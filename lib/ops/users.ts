import "server-only";

import { type PoolClient } from "pg";
import { getPool, query } from "@/lib/db/postgres";
import { normalizeOpsEmail } from "@/lib/ops/email";
import { hashPassword } from "@/lib/ops/password";
import {
  normalizePermissionKeys,
  OPS_PERMISSIONS,
  type OpsPermission,
  type OpsRole,
} from "@/lib/ops/permissions";
import {
  evaluateOpsUserCreate,
  evaluateOpsUserUpdate,
} from "@/lib/ops/user-mutation-policy";

export type OpsUserListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: OpsRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type OpsUserDetail = OpsUserListItem & {
  permissions: OpsPermission[];
};

type UserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: OpsRole;
  is_active: boolean;
  last_login_at: Date | null;
  created_at: Date;
};

type CountRow = { count: string };

function mapUser(row: UserRow): OpsUserListItem {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    isActive: row.is_active,
    lastLoginAt: row.last_login_at ? row.last_login_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listOpsUsers(input: {
  query: string;
  role: string;
  status: string;
  page: number;
  pageSize: number;
}) {
  const filters: string[] = ["TRUE"];
  const values: unknown[] = [];
  const q = input.query.trim();
  if (q) {
    values.push(`%${q}%`);
    filters.push(
      `(first_name ILIKE $${values.length} OR last_name ILIKE $${values.length} OR email ILIKE $${values.length})`,
    );
  }
  if (input.role === "owner" || input.role === "employee") {
    values.push(input.role);
    filters.push(`role = $${values.length}`);
  }
  if (input.status === "active") {
    filters.push("is_active = TRUE");
  } else if (input.status === "inactive") {
    filters.push("is_active = FALSE");
  }
  const where = filters.join(" AND ");
  const count = await query<CountRow>(
    `SELECT COUNT(*)::text AS count FROM ops_users WHERE ${where}`,
    values,
  );
  const total = Number(count.rows[0]?.count ?? 0);
  const offset = (input.page - 1) * input.pageSize;
  values.push(input.pageSize, offset);
  const result = await query<UserRow>(
    `SELECT id, first_name, last_name, email, role, is_active, last_login_at, created_at
     FROM ops_users
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );
  return { items: result.rows.map(mapUser), total };
}

export async function getOpsUser(id: string): Promise<OpsUserDetail | null> {
  const result = await query<UserRow>(
    `SELECT id, first_name, last_name, email, role, is_active, last_login_at, created_at
     FROM ops_users
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const grants = await query<{ permission_key: string }>(
    `SELECT permission_key FROM ops_user_permissions WHERE user_id = $1`,
    [id],
  );
  return {
    ...mapUser(row),
    permissions: normalizePermissionKeys(grants.rows.map((item) => item.permission_key)),
  };
}

export async function emailTaken(email: string, excludeId?: string) {
  const normalized = normalizeOpsEmail(email);
  const result = excludeId
    ? await query<{ id: string }>(
        `SELECT id FROM ops_users WHERE lower(email) = $1 AND id <> $2 LIMIT 1`,
        [normalized, excludeId],
      )
    : await query<{ id: string }>(
        `SELECT id FROM ops_users WHERE lower(email) = $1 LIMIT 1`,
        [normalized],
      );
  return Boolean(result.rows[0]);
}

async function replacePermissions(
  client: PoolClient,
  userId: string,
  role: OpsRole,
  keys: OpsPermission[],
) {
  await client.query(`DELETE FROM ops_user_permissions WHERE user_id = $1`, [
    userId,
  ]);
  const granted = role === "owner" ? [...OPS_PERMISSIONS] : keys;
  for (const key of granted) {
    await client.query(
      `INSERT INTO ops_user_permissions (user_id, permission_key)
       VALUES ($1, $2)`,
      [userId, key],
    );
  }
}

async function mutationActor(client: PoolClient, actorId: string) {
  const result = await client.query<{
    id: string;
    role: OpsRole;
    is_active: boolean;
    can_manage_users: boolean;
  }>(
    `SELECT u.id, u.role, u.is_active,
            (
              u.role = 'owner'
              OR EXISTS (
                SELECT 1
                FROM ops_user_permissions p
                WHERE p.user_id = u.id
                  AND p.permission_key = 'users.manage'
              )
            ) AS can_manage_users
     FROM ops_users u
     WHERE u.id = $1
     FOR UPDATE`,
    [actorId],
  );
  const actor = result.rows[0];
  return actor?.is_active
    ? {
        id: actor.id,
        role: actor.role,
        canManageUsers: actor.can_manage_users,
      }
    : null;
}

async function emailTakenInTransaction(
  client: PoolClient,
  email: string,
  excludeId?: string,
) {
  const normalized = normalizeOpsEmail(email);
  const result = excludeId
    ? await client.query<{ id: string }>(
        `SELECT id FROM ops_users WHERE lower(email) = $1 AND id <> $2 LIMIT 1`,
        [normalized, excludeId],
      )
    : await client.query<{ id: string }>(
        `SELECT id FROM ops_users WHERE lower(email) = $1 LIMIT 1`,
        [normalized],
      );
  return Boolean(result.rows[0]);
}

export async function createOpsEmployee(input: {
  actorId: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: OpsRole;
  isActive: boolean;
  permissions: OpsPermission[];
}) {
  const passwordHash = await hashPassword(input.password);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('tripetica:ops-user-mutation'))`,
    );
    const actor = await mutationActor(client, input.actorId);
    if (!actor) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "forbidden" as const };
    }
    const decision = evaluateOpsUserCreate(actor, input.role);
    if (!decision.allowed) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: decision.reason };
    }
    if (await emailTakenInTransaction(client, input.email)) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "email" as const };
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO ops_users (first_name, last_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.firstName.trim(),
        input.lastName.trim(),
        normalizeOpsEmail(input.email),
        passwordHash,
        input.role,
        input.isActive,
      ],
    );
    const id = inserted.rows[0]?.id;
    if (!id) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "failed" as const };
    }
    await replacePermissions(client, id, input.role, input.permissions);
    await client.query("COMMIT");
    return { ok: true as const, id };
  } catch {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    return { ok: false as const, reason: "failed" as const };
  } finally {
    client.release();
  }
}

export async function updateOpsUser(
  id: string,
  input: {
    actorId: string;
    firstName: string;
    lastName: string;
    email: string;
    password?: string;
    role: OpsRole;
    isActive: boolean;
    permissions: OpsPermission[];
  },
) {
  const passwordHash = input.password
    ? await hashPassword(input.password)
    : null;
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('tripetica:ops-user-mutation'))`,
    );
    const actor = await mutationActor(client, input.actorId);
    if (!actor) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "forbidden" as const };
    }
    const targetResult = await client.query<{
      id: string;
      role: OpsRole;
      is_active: boolean;
    }>(
      `SELECT id, role, is_active
       FROM ops_users
       WHERE id = $1
       FOR UPDATE`,
      [id],
    );
    const target = targetResult.rows[0];
    if (!target) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "missing" as const };
    }
    const ownerCount = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM ops_users
       WHERE role = 'owner'
         AND is_active = TRUE
         AND id <> $1`,
      [id],
    );
    const decision = evaluateOpsUserUpdate({
      actor,
      target: {
        id: target.id,
        role: target.role,
        isActive: target.is_active,
      },
      nextRole: input.role,
      nextIsActive: input.isActive,
      activeOwnersExcludingTarget: Number(ownerCount.rows[0]?.count ?? 0),
    });
    if (!decision.allowed) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: decision.reason };
    }
    if (await emailTakenInTransaction(client, input.email, id)) {
      await client.query("ROLLBACK");
      return { ok: false as const, reason: "email" as const };
    }
    await client.query(
      `UPDATE ops_users
       SET first_name = $2,
           last_name = $3,
           email = $4,
           role = $5,
           is_active = $6,
           password_hash = COALESCE($7, password_hash)
       WHERE id = $1`,
      [
        id,
        input.firstName.trim(),
        input.lastName.trim(),
        normalizeOpsEmail(input.email),
        input.role,
        input.isActive,
        passwordHash,
      ],
    );
    await replacePermissions(client, id, input.role, input.permissions);
    if (passwordHash || !input.isActive) {
      await client.query(`DELETE FROM ops_sessions WHERE user_id = $1`, [id]);
    }
    await client.query("COMMIT");
    return { ok: true as const };
  } catch {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    return { ok: false as const, reason: "failed" as const };
  } finally {
    client.release();
  }
}

export async function countActiveOwners(excludeUserId?: string) {
  const result = await query<{ count: string }>(
    excludeUserId
      ? `SELECT COUNT(*)::text AS count
         FROM ops_users
         WHERE role = 'owner' AND is_active = TRUE AND id <> $1`
      : `SELECT COUNT(*)::text AS count
         FROM ops_users
         WHERE role = 'owner' AND is_active = TRUE`,
    excludeUserId ? [excludeUserId] : [],
  );
  return Number(result.rows[0]?.count ?? 0);
}

export async function createOwnerAccount(input: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) {
  const email = normalizeOpsEmail(input.email);
  const passwordHash = await hashPassword(input.password);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext('tripetica:ops-user-mutation'))`,
    );
    if (await emailTakenInTransaction(client, email)) {
      await client.query("ROLLBACK");
      throw new Error("An operations user with this email already exists.");
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO ops_users (first_name, last_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, 'owner', TRUE)
       RETURNING id`,
      [input.firstName.trim(), input.lastName.trim(), email, passwordHash],
    );
    const id = inserted.rows[0]?.id;
    if (!id) {
      await client.query("ROLLBACK");
      throw new Error("Could not create owner.");
    }
    await replacePermissions(client, id, "owner", [...OPS_PERMISSIONS]);
    await client.query("COMMIT");
    return id;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ignore rollback failure
    }
    throw error;
  } finally {
    client.release();
  }
}
