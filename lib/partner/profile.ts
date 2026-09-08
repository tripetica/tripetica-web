import "server-only";

import { query } from "@/lib/db/postgres";
import {
  normalizePartnerAddress,
  normalizePartnerPersonName,
  normalizePartnerTaxOffice,
} from "@/lib/partner/application-fields";
import {
  PARTNER_ADDRESS_MAX_LENGTH,
  PARTNER_CONTACT_NAME_MAX_LENGTH,
  PARTNER_TAX_OFFICE_MAX_LENGTH,
  type PartnerBusinessType,
  type PartnerStatus,
} from "@/lib/partner/constants";
import { normalizePartnerEmail } from "@/lib/partner/email";
import { phoneValidity, toE164 } from "@/lib/booking/phone";
import { normalizeIso2 } from "@/lib/geo/countries";

export type PartnerSelfProfile = {
  partnerCode: string;
  name: string;
  status: PartnerStatus;
  businessType: PartnerBusinessType | null;
  addressLine: string | null;
  countryCode: string | null;
  taxOffice: string | null;
  taxNumber: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  email: string;
  phone: string | null;
  phoneCountryCode: string | null;
};

type ProfileRow = {
  partner_code: string;
  name: string;
  status: PartnerStatus;
  business_type: PartnerBusinessType | null;
  address_line: string | null;
  country_code: string | null;
  tax_office: string | null;
  tax_number: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  email: string;
  phone: string | null;
  phone_country_code: string | null;
};

export async function getPartnerSelfProfile(
  partnerId: string,
): Promise<PartnerSelfProfile | null> {
  const result = await query<ProfileRow>(
    `SELECT
        p.partner_code,
        p.name,
        p.status,
        p.business_type,
        p.address_line,
        p.country_code,
        p.tax_office,
        p.tax_number,
        p.contact_first_name,
        p.contact_last_name,
        p.phone,
        p.phone_country_code,
        u.email
     FROM partners p
     JOIN partner_users u ON u.partner_id = p.id
     WHERE p.id = $1
       AND p.deleted_at IS NULL
     ORDER BY u.created_at ASC
     LIMIT 1`,
    [partnerId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    partnerCode: row.partner_code,
    name: row.name,
    status: row.status,
    businessType: row.business_type,
    addressLine: row.address_line,
    countryCode: row.country_code,
    taxOffice: row.tax_office,
    taxNumber: row.tax_number,
    contactFirstName: row.contact_first_name,
    contactLastName: row.contact_last_name,
    email: row.email,
    phone: row.phone,
    phoneCountryCode: row.phone_country_code,
  };
}

export async function updatePartnerSelfProfile(input: {
  partnerId: string;
  contactFirstName: string;
  contactLastName: string;
  phoneCountryCode: string;
  phoneNational: string;
  addressLine: string;
  taxOffice: string;
}): Promise<
  | { ok: true }
  | {
      ok: false;
      error:
        | "not-found"
        | "invalid-contact"
        | "invalid-phone"
        | "invalid-address"
        | "invalid-tax-office"
        | "failed";
    }
> {
  const current = await getPartnerSelfProfile(input.partnerId);
  if (!current) {
    return { ok: false, error: "not-found" };
  }
  const contactFirstName = normalizePartnerPersonName(input.contactFirstName);
  const contactLastName = normalizePartnerPersonName(input.contactLastName);
  const addressLine = normalizePartnerAddress(input.addressLine);
  const taxOffice = normalizePartnerTaxOffice(input.taxOffice);
  const phoneCountryCode = normalizeIso2(input.phoneCountryCode);
  if (
    !contactFirstName ||
    contactFirstName.length > PARTNER_CONTACT_NAME_MAX_LENGTH ||
    !contactLastName ||
    contactLastName.length > PARTNER_CONTACT_NAME_MAX_LENGTH
  ) {
    return { ok: false, error: "invalid-contact" };
  }
  if (!phoneCountryCode || phoneValidity(phoneCountryCode, input.phoneNational) !== "valid") {
    return { ok: false, error: "invalid-phone" };
  }
  const phone = toE164(phoneCountryCode, input.phoneNational);
  if (!phone) {
    return { ok: false, error: "invalid-phone" };
  }
  if (!addressLine || addressLine.length > PARTNER_ADDRESS_MAX_LENGTH) {
    return { ok: false, error: "invalid-address" };
  }
  if (!taxOffice || taxOffice.length > PARTNER_TAX_OFFICE_MAX_LENGTH) {
    return { ok: false, error: "invalid-tax-office" };
  }
  const updated = await query(
    `UPDATE partners
     SET contact_first_name = $2,
         contact_last_name = $3,
         phone = $4,
         phone_country_code = $5,
         address_line = $6,
         tax_office = $7
     WHERE id = $1
       AND deleted_at IS NULL`,
    [
      input.partnerId,
      contactFirstName,
      contactLastName,
      phone,
      phoneCountryCode,
      addressLine,
      taxOffice,
    ],
  );
  if (updated.rowCount !== 1) {
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}

export async function partnerLoginEmailTaken(email: string, exceptUserId?: string) {
  const normalized = normalizePartnerEmail(email);
  const result = await query<{ id: string }>(
    `SELECT id
     FROM partner_users
     WHERE lower(email) = $1
       AND ($2::uuid IS NULL OR id <> $2)
     LIMIT 1`,
    [normalized, exceptUserId ?? null],
  );
  return Boolean(result.rows[0]);
}

export async function applyVerifiedPartnerLoginEmail(input: {
  userId: string;
  partnerId: string;
  nextEmail: string;
}): Promise<{ ok: true; previousEmail: string } | { ok: false; error: "duplicate" | "failed" }> {
  const nextEmail = normalizePartnerEmail(input.nextEmail);
  const current = await query<{ email: string }>(
    `SELECT email
     FROM partner_users
     WHERE id = $1
       AND partner_id = $2
     LIMIT 1`,
    [input.userId, input.partnerId],
  );
  const previousEmail = current.rows[0]?.email;
  if (!previousEmail) {
    return { ok: false, error: "failed" };
  }
  if (await partnerLoginEmailTaken(nextEmail, input.userId)) {
    return { ok: false, error: "duplicate" };
  }
  const updated = await query(
    `UPDATE partner_users
     SET email = $3
     WHERE id = $1
       AND partner_id = $2`,
    [input.userId, input.partnerId, nextEmail],
  );
  if (updated.rowCount !== 1) {
    return { ok: false, error: "failed" };
  }
  return { ok: true, previousEmail };
}
