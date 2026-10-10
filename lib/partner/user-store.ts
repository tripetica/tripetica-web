import "server-only";

import { query } from "@/lib/db/postgres";
import { isPartnerTab, PARTNER_TABS, type PartnerTab } from "@/lib/partner/access";
import { normalizePartnerEmail } from "@/lib/partner/email";
import { hashPassword } from "@/lib/security/password";
import { isPasswordLengthValid, passwordsMatch } from "@/lib/security/password-policy";

export type PartnerExtraUser = {
  id: string;
  email: string;
  status: "active" | "inactive";
  tabs: PartnerTab[];
};

export async function listPartnerExtraUsers(partnerId: string): Promise<PartnerExtraUser[]> {
  const result = await query<{ id: string; email: string; status: "active" | "inactive"; tabs: string[] | null }>(
    `SELECT u.id, u.email, u.status,
            COALESCE((SELECT array_agg(g.tab) FROM partner_user_grants g WHERE g.user_id = u.id), '{}') AS tabs
       FROM partner_users u
      WHERE u.partner_id = $1 AND u.is_owner = FALSE
      ORDER BY u.created_at`,
    [partnerId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    email: row.email,
    status: row.status,
    tabs: (row.tabs ?? []).filter(isPartnerTab),
  }));
}

export async function createPartnerExtraUser(input: {
  partnerId: string;
  email: string;
  password: string;
  passwordAgain: string;
  tabs: readonly string[];
}) {
  const email = normalizePartnerEmail(input.email);
  const tabs = input.tabs.filter(isPartnerTab);
  if (!passwordsMatch(input.password, input.passwordAgain)) {
    return { ok: false as const, error: "mismatch" as const };
  }
  if (!email.includes("@") || !isPasswordLengthValid(input.password)) {
    return { ok: false as const, error: "invalid" as const };
  }
  const passwordHash = await hashPassword(input.password);
  try {
    const inserted = await query<{ id: string }>(
      `INSERT INTO partner_users (partner_id, email, password_hash, role, status, must_change_password, is_owner)
       VALUES ($1, $2, $3, 'admin', 'active', FALSE, FALSE)
       RETURNING id`,
      [input.partnerId, email, passwordHash],
    );
    const userId = inserted.rows[0]?.id;
    if (!userId) return { ok: false as const, error: "failed" as const };
    for (const tab of tabs) {
      await query(
        `INSERT INTO partner_user_grants (user_id, tab) VALUES ($1, $2)`,
        [userId, tab],
      );
    }
    return { ok: true as const };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return { ok: false as const, error: "duplicate" as const };
    }
    throw error;
  }
}

export async function replacePartnerExtraUserTabs(input: {
  partnerId: string;
  userId: string;
  tabs: readonly string[];
}) {
  const tabs = input.tabs.filter(isPartnerTab);
  const owned = await query<{ id: string }>(
    `SELECT id FROM partner_users WHERE id = $1 AND partner_id = $2 AND is_owner = FALSE`,
    [input.userId, input.partnerId],
  );
  if (!owned.rows[0]) return { ok: false as const, error: "not-found" as const };
  await query(`DELETE FROM partner_user_grants WHERE user_id = $1`, [input.userId]);
  for (const tab of tabs) {
    await query(`INSERT INTO partner_user_grants (user_id, tab) VALUES ($1, $2)`, [input.userId, tab]);
  }
  return { ok: true as const };
}

export async function setPartnerExtraUserStatus(input: {
  partnerId: string;
  userId: string;
  status: "active" | "inactive";
}) {
  const updated = await query<{ id: string }>(
    `UPDATE partner_users
        SET status = $3
      WHERE id = $1 AND partner_id = $2 AND is_owner = FALSE
      RETURNING id`,
    [input.userId, input.partnerId, input.status],
  );
  if (!updated.rows[0]) return { ok: false as const, error: "not-found" as const };
  if (input.status === "inactive") {
    await query(`DELETE FROM partner_sessions WHERE user_id = $1`, [input.userId]);
  }
  return { ok: true as const };
}

export async function deletePartnerExtraUser(partnerId: string, userId: string) {
  const deleted = await query<{ id: string }>(
    `DELETE FROM partner_users WHERE id = $1 AND partner_id = $2 AND is_owner = FALSE RETURNING id`,
    [userId, partnerId],
  );
  return deleted.rows[0] ? { ok: true as const } : { ok: false as const, error: "not-found" as const };
}

export const partnerUserTabChoices = PARTNER_TABS;
