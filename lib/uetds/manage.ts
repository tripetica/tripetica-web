import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import {
  blockingUetdsDraftIssues,
  parseUetdsDraft,
  type UetdsDraft,
} from "@/lib/uetds/draft";
import {
  effectiveUetdsStartForNewPassenger,
  evaluateUetdsEditWindow,
  isUetdsNewStartSafe,
} from "@/lib/uetds/edit-policy";
import { normalizeUetdsPersonName } from "@/lib/uetds/passenger-name";
import { isUetdsDriverSubscriptionEntitled } from "@/lib/uetds/driver-subscription";
import { loadDriverUetdsSubscriptionEntitlement } from "@/lib/uetds/driver-subscription-store";
import { diffUetdsEdit } from "@/lib/uetds/manage-diff";
import {
  applyUetdsPassengerCountWindow,
  classifyUetdsPassengers,
  expectedFinalPassengerCount,
  ministryListedActivePassengerCount,
  serverPassengerRefs,
  uetdsPassengerCountMismatch,
} from "@/lib/uetds/passenger-class";
import { ozetWithoutSecrets, queryUetdsTestBildirimOzeti } from "@/lib/uetds/ministry-ozet";
import { isOfficialUetdsLocationReady } from "@/lib/uetds/location";
import { extractTextFromPdfBuffer } from "@/lib/uetds/extract-pdf";
import { loadUetdsMinistryCredentials } from "@/lib/uetds/ministry-credentials";
import { resolveUetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { parseMinistryLastPassengerNotify } from "@/lib/uetds/ministry-last-passenger";
import {
  mutateUetdsPersonelEkle,
  mutateUetdsPersonelIptal,
  mutateUetdsSeferGrupGuncelle,
  mutateUetdsSeferGuncelle,
  mutateUetdsSeferIptal,
  mutateUetdsYolcuEkle,
  mutateUetdsYolcuIptalByRef,
  type UetdsMutationResult,
} from "@/lib/uetds/ministry-mutate";
import { fetchUetdsTestSeferDetailPdf } from "@/lib/uetds/ministry-pdf";
import { getUetdsNotification } from "@/lib/uetds/notifications";
import { type UetdsFleetScope } from "@/lib/uetds/fleet-options";
import {
  evaluateUetdsEditFleet,
  ministryPersonnelActive,
  ministryPersonnelHasIdentity,
  ministryPlateEquals,
} from "@/lib/uetds/edit-fleet";
import { getUetdsDriverOption, getUetdsVehicleOption } from "@/lib/uetds/fleet-scope";
import { resolveUetdsTestAracPlaka } from "@/lib/uetds/ministry-test-fixtures";
import { syncReservationAssignmentFromUetdsEdit } from "@/lib/uetds/reservation-assignment-sync";

export type UetdsManageError =
  | "forbidden"
  | "invalid"
  | "not-found"
  | "live-blocked"
  | "no-test-credentials"
  | "no-live-credentials"
  | "start-locked"
  | "start-too-soon"
  | "new-passenger-blocked"
  | "removed-passenger-blocked"
  | "passenger-correction-blocked"
  | "missing-passenger-ref"
  | "passenger-count-mismatch"
  | "cancelled"
  | "ministry"
  | "failed"
  | "mismatch"
  | "incomplete"
  | "external"
  | "unassigned"
  | "inactive"
  | "not-ready"
  | "company-mismatch"
  | "driver-identity"
  | "subscription"
  | "reservation-scope"
  | "fleet-verify"
  | "assignment-sync"
  | "kamu-session-required"
  | "kamu-session-expired"
  | "kamu-firm-required"
  | "kamu-sefer-not-found"
  | "kamu-yolcu-not-found"
  | "kamu-update-failed"
  | "kamu-flush-blocked"
  | "kamu-ref-changed"
  | "kamu-verify-failed";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePassengerNames<T extends { firstName: string; lastName: string }>(passenger: T): T {
  return {
    ...passenger,
    firstName: normalizeUetdsPersonName(passenger.firstName),
    lastName: normalizeUetdsPersonName(passenger.lastName),
  };
}

function firstFailedMinistryMessage(operations: UetdsMutationResult[]) {
  return operations.find((item) => item.sonucKodu !== 0)?.sonucMesaji?.trim() || undefined;
}

export function snapshotToUetdsDraft(snapshotJson: string, fallback: Partial<UetdsDraft> = {}): UetdsDraft | null {
  let snapshot: Record<string, unknown> | null = null;
  try {
    snapshot = asRecord(JSON.parse(snapshotJson || "{}"));
  } catch {
    return null;
  }
  const trip = asRecord(snapshot?.trip);
  const ministry = asRecord(snapshot?.ministry);
  const refs = serverPassengerRefs(ministry?.passengerRefs);
  const passengers = (Array.isArray(snapshot?.passengers) ? snapshot.passengers : []).map((item, index) => {
    const row = asRecord(item) ?? {};
    const ministryReference = refs[index] || text(row.ministryReference) || null;
    return {
      ...row,
      // Stable keys: snapshot rows usually lack `key`; random UUIDs during SSR/client
      // remounts are a hydration footgun if the draft is ever re-derived on the client.
      key: text(row.key) || (ministryReference ? `ref-${ministryReference}` : `pax-${index}`),
      ministryReference,
    };
  });
  return parseUetdsDraft({
    source: text(snapshot?.source) || fallback.source || "manual",
    reservationId: text(snapshot?.reservationId) || null,
    origin: text(trip?.origin),
    destination: text(trip?.destination),
    originLocation: trip?.originLocation,
    destinationLocation: trip?.destinationLocation,
    startDate: text(trip?.startDate),
    startTime: text(trip?.startTime),
    endDate: text(trip?.endDate),
    endTime: text(trip?.endTime),
    tripKind: text(trip?.tripKind) || "transfer",
    groupName: text(trip?.groupName),
    purpose: text(trip?.purpose),
    fare: text(trip?.fare),
    driverId: text(asRecord(snapshot?.driver)?.id),
    vehicleId: text(asRecord(snapshot?.vehicle)?.id),
    endManual: true,
    passengers,
    fieldProvenance: fallback.fieldProvenance,
  });
}

export { diffUetdsEdit };

export async function hydrateMinistryLastPassengerNotify(input: {
  id: string;
  partnerId?: string | null;
}) {
  const notification = await getUetdsNotification(input);
  if (!notification) {
    return null;
  }
  const snapshot = asRecord(JSON.parse(notification.snapshotJson || "{}"));
  const ministry = asRecord(snapshot?.ministry);
  if (text(ministry?.lastPassengerNotifiedSource) === "ministry_pdf" && text(ministry?.lastPassengerNotifiedAt)) {
    return notification;
  }
  if (!notification.ministryReference || !notification.companyId) {
    return notification;
  }
  const credentials = await loadUetdsMinistryCredentials(notification.companyId);
  if (!credentials) {
    return notification;
  }
  const parsed = await refreshLastPassengerNotify({
    username: credentials.username,
    password: credentials.password,
    seferReferansNo: notification.ministryReference,
  });
  if (!parsed) {
    return notification;
  }
  const resulting = {
    ...snapshot,
    ministry: {
      ...ministry,
      lastPassengerNotifiedAt: parsed,
      lastPassengerNotifiedSource: "ministry_pdf",
    },
  };
  await query(`UPDATE uetds_notifications SET snapshot = $2::jsonb WHERE id = $1`, [
    notification.id,
    JSON.stringify(resulting),
  ]);
  return {
    ...notification,
    snapshotJson: JSON.stringify(resulting),
  };
}

async function refreshLastPassengerNotify(input: {
  username: string;
  password: string;
  seferReferansNo: string;
}) {
  const pdf = await fetchUetdsTestSeferDetailPdf(input);
  if (!pdf.ok || !pdf.pdf) {
    return null;
  }
  return parseMinistryLastPassengerNotify(extractTextFromPdfBuffer(pdf.pdf));
}

async function insertRevision(input: {
  notificationId: string;
  actorType: UetdsFleetScope;
  actorUserId: string;
  previous: unknown;
  resulting: unknown;
  changedFields: string[];
  operations: UetdsMutationResult[];
}) {
  await query(
    `INSERT INTO uetds_notification_revisions (
       notification_id, actor_type, actor_user_id, previous_snapshot, resulting_snapshot, changed_fields, ministry_operations
     ) VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7::jsonb)`,
    [
      input.notificationId,
      input.actorType,
      input.actorUserId,
      JSON.stringify(input.previous),
      JSON.stringify(input.resulting),
      input.changedFields,
      JSON.stringify(
        input.operations.map((item) => ({
          operation: item.operation,
          sonucKodu: item.sonucKodu,
          sonucMesaji: item.sonucMesaji,
          reference: item.reference ?? null,
        })),
      ),
    ],
  );
}

export async function cancelUetdsNotification(input: {
  actorType: UetdsFleetScope;
  actorUserId: string;
  partnerId?: string | null;
  notificationId: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: UetdsManageError; ministryMessage?: string }> {
  if (!resolveUetdsMinistryRuntime()) {
    return { ok: false, error: "live-blocked" };
  }
  const notification = await getUetdsNotification({
    id: input.notificationId,
    partnerId: input.actorType === "partner" ? input.partnerId ?? null : null,
  });
  if (!notification) {
    return { ok: false, error: "not-found" };
  }
  if (notification.ministryEnv !== resolveUetdsMinistryRuntime()) {
    return { ok: false, error: "live-blocked" };
  }
  if (notification.status === "cancelled") {
    return { ok: false, error: "cancelled" };
  }
  if (!notification.ministryReference || !notification.companyId) {
    return { ok: false, error: "invalid" };
  }
  const credentials = await loadUetdsMinistryCredentials(notification.companyId);
  if (!credentials) {
    return {
      ok: false,
      error: resolveUetdsMinistryRuntime() === "live" ? "no-live-credentials" : "no-test-credentials",
    };
  }
  const previous = JSON.parse(notification.snapshotJson || "{}");
  const result = await mutateUetdsSeferIptal({
    username: credentials.username,
    password: credentials.password,
    seferReferansNo: notification.ministryReference,
    reason: input.reason,
  });
  const resulting = {
    ...asRecord(previous),
    ministry: {
      ...asRecord(asRecord(previous)?.ministry),
      status: result.sonucKodu === 0 ? "cancelled" : text(asRecord(asRecord(previous)?.ministry)?.status),
      lastCancel: { sonucKodu: result.sonucKodu, sonucMesaji: result.sonucMesaji },
    },
  };
  if (result.sonucKodu !== 0) {
    await insertRevision({
      notificationId: notification.id,
      actorType: input.actorType,
      actorUserId: input.actorUserId,
      previous,
      resulting,
      changedFields: ["cancel"],
      operations: [result],
    });
    return { ok: false, error: "ministry", ministryMessage: result.sonucMesaji };
  }
  await query(
    `UPDATE uetds_notifications SET status = 'cancelled', snapshot = $2::jsonb WHERE id = $1`,
    [notification.id, JSON.stringify(resulting)],
  );
  await insertRevision({
    notificationId: notification.id,
    actorType: input.actorType,
    actorUserId: input.actorUserId,
    previous,
    resulting,
    changedFields: ["cancel"],
    operations: [result],
  });
  return { ok: true };
}

export async function updateUetdsNotification(input: {
  actorType: UetdsFleetScope;
  actorUserId: string;
  partnerId?: string | null;
  notificationId: string;
  draft: unknown;
  nowUtcMs?: number;
}): Promise<
  | {
      ok: true;
      status: "updated" | "partial_update";
      operations: UetdsMutationResult[];
      warning?: UetdsManageError;
      ministryMessage?: string;
    }
  | { ok: false; error: UetdsManageError; ministryMessage?: string; operations?: UetdsMutationResult[] }
> {
  if (!resolveUetdsMinistryRuntime()) {
    return { ok: false, error: "live-blocked" };
  }
  const edited = parseUetdsDraft(input.draft);
  if (!edited) {
    return { ok: false, error: "invalid" };
  }
  const notification = await getUetdsNotification({
    id: input.notificationId,
    partnerId: input.actorType === "partner" ? input.partnerId ?? null : null,
  });
  if (!notification) {
    return { ok: false, error: "not-found" };
  }
  if (notification.status === "cancelled") {
    return { ok: false, error: "cancelled" };
  }
  const original = snapshotToUetdsDraft(notification.snapshotJson);
  if (!original || !notification.ministryReference || !notification.companyId) {
    return { ok: false, error: "invalid" };
  }
  const nowUtcMs = input.nowUtcMs ?? Date.now();
  const window = evaluateUetdsEditWindow(original.startDate, original.startTime, nowUtcMs);
  const requested = diffUetdsEdit(original, edited);

  const snapshot = asRecord(JSON.parse(notification.snapshotJson || "{}"));
  const ministry = asRecord(snapshot?.ministry);
  const ministryRefs = serverPassengerRefs(ministry?.passengerRefs);
  const working: UetdsDraft = {
    ...edited,
    startDate: original.startDate,
    startTime: original.startTime,
    passengers: applyUetdsPassengerCountWindow(original, edited, ministryRefs, false).map(
      normalizePassengerNames,
    ),
  };
  let warning: UetdsManageError | undefined;

  const startRequested = requested.includes("start");
  if (startRequested && !window.canChangeStart) {
    warning = warning ?? "start-locked";
  } else if (startRequested && !isUetdsNewStartSafe(edited.startDate, edited.startTime, nowUtcMs)) {
    warning = warning ?? "start-too-soon";
  } else if (startRequested) {
    working.startDate = edited.startDate;
    working.startTime = edited.startTime;
  }

  const intendedWindow = evaluateUetdsEditWindow(working.startDate, working.startTime, nowUtcMs);
  const allowCountChange = intendedWindow.canChangePassengerCount;
  const intendedPassengers = classifyUetdsPassengers(original, edited, ministryRefs);
  if (intendedPassengers.some((item) => item.kind === "GENUINELY_NEW") && !allowCountChange) {
    return { ok: false, error: "new-passenger-blocked" };
  }
  if (intendedPassengers.some((item) => item.kind === "REMOVED_EXISTING") && !allowCountChange) {
    return { ok: false, error: "removed-passenger-blocked" };
  }
  working.passengers = applyUetdsPassengerCountWindow(
    original,
    edited,
    ministryRefs,
    allowCountChange,
  ).map(normalizePassengerNames);

  const classified = classifyUetdsPassengers(original, working, ministryRefs);
  if (
    classified.some(
      (item) =>
        (item.kind === "EDITED_EXISTING" || item.kind === "REMOVED_EXISTING") &&
        !item.ministryReference,
    )
  ) {
    return { ok: false, error: "missing-passenger-ref" };
  }

  const missing = blockingUetdsDraftIssues(working);
  if (missing.length > 0) {
    return { ok: false, error: "invalid" };
  }
  if (
    !isOfficialUetdsLocationReady(working.originLocation) ||
    !isOfficialUetdsLocationReady(working.destinationLocation)
  ) {
    return { ok: false, error: "invalid" };
  }

  const changed = diffUetdsEdit(original, working);
  if (changed.length === 0) {
    return { ok: false, error: warning ?? "invalid" };
  }

  const grupReferansNo = text(ministry?.grupReferansNo);
  const vehicle = asRecord(snapshot?.vehicle);
  const plate = text(vehicle?.ministryPlate) || text(vehicle?.plate);
  if (!grupReferansNo || !plate) {
    return { ok: false, error: "invalid" };
  }
  const credentials = await loadUetdsMinistryCredentials(notification.companyId);
  if (!credentials) {
    return {
      ok: false,
      error: resolveUetdsMinistryRuntime() === "live" ? "no-live-credentials" : "no-test-credentials",
    };
  }
  const fleetScope = {
    scope: input.actorType,
    partnerId: input.actorType === "partner" ? input.partnerId ?? null : null,
  };
  const [nextDriver, nextVehicle, previousDriver] = await Promise.all([
    getUetdsDriverOption({ ...fleetScope, driverId: working.driverId }),
    getUetdsVehicleOption({ ...fleetScope, vehicleId: working.vehicleId }),
    changed.includes("driver")
      ? getUetdsDriverOption({ ...fleetScope, driverId: original.driverId })
      : Promise.resolve(null),
  ]);
  let nextMinistryPlate = plate;
  if (changed.includes("driver") || changed.includes("vehicle")) {
    const fleet = evaluateUetdsEditFleet({
      seferCompanyId: notification.companyId,
      driver: nextDriver,
      vehicle: nextVehicle,
      driverNationalId: nextDriver?.nationalId ?? null,
      requireDriverIdentity: changed.includes("driver"),
      reservationPartnerId: notification.reservationId ? notification.partnerId : null,
    });
    if (!fleet.ok) {
      return { ok: false, error: fleet.error };
    }
    if (nextDriver) {
      const subscription = await loadDriverUetdsSubscriptionEntitlement(nextDriver.id);
      if (
        !isUetdsDriverSubscriptionEntitled({
          enrolled: subscription.enrolled,
          periods: subscription.periods,
        })
      ) {
        return { ok: false, error: "subscription" };
      }
    }
    if (!nextVehicle) {
      return { ok: false, error: "invalid" };
    }
    nextMinistryPlate =
      resolveUetdsMinistryRuntime() === "test"
        ? resolveUetdsTestAracPlaka({
            testUsername: credentials.username,
            fleetPlate: nextVehicle.plate,
          })
        : nextVehicle.plate.trim();
  }

  await query(`UPDATE uetds_notifications SET status = 'updating' WHERE id = $1`, [notification.id]);

  const beforeOzet = await queryUetdsTestBildirimOzeti({
    username: credentials.username,
    password: credentials.password,
    seferReferansNo: notification.ministryReference,
  });

  const operations: UetdsMutationResult[] = [];
  if (changed.includes("driver")) {
    const cancelNationalId =
      previousDriver?.nationalId?.trim() ||
      ministryPersonnelActive(beforeOzet.personnel).find(
        (item) => !ministryPersonnelHasIdentity([item], nextDriver?.nationalId),
      )?.nationalId ||
      ministryPersonnelActive(beforeOzet.personnel)[0]?.nationalId ||
      "";
    if (!cancelNationalId || !nextDriver?.nationalId?.trim()) {
      operations.push({
        operation: "personelIptal",
        sonucKodu: null,
        sonucMesaji: "Mevcut şoför kimliği Bakanlık iptali için doğrulanamadı.",
      });
    } else {
      const cancel = await mutateUetdsPersonelIptal({
        username: credentials.username,
        password: credentials.password,
        seferReferansNo: notification.ministryReference,
        nationalId: cancelNationalId,
        reason: "Sofor degisikligi",
      });
      operations.push(cancel);
      if (cancel.sonucKodu === 0) {
        operations.push(
          await mutateUetdsPersonelEkle({
            username: credentials.username,
            password: credentials.password,
            seferReferansNo: notification.ministryReference,
            nationalId: nextDriver.nationalId,
            fullName: nextDriver.fullName,
          }),
        );
      }
    }
  }
  if (
    changed.includes("start") ||
    changed.includes("end") ||
    changed.includes("purpose") ||
    changed.includes("vehicle")
  ) {
    operations.push(
      await mutateUetdsSeferGuncelle({
        username: credentials.username,
        password: credentials.password,
        seferReferansNo: notification.ministryReference,
        draft: working,
        plate: nextMinistryPlate,
      }),
    );
  }
  if (changed.includes("group")) {
    operations.push(
      await mutateUetdsSeferGrupGuncelle({
        username: credentials.username,
        password: credentials.password,
        seferReferansNo: notification.ministryReference,
        grupReferansNo,
        draft: working,
      }),
    );
  }
  const nextPassengers: typeof original.passengers = [];
  const nextRefs: Array<string | null> = [];
  const cancelledRefs: string[] = [];
  const keptRefs = new Map<number, string | null>();
  const keptPassengers = new Map<number, (typeof original.passengers)[number]>();

  original.passengers.forEach((passenger, index) => {
    keptRefs.set(index, ministryRefs[index] || passenger.ministryReference);
    keptPassengers.set(index, { ...passenger });
  });

  // Passenger field corrections: SOAP iptal + yeniden ekle (same ministry sefer/grup).
  // Kamu portal in-place Güncelle remains available as research code under lib/uetds/kamu-portal/
  // but is not used by the Tripetica form edit path.
  for (const item of classified.filter((entry) => entry.kind === "EDITED_EXISTING")) {
    const reference = item.ministryReference;
    const passenger = item.edited;
    if (!reference || !passenger) {
      continue;
    }
    const cancel = await mutateUetdsYolcuIptalByRef({
      username: credentials.username,
      password: credentials.password,
      seferReferansNo: notification.ministryReference,
      yolcuReferansNo: reference,
      reason: "Yolcu bilgisi duzeltme",
    });
    operations.push(cancel);
    if (cancel.sonucKodu !== 0) {
      continue;
    }
    cancelledRefs.push(reference);
    const add = await mutateUetdsYolcuEkle({
      username: credentials.username,
      password: credentials.password,
      seferReferansNo: notification.ministryReference,
      grupReferansNo,
      passenger,
      seatNo: String(item.index + 1),
    });
    operations.push(add);
    if (add.sonucKodu === 0 && add.reference) {
      keptRefs.set(item.index, add.reference);
      keptPassengers.set(item.index, { ...passenger, ministryReference: add.reference });
    }
  }

  const seferUpdate = operations.find((item) => item.operation === "seferGuncelle");
  const startForCount = effectiveUetdsStartForNewPassenger({
    originalStartDate: original.startDate,
    originalStartTime: original.startTime,
    finalStartDate: working.startDate,
    finalStartTime: working.startTime,
    seferUpdateSonucKodu: seferUpdate?.sonucKodu,
  });
  const immediatelyBeforeCountChange = evaluateUetdsEditWindow(
    startForCount.startDate,
    startForCount.startTime,
    nowUtcMs,
  );
  const removedExisting = classified.filter((item) => item.kind === "REMOVED_EXISTING");
  if (removedExisting.length > 0 && !immediatelyBeforeCountChange.canRemoveExistingPassenger) {
    warning = warning ?? "removed-passenger-blocked";
  } else {
    for (const item of removedExisting) {
      const reference = item.ministryReference;
      if (!reference) {
        continue;
      }
      const cancel = await mutateUetdsYolcuIptalByRef({
        username: credentials.username,
        password: credentials.password,
        seferReferansNo: notification.ministryReference,
        yolcuReferansNo: reference,
        reason: "Yolcu bildirimi silindi",
      });
      operations.push(cancel);
      if (cancel.sonucKodu === 0) {
        cancelledRefs.push(reference);
        keptRefs.delete(item.index);
        keptPassengers.delete(item.index);
      }
    }
  }

  const genuinelyNew = classified.filter((item) => item.kind === "GENUINELY_NEW");
  const successfulNew: typeof original.passengers = [];
  const successfulNewRefs: Array<string | null> = [];
  if (genuinelyNew.length > 0 && !immediatelyBeforeCountChange.canAddNewPassenger) {
    warning = warning ?? "new-passenger-blocked";
  } else {
    for (const item of genuinelyNew) {
      if (!item.edited) {
        continue;
      }
      const add = await mutateUetdsYolcuEkle({
        username: credentials.username,
        password: credentials.password,
        seferReferansNo: notification.ministryReference,
        grupReferansNo,
        passenger: item.edited,
        seatNo: String(keptPassengers.size + successfulNew.length + 1),
      });
      operations.push(add);
      if (add.sonucKodu === 0) {
        successfulNew.push({ ...item.edited, ministryReference: add.reference ?? null });
        successfulNewRefs.push(add.reference ?? null);
      }
    }
  }

  [...keptPassengers.keys()]
    .sort((left, right) => left - right)
    .forEach((index) => {
      nextPassengers.push(keptPassengers.get(index)!);
      nextRefs.push(keptRefs.get(index) ?? null);
    });
  successfulNew.forEach((passenger, index) => {
    nextPassengers.push(passenger);
    nextRefs.push(successfulNewRefs[index] ?? null);
  });

  if (operations.length === 0) {
    await query(`UPDATE uetds_notifications SET status = $2 WHERE id = $1`, [
      notification.id,
      notification.status,
    ]);
    return { ok: false, error: warning ?? "invalid" };
  }

  const failed = operations.filter((item) => item.sonucKodu !== 0);
  const afterOzet = await queryUetdsTestBildirimOzeti({
    username: credentials.username,
    password: credentials.password,
    seferReferansNo: notification.ministryReference,
  });
  const expectedCount = expectedFinalPassengerCount(classified);
  const ministryActiveCount = ministryListedActivePassengerCount(afterOzet);
  const editedExistingCorrectionsSucceeded = classified
    .filter((item) => item.kind === "EDITED_EXISTING")
    .every((item) => {
      const cancelOk = operations.some(
        (op) =>
          op.operation === "yolcuIptalUetdsYolcuRefNoIle" &&
          op.reference === item.ministryReference &&
          op.sonucKodu === 0,
      );
      const addOk = Boolean(
        keptRefs.get(item.index) && keptRefs.get(item.index) !== item.ministryReference,
      );
      return cancelOk && addOk;
    });
  const countMismatch = uetdsPassengerCountMismatch({
    classified,
    ministryActiveCount,
    editedExistingCorrectionsSucceeded,
  });
  if (countMismatch) {
    warning = "passenger-count-mismatch";
  }

  let lastPassengerNotifiedAt = afterOzet.sonYolcuBildirimTarihi || text(ministry?.lastPassengerNotifiedAt) || null;
  let lastPassengerNotifiedSource = afterOzet.sonYolcuBildirimTarihi
    ? "ministry_ozet"
    : text(ministry?.lastPassengerNotifiedSource) || null;
  if (
    classified.some(
      (item) =>
        item.kind === "EDITED_EXISTING" ||
        item.kind === "GENUINELY_NEW" ||
        item.kind === "REMOVED_EXISTING",
    ) &&
    operations.some(
      (item) =>
        (item.operation === "yolcuEkle" || item.operation === "yolcuIptalUetdsYolcuRefNoIle") &&
        item.sonucKodu === 0,
    )
  ) {
    const parsed = await refreshLastPassengerNotify({
      username: credentials.username,
      password: credentials.password,
      seferReferansNo: notification.ministryReference,
    });
    if (parsed) {
      lastPassengerNotifiedAt = parsed;
      lastPassengerNotifiedSource = "ministry_pdf";
    }
  }

  const seferFailed = failed.some((item) => item.operation === "seferGuncelle");
  const groupFailed = failed.some((item) => item.operation === "seferGrupGuncelle");
  const driverChangeRequested = changed.includes("driver");
  const vehicleChangeRequested = changed.includes("vehicle");
  const driverSoapOk =
    !driverChangeRequested ||
    (operations.some((item) => item.operation === "personelIptal" && item.sonucKodu === 0) &&
      operations.some((item) => item.operation === "personelEkle" && item.sonucKodu === 0));
  const vehicleSoapOk =
    !vehicleChangeRequested ||
    operations.some((item) => item.operation === "seferGuncelle" && item.sonucKodu === 0);
  const driverVerified =
    !driverChangeRequested ||
    (driverSoapOk &&
      (afterOzet.personnel.length === 0 ||
        ministryPersonnelHasIdentity(afterOzet.personnel, nextDriver?.nationalId)));
  const vehicleVerified =
    !vehicleChangeRequested ||
    (vehicleSoapOk &&
      (!afterOzet.aracPlaka || ministryPlateEquals(afterOzet.aracPlaka, nextMinistryPlate)));
  if ((driverChangeRequested && !driverVerified) || (vehicleChangeRequested && !vehicleVerified)) {
    warning = warning ?? "fleet-verify";
  }
  const assignmentSync = await syncReservationAssignmentFromUetdsEdit({
    actorType: input.actorType,
    actorUserId: input.actorUserId,
    partnerId: input.partnerId ?? notification.partnerId,
    reservationId: notification.reservationId,
    source: notification.source,
    driverId: driverChangeRequested && driverVerified ? working.driverId : null,
    vehicleId: vehicleChangeRequested && vehicleVerified ? working.vehicleId : null,
  });
  if (
    assignmentSync.attempted &&
    ((driverChangeRequested && driverVerified && assignmentSync.driverOk === false) ||
      (vehicleChangeRequested && vehicleVerified && assignmentSync.vehicleOk === false))
  ) {
    warning = warning ?? "assignment-sync";
  }
  const originalTrip = asRecord(snapshot?.trip);
  const originalDriverSnap = asRecord(snapshot?.driver);
  const originalVehicleSnap = asRecord(snapshot?.vehicle);
  const resultingDriver =
    driverChangeRequested && driverVerified && nextDriver
      ? {
          id: nextDriver.id,
          fullName: nextDriver.fullName,
          partnerId: nextDriver.partnerId,
        }
      : originalDriverSnap;
  const resultingVehicle =
    vehicleChangeRequested && vehicleVerified && nextVehicle
      ? {
          id: nextVehicle.id,
          plate: nextVehicle.plate,
          ministryPlate: nextMinistryPlate,
          brand: nextVehicle.brand,
          model: nextVehicle.model,
          partnerId: nextVehicle.partnerId,
        }
      : originalVehicleSnap;
  const resulting = {
    ...snapshot,
    driver: resultingDriver,
    vehicle: resultingVehicle,
    trip: {
      ...originalTrip,
      origin: groupFailed ? text(originalTrip?.origin) : working.origin,
      destination: groupFailed ? text(originalTrip?.destination) : working.destination,
      originLocation: groupFailed ? originalTrip?.originLocation : working.originLocation,
      destinationLocation: groupFailed ? originalTrip?.destinationLocation : working.destinationLocation,
      startDate: seferFailed ? original.startDate : working.startDate,
      startTime: seferFailed ? original.startTime : working.startTime,
      endDate: seferFailed ? original.endDate : working.endDate,
      endTime: seferFailed ? original.endTime : working.endTime,
      groupName: groupFailed ? text(originalTrip?.groupName) : working.groupName,
      purpose: seferFailed ? original.purpose : working.purpose,
      fare: groupFailed ? text(originalTrip?.fare) : working.fare,
    },
    passengers: nextPassengers.filter(Boolean).map((passenger) => ({
      nationality: passenger.nationality,
      identityType: passenger.identityType,
      identityNumber: passenger.identityNumber,
      firstName: passenger.firstName,
      lastName: passenger.lastName,
      gender: passenger.gender,
      ministryReference: passenger.ministryReference,
    })),
    ministry: {
      ...ministry,
      passengerRefs: nextRefs.map((reference, index) => ({
        index,
        reference,
      })),
      cancelledPassengerRefs: cancelledRefs,
      lastPassengerNotifiedAt,
      lastPassengerNotifiedSource,
      lastMutations: operations,
      ministryVerification: {
        expectedPassengerCount: expectedCount,
        actualPassengerCount: ministryActiveCount,
        before: ozetWithoutSecrets(beforeOzet),
        bildirilenYolcuSayisi: afterOzet.bildirilenYolcuSayisi,
        iptalYolcuSayisi: afterOzet.iptalYolcuSayisi,
        sonYolcuBildirimTarihi: afterOzet.sonYolcuBildirimTarihi,
        ozet: ozetWithoutSecrets(afterOzet),
        countMismatch,
        driverVerified,
        vehicleVerified,
        expectedMinistryPlate: nextMinistryPlate,
      },
      assignmentSync: assignmentSync.attempted
        ? {
            source: "uetds-edit",
            reservationId: notification.reservationId,
            seferReferansNo: notification.ministryReference,
            previousDriverId: original.driverId,
            previousVehicleId: original.vehicleId,
            nextDriverId: text(asRecord(resultingDriver)?.id) || original.driverId,
            nextVehicleId: text(asRecord(resultingVehicle)?.id) || original.vehicleId,
            driverSynced: assignmentSync.driverOk,
            vehicleSynced: assignmentSync.vehicleOk,
            actorType: input.actorType,
            actorUserId: input.actorUserId,
          }
        : null,
    },
  };

  const fleetFailed =
    (driverChangeRequested && !driverVerified) || (vehicleChangeRequested && !vehicleVerified);
  const assignmentFailed = warning === "assignment-sync";
  const nextStatus = countMismatch || fleetFailed
    ? "update_error"
    : operations.length === 0
      ? notification.status
      : failed.length === 0 && !assignmentFailed
        ? "updated"
        : failed.length === operations.length
          ? "update_error"
          : "partial_update";

  if (!isUuid(notification.id)) {
    return { ok: false, error: "failed" };
  }
  await query(
    `UPDATE uetds_notifications
     SET status = $2,
         snapshot = $3::jsonb,
         driver_id = $4,
         vehicle_id = $5
     WHERE id = $1`,
    [
      notification.id,
      nextStatus,
      JSON.stringify(resulting),
      text(asRecord(resultingDriver)?.id) || original.driverId || null,
      text(asRecord(resultingVehicle)?.id) || original.vehicleId || null,
    ],
  );
  await insertRevision({
    notificationId: notification.id,
    actorType: input.actorType,
    actorUserId: input.actorUserId,
    previous: snapshot,
    resulting,
    changedFields: changed,
    operations,
  });
  const ministryMessage = firstFailedMinistryMessage(operations);
  if (countMismatch) {
    return { ok: false, error: "passenger-count-mismatch", operations, ministryMessage };
  }
  if (fleetFailed) {
    return { ok: false, error: "fleet-verify", operations, ministryMessage };
  }
  if (assignmentFailed) {
    return { ok: false, error: "assignment-sync", operations, ministryMessage };
  }
  if (failed.length === operations.length && operations.length > 0) {
    return { ok: false, error: "ministry", ministryMessage, operations };
  }
  if (failed.length > 0) {
    return { ok: true, status: "partial_update", operations, warning, ministryMessage };
  }
  return { ok: true, status: "updated", operations, warning };
}
