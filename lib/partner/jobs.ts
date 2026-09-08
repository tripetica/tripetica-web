import "server-only";

import { getPool, query } from "@/lib/db/postgres";
import { countryName } from "@/lib/geo/countries";
import { type Locale } from "@/lib/i18n/config";
import { parseOpsAmount } from "@/lib/ops/money";
import { selectedStoredAmount } from "@/lib/ops/money";
import {
  formatPartnerMoney,
  partnerPayoutAmount,
} from "@/lib/partner/job-payout";
import {
  partnerCanSeeOpenJob,
  partnerCanSeePassengerContact,
  partnerJobRank,
  effectiveVisibleMaxRank,
  type PartnerJobRank,
} from "@/lib/partner/job-visibility";
import {
  partnerJobGenderValue,
  partnerJobIsAirportPickup,
  partnerJobPlaceName,
  partnerJobServiceLabel,
  partnerPassengerIdentityFields,
} from "@/lib/partner/job-view";
import {
  type PartnerJobPassenger,
  type PartnerJobRecord,
} from "@/lib/partner/job-types";
import { assignmentViewsForRows } from "@/lib/partner/job-assignment";
import { type JobAssignmentView } from "@/lib/partner/job-assignment-view";

export type { PartnerJobPassenger, PartnerJobRecord };

export type PartnerJobViewer = {
  partnerId: string;
  userId: string;
  isPrimaryPartner: boolean;
  locale: Locale;
};

type PartnerRow = {
  id: string;
  is_primary_partner: boolean;
  priority_level: number | null;
  status: string;
  deleted_at: Date | null;
};

type JobRow = {
  id: string;
  reservation_code: string | null;
  pickup_at: Date;
  created_at: Date;
  service_type: string | null;
  tour_code: string | null;
  pickup_name_customer: string | null;
  pickup_name_tr: string | null;
  dropoff_name_customer: string | null;
  dropoff_name_tr: string | null;
  passenger_count: number | null;
  luggage_count: number | null;
  baby_seat_count: number | null;
  notes: string | null;
  duration_hours: string | null;
  flight_code: string | null;
  meet_and_greet: boolean | null;
  pickup_location_type: string | null;
  pickup_airport_code: string | null;
  pickup_place_id: string | null;
  payment_method: string | null;
  total_price: string | null;
  currency: string | null;
  price_manually_overridden: boolean | null;
  manual_price_totals: unknown;
  accepted_partner_id: string | null;
  accepted_at: Date | null;
  status: string;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_country_code: string | null;
  assigned_driver_kind: string | null;
  assigned_driver_id: string | null;
  assigned_driver_snapshot: unknown;
  assigned_vehicle_kind: string | null;
  assigned_vehicle_id: string | null;
  assigned_vehicle_snapshot: unknown;
};

type PassengerRow = {
  sequence_no: number;
  first_name: string | null;
  last_name: string | null;
  country_code: string | null;
  identity_number: string | null;
  gender: string | null;
  is_primary_passenger: boolean;
};

const JOB_SELECT = `
  id, reservation_code, pickup_at, created_at, service_type, tour_code,
  pickup_name_customer, pickup_name_tr, dropoff_name_customer, dropoff_name_tr,
  passenger_count, luggage_count, baby_seat_count, notes, duration_hours::text,
  flight_code, meet_and_greet, pickup_location_type, pickup_airport_code,
  pickup_place_id, payment_method, total_price::text, currency,
  price_manually_overridden, manual_price_totals,
  accepted_partner_id, accepted_at, status,
  customer_first_name, customer_last_name, customer_phone,
  customer_email, customer_country_code,
  assigned_driver_kind, assigned_driver_id, assigned_driver_snapshot,
  assigned_vehicle_kind, assigned_vehicle_id, assigned_vehicle_snapshot
`;

export async function getPartnerJobContext(partnerId: string) {
  const result = await query<PartnerRow>(
    `SELECT id, is_primary_partner, priority_level, status, deleted_at
     FROM partners
     WHERE id = $1
     LIMIT 1`,
    [partnerId],
  );
  const row = result.rows[0];
  if (!row || row.deleted_at || row.status !== "active") {
    return null;
  }
  const rank = partnerJobRank({
    isPrimaryPartner: row.is_primary_partner,
    priorityLevel: row.priority_level,
  });
  return {
    partnerId: row.id,
    isPrimaryPartner: row.is_primary_partner,
    priorityLevel: row.priority_level,
    rank,
  };
}

function moneyOf(row: JobRow) {
  return selectedStoredAmount({
    currency: row.currency,
    totalPrice: row.total_price,
    priceManuallyOverridden: Boolean(row.price_manually_overridden),
    manualPriceTotals: row.manual_price_totals as never,
  });
}

function mapJob(
  row: JobRow,
  input: {
    locale: Locale;
    isPrimaryPartner: boolean;
    accepted: boolean;
    canSeeContact: boolean;
    passengers?: PartnerJobPassenger[] | null;
    assignment?: JobAssignmentView;
  },
): PartnerJobRecord {
  const stored = moneyOf(row);
  const total = parseOpsAmount(stored.amount);
  const payout = partnerPayoutAmount({
    total,
    isPrimaryPartner: input.isPrimaryPartner,
  });
  const isCash = row.payment_method === "cash";
  const isAirport = partnerJobIsAirportPickup({
    pickupLocationType: row.pickup_location_type,
    pickupAirportCode: row.pickup_airport_code,
    pickupPlaceId: row.pickup_place_id,
  });
  return {
    id: row.id,
    pickupAt: row.pickup_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    serviceType: row.service_type,
    tourCode: row.tour_code,
    serviceLabel: partnerJobServiceLabel(row.service_type, row.tour_code, input.locale),
    pickupName: partnerJobPlaceName(row.pickup_name_customer, row.pickup_name_tr),
    dropoffName: partnerJobPlaceName(row.dropoff_name_customer, row.dropoff_name_tr),
    passengerCount: row.passenger_count,
    luggageCount: row.luggage_count,
    babySeatCount: row.baby_seat_count,
    notes: row.notes,
    durationHours: row.duration_hours,
    flightCode: isAirport ? row.flight_code : null,
    meetAndGreet: isAirport ? Boolean(row.meet_and_greet) : null,
    isAirportPickup: isAirport,
    paymentMethod: row.payment_method,
    isCash,
    payoutAmount: payout,
    payoutLabel: formatPartnerMoney(payout, stored.currency, input.locale),
    collectAmount: input.accepted && isCash ? total : null,
    collectLabel:
      input.accepted && isCash ? formatPartnerMoney(total, stored.currency, input.locale) : null,
    currency: stored.currency,
    reservationCode: input.accepted ? row.reservation_code : null,
    accepted: input.accepted,
    acceptedAt: row.accepted_at?.toISOString() ?? null,
    customerName: input.accepted
      ? [row.customer_first_name, row.customer_last_name].filter(Boolean).join(" ").trim() || null
      : null,
    customerPhone: input.accepted && input.canSeeContact ? row.customer_phone : null,
    customerEmail: input.accepted && input.canSeeContact ? row.customer_email : null,
    customerCountry: input.accepted ? countryName(row.customer_country_code, input.locale) : null,
    canSeePassengerContact: input.accepted && input.canSeeContact,
    passengers: input.accepted ? input.passengers ?? [] : null,
    assignment: input.accepted ? input.assignment : undefined,
  };
}

async function loadPassengers(
  reservationId: string,
  locale: Locale,
  canSeeContact: boolean,
  customer: { phone: string | null; email: string | null },
): Promise<PartnerJobPassenger[]> {
  const result = await query<PassengerRow>(
    `SELECT sequence_no, first_name, last_name, country_code, identity_number,
            gender, is_primary_passenger
     FROM reservations_passengers
     WHERE reservation_id = $1
     ORDER BY sequence_no ASC`,
    [reservationId],
  );
  return result.rows.map((row) => {
    const identity = partnerPassengerIdentityFields(row.identity_number);
    return {
      sequenceNo: row.sequence_no,
      isPrimary: row.is_primary_passenger,
      firstName: row.first_name?.trim() || null,
      lastName: row.last_name?.trim() || null,
      gender: partnerJobGenderValue(row.gender),
      countryName: countryName(row.country_code, locale),
      passportNumber: identity.passportNumber,
      nationalId: identity.nationalId,
      phone: canSeeContact && row.is_primary_passenger ? customer.phone : null,
      email: canSeeContact && row.is_primary_passenger ? customer.email : null,
    };
  });
}

export async function listOpenPartnerJobs(
  viewer: PartnerJobViewer,
  now = new Date(),
): Promise<PartnerJobRecord[]> {
  const context = await getPartnerJobContext(viewer.partnerId);
  if (!context || context.rank === null) {
    return [];
  }
  const result = await query<JobRow>(
    `SELECT ${JOB_SELECT}
     FROM reservations
     WHERE deleted_at IS NULL
       AND status = 'confirmed'
       AND accepted_partner_id IS NULL
       AND pickup_at >= NOW()
     ORDER BY created_at DESC, id DESC`,
  );
  return result.rows
    .filter((row) =>
      partnerCanSeeOpenJob(
        context.rank,
        effectiveVisibleMaxRank({
          now,
          pickupAt: row.pickup_at,
          createdAt: row.created_at,
        }),
      ),
    )
    .map((row) =>
      mapJob(row, {
        locale: viewer.locale,
        isPrimaryPartner: context.isPrimaryPartner,
        accepted: false,
        canSeeContact: false,
      }),
    );
}

export async function listAcceptedPartnerJobs(
  viewer: PartnerJobViewer,
): Promise<PartnerJobRecord[]> {
  const context = await getPartnerJobContext(viewer.partnerId);
  if (!context) {
    return [];
  }
  const result = await query<JobRow>(
    `SELECT ${JOB_SELECT}
     FROM reservations
     WHERE deleted_at IS NULL
       AND accepted_partner_id = $1
     ORDER BY accepted_at DESC NULLS LAST, pickup_at DESC`,
    [viewer.partnerId],
  );
  const assignments = await assignmentViewsForRows(viewer.partnerId, result.rows);
  return result.rows.map((row) =>
    mapJob(row, {
      locale: viewer.locale,
      isPrimaryPartner: context.isPrimaryPartner,
      accepted: true,
      canSeeContact: partnerCanSeePassengerContact(context.rank),
      assignment: assignments.get(row.id),
    }),
  );
}

export async function getPartnerJob(
  viewer: PartnerJobViewer,
  jobId: string,
  now = new Date(),
): Promise<PartnerJobRecord | null> {
  const context = await getPartnerJobContext(viewer.partnerId);
  if (!context || context.rank === null) {
    return null;
  }
  const result = await query<JobRow>(
    `SELECT ${JOB_SELECT}
     FROM reservations
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [jobId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  const acceptedByViewer = row.accepted_partner_id === viewer.partnerId;
  if (row.accepted_partner_id && !acceptedByViewer) {
    return null;
  }
  if (!acceptedByViewer) {
    if (row.status !== "confirmed" || row.pickup_at.getTime() < now.getTime()) {
      return null;
    }
    const visible = partnerCanSeeOpenJob(
      context.rank,
      effectiveVisibleMaxRank({
        now,
        pickupAt: row.pickup_at,
        createdAt: row.created_at,
      }),
    );
    if (!visible) {
      return null;
    }
    return mapJob(row, {
      locale: viewer.locale,
      isPrimaryPartner: context.isPrimaryPartner,
      accepted: false,
      canSeeContact: false,
    });
  }

  const canSeeContact = partnerCanSeePassengerContact(context.rank);
  const loaded = await loadPassengers(jobId, viewer.locale, canSeeContact, {
    phone: row.customer_phone,
    email: row.customer_email,
  });
  const passengers =
    loaded.length > 0
      ? loaded
      : reservationCustomerPassenger(row, viewer.locale, canSeeContact);
  return mapJob(row, {
    locale: viewer.locale,
    isPrimaryPartner: context.isPrimaryPartner,
    accepted: true,
    canSeeContact,
    passengers,
  });
}

function reservationCustomerPassenger(
  row: JobRow,
  locale: Locale,
  canSeeContact: boolean,
): PartnerJobPassenger[] {
  const passenger: PartnerJobPassenger = {
    sequenceNo: 1,
    isPrimary: true,
    firstName: row.customer_first_name?.trim() || null,
    lastName: row.customer_last_name?.trim() || null,
    gender: null,
    countryName: countryName(row.customer_country_code, locale),
    passportNumber: null,
    nationalId: null,
    phone: canSeeContact ? row.customer_phone : null,
    email: canSeeContact ? row.customer_email : null,
  };
  if (
    !passenger.firstName &&
    !passenger.lastName &&
    !passenger.countryName &&
    !passenger.phone &&
    !passenger.email
  ) {
    return [];
  }
  return [passenger];
}

export async function claimPartnerJob(input: {
  partnerId: string;
  userId: string;
  reservationId: string;
  now?: Date;
}): Promise<
  | { ok: true; reservationId: string }
  | { ok: false; error: "not-found" | "not-visible" | "already-taken" | "inactive" }
> {
  const context = await getPartnerJobContext(input.partnerId);
  if (!context || context.rank === null) {
    return { ok: false, error: "inactive" };
  }
  const now = input.now ?? new Date();
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query<JobRow>(
      `SELECT ${JOB_SELECT}
       FROM reservations
       WHERE id = $1
         AND deleted_at IS NULL
       FOR UPDATE`,
      [input.reservationId],
    );
    const row = locked.rows[0];
    if (!row || row.status !== "confirmed" || row.pickup_at.getTime() < now.getTime()) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not-found" };
    }
    if (row.accepted_partner_id) {
      await client.query("ROLLBACK");
      return { ok: false, error: "already-taken" };
    }
    const visible = partnerCanSeeOpenJob(
      context.rank,
      effectiveVisibleMaxRank({
        now,
        pickupAt: row.pickup_at,
        createdAt: row.created_at,
      }),
    );
    if (!visible) {
      await client.query("ROLLBACK");
      return { ok: false, error: "not-visible" };
    }
    const claimed = await client.query<{ id: string }>(
      `UPDATE reservations
       SET accepted_partner_id = $2,
           accepted_at = NOW(),
           accepted_by_partner_user_id = $3
       WHERE id = $1
         AND accepted_partner_id IS NULL
         AND deleted_at IS NULL
         AND status = 'confirmed'
       RETURNING id`,
      [input.reservationId, input.partnerId, input.userId],
    );
    if (!claimed.rows[0]) {
      await client.query("ROLLBACK");
      return { ok: false, error: "already-taken" };
    }
    await client.query("COMMIT");
    return { ok: true, reservationId: claimed.rows[0].id };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export type { PartnerJobRank };
