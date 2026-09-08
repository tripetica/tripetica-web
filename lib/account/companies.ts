import "server-only";

import { getPool, query } from "@/lib/db/postgres";
import { isValidEmailShape, normalizeAccountEmail } from "@/lib/account/email";
import { countryByIso2 } from "@/lib/geo/countries";

export type CustomerCompany = {
  id: string;
  userId: string;
  companyName: string;
  countryCode: string;
  addressLine: string;
  city: string;
  postalCode: string | null;
  taxId: string | null;
  taxOffice: string | null;
  invoiceEmail: string;
  phone: string | null;
  isDefault: boolean;
};

type CompanyRow = {
  id: string;
  user_id: string;
  company_name: string;
  country_code: string;
  address_line: string;
  city: string;
  postal_code: string | null;
  tax_id: string | null;
  tax_office: string | null;
  invoice_email: string;
  phone: string | null;
  is_default: boolean;
};

function mapCompany(row: CompanyRow): CustomerCompany {
  return {
    id: row.id,
    userId: row.user_id,
    companyName: row.company_name,
    countryCode: row.country_code,
    addressLine: row.address_line,
    city: row.city,
    postalCode: row.postal_code,
    taxId: row.tax_id,
    taxOffice: row.tax_office,
    invoiceEmail: row.invoice_email,
    phone: row.phone,
    isDefault: row.is_default,
  };
}

export type CustomerCompanyInput = {
  companyName: string;
  countryCode: string;
  addressLine: string;
  city: string;
  postalCode: string | null;
  taxId: string | null;
  taxOffice: string | null;
  invoiceEmail: string;
  phone: string | null;
};

export function validateCompanyInput(input: {
  companyName: string;
  countryCode: string;
  addressLine: string;
  city: string;
  postalCode: string;
  taxId: string;
  taxOffice: string;
  invoiceEmail: string;
  phone: string;
}): { ok: true; value: CustomerCompanyInput } | { ok: false; reason: string } {
  const companyName = input.companyName.trim();
  const countryCode = input.countryCode.trim().toUpperCase();
  const addressLine = input.addressLine.trim();
  const city = input.city.trim();
  const postalCode = input.postalCode.trim() || null;
  const taxId = input.taxId.trim() || null;
  const taxOffice = input.taxOffice.trim() || null;
  const invoiceEmail = normalizeAccountEmail(input.invoiceEmail);
  const phone = input.phone.trim() || null;

  if (!companyName || companyName.length > 200) {
    return { ok: false as const, reason: "invalid_company" as const };
  }
  if (!countryByIso2(countryCode)) {
    return { ok: false as const, reason: "invalid_country" as const };
  }
  if (!addressLine || !city) {
    return { ok: false as const, reason: "invalid_address" as const };
  }
  if (!isValidEmailShape(invoiceEmail)) {
    return { ok: false as const, reason: "invalid_email" as const };
  }
  if (countryCode === "TR") {
    if (!taxId || !taxOffice) {
      return { ok: false as const, reason: "invalid_tr_tax" as const };
    }
  }
  return {
    ok: true as const,
    value: {
      companyName,
      countryCode,
      addressLine,
      city,
      postalCode,
      taxId,
      taxOffice: countryCode === "TR" ? taxOffice : null,
      invoiceEmail,
      phone,
    },
  };
}

export async function listCompaniesForUser(userId: string) {
  const result = await query<CompanyRow>(
    `SELECT id, user_id, company_name, country_code, address_line, city,
            postal_code, tax_id, tax_office, invoice_email, phone, is_default
     FROM customer_companies
     WHERE user_id = $1
     ORDER BY is_default DESC, company_name ASC`,
    [userId],
  );
  return result.rows.map(mapCompany);
}

export async function getCompanyForUser(userId: string, companyId: string) {
  const result = await query<CompanyRow>(
    `SELECT id, user_id, company_name, country_code, address_line, city,
            postal_code, tax_id, tax_office, invoice_email, phone, is_default
     FROM customer_companies
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [companyId, userId],
  );
  const row = result.rows[0];
  return row ? mapCompany(row) : null;
}

export async function createCompanyForUser(
  userId: string,
  input: CustomerCompanyInput,
  makeDefault: boolean,
) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existing = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM customer_companies WHERE user_id = $1`,
      [userId],
    );
    const isFirst = Number(existing.rows[0]?.count ?? 0) === 0;
    const isDefault = makeDefault || isFirst;
    if (isDefault) {
      await client.query(
        `UPDATE customer_companies SET is_default = FALSE WHERE user_id = $1`,
        [userId],
      );
    }
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO customer_companies (
         user_id, company_name, country_code, address_line, city, postal_code,
         tax_id, tax_office, invoice_email, phone, is_default
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id`,
      [
        userId,
        input.companyName,
        input.countryCode,
        input.addressLine,
        input.city,
        input.postalCode,
        input.taxId,
        input.taxOffice,
        input.invoiceEmail,
        input.phone,
        isDefault,
      ],
    );
    await client.query("COMMIT");
    return inserted.rows[0]!.id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function updateCompanyForUser(
  userId: string,
  companyId: string,
  input: CustomerCompanyInput,
  makeDefault: boolean,
) {
  const existing = await getCompanyForUser(userId, companyId);
  if (!existing) {
    return { ok: false as const, reason: "not_found" as const };
  }
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (makeDefault) {
      await client.query(
        `UPDATE customer_companies SET is_default = FALSE WHERE user_id = $1`,
        [userId],
      );
    }
    await client.query(
      `UPDATE customer_companies
       SET company_name = $3,
           country_code = $4,
           address_line = $5,
           city = $6,
           postal_code = $7,
           tax_id = $8,
           tax_office = $9,
           invoice_email = $10,
           phone = $11,
           is_default = CASE WHEN $12 THEN TRUE ELSE is_default END
       WHERE id = $1 AND user_id = $2`,
      [
        companyId,
        userId,
        input.companyName,
        input.countryCode,
        input.addressLine,
        input.city,
        input.postalCode,
        input.taxId,
        input.taxOffice,
        input.invoiceEmail,
        input.phone,
        makeDefault,
      ],
    );
    await client.query("COMMIT");
    return { ok: true as const };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function deleteCompanyForUser(userId: string, companyId: string) {
  const result = await query(
    `DELETE FROM customer_companies
     WHERE id = $1 AND user_id = $2`,
    [companyId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
