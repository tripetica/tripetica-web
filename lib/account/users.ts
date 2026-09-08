import "server-only";

import { query } from "@/lib/db/postgres";

export type CustomerUserRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  phone_country_code: string | null;
  nationality_code: string | null;
  password_hash: string;
  email_verified_at: Date | null;
  pending_email: string | null;
  is_active: boolean;
};

export async function findCustomerByEmail(email: string) {
  const result = await query<CustomerUserRow>(
    `SELECT id, first_name, last_name, email, phone, phone_country_code, nationality_code,
            password_hash, email_verified_at, pending_email, is_active
     FROM customer_users
     WHERE lower(email) = $1
     LIMIT 1`,
    [email],
  );
  return result.rows[0] ?? null;
}

export async function findCustomerById(id: string) {
  const result = await query<CustomerUserRow>(
    `SELECT id, first_name, last_name, email, phone, phone_country_code, nationality_code,
            password_hash, email_verified_at, pending_email, is_active
     FROM customer_users
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function insertCustomerUser(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  phoneCountryCode: string | null;
  nationalityCode: string | null;
  passwordHash: string;
}) {
  const result = await query<{ id: string }>(
    `INSERT INTO customer_users (
       first_name, last_name, email, phone, phone_country_code, nationality_code, password_hash
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [
      input.firstName,
      input.lastName,
      input.email,
      input.phone,
      input.phoneCountryCode,
      input.nationalityCode,
      input.passwordHash,
    ],
  );
  return result.rows[0]!.id;
}

export async function deleteUnverifiedCustomerUser(userId: string) {
  await query(
    `DELETE FROM customer_users
     WHERE id = $1
       AND email_verified_at IS NULL`,
    [userId],
  );
}

export async function markCustomerEmailVerified(userId: string) {
  await query(
    `UPDATE customer_users
     SET email_verified_at = COALESCE(email_verified_at, NOW()),
         pending_email = NULL,
         pending_email_requested_at = NULL
     WHERE id = $1`,
    [userId],
  );
}

export async function claimLegacyReservationsByVerifiedEmail(
  userId: string,
  email: string,
) {
  await query(
    `UPDATE reservations
     SET customer_user_id = $1
     WHERE customer_user_id IS NULL
       AND customer_email IS NOT NULL
       AND lower(customer_email) = lower($2)
       AND EXISTS (
         SELECT 1
         FROM customer_users
         WHERE id = $1
           AND is_active = TRUE
           AND email_verified_at IS NOT NULL
           AND lower(email) = lower($2)
       )`,
    [userId, email],
  );
}

export async function applyPendingEmailChange(userId: string, newEmail: string) {
  await query(
    `UPDATE customer_users
     SET email = $2,
         email_verified_at = NOW(),
         pending_email = NULL,
         pending_email_requested_at = NULL
     WHERE id = $1`,
    [userId, newEmail],
  );
}

export async function setPendingEmail(userId: string, pendingEmail: string) {
  await query(
    `UPDATE customer_users
     SET pending_email = $2,
         pending_email_requested_at = NOW()
     WHERE id = $1`,
    [userId, pendingEmail],
  );
}

export async function updateCustomerProfile(input: {
  userId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  phoneCountryCode: string | null;
  nationalityCode: string | null;
}) {
  await query(
    `UPDATE customer_users
     SET first_name = $2,
         last_name = $3,
         phone = $4,
         phone_country_code = $5,
         nationality_code = $6
     WHERE id = $1`,
    [
      input.userId,
      input.firstName,
      input.lastName,
      input.phone,
      input.phoneCountryCode,
      input.nationalityCode,
    ],
  );
}

export async function updateCustomerPassword(userId: string, passwordHash: string) {
  await query(`UPDATE customer_users SET password_hash = $2 WHERE id = $1`, [
    userId,
    passwordHash,
  ]);
}

export async function touchCustomerLogin(userId: string) {
  await query(`UPDATE customer_users SET last_login_at = NOW() WHERE id = $1`, [
    userId,
  ]);
}
