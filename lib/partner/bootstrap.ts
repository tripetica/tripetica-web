import "server-only";

import { type PoolClient } from "pg";
import { query } from "@/lib/db/postgres";
import {
  DEV_PRIMARY_PARTNER_NAME,
  DEV_PRIMARY_PARTNER_USER_EMAIL,
  PARTNER_MIN_PASSWORD_LENGTH,
} from "@/lib/partner/constants";
import { normalizePartnerEmail } from "@/lib/partner/email";
import { formatPartnerCode } from "@/lib/partner/partner-code";
import { isPartnerPasswordLengthValid } from "@/lib/partner/policy";
import { hashPassword } from "@/lib/security/password";

type PartnerRow = {
  id: string;
  partner_code: string;
  name: string;
  is_primary_partner: boolean;
};

type PartnerUserRow = {
  id: string;
  email: string;
  partner_id: string;
};

type PartnerQueryClient = Pick<PoolClient, "query">;

export async function allocatePartnerCode(client?: PartnerQueryClient) {
  const exec = client ?? { query };
  const result = await exec.query<{ last_seq: number }>(
    `UPDATE partner_code_seq
     SET last_seq = last_seq + 1
     WHERE id = TRUE
     RETURNING last_seq`,
  );
  const seq = result.rows[0]?.last_seq;
  if (!seq) {
    throw new Error("Partner code sequence is not initialized");
  }
  return formatPartnerCode(seq);
}

export async function ensurePrimaryPartner() {
  const existing = await query<PartnerRow>(
    `SELECT id, partner_code, name, is_primary_partner
     FROM partners
     WHERE is_primary_partner = TRUE
     LIMIT 1`,
  );
  if (existing.rows[0]) {
    return { partner: existing.rows[0], created: false };
  }
  const partnerCode = await allocatePartnerCode();
  const inserted = await query<PartnerRow>(
    `INSERT INTO partners (partner_code, name, status, is_primary_partner)
     VALUES ($1, $2, 'active', TRUE)
     RETURNING id, partner_code, name, is_primary_partner`,
    [partnerCode, DEV_PRIMARY_PARTNER_NAME],
  );
  const partner = inserted.rows[0];
  if (!partner) {
    throw new Error("Primary partner could not be created");
  }
  return { partner, created: true };
}

export async function createOrResetPrimaryPartnerUser(password: string) {
  if (!isPartnerPasswordLengthValid(password)) {
    throw new Error(
      `Password must be at least ${PARTNER_MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  const { partner, created: partnerCreated } = await ensurePrimaryPartner();
  const email = normalizePartnerEmail(DEV_PRIMARY_PARTNER_USER_EMAIL);
  const passwordHash = await hashPassword(password);
  const existing = await query<PartnerUserRow>(
    `SELECT id, email, partner_id
     FROM partner_users
     WHERE lower(email) = $1
     LIMIT 1`,
    [email],
  );
  if (existing.rows[0]) {
    if (existing.rows[0].partner_id !== partner.id) {
      throw new Error("Primary partner user is already linked to another partner");
    }
    await query(
      `UPDATE partner_users
       SET password_hash = $1,
           role = 'admin',
           status = 'active',
           must_change_password = TRUE
       WHERE id = $2`,
      [passwordHash, existing.rows[0].id],
    );
    await query(`DELETE FROM partner_sessions WHERE user_id = $1`, [
      existing.rows[0].id,
    ]);
    return {
      partner,
      partnerCreated,
      user: existing.rows[0],
      userCreated: false,
      passwordReset: true,
    };
  }
  const inserted = await query<PartnerUserRow>(
    `INSERT INTO partner_users (
        partner_id,
        email,
        password_hash,
        role,
        status,
        must_change_password
     )
     VALUES ($1, $2, $3, 'admin', 'active', TRUE)
     RETURNING id, email, partner_id`,
    [partner.id, email, passwordHash],
  );
  const user = inserted.rows[0];
  if (!user) {
    throw new Error("Primary partner user could not be created");
  }
  return {
    partner,
    partnerCreated,
    user,
    userCreated: true,
    passwordReset: false,
  };
}

export async function setPartnerUserPasswordByEmail(emailRaw: string, password: string) {
  if (!isPartnerPasswordLengthValid(password)) {
    throw new Error(
      `Password must be at least ${PARTNER_MIN_PASSWORD_LENGTH} characters.`,
    );
  }
  const email = normalizePartnerEmail(emailRaw);
  const passwordHash = await hashPassword(password);
  const updated = await query<PartnerUserRow>(
    `UPDATE partner_users
     SET password_hash = $1,
         must_change_password = TRUE
     WHERE lower(email) = $2
     RETURNING id, email, partner_id`,
    [passwordHash, email],
  );
  const user = updated.rows[0];
  if (!user) {
    throw new Error("Partner user not found");
  }
  await query(`DELETE FROM partner_sessions WHERE user_id = $1`, [user.id]);
  return user;
}
