import "server-only";

import { randomBytes } from "node:crypto";
import { query } from "@/lib/db/postgres";
import { normalizeOpsEmail } from "@/lib/ops/email";
import { OPS_PERMISSIONS } from "@/lib/ops/permissions";
import { createOwnerAccount } from "@/lib/ops/users";
import { hashPassword } from "@/lib/ops/password";

export const DEV_OPS_OWNER_FIRST_NAME = "RECEP";
export const DEV_OPS_OWNER_LAST_NAME = "YILDIRIM";
export const DEV_OPS_OWNER_EMAIL = "recepyildirim19@gmail.com";

export async function ensureDevOpsOwner() {
  const email = normalizeOpsEmail(DEV_OPS_OWNER_EMAIL);
  const existing = await query<{ id: string }>(
    `SELECT id FROM ops_users WHERE lower(email) = $1 LIMIT 1`,
    [email],
  );
  if (existing.rows[0]) {
    const id = existing.rows[0].id;
    await query(
      `UPDATE ops_users
       SET first_name = $2,
           last_name = $3,
           role = 'owner',
           is_active = TRUE
       WHERE id = $1`,
      [id, DEV_OPS_OWNER_FIRST_NAME, DEV_OPS_OWNER_LAST_NAME],
    );
    await query(`DELETE FROM ops_user_permissions WHERE user_id = $1`, [id]);
    for (const permission of OPS_PERMISSIONS) {
      await query(
        `INSERT INTO ops_user_permissions (user_id, permission_key) VALUES ($1, $2)`,
        [id, permission],
      );
    }
    return { id, created: false };
  }
  const bootstrapPassword = randomBytes(24).toString("base64url");
  const id = await createOwnerAccount({
    firstName: DEV_OPS_OWNER_FIRST_NAME,
    lastName: DEV_OPS_OWNER_LAST_NAME,
    email,
    password: bootstrapPassword,
  });
  return { id, created: true };
}

export async function setOpsUserPasswordByEmail(emailRaw: string, password: string) {
  const email = normalizeOpsEmail(emailRaw);
  const passwordHash = await hashPassword(password);
  const updated = await query<{ id: string; email: string }>(
    `UPDATE ops_users
     SET password_hash = $1
     WHERE lower(email) = $2
     RETURNING id, email`,
    [passwordHash, email],
  );
  const user = updated.rows[0];
  if (!user) {
    throw new Error("Operations user not found");
  }
  await query(`DELETE FROM ops_sessions WHERE user_id = $1`, [user.id]);
  return user;
}
