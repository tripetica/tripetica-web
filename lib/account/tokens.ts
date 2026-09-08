import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { query } from "@/lib/db/postgres";

export type AccountTokenPurpose =
  | "email_verify"
  | "email_change"
  | "password_reset";

export function createAuthToken() {
  return randomBytes(32).toString("base64url");
}

export function hashAuthToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function invalidateOpenTokens(
  userId: string,
  purpose: AccountTokenPurpose,
) {
  await query(
    `UPDATE customer_auth_tokens
     SET used_at = NOW()
     WHERE user_id = $1
       AND purpose = $2
       AND used_at IS NULL`,
    [userId, purpose],
  );
}

export async function createAuthTokenRecord(input: {
  userId: string;
  purpose: AccountTokenPurpose;
  expiresAt: Date;
  emailTarget?: string | null;
}) {
  await invalidateOpenTokens(input.userId, input.purpose);
  const token = createAuthToken();
  const tokenHash = hashAuthToken(token);
  await query(
    `INSERT INTO customer_auth_tokens (user_id, purpose, token_hash, email_target, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.userId,
      input.purpose,
      tokenHash,
      input.emailTarget ?? null,
      input.expiresAt,
    ],
  );
  return token;
}

export type AuthTokenRow = {
  id: string;
  user_id: string;
  purpose: AccountTokenPurpose;
  email_target: string | null;
  expires_at: Date;
  used_at: Date | null;
};

export async function findAuthToken(
  token: string,
  purpose: AccountTokenPurpose,
): Promise<AuthTokenRow | null> {
  const result = await query<AuthTokenRow>(
    `SELECT id, user_id, purpose, email_target, expires_at, used_at
     FROM customer_auth_tokens
     WHERE token_hash = $1
       AND purpose = $2
     LIMIT 1`,
    [hashAuthToken(token), purpose],
  );
  return result.rows[0] ?? null;
}

export async function markAuthTokenUsed(id: string) {
  await query(
    `UPDATE customer_auth_tokens
     SET used_at = NOW()
     WHERE id = $1
       AND used_at IS NULL`,
    [id],
  );
}
