import "server-only";

import { query } from "@/lib/db/postgres";
import { isValidOpsEmail, normalizeOpsEmail } from "@/lib/ops/email";
import { hashPassword, verifyPassword } from "@/lib/ops/password";
import { deleteOpsSessionsForUser } from "@/lib/ops/session";
import { emailTaken } from "@/lib/ops/users";
import {
  isPasswordLengthValid,
  passwordsMatch,
} from "@/lib/security/password-policy";

const NAME_MAX_LENGTH = 80;

export type OpsAccountProfileError =
  | "invalid-name"
  | "invalid-email"
  | "email-taken"
  | "failed";

export type OpsAccountPasswordError =
  | "short"
  | "mismatch"
  | "current-invalid"
  | "failed";

function trimName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export async function updateOpsSelfProfile(input: {
  actorId: string;
  firstName: string;
  lastName: string;
  email: string;
}): Promise<{ ok: true } | { ok: false; error: OpsAccountProfileError }> {
  const firstName = trimName(input.firstName);
  const lastName = trimName(input.lastName);
  if (
    !firstName ||
    !lastName ||
    firstName.length > NAME_MAX_LENGTH ||
    lastName.length > NAME_MAX_LENGTH
  ) {
    return { ok: false, error: "invalid-name" };
  }
  const email = normalizeOpsEmail(input.email);
  if (!isValidOpsEmail(email)) {
    return { ok: false, error: "invalid-email" };
  }
  if (await emailTaken(email, input.actorId)) {
    return { ok: false, error: "email-taken" };
  }
  const updated = await query(
    `UPDATE ops_users
     SET first_name = $2,
         last_name = $3,
         email = $4
     WHERE id = $1
       AND is_active = TRUE`,
    [input.actorId, firstName, lastName, email],
  );
  if (updated.rowCount !== 1) {
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}

export async function changeOpsSelfPassword(input: {
  actorId: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<{ ok: true } | { ok: false; error: OpsAccountPasswordError }> {
  if (!passwordsMatch(input.newPassword, input.confirmPassword)) {
    return { ok: false, error: "mismatch" };
  }
  if (!isPasswordLengthValid(input.newPassword)) {
    return { ok: false, error: "short" };
  }

  const result = await query<{ password_hash: string }>(
    `SELECT password_hash
     FROM ops_users
     WHERE id = $1
       AND is_active = TRUE
     LIMIT 1`,
    [input.actorId],
  );
  const stored = result.rows[0]?.password_hash;
  if (!stored) {
    return { ok: false, error: "failed" };
  }
  if (
    !input.currentPassword ||
    !(await verifyPassword(input.currentPassword, stored))
  ) {
    return { ok: false, error: "current-invalid" };
  }

  const nextHash = await hashPassword(input.newPassword);
  const updated = await query(
    `UPDATE ops_users
     SET password_hash = $1
     WHERE id = $2
       AND is_active = TRUE`,
    [nextHash, input.actorId],
  );
  if (updated.rowCount !== 1) {
    return { ok: false, error: "failed" };
  }
  await deleteOpsSessionsForUser(input.actorId);
  return { ok: true };
}
