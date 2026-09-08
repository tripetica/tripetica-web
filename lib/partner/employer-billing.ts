import "server-only";

import { query } from "@/lib/db/postgres";
import { type EmployerBillingProfile } from "@/lib/partner/employer-billing-profile";

export type { EmployerBillingProfile };

type ProfileRow = {
  legal_name: string;
  tax_office: string;
  tax_number: string;
  address_line: string;
  email: string;
  phone: string;
  authorized_person: string;
};

export async function getEmployerBillingProfile(): Promise<EmployerBillingProfile | null> {
  const result = await query<ProfileRow>(
    `SELECT
        legal_name,
        tax_office,
        tax_number,
        address_line,
        email,
        phone,
        authorized_person
     FROM employer_billing_profile
     WHERE id = TRUE
     LIMIT 1`,
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    legalName: row.legal_name,
    taxOffice: row.tax_office,
    taxNumber: row.tax_number,
    addressLine: row.address_line,
    email: row.email,
    phone: row.phone,
    authorizedPerson: row.authorized_person,
  };
}
