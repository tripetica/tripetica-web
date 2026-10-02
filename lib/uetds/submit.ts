import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import {
  blockingUetdsDraftIssues,
  parseUetdsDraft,
  type UetdsDraft,
} from "@/lib/uetds/draft";
import { deleteUetdsFormDraft } from "@/lib/uetds/form-drafts";
import { shouldDeleteUetdsFormDraftAfterMinistry } from "@/lib/uetds/form-draft-policy";
import { evaluateUetdsEligibility } from "@/lib/uetds/eligibility";
import { isUetdsDriverSubscriptionEntitled } from "@/lib/uetds/driver-subscription";
import { loadDriverUetdsSubscriptionEntitlement } from "@/lib/uetds/driver-subscription-store";
import { adjustUetdsTripTimesForSubmit, type UetdsTripTimeAdjustment } from "@/lib/uetds/trip-time";
import { selectedFleetCompany, type UetdsFleetScope } from "@/lib/uetds/fleet-options";
import { getUetdsDriverOption, getUetdsVehicleOption } from "@/lib/uetds/fleet-scope";
import { isOfficialUetdsLocationReady } from "@/lib/uetds/location";
import { loadUetdsMinistryCredentials } from "@/lib/uetds/ministry-credentials";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { extractTextFromPdfBuffer } from "@/lib/uetds/extract-pdf";
import { parseMinistryLastPassengerNotify } from "@/lib/uetds/ministry-last-passenger";
import { fetchUetdsTestSeferDetailPdf } from "@/lib/uetds/ministry-pdf";
import { submitUetdsTestNotification, type UetdsMinistrySubmission } from "@/lib/uetds/ministry-submit";
import { resolveUetdsTestAracPlaka } from "@/lib/uetds/ministry-test-fixtures";
import { loadUetdsReservationContext } from "@/lib/uetds/reservation-context";
import { findActiveUetdsNotificationForReservation } from "@/lib/uetds/reservation-notification";

export type UetdsSubmitError =
  | "forbidden"
  | "invalid"
  | "ineligible"
  | "subscription"
  | "missing"
  | "location"
  | "driver-identity"
  | "no-test-credentials"
  | "no-live-credentials"
  | "live-blocked"
  | "ministry"
  | "not-found"
  | "failed"
  | "duplicate-reservation";

export type UetdsSubmitResult =
  | {
      ok: true;
      id: string;
      ministry: UetdsMinistrySubmission;
      timeAdjustment: UetdsTripTimeAdjustment;
    }
  | {
      ok: false;
      error: UetdsSubmitError;
      ministryMessage?: string;
      missing?: string[];
      timeAdjustment?: UetdsTripTimeAdjustment | null;
    };

function parseDraft(raw: unknown): UetdsDraft | null {
  return parseUetdsDraft(raw);
}

export async function submitUetdsNotification(input: {
  actorType: UetdsFleetScope;
  actorUserId: string;
  partnerId?: string | null;
  draft: unknown;
}): Promise<UetdsSubmitResult> {
  const ministryRuntime = resolveUetdsMinistryRuntime();
  if (!ministryRuntime) {
    return { ok: false, error: "live-blocked" };
  }
  const draft = parseDraft(input.draft);
  if (!draft) {
    return { ok: false, error: "invalid" };
  }
  let reservationPartnerId: string | null = null;
  if (draft.source === "reservation") {
    if (!isUuid(draft.reservationId ?? "")) {
      return { ok: false, error: "invalid" };
    }
    const context = await loadUetdsReservationContext(draft.reservationId ?? "");
    if (!context) {
      return { ok: false, error: "not-found" };
    }
    if (input.actorType === "partner" && context.partnerId !== input.partnerId) {
      return { ok: false, error: "forbidden" };
    }
    reservationPartnerId = context.partnerId;
    const existing = await findActiveUetdsNotificationForReservation({
      reservationId: draft.reservationId ?? "",
      partnerId: input.actorType === "partner" ? input.partnerId ?? null : null,
    });
    if (existing) {
      return { ok: false, error: "duplicate-reservation" };
    }
  } else {
    draft.reservationId = null;
  }

  const scopePartnerId = input.actorType === "partner" ? input.partnerId : null;
  const [driver, vehicle] = await Promise.all([
    getUetdsDriverOption({
      scope: input.actorType,
      partnerId: scopePartnerId,
      driverId: draft.driverId,
    }),
    getUetdsVehicleOption({
      scope: input.actorType,
      partnerId: scopePartnerId,
      vehicleId: draft.vehicleId,
    }),
  ]);
  if (!driver || !vehicle) {
    return { ok: false, error: "forbidden" };
  }
  if (input.actorType === "partner") {
    if (driver.partnerId !== input.partnerId || vehicle.partnerId !== input.partnerId) {
      return { ok: false, error: "forbidden" };
    }
  }

  const company = selectedFleetCompany(driver, vehicle);
  const eligibility = evaluateUetdsEligibility({
    driverId: driver.id,
    vehicleId: vehicle.id,
    driverKind: "registered",
    vehicleKind: "registered",
    driverCompanyId: driver.uetdsCompanyId,
    vehicleCompanyId: vehicle.uetdsCompanyId,
    company,
  });
  if (!eligibility.ok || !company) {
    return { ok: false, error: "ineligible" };
  }
  const subscription = await loadDriverUetdsSubscriptionEntitlement(driver.id);
  if (
    !isUetdsDriverSubscriptionEntitled({
      enrolled: subscription.enrolled,
      periods: subscription.periods,
    })
  ) {
    return { ok: false, error: "subscription" };
  }
  const missing = blockingUetdsDraftIssues(draft);
  if (missing.length > 0) {
    return { ok: false, error: "missing", missing, timeAdjustment: null };
  }
  const timeAdjustment = adjustUetdsTripTimesForSubmit(draft);
  draft.startDate = timeAdjustment.startDate;
  draft.startTime = timeAdjustment.startTime;
  draft.endDate = timeAdjustment.endDate;
  draft.endTime = timeAdjustment.endTime;
  if (
    !isOfficialUetdsLocationReady(draft.originLocation) ||
    !isOfficialUetdsLocationReady(draft.destinationLocation)
  ) {
    return { ok: false, error: "location" };
  }
  if (!driver.nationalId?.trim()) {
    return { ok: false, error: "driver-identity" };
  }

  const ownerPartnerId =
    draft.source === "reservation" ? reservationPartnerId ?? driver.partnerId : driver.partnerId;
  if (!isUuid(ownerPartnerId ?? "")) {
    return { ok: false, error: "invalid" };
  }

  const credentials = await loadUetdsMinistryCredentials(company.id);
  if (!credentials || credentials.env !== ministryRuntime) {
    return {
      ok: false,
      error: ministryRuntime === "live" ? "no-live-credentials" : "no-test-credentials",
    };
  }

  const ministryPlate =
    ministryRuntime === "test"
      ? resolveUetdsTestAracPlaka({
          testUsername: credentials.username,
          fleetPlate: vehicle.plate,
        })
      : vehicle.plate.trim();

  let ministry: UetdsMinistrySubmission;
  try {
    ministry = await submitUetdsTestNotification({
      username: credentials.username,
      password: credentials.password,
      draft,
      plate: ministryPlate,
      driverNationalId: driver.nationalId,
      driverFullName: driver.fullName,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "uetds_live_blocked") {
      return { ok: false, error: "live-blocked", timeAdjustment };
    }
    return { ok: false, error: "ministry", timeAdjustment };
  }

  const snapshot = {
    source: draft.source,
    reservationId: draft.reservationId,
    trip: {
      origin: draft.origin.trim(),
      destination: draft.destination.trim(),
      originLocation: draft.originLocation,
      destinationLocation: draft.destinationLocation,
      startDate: draft.startDate,
      startTime: draft.startTime,
      endDate: draft.endDate,
      endTime: draft.endTime,
      tripKind: draft.tripKind,
      groupName: draft.groupName.trim(),
      purpose: draft.purpose.trim(),
      fare: draft.fare.trim(),
    },
    passengers: draft.passengers.map((passenger) => ({
      nationality: passenger.nationality,
      identityType: passenger.identityType,
      identityNumber: passenger.identityNumber.trim(),
      firstName: passenger.firstName.trim(),
      lastName: passenger.lastName.trim(),
      gender: passenger.gender,
    })),
    company: {
      id: company.id,
      shortName: company.shortName,
      status: company.status,
      integrationStatus: company.integrationStatus,
    },
    driver: {
      id: driver.id,
      fullName: driver.fullName,
      partnerId: driver.partnerId,
    },
    vehicle: {
      id: vehicle.id,
      plate: vehicle.plate,
      ministryPlate,
      brand: vehicle.brand,
      model: vehicle.model,
      partnerId: vehicle.partnerId,
    },
    actor: {
      type: input.actorType,
      id: input.actorUserId,
    },
    ministry: {
      finalVerification: ministry.finalVerification ?? null,
      finalVerificationHistory: ministry.finalVerification ? [ministry.finalVerification] : [],
      env: ministry.env,
      status: ministry.status,
      seferReferansNo: ministry.seferReferansNo,
      firmaSeferNo: ministry.firmaSeferNo ?? null,
      grupReferansNo: ministry.grupReferansNo,
      passengerRefs: ministry.passengerRefs.map((item) => ({
        index: item.index,
        reference: item.reference,
        sonucKodu: item.sonucKodu,
        sonucMesaji: item.sonucMesaji,
      })),
      stages: ministry.stages,
      message: ministry.message,
      lastPassengerNotifiedAt: null as string | null,
      lastPassengerNotifiedSource: null as string | null,
    },
  };
  if (ministry.seferReferansNo) {
    try {
      const pdf = await fetchUetdsTestSeferDetailPdf({
        username: credentials.username,
        password: credentials.password,
        seferReferansNo: ministry.seferReferansNo,
      });
      if (pdf.ok && pdf.pdf) {
        const parsed = parseMinistryLastPassengerNotify(extractTextFromPdfBuffer(pdf.pdf));
        if (parsed) {
          snapshot.ministry.lastPassengerNotifiedAt = parsed;
          snapshot.ministry.lastPassengerNotifiedSource = "ministry_pdf";
        }
      }
    } catch {
      // Official last-passenger time stays unknown rather than using created_at.
    }
  }

  const dbStatus = ministry.status === "submitted" ? "submitted" : ministry.status;
  try {
    const result = await query<{ id: string }>(
      `INSERT INTO uetds_notifications (
         partner_id, reservation_id, source, actor_type, actor_user_id, status,
         company_id, company_short_name, driver_id, vehicle_id, snapshot,
         ministry_env, ministry_reference, submitted_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11::jsonb,
         $12, $13, NOW()
       )
       RETURNING id`,
      [
        ownerPartnerId,
        draft.reservationId,
        draft.source,
        input.actorType,
        input.actorUserId,
        dbStatus,
        company.id,
        company.shortName,
        driver.id,
        vehicle.id,
        JSON.stringify(snapshot),
        ministry.env,
        ministry.seferReferansNo,
      ],
    );
    const id = result.rows[0]?.id;
    if (!id) {
      return { ok: false, error: "failed", ministryMessage: ministry.message, timeAdjustment };
    }
    if (ministry.status === "failed") {
      return { ok: false, error: "ministry", ministryMessage: ministry.message, timeAdjustment };
    }
    if (ministry.finalVerification || shouldDeleteUetdsFormDraftAfterMinistry(ministry.status)) {
      await deleteUetdsFormDraft({
        actor: {
          type: input.actorType,
          userId: input.actorUserId,
          partnerId: input.actorType === "partner" ? input.partnerId ?? null : null,
        },
        reservationId: draft.reservationId,
      });
    }
    return { ok: true, id, ministry, timeAdjustment };
  } catch (error) {
    const code =
      error && typeof error === "object" && "code" in error ? String(error.code) : "";
    if (code === "23505") {
      return { ok: false, error: "duplicate-reservation", ministryMessage: ministry.message, timeAdjustment };
    }
    return { ok: false, error: "failed", ministryMessage: ministry.message, timeAdjustment };
  }
}
