import "server-only";

import { type PoolClient } from "pg";
import {
  type CheckoutPaymentMethod,
  checkoutCanComplete,
} from "@/lib/booking/checkout-complete";
import { verifyRecaptchaToken } from "@/lib/booking/recaptcha-verify";
import {
  COMPLETED_STAGE,
  COMPLETED_STATUS,
  DRAFT_STATUS,
  HOURLY_SERVICE_TYPE,
  type ActiveDraft,
  findActiveDraftWithClient,
} from "@/lib/booking/reservation-search";
import { computeEditPriceDifference } from "@/lib/booking/edit-price-diff";
import { isBursaTour } from "@/lib/booking/pricing/bursa-pricing";
import {
  evaluateBosphorusCheckoutDay,
  isBosphorusDinnerTour,
} from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import { isLayoverTour } from "@/lib/booking/pricing/layover-pricing";
import { isNoKmPackageTour } from "@/lib/booking/pricing/no-km-package-tour";
import {
  isPrimaryPassengerReady,
  validateDraftForCashCompletion,
} from "@/lib/booking/complete-reservation-validation";
import { isValidEmail } from "@/lib/booking/phone";
import { getPool } from "@/lib/db/postgres";
import { formatUtcToIstanbulLocal } from "@/lib/booking/istanbul-time";
import { canonicalFxSnapshot, selectedStoredAmount } from "@/lib/ops/money";
import { resolveStoredPriceAmount } from "@/lib/ops/price-override";
import { allocateReservationCode } from "@/lib/ops/reservation-code";
import {
  checkoutPickupLocalToDate,
  evaluateCheckoutPickupPrep,
  suggestedCheckoutPickupLocal,
} from "@/lib/booking/checkout-pickup-prep";
import {
  ONLINE_PAYMENT_METHOD,
  ONLINE_PAYMENT_PENDING_STATUS,
  ONLINE_PAYMENT_PROVIDER,
  RESERVATION_PAYMENT_PENDING_STATUS,
  SBP_UNSUPPORTED_CURRENCY,
} from "@/lib/payments/online-payment";
import { buildReservationServiceSnapshot } from "@/lib/booking/reservation-service-snapshot";
import { queueReservationEmails } from "@/lib/booking/reservation-email-queue";
import {
  completionEmailQueueTimestampSql,
  completionRequiresCaptcha,
  type ReservationCompletionMode,
} from "@/lib/booking/completion-security-policy";

export type CompleteReservationInput = {
  browserSessionId: string;
  payment: CheckoutPaymentMethod;
  legalAccepted: boolean;
  captchaToken: string | null;
  customerUserId?: string | null;
  acceptAdjustedPickup?: boolean;
  expectedPickupAtLocal?: string | null;
};

export type CompleteReservationResult =
  | {
      status: "ok";
      reservationId: string;
      reservationCode: string;
      alreadyExisted: boolean;
      next: "success" | "payment";
    }
  | {
      status: "edit-review-only";
      originalReservationId: string;
      originalReservationCode: string;
      originalTotal: number | null;
      originalCurrency: string | null;
      newTotal: number | null;
      newCurrency: string | null;
      difference: number | null;
    }
  | { status: "not-found" }
  | { status: "forbidden" }
  | { status: "invalid"; reason: string }
  | { status: "unsupported-payment" }
  | { status: "pickup-prep-insufficient"; suggestedPickupAtLocal: string }
  | { status: "pickup-prep-stale"; suggestedPickupAtLocal: string }
  | { status: "bosphorus-day-cutoff"; suggestedPickupAtLocal: string };

type ExistingReservationRow = {
  id: string;
  reservation_code: string;
  status: string;
  payment_method: string | null;
  payment_status: string | null;
};

type LatestSearchRow = {
  id: string;
  status: string;
  reservation_id: string | null;
  reservation_code: string | null;
  reservation_status: string | null;
  payment_method: string | null;
  payment_status: string | null;
};

function trim(value: string | null | undefined) {
  return value?.trim() || "";
}

async function findLatestSearchForSession(
  client: PoolClient,
  browserSessionId: string,
) {
  const result = await client.query<LatestSearchRow>(
    `SELECT
        s.id,
        s.status,
        r.id AS reservation_id,
        r.reservation_code,
        r.status AS reservation_status,
        r.payment_method,
        r.payment_status
     FROM reservation_searches s
     LEFT JOIN reservations r ON r.source_reservation_search_id = s.id
     WHERE s.browser_session_id = $1
     ORDER BY s.updated_at DESC
     LIMIT 1`,
    [browserSessionId],
  );
  return result.rows[0] ?? null;
}

async function findExistingReservation(client: PoolClient, searchId: string) {
  const result = await client.query<ExistingReservationRow>(
    `SELECT id, reservation_code, status, payment_method, payment_status
     FROM reservations
     WHERE source_reservation_search_id = $1
     LIMIT 1`,
    [searchId],
  );
  return result.rows[0] ?? null;
}

async function eligibleCustomerUserId(
  client: PoolClient,
  customerUserId: string | null | undefined,
) {
  if (!customerUserId) {
    return null;
  }
  const result = await client.query<{ id: string }>(
    `SELECT id
     FROM customer_users
     WHERE id = $1
       AND is_active = TRUE
       AND email_verified_at IS NOT NULL
     LIMIT 1`,
    [customerUserId],
  );
  return result.rows[0]?.id ?? null;
}

async function attachExistingReservationToCustomer(
  client: PoolClient,
  reservationId: string,
  customerUserId: string | null | undefined,
) {
  if (!customerUserId) {
    return;
  }
  await client.query(
    `UPDATE reservations r
     SET customer_user_id = u.id
     FROM customer_users u
     WHERE r.id = $1
       AND u.id = $2
       AND u.is_active = TRUE
       AND u.email_verified_at IS NOT NULL
       AND r.customer_user_id IS NULL
       AND r.customer_email IS NOT NULL
       AND lower(r.customer_email) = lower(u.email)`,
    [reservationId, customerUserId],
  );
}

function buildCheckoutGate(
  draft: ActiveDraft,
  payment: CheckoutPaymentMethod,
  legalAccepted: boolean,
  captchaVerified: boolean,
) {
  const primary = draft.passengers.find((item) => item.isPrimaryPassenger);
  return checkoutCanComplete({
    emailValid: Boolean(trim(draft.customerEmail) && isValidEmail(draft.customerEmail!)),
    phoneValid: Boolean(trim(draft.customerPhone)),
    mainPassengerComplete: isPrimaryPassengerReady(primary),
    payment,
    legalAccepted,
    captchaVerified,
  });
}

async function updateDraftPickupAt(
  client: PoolClient,
  searchId: string,
  pickupAt: Date,
) {
  await client.query(
    `UPDATE reservation_searches
     SET selected_pickup_at = $2,
         applied_pickup_at = $2
     WHERE id = $1`,
    [searchId, pickupAt],
  );
}

function resolveCheckoutPickupPrep(
  draft: ActiveDraft,
  input: CompleteReservationInput,
  nowUtcMs: number,
):
  | { proceed: true; pickupAt: Date }
  | { proceed: false; result: CompleteReservationResult } {
  const currentPickupAt = draft.applied.pickupAt;
  if (!currentPickupAt) {
    return { proceed: false, result: { status: "invalid", reason: "pickup-at" } };
  }

  if (isBosphorusDinnerTour(draft.serviceType, draft.tourCode)) {
    const pickupLocal = formatUtcToIstanbulLocal(currentPickupAt.getTime());
    const nowLocal = formatUtcToIstanbulLocal(nowUtcMs);
    const dayCheck = evaluateBosphorusCheckoutDay(pickupLocal, nowLocal);

    if (input.acceptAdjustedPickup) {
      if (dayCheck.ok) {
        return { proceed: true, pickupAt: currentPickupAt };
      }
      const freshSuggested = dayCheck.suggestedPickupAtLocal;
      const expected = input.expectedPickupAtLocal?.trim();
      if (expected && expected !== freshSuggested) {
        return {
          proceed: false,
          result: {
            status: "bosphorus-day-cutoff",
            suggestedPickupAtLocal: freshSuggested,
          },
        };
      }
      return {
        proceed: true,
        pickupAt: checkoutPickupLocalToDate(freshSuggested),
      };
    }

    if (!dayCheck.ok) {
      return {
        proceed: false,
        result: {
          status: "bosphorus-day-cutoff",
          suggestedPickupAtLocal: dayCheck.suggestedPickupAtLocal,
        },
      };
    }

    return { proceed: true, pickupAt: currentPickupAt };
  }

  const prep = evaluateCheckoutPickupPrep(currentPickupAt, nowUtcMs);

  if (input.acceptAdjustedPickup) {
    if (prep.ok) {
      return { proceed: true, pickupAt: currentPickupAt };
    }

    const freshSuggested = suggestedCheckoutPickupLocal(nowUtcMs);
    const expected = input.expectedPickupAtLocal?.trim();
    if (expected && expected !== freshSuggested) {
      return {
        proceed: false,
        result: {
          status: "pickup-prep-stale",
          suggestedPickupAtLocal: freshSuggested,
        },
      };
    }

    return {
      proceed: true,
      pickupAt: checkoutPickupLocalToDate(freshSuggested),
    };
  }

  if (!prep.ok) {
    return {
      proceed: false,
      result: {
        status: "pickup-prep-insufficient",
        suggestedPickupAtLocal: prep.suggestedPickupAtLocal,
      },
    };
  }

  return { proceed: true, pickupAt: currentPickupAt };
}

async function findExistingReservationBySession(browserSessionId: string) {
  const result = await getPool().query<ExistingReservationRow>(
    `SELECT r.id, r.reservation_code, r.status, r.payment_method, r.payment_status
     FROM reservations r
     INNER JOIN reservation_searches s ON s.id = r.source_reservation_search_id
     WHERE s.browser_session_id = $1
     ORDER BY r.created_at DESC
     LIMIT 1`,
    [browserSessionId],
  );
  return result.rows[0] ?? null;
}

function nextStepForExisting(row: {
  status: string;
  payment_method: string | null;
  payment_status: string | null;
}): "success" | "payment" {
  if (
    row.payment_method === ONLINE_PAYMENT_METHOD &&
    (row.status === RESERVATION_PAYMENT_PENDING_STATUS ||
      row.payment_status === ONLINE_PAYMENT_PENDING_STATUS)
  ) {
    return "payment";
  }
  return "success";
}

async function completeReservation(
  input: CompleteReservationInput,
  mode: ReservationCompletionMode,
): Promise<CompleteReservationResult> {
  if (mode === "cash" && input.payment !== "cash") {
    return { status: "unsupported-payment" };
  }
  if (mode === "sbp" && input.payment !== "sbp") {
    return { status: "unsupported-payment" };
  }
  if (!input.legalAccepted) {
    return { status: "invalid", reason: "legal" };
  }

  const client = await getPool().connect();
  try {
    await client.query("BEGIN");

    const latest = await findLatestSearchForSession(client, input.browserSessionId);
    if (!latest) {
      await client.query("ROLLBACK");
      return { status: "not-found" };
    }

    if (latest.status === COMPLETED_STATUS && latest.reservation_id && latest.reservation_code) {
      await attachExistingReservationToCustomer(
        client,
        latest.reservation_id,
        input.customerUserId,
      );
      await queueReservationEmails(client, latest.reservation_id);
      await client.query("COMMIT");
      return {
        status: "ok",
        reservationId: latest.reservation_id,
        reservationCode: latest.reservation_code,
        alreadyExisted: true,
        next: nextStepForExisting({
          status: latest.reservation_status ?? "confirmed",
          payment_method: latest.payment_method,
          payment_status: latest.payment_status,
        }),
      };
    }

    const locked = await client.query<{ id: string; browser_session_id: string; status: string }>(
      `SELECT id, browser_session_id, status
       FROM reservation_searches
       WHERE id = $1
       FOR UPDATE`,
      [latest.id],
    );
    const searchRow = locked.rows[0];
    if (!searchRow || searchRow.browser_session_id !== input.browserSessionId) {
      await client.query("ROLLBACK");
      return { status: "forbidden" };
    }

    const existing = await findExistingReservation(client, searchRow.id);
    if (existing) {
      await attachExistingReservationToCustomer(client, existing.id, input.customerUserId);
      await queueReservationEmails(client, existing.id);
      await client.query(
        `UPDATE reservation_searches
         SET status = $2,
             current_stage = $3,
             completed_at = COALESCE(completed_at, NOW()),
             payment_method = COALESCE(payment_method, $4)
         WHERE id = $1`,
        [
          searchRow.id,
          COMPLETED_STATUS,
          COMPLETED_STAGE,
          mode === "cash" ? "cash" : ONLINE_PAYMENT_METHOD,
        ],
      );
      await client.query("COMMIT");
      return {
        status: "ok",
        reservationId: existing.id,
        reservationCode: existing.reservation_code,
        alreadyExisted: true,
        next: nextStepForExisting(existing),
      };
    }

    if (searchRow.status !== DRAFT_STATUS) {
      await client.query("ROLLBACK");
      return { status: "not-found" };
    }

    const draft = await findActiveDraftWithClient(client, input.browserSessionId);
    if (!draft || draft.id !== searchRow.id) {
      await client.query("ROLLBACK");
      return { status: "not-found" };
    }

    // Stage 2: edit drafts never create/update reservations or payments.
    if (draft.editingOriginal) {
      const diff = computeEditPriceDifference({
        originalTotal: draft.editingOriginal.totalPrice,
        originalCurrency: draft.editingOriginal.currency,
        newTotal: draft.appliedVehicleTotal,
        newCurrency: draft.currency,
      });
      await client.query("ROLLBACK");
      return {
        status: "edit-review-only",
        originalReservationId: draft.editingOriginal.reservationId,
        originalReservationCode: draft.editingOriginal.reservationCode,
        originalTotal: diff.originalTotal,
        originalCurrency: diff.originalCurrency,
        newTotal: diff.newTotal,
        newCurrency: diff.newCurrency,
        difference: diff.difference,
      };
    }

    if (mode === "sbp" && draft.currency === SBP_UNSUPPORTED_CURRENCY) {
      await client.query("ROLLBACK");
      return { status: "invalid", reason: "sbp-gbp" };
    }

    const readiness = validateDraftForCashCompletion(draft);
    if (readiness) {
      await client.query("ROLLBACK");
      return { status: "invalid", reason: readiness };
    }
    if (!buildCheckoutGate(draft, input.payment, input.legalAccepted, true)) {
      await client.query("ROLLBACK");
      return { status: "invalid", reason: "checkout" };
    }

    const nowUtcMs = Date.now();
    const prepResolution = resolveCheckoutPickupPrep(draft, input, nowUtcMs);
    if (!prepResolution.proceed) {
      await client.query("ROLLBACK");
      return prepResolution.result;
    }

    if (completionRequiresCaptcha(mode)) {
      const captchaOk = await verifyRecaptchaToken(input.captchaToken ?? "");
      if (!captchaOk) {
        await client.query("ROLLBACK");
        return { status: "invalid", reason: "captcha" };
      }
    }

    const pickupAt = prepResolution.pickupAt;
    if (pickupAt.getTime() !== draft.applied.pickupAt?.getTime()) {
      await updateDraftPickupAt(client, draft.id, pickupAt);
      draft.applied.pickupAt = pickupAt;
      draft.selected.pickupAt = pickupAt;
    }

    const price = resolveStoredPriceAmount({
      currency: draft.currency,
      appliedVehicleTotal: draft.appliedVehicleTotal,
      fxSnapshot: draft.appliedFxSnapshot,
      priceManuallyOverridden: draft.priceManuallyOverridden,
      manualPriceTotals: draft.manualPriceTotals,
    });
    const calculatedPrice = selectedStoredAmount({
      currency: draft.currency,
      appliedVehicleTotal: draft.appliedVehicleTotal,
      fxSnapshot: draft.appliedFxSnapshot,
    });
    const reservationCode = await allocateReservationCode(client);
    const fxSnapshot = canonicalFxSnapshot(
      draft.appliedFxSnapshot,
      draft.appliedVehicleTotalEur,
    );
    const serviceContentSnapshot =
      draft.serviceType === "hourly" ||
      draft.serviceType === "tour" ||
      Boolean(draft.appliedVehicleCode)
        ? buildReservationServiceSnapshot({
            serviceType: draft.serviceType,
            tourCode: draft.tourCode,
            durationHours: draft.applied.durationHours,
            bursaRoute: draft.applied.bursaRoute,
            vehicleCode: draft.appliedVehicleCode,
          })
        : null;

    const reservationStatus =
      mode === "cash" ? "confirmed" : RESERVATION_PAYMENT_PENDING_STATUS;
    const paymentMethod = mode === "cash" ? "cash" : ONLINE_PAYMENT_METHOD;
    const paymentStatus = mode === "cash" ? null : ONLINE_PAYMENT_PENDING_STATUS;
    const paymentProvider = mode === "cash" ? null : ONLINE_PAYMENT_PROVIDER;
    const paymentAmount = mode === "cash" ? null : price.amount;
    const paymentCurrency = mode === "cash" ? null : price.currency;
    const confirmedAtSql = mode === "cash" ? "NOW()" : "NULL";
    const emailQueuedAtSql = completionEmailQueueTimestampSql(mode);
    const customerUserId = await eligibleCustomerUserId(client, input.customerUserId);

    const insert = await client.query<{ id: string }>(
      `INSERT INTO reservations (
         reservation_code,
         source_reservation_search_id,
         status,
         locale,
         service_type,
         tour_code,
         pickup_name_customer,
         pickup_address_customer,
         pickup_name_tr,
         pickup_address_tr,
         pickup_place_id,
         pickup_latitude,
         pickup_longitude,
         pickup_location_type,
         pickup_airport_code,
         dropoff_name_customer,
         dropoff_address_customer,
         dropoff_name_tr,
         dropoff_address_tr,
         dropoff_place_id,
         dropoff_latitude,
         dropoff_longitude,
         dropoff_location_type,
         dropoff_airport_code,
         pickup_at,
         service_timezone,
         distance_km,
         passenger_count,
         luggage_count,
         baby_seat_count,
         flight_code,
         meet_and_greet,
         duration_hours,
         bursa_route,
         bosphorus_adult_soft,
         bosphorus_adult_alcohol,
         bosphorus_child_5_9,
         bosphorus_child_0_4,
         vehicle_code,
         vehicle_label_customer,
         vehicle_label_tr,
         total_price,
         currency,
         payment_method,
         payment_status,
         payment_provider,
         payment_amount,
         payment_currency,
         fx_snapshot,
         price_manually_overridden,
         manual_price_totals,
         system_total_price,
         system_currency,
         system_fx_snapshot,
         customer_first_name,
         customer_last_name,
         customer_email,
         customer_phone,
         customer_country_code,
         notes,
         service_content_snapshot,
         reservation_confirmation_email_queued_at,
         operation_notification_email_queued_at,
         customer_user_id,
         confirmed_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12, $13, $14, $15,
         $16, $17, $18, $19, $20, $21, $22, $23, $24,
         $25, $26, $27, $28, $29, $30, $31, $32, $33, $34,
         $35, $36, $37, $38, $39, $40, $41, $42, $43, $44,
         $45, $46, $47, $48, $49, $50, $51, $52, $53, $54,
         $55, $56, $57, $58, $59, $60, $61,
         ${emailQueuedAtSql}, ${emailQueuedAtSql}, $62, ${confirmedAtSql}
       )
       RETURNING id`,
      [
        reservationCode,
        draft.id,
        reservationStatus,
        draft.locale ?? "tr",
        draft.serviceType ?? "transfer",
        draft.tourCode,
        draft.applied.pickup.nameCustomer,
        draft.applied.pickup.addressCustomer,
        draft.applied.pickup.nameTr,
        draft.applied.pickup.addressTr,
        draft.applied.pickup.placeId,
        draft.applied.pickup.latitude,
        draft.applied.pickup.longitude,
        draft.applied.pickup.locationType,
        draft.applied.pickup.airportCode,
        draft.applied.dropoff.nameCustomer,
        draft.applied.dropoff.addressCustomer,
        draft.applied.dropoff.nameTr,
        draft.applied.dropoff.addressTr,
        draft.applied.dropoff.placeId,
        draft.applied.dropoff.latitude,
        draft.applied.dropoff.longitude,
        draft.applied.dropoff.locationType,
        draft.applied.dropoff.airportCode,
        pickupAt,
        draft.serviceTimezone ?? "Europe/Istanbul",
        draft.applied.distanceKm,
        draft.applied.passengerCount,
        draft.applied.luggageCount,
        draft.applied.babySeatCount,
        draft.applied.flightCode,
        draft.applied.meetAndGreet,
        draft.serviceType === HOURLY_SERVICE_TYPE ||
        isLayoverTour(draft.serviceType, draft.tourCode) ||
        isNoKmPackageTour(draft.serviceType, draft.tourCode)
          ? draft.applied.durationHours
          : null,
        isBursaTour(draft.serviceType, draft.tourCode)
          ? draft.applied.bursaRoute
          : null,
        isBosphorusDinnerTour(draft.serviceType, draft.tourCode)
          ? (draft.applied.bosphorusPax?.adultSoft ?? 0)
          : null,
        isBosphorusDinnerTour(draft.serviceType, draft.tourCode)
          ? (draft.applied.bosphorusPax?.adultAlcohol ?? 0)
          : null,
        isBosphorusDinnerTour(draft.serviceType, draft.tourCode)
          ? (draft.applied.bosphorusPax?.child5to9 ?? 0)
          : null,
        isBosphorusDinnerTour(draft.serviceType, draft.tourCode)
          ? (draft.applied.bosphorusPax?.child0to4 ?? 0)
          : null,
        isBosphorusDinnerTour(draft.serviceType, draft.tourCode)
          ? null
          : draft.appliedVehicleCode,
        draft.appliedVehicleLabelCustomer,
        draft.appliedVehicleLabelTr,
        price.amount,
        price.currency,
        paymentMethod,
        paymentStatus,
        paymentProvider,
        paymentAmount,
        paymentCurrency,
        fxSnapshot ? JSON.stringify(fxSnapshot) : null,
        draft.priceManuallyOverridden,
        draft.manualPriceTotals ? JSON.stringify(draft.manualPriceTotals) : null,
        calculatedPrice.amount,
        calculatedPrice.currency,
        draft.appliedFxSnapshot ? JSON.stringify(draft.appliedFxSnapshot) : null,
        draft.customerFirstName,
        draft.customerLastName,
        draft.customerEmail,
        draft.customerPhone,
        draft.customerCountryCode,
        draft.notes,
        serviceContentSnapshot ? JSON.stringify(serviceContentSnapshot) : null,
        customerUserId,
      ],
    );
    const reservationId = insert.rows[0]?.id;
    if (!reservationId) {
      throw new Error("Reservation insert did not return id");
    }

    await client.query(
      `INSERT INTO reservations_passengers (
         reservation_id, sequence_no, first_name, last_name,
         country_code, identity_number, gender, is_primary_passenger
       )
       SELECT
         $1, sequence_no, first_name, last_name,
         country_code, identity_number, gender, is_primary_passenger
       FROM reservation_searches_passengers
       WHERE reservation_search_id = $2`,
      [reservationId, draft.id],
    );

    const { ensureDriverTaskForReservation } = await import("@/lib/ops/driver-task");
    await ensureDriverTaskForReservation(client, reservationId);

    if (mode === "sbp" && paymentAmount != null && paymentCurrency) {
      try {
        const { insertPaymentTransaction } = await import(
          "@/lib/payments/ledger/store"
        );
        const amountNumber = Number(paymentAmount);
        if (Number.isFinite(amountNumber) && amountNumber > 0) {
          await insertPaymentTransaction(client, {
            reservationId,
            reservationCode,
            sequenceNo: 1,
            kind: "initial_payment",
            amount: amountNumber,
            currency: paymentCurrency,
            status: "pending",
            idempotencyKey: `booking-complete:p1:${draft.id}`,
          });
        }
      } catch (error) {
        console.error("[complete-reservation] payment ledger P1 insert failed", error);
      }
    }

    await client.query(
      `UPDATE reservation_searches
       SET status = $2,
           current_stage = $3,
           completed_at = NOW(),
           payment_method = $4
       WHERE id = $1`,
      [draft.id, COMPLETED_STATUS, COMPLETED_STAGE, paymentMethod],
    );

    await client.query("COMMIT");
    return {
      status: "ok",
      reservationId,
      reservationCode,
      alreadyExisted: false,
      next: mode === "cash" ? "success" : "payment",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "23505"
    ) {
      const existing = await findExistingReservationBySession(input.browserSessionId);
      if (existing) {
        const { ensureDriverTaskForReservation } = await import("@/lib/ops/driver-task");
        await ensureDriverTaskForReservation(client, existing.id);
        await attachExistingReservationToCustomer(
          client,
          existing.id,
          input.customerUserId,
        );
        await queueReservationEmails(client, existing.id);
        return {
          status: "ok",
          reservationId: existing.id,
          reservationCode: existing.reservation_code,
          alreadyExisted: true,
          next: nextStepForExisting(existing),
        };
      }
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function completeCashReservation(
  input: CompleteReservationInput,
): Promise<CompleteReservationResult> {
  return completeReservation(input, "cash");
}

export async function completeSbpReservation(
  input: CompleteReservationInput,
): Promise<CompleteReservationResult> {
  return completeReservation(input, "sbp");
}
