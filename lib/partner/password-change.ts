import "server-only";

import { query } from "@/lib/db/postgres";
import {
  isPartnerPasswordLengthValid,
  partnerPasswordsMatch,
} from "@/lib/partner/policy";
import {
  deletePartnerSessionsForUser,
  type PartnerActor,
} from "@/lib/partner/session";
import { hashPassword, verifyPassword } from "@/lib/security/password";

export type PartnerPasswordChangeError =
  | "short"
  | "mismatch"
  | "same-as-old"
  | "current-invalid"
  | "failed";

type PasswordRow = {
  password_hash: string;
};

export async function changePartnerPassword(input: {
  actor: PartnerActor;
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
  requireCurrent: boolean;
}): Promise<{ ok: true } | { ok: false; error: PartnerPasswordChangeError }> {
  if (!partnerPasswordsMatch(input.newPassword, input.confirmPassword)) {
    return { ok: false, error: "mismatch" };
  }
  if (!isPartnerPasswordLengthValid(input.newPassword)) {
    return { ok: false, error: "short" };
  }

  const result = await query<PasswordRow>(
    `SELECT password_hash
     FROM partner_users
     WHERE id = $1
     LIMIT 1`,
    [input.actor.userId],
  );
  const stored = result.rows[0]?.password_hash;
  if (!stored) {
    return { ok: false, error: "failed" };
  }

  if (input.requireCurrent) {
    const current = input.currentPassword ?? "";
    if (!current || !(await verifyPassword(current, stored))) {
      return { ok: false, error: "current-invalid" };
    }
  }

  if (await verifyPassword(input.newPassword, stored)) {
    return { ok: false, error: "same-as-old" };
  }

  const nextHash = await hashPassword(input.newPassword);
  const updated = await query(
    `UPDATE partner_users
     SET password_hash = $1,
         must_change_password = FALSE
     WHERE id = $2`,
    [nextHash, input.actor.userId],
  );
  if (updated.rowCount !== 1) {
    return { ok: false, error: "failed" };
  }
  await deletePartnerSessionsForUser(input.actor.userId);
  return { ok: true };
}
