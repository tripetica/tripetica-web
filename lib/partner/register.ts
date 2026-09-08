import "server-only";

import { getPool } from "@/lib/db/postgres";
import { normalizePartnerEmail } from "@/lib/partner/email";
import { parsePartnerApplicationInput } from "@/lib/partner/application-fields";
import { allocatePartnerCode } from "@/lib/partner/bootstrap";
import { consumeVerifiedPartnerEmailChallenge } from "@/lib/partner/email-verification";
import { hashPassword } from "@/lib/security/password";

export type CreatePartnerApplicationDeps = {
  consumeVerified?: typeof consumeVerifiedPartnerEmailChallenge;
};

export async function createPartnerApplication(input: {
  email: string;
  phoneCountryCode: string;
  phoneNational: string;
  contactFirstName: string;
  contactLastName: string;
  businessType: string;
  name: string;
  addressLine: string;
  countryCode: string;
  taxOffice: string;
  taxNumber: string;
  password: string;
  confirmPassword: string;
}, deps: CreatePartnerApplicationDeps = {}): Promise<
  | { ok: true; partnerId: string; partnerCode: string }
  | { ok: false; error: "duplicate" | "unverified-email" | NonNullable<Extract<ReturnType<typeof parsePartnerApplicationInput>, { ok: false }>["error"]> }
> {
  const parsed = parsePartnerApplicationInput({
    ...input,
    lockCountryToDefault: true,
    strictRegisterTaxId: true,
  });
  if (!parsed.ok) {
    return parsed;
  }

  const email = normalizePartnerEmail(parsed.value.email);
  const passwordHash = await hashPassword(parsed.value.password);
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ id: string }>(
      `SELECT id
       FROM partner_users
       WHERE lower(email) = $1
         AND status IN ('pending', 'active')
       LIMIT 1`,
      [email],
    );
    if (existing.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "duplicate" };
    }

    const consume = deps.consumeVerified ?? consumeVerifiedPartnerEmailChallenge;
    const verified = await consume({
      email,
      purpose: "register",
    });
    if (!verified.ok) {
      await client.query("ROLLBACK");
      return { ok: false, error: "unverified-email" };
    }

    const partnerCode = await allocatePartnerCode(client);
    const partner = await client.query<{ id: string; partner_code: string }>(
      `INSERT INTO partners (
          partner_code,
          name,
          status,
          is_primary_partner,
          business_type,
          address_line,
          country_code,
          tax_office,
          tax_number,
          contact_first_name,
          contact_last_name,
          phone,
          phone_country_code,
          applied_at
       )
       VALUES (
          $1, $2, 'pending', FALSE,
          $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW()
       )
       RETURNING id, partner_code`,
      [
        partnerCode,
        parsed.value.name,
        parsed.value.businessType,
        parsed.value.addressLine,
        parsed.value.countryCode,
        parsed.value.taxOffice,
        parsed.value.taxNumber,
        parsed.value.contactFirstName,
        parsed.value.contactLastName,
        parsed.value.phone,
        parsed.value.phoneCountryCode,
      ],
    );
    const created = partner.rows[0];
    if (!created) {
      throw new Error("Partner application could not be created");
    }
    await client.query(
      `INSERT INTO partner_users (
          partner_id,
          email,
          password_hash,
          role,
          status,
          must_change_password
       )
       VALUES ($1, $2, $3, 'admin', 'pending', FALSE)`,
      [created.id, email, passwordHash],
    );
    await client.query("COMMIT");
    return {
      ok: true,
      partnerId: created.id,
      partnerCode: created.partner_code,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "23505"
    ) {
      return { ok: false, error: "duplicate" };
    }
    throw error;
  } finally {
    client.release();
  }
}
