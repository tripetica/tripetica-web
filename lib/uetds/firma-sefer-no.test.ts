import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAiEditTargetSnapshot } from "@/lib/uetds/ai-edit-target";
import { createEmptyDraft } from "@/lib/uetds/draft";
import { lockUetdsNotificationIdentities, readStoredFirmaSeferNo, readStoredMinistrySeferRef } from "@/lib/uetds/firma-sefer-no";

const FIRMA = "TRP-1790896262139";
const MINISTRY = "2610027214572618";

const previous = {
  source: "manual",
  reservationId: null,
  trip: {
    origin: "Bağcılar",
    destination: "Taksim",
    originLocation: { provinceName: "İstanbul", districtOrAirportName: "Bağcılar", placeName: "Bağcılar" },
    destinationLocation: { provinceName: "İstanbul", districtOrAirportName: "Beyoğlu", placeName: "Taksim" },
    startDate: "2026-10-01",
    startTime: "09:00",
    endDate: "2026-10-01",
    endTime: "12:00",
    purpose: "Transfer",
    tripKind: "transfer",
  },
  passengers: [{ firstName: "Eski", lastName: "Yolcu", nationality: "TR", identityNumber: "11111111111", gender: "female" }],
  ministry: { seferReferansNo: MINISTRY, firmaSeferNo: FIRMA },
};

test("detail identities stay separate", () => {
  assert.equal(readStoredFirmaSeferNo(previous), FIRMA);
  assert.equal(readStoredMinistrySeferRef(previous), MINISTRY);
  assert.notEqual(readStoredFirmaSeferNo(previous), readStoredMinistrySeferRef(previous));
  const detail = readFileSync("components/uetds/uetds-notification-detail.tsx", "utf8");
  assert.match(detail, /copy\.firmaSeferNo/);
  assert.match(detail, /copy\.seferRef/);
  assert.match(detail, /displayedFirmaSeferNo/);
  const firmaAt = detail.indexOf("copy.firmaSeferNo");
  const refAt = detail.indexOf("copy.seferRef");
  assert.ok(firmaAt >= 0 && refAt > firmaAt);
});

test("AI edit shows Firma Sefer No as text, not an editable field", () => {
  const form = readFileSync("components/uetds/uetds-notification-form.tsx", "utf8");
  assert.match(form, /copy\.firmaSeferNo/);
  assert.match(form, /aiEdit\.meta\.firmaSeferNo/);
  assert.doesNotMatch(form, /name=["']firmaSeferNo["']/);
  const ops = readFileSync("app/[locale]/ops/(panel)/uetds/notifications/[id]/ai-edit/page.tsx", "utf8");
  const partner = readFileSync("app/[locale]/partner/(panel)/uetds/notifications/[id]/ai-edit/page.tsx", "utf8");
  assert.match(ops, /firmaSeferNo: readStoredFirmaSeferNo/);
  assert.match(partner, /firmaSeferNo: readStoredFirmaSeferNo/);
});

test("TARGET save keeps Firma Sefer No and ministry reference", () => {
  const draft = createEmptyDraft("manual");
  draft.origin = "Küçükçekmece";
  draft.destination = "Bakırköy";
  draft.startDate = "2026-10-02";
  draft.startTime = "10:00";
  draft.endDate = "2026-10-02";
  draft.endTime = "13:00";
  draft.passengers[0] = { ...draft.passengers[0]!, firstName: "Ayşe", lastName: "Yılmaz", nationality: "TR", identityNumber: "11111111111", gender: "female" };
  const saved = applyAiEditTargetSnapshot(previous, draft);
  const trip = saved.trip as { origin: string; destination: string; startDate: string; startTime: string; endDate: string; endTime: string };
  const passengers = saved.passengers as Array<{ firstName: string }>;
  assert.equal(trip.origin, "Küçükçekmece");
  assert.equal(trip.destination, "Bakırköy");
  assert.equal(trip.startDate, "2026-10-01");
  assert.equal(trip.startTime, "09:00");
  assert.equal(trip.endDate, "2026-10-01");
  assert.equal(trip.endTime, "12:00");
  assert.equal(passengers[0]?.firstName, "Ayşe");
  assert.equal(readStoredFirmaSeferNo(saved), FIRMA);
  assert.equal(readStoredMinistrySeferRef(saved), MINISTRY);
});

test("a payload that replaces Firma Sefer No is ignored", () => {
  const poisoned = {
    ...previous,
    reservationId: "TRP-HACK",
    trip: { ...previous.trip, firmaSeferNo: "TRP-HACK", origin: "Yeni" },
    ministry: { seferReferansNo: "000", firmaSeferNo: "TRP-HACK" },
  };
  const locked = lockUetdsNotificationIdentities(previous, poisoned);
  assert.equal(readStoredFirmaSeferNo(locked), FIRMA);
  assert.equal(readStoredMinistrySeferRef(locked), MINISTRY);
  assert.equal((locked.trip as { origin: string; firmaSeferNo?: string }).origin, "Yeni");
  assert.equal((locked.trip as { firmaSeferNo?: string }).firmaSeferNo, undefined);
  assert.equal(locked.reservationId, null);
});
