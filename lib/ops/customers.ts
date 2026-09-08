import "server-only";

import { query } from "@/lib/db/postgres";

export const OPS_CUSTOMERS_PAGE_SIZE = 25;

export type OpsCustomerListItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  phoneCountryCode: string | null;
  isActive: boolean;
  isVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type OpsCustomerReservation = {
  id: string;
  reservationCode: string;
  pickupAt: string | null;
  serviceType: string | null;
  status: string;
  totalPrice: string | null;
  currency: string | null;
  createdAt: string;
};

export type OpsCustomerDetail = OpsCustomerListItem & {
  nationalityCode: string | null;
  updatedAt: string;
  reservations: OpsCustomerReservation[];
};

type CustomerRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  phone_country_code: string | null;
  is_active: boolean;
  email_verified_at: Date | null;
  created_at: Date;
  updated_at: Date;
  last_login_at: Date | null;
  nationality_code: string | null;
};

type ReservationRow = {
  id: string;
  reservation_code: string;
  pickup_at: Date | null;
  service_type: string | null;
  status: string;
  total_price: string | null;
  currency: string | null;
  created_at: Date;
};

function mapCustomer(row: CustomerRow): OpsCustomerListItem {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    phone: row.phone,
    phoneCountryCode: row.phone_country_code,
    isActive: row.is_active,
    isVerified: row.email_verified_at !== null,
    createdAt: row.created_at.toISOString(),
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
  };
}

export async function listOpsCustomers(input: {
  query: string;
  status: string;
  verification: string;
  page: number;
  pageSize?: number;
}) {
  const filters = ["TRUE"];
  const values: unknown[] = [];
  const search = input.query.trim();

  if (search) {
    values.push(`%${search}%`);
    const parameter = `$${values.length}`;
    filters.push(
      `(concat_ws(' ', first_name, last_name) ILIKE ${parameter}
        OR email ILIKE ${parameter}
        OR coalesce(phone, '') ILIKE ${parameter})`,
    );
  }
  if (input.status === "active") {
    filters.push("is_active = TRUE");
  } else if (input.status === "inactive") {
    filters.push("is_active = FALSE");
  }
  if (input.verification === "verified") {
    filters.push("email_verified_at IS NOT NULL");
  } else if (input.verification === "unverified") {
    filters.push("email_verified_at IS NULL");
  }

  const where = filters.join(" AND ");
  const countResult = await query<{ count: string }>(
    `SELECT COUNT(*)::text AS count
     FROM customer_users
     WHERE ${where}`,
    values,
  );
  const total = Number(countResult.rows[0]?.count ?? 0);
  const pageSize = input.pageSize ?? OPS_CUSTOMERS_PAGE_SIZE;
  const offset = (input.page - 1) * pageSize;
  values.push(pageSize, offset);

  const result = await query<CustomerRow>(
    `SELECT id, first_name, last_name, email, phone, phone_country_code,
            is_active, email_verified_at, created_at, updated_at, last_login_at,
            NULL::text AS nationality_code
     FROM customer_users
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values,
  );

  return { items: result.rows.map(mapCustomer), total, pageSize };
}

async function customerNationalitySelect() {
  const result = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = current_schema()
         AND table_name = 'customer_users'
         AND column_name = 'nationality_code'
     ) AS exists`,
  );
  return result.rows[0]?.exists ? "nationality_code" : "NULL::text AS nationality_code";
}

export async function getOpsCustomer(id: string): Promise<OpsCustomerDetail | null> {
  const nationalitySelect = await customerNationalitySelect();
  const customerResult = await query<CustomerRow>(
    `SELECT id, first_name, last_name, email, phone, phone_country_code,
            is_active, email_verified_at, created_at, updated_at, last_login_at,
            ${nationalitySelect}
     FROM customer_users
     WHERE id = $1
     LIMIT 1`,
    [id],
  );
  const row = customerResult.rows[0];
  if (!row) {
    return null;
  }

  const reservationsResult = await query<ReservationRow>(
    `SELECT id, reservation_code, pickup_at, service_type, status,
            total_price::text, currency, created_at
     FROM reservations
     WHERE deleted_at IS NULL
       AND (
         customer_user_id = $1
         OR (
           customer_user_id IS NULL
           AND lower(trim(customer_email)) = lower(trim($2))
         )
       )
     ORDER BY pickup_at DESC NULLS LAST, created_at DESC`,
    [row.id, row.email],
  );

  return {
    ...mapCustomer(row),
    nationalityCode: row.nationality_code,
    updatedAt: row.updated_at.toISOString(),
    reservations: reservationsResult.rows.map((reservation) => ({
      id: reservation.id,
      reservationCode: reservation.reservation_code,
      pickupAt: reservation.pickup_at?.toISOString() ?? null,
      serviceType: reservation.service_type,
      status: reservation.status,
      totalPrice: reservation.total_price,
      currency: reservation.currency,
      createdAt: reservation.created_at.toISOString(),
    })),
  };
}
