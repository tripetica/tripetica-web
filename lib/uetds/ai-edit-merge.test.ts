import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import { applyAiEditExtraction, passengerIdentity, prepareAiEditDrafts } from "@/lib/uetds/ai-edit";
import { mapAiUetdsExtraction } from "@/lib/uetds/ai-extraction-schema";
import { planAiEditContinue, type AiEditSnapshotMeta } from "@/lib/uetds/ai-edit-snapshot";
import { createEmptyDraft, createPassengerDraft, type UetdsDraft } from "@/lib/uetds/draft";

const NOW = istanbulLocalToUtcMs("2026-09-30T12:00");

function named(firstName: string, lastName: string, index: number) {
  return createPassengerDraft({
    key: `pax-${index}`,
    firstName,
    lastName,
    nationality: "TR",
    identityNumber: `A${String(index).padStart(7, "0")}123`,
    gender: index % 2 === 0 ? "male" : "female",
  });
}

function notified(count: number, names?: Array<[string, string]>): { original: UetdsDraft; edited: UetdsDraft } {
  const draft = createEmptyDraft("manual", { applyTripDefaults: false });
  draft.origin = "Istanbul Airport";
  draft.destination = "X Hotel, Kadıköy, İstanbul";
  draft.startDate = "2026-10-02";
  draft.startTime = "09:00";
  draft.endDate = "2026-10-02";
  draft.endTime = "13:00";
  draft.groupName = "Grup A";
  draft.driverId = "driver-1";
  draft.vehicleId = "vehicle-1";
  draft.passengers = Array.from({ length: count }, (_, index) => {
    const pair = names?.[index] ?? [`Yolcu${index + 1}`, "Eski"];
    return named(pair[0], pair[1], index);
  });
  return prepareAiEditDrafts(draft);
}

function incomingNames(names: Array<[string, string]>, extras?: Array<Record<string, string | undefined>>) {
  return names.map(([firstName, lastName], index) => ({
    firstName,
    lastName,
    nationality: "TR",
    gender: "female" as const,
    ...(extras?.[index] ?? {}),
  }));
}

test("A: 7 old passengers and 3 extracted rows update only the first 3", () => {
  const { original, edited } = notified(7);
  const before = original.passengers.map(passengerIdentity);
  const next = applyAiEditExtraction(edited, {
    passengers: incomingNames([
      ["Ayse", "Ketenci"],
      ["Hacer", "Ketenci"],
      ["Mine", "Ketenci"],
    ]),
  }, NOW).draft;
  assert.equal(next.passengers.length, 7);
  assert.equal(next.passengers[0].firstName, "Ayse");
  assert.equal(next.passengers[1].lastName, "Ketenci");
  assert.equal(next.passengers[2].firstName, "Mine");
  assert.equal(next.passengers[3].firstName, "Yolcu4");
  assert.equal(next.passengers[6].firstName, "Yolcu7");
  assert.equal(next.passengers[0].identityNumber, "11111111111");
  assert.equal(next.passengers[2].identityNumber, "11111111111");
  assert.equal(next.passengers[3].identityNumber, original.passengers[3].identityNumber);
  assert.equal(next.passengers[6].identityNumber, original.passengers[6].identityNumber);
  assert.deepEqual(original.passengers.map(passengerIdentity), before);
});

test("B: 3 old and 3 new rows all update", () => {
  const { edited } = notified(3, [["Ahmet", "Yilmaz"], ["Bekir", "Yilmaz"], ["Cem", "Yilmaz"]]);
  const next = applyAiEditExtraction(edited, {
    passengers: incomingNames([
      ["Ayse", "Ketenci"],
      ["Hacer", "Ketenci"],
      ["Mine", "Ketenci"],
    ]),
  }, NOW).draft;
  assert.deepEqual(next.passengers.map((passenger) => passenger.firstName), ["Ayse", "Hacer", "Mine"]);
  assert.deepEqual(next.passengers.map((passenger) => passenger.lastName), ["Ketenci", "Ketenci", "Ketenci"]);
});

test("C: 3 old and 5 new rows do not open extra passenger lines", () => {
  const { edited } = notified(3);
  const next = applyAiEditExtraction(edited, {
    passengerCount: 5,
    passengers: incomingNames([
      ["Ayse", "Ketenci"],
      ["Hacer", "Ketenci"],
      ["Mine", "Ketenci"],
      ["Derya", "Ketenci"],
      ["Eda", "Ketenci"],
    ]),
  }, NOW).draft;
  assert.equal(next.passengers.length, 3);
  assert.equal(next.passengers[2].firstName, "Mine");
  assert.equal(next.passengers[0].identityNumber, "11111111111");
  assert.equal(next.passengers.some((passenger) => passenger.firstName === "Derya"), false);
});

test("D: a field the extraction omits keeps the notified value", () => {
  const { edited } = notified(2);
  const next = applyAiEditExtraction(edited, {
    passengers: incomingNames([["Ayse", "Ketenci"], ["Hacer", "Ketenci"]]),
  }, NOW).draft;
  assert.equal(next.destination, "X Hotel, Kadıköy, İstanbul");
  assert.equal(next.groupName, "Grup A");
  assert.equal(next.driverId, "driver-1");
  assert.equal(next.vehicleId, "vehicle-1");
  assert.equal(next.startDate, "2026-10-02");
  assert.equal(next.startTime, "09:00");
});

test("E: an incomplete new place replaces the old value and stays in review", () => {
  const { edited } = notified(1);
  const next = applyAiEditExtraction(edited, { destination: "Hilton" }, NOW).draft;
  assert.equal(next.destination, "Hilton");
  assert.equal(next.destinationReview, true);
  assert.equal(next.destination.includes("X Hotel"), false);
});

test("F: a missing passenger subfield does not blank gender and does not keep the previous nationality", () => {
  const { edited } = notified(1, [["Ahmet", "Yilmaz"]]);
  const gender = edited.passengers[0].gender;
  const next = applyAiEditExtraction(edited, {
    passengers: [{ firstName: "Ayse", lastName: "Ketenci" }],
  }, NOW).draft;
  assert.equal(next.passengers[0].firstName, "Ayse");
  assert.equal(next.passengers[0].lastName, "Ketenci");
  assert.equal(next.passengers[0].gender, gender);
  assert.equal(next.passengers[0].nationality, "");
});

test("replaced rows take the new nationality and the full passport, and later rows stay", () => {
  const { original, edited } = notified(6, [
    ["Eski", "Bir"],
    ["Eski", "Iki"],
    ["Eski", "Uc"],
    ["Eski", "Dort"],
    ["Eski", "Bes"],
    ["Eski", "Alti"],
  ]);
  original.destination = "Şişli";
  edited.destination = "Şişli";
  for (const passenger of original.passengers) passenger.nationality = "LY";
  for (const passenger of edited.passengers) {
    passenger.nationality = "LY";
    passenger.provenance = { ...passenger.provenance, nationality: "reservation", identityNumber: "reservation" };
  }
  const mapped = mapAiUetdsExtraction({
    origin: null,
    destination: "Fatih",
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
    tripKind: null,
    purpose: null,
    fare: null,
    flightCode: null,
    passengers: [
      { firstName: "Donglee", lastName: "Shin", nationality: "Güney Kore", gender: "male", identityNumber: "M868P8841" },
      { firstName: "Cholpon", lastName: "Duishoeva", nationality: "Rusya", gender: "female", identityNumber: "760892803" },
      { firstName: "Tattigul", lastName: "Ergeshova", nationality: "Kırgızistan", gender: "female", identityNumber: "KP0435673" },
    ],
  }, "", NOW);
  const next = applyAiEditExtraction(edited, mapped, NOW).draft;
  const meta: AiEditSnapshotMeta = {
    notificationId: "11111111-1111-1111-1111-111111111111",
    partnerId: "22222222-2222-2222-2222-222222222222",
    companyId: null,
    companyName: "Search Travel",
    seferReference: null,
    plate: "34 EGP 847",
    driverName: "Recep Yildirim",
    vehicleLabel: "34 EGP 847",
  };
  const planned = planAiEditContinue({
    existingOld: null,
    originalDraft: original,
    currentDraft: next,
    meta,
    authorityId: "faebc83f-18b5-49e0-b4f7-b7d2748042bf",
  });
  assert.equal(original.destination, "Şişli");
  assert.equal(planned.old.destination.place, "Şişli");
  assert.equal(next.destination, "Fatih");
  assert.equal(planned.plan.dropoff_changed, true);
  assert.equal(planned.openLogin, true);
  assert.equal(planned.plan.passenger_changes[0]?.old_index, 1);
  assert.equal(planned.plan.passenger_changes[0]?.old.nationality, "LY");
  assert.equal(planned.plan.passenger_changes[0]?.new.document_number, "M868P8841");
  assert.equal(planned.plan.passenger_changes[0]?.new.nationality, "KR");
  assert.equal(planned.plan.passenger_changes[2]?.old_index, 3);
  assert.equal(planned.plan.passenger_changes.length, 3);
  assert.equal(next.passengers.length, 6);
  assert.equal(next.passengers[0].nationality, "KR");
  assert.equal(next.passengers[0].identityNumber, "M868P8841");
  assert.equal(next.passengers[0].gender, "male");
  assert.equal(next.passengers[1].nationality, "RU");
  assert.equal(next.passengers[1].identityNumber, "760892803");
  assert.equal(next.passengers[2].nationality, "KG");
  assert.equal(next.passengers[2].identityNumber, "KP0435673");
  assert.equal(next.passengers[3].firstName, "Eski");
  assert.equal(next.passengers[3].nationality, "LY");
  assert.equal(next.passengers[5].lastName, "Alti");
  assert.equal(next.passengers[5].nationality, "LY");
});

test("replaced passenger without a document number does not inherit the previous passport", () => {
  const { edited } = notified(3, [
    ["Ahmet", "Yilmaz"],
    ["Bekir", "Yilmaz"],
    ["Mehmet", "Yilmaz"],
  ]);
  edited.passengers[0].identityNumber = "AB123456";
  edited.passengers[1].identityNumber = "CD987654";
  edited.passengers[2].identityNumber = "EF456789";
  const previousPassport = edited.passengers[0].identityNumber;
  const next = applyAiEditExtraction(edited, {
    passengers: [
      { firstName: "Mario", lastName: "Riccardi" },
      { firstName: "Assonta", lastName: "Esposet", identityNumber: "XY555555" },
    ],
  }, NOW).draft;
  assert.equal(next.passengers.length, 3);
  assert.equal(next.passengers[0].firstName, "Mario");
  assert.equal(next.passengers[0].identityNumber, "11111111111");
  assert.equal(next.passengers[1].firstName, "Assonta");
  assert.equal(next.passengers[1].identityNumber, "XY555555");
  assert.equal(next.passengers[2].firstName, "Mehmet");
  assert.equal(next.passengers[2].identityNumber, "EF456789");
  assert.notEqual(next.passengers[0].identityNumber, previousPassport);
});

test("G: original snapshot stays intact after the edited state changes", () => {
  const { original, edited } = notified(2, [["Ahmet", "Yilmaz"], ["Bekir", "Yilmaz"]]);
  const snapshot = JSON.stringify(original);
  applyAiEditExtraction(edited, {
    destination: "Hilton",
    passengers: incomingNames([["Ayse", "Ketenci"], ["Hacer", "Ketenci"]]),
  }, NOW);
  edited.passengers[0].firstName = "Mutated";
  assert.equal(JSON.stringify(original), snapshot);
  assert.equal(original.passengers[0].firstName, "Ahmet");
  assert.equal(original.destination, "X Hotel, Kadıköy, İstanbul");
});

test("yearless past date does not replace an existing AI-edit start with next year or +65", () => {
  const { edited } = notified(1);
  const mapped = mapAiUetdsExtraction(
    {
      origin: null, destination: null, startDate: "2027-09-27", startTime: "12:00",
      endDate: null, endTime: null, tripKind: null, purpose: null, fare: null, flightCode: null,
      passengers: [],
    },
    "27 Eylül 12:00",
    NOW,
  );
  const next = applyAiEditExtraction(edited, mapped, NOW).draft;
  assert.equal(next.startDate, "2026-10-02");
  assert.equal(next.startTime, "09:00");
});

test("AI edit reuses the notification form and does not start Kamu automation", () => {
  const form = readFileSync("components/uetds/uetds-notification-form.tsx", "utf8");
  const modal = readFileSync("components/uetds/uetds-edit-method-modal.tsx", "utf8");
  const partner = readFileSync("app/[locale]/partner/(panel)/uetds/notifications/[id]/ai-edit/page.tsx", "utf8");
  const ops = readFileSync("app/[locale]/ops/(panel)/uetds/notifications/[id]/ai-edit/page.tsx", "utf8");
  assert.match(form, /lockPassengerCount: true/);
  assert.match(form, /preserveUntouchedTimes: true/);
  assert.match(form, /replaceMissingDocument: true/);
  assert.match(form, /authorityForNotificationForm/);
  assert.match(form, /data-edevlet-authority-id/);
  assert.doesNotMatch(form, /name="edevletAuthorityId"/);
  assert.match(form, /originalDraftRef/);
  assert.match(form, /copy\.aiEditContinue/);
  assert.match(form, /AiEditLunaWorkspace/);
  assert.match(form, /captureAiEditSnapshot/);
  assert.match(form, /planAiEditContinue/);
  assert.match(form, /setLunaOpen\(true\)/);
  assert.doesNotMatch(form, /setAiContinueHint\(copy\.extractNone\)/);
  assert.doesNotMatch(form, /unsealSecret|kamu-portal|window\.open/);
  assert.equal((form.match(/oldSnapshotRef\.current = null/g) ?? []).length, 1);
  assert.match(modal, /href=\{aiEditHref\}/);
  assert.doesNotMatch(modal, /setAiNotice/);
  assert.match(partner, /UetdsNotificationForm/);
  assert.match(partner, /prepareAiEditDrafts/);
  assert.match(partner, /notificationHasGoldDriver/);
  assert.doesNotMatch(partner, /updateUetdsNotificationAction|unsealSecret|kamu-portal/);
  assert.match(ops, /UetdsNotificationForm/);
  assert.doesNotMatch(ops, /updateUetdsNotificationAction|unsealSecret/);
  assert.match(readFileSync("components/uetds/uetds-notification-edit-form.tsx", "utf8"), /updateUetdsNotificationAction/);
  assert.doesNotMatch(form, /conflict\.path === "tripKind"/);
  assert.match(form, /copy\.keepCurrent/);
  assert.match(form, /copy\.useExtracted/);
});

test("AI edit applies a valid extracted tripKind without a conflict row", () => {
  const { edited } = notified(1);
  assert.equal(edited.tripKind, "transfer");
  const merged = applyAiEditExtraction(edited, { tripKind: "tour", destination: "Hilton Istanbul" }, NOW);
  assert.equal(merged.draft.tripKind, "tour");
  assert.equal(merged.draft.destination, "Hilton Istanbul");
  assert.equal(merged.conflicts.some((item) => item.path === "tripKind"), false);
  assert.equal(merged.conflicts.some((item) => item.label === "tripKind"), false);
});

test("AI edit keeps the notified tripKind when extraction omits it", () => {
  const { edited } = notified(1);
  edited.tripKind = "charter";
  const merged = applyAiEditExtraction(edited, {
    destination: "Hilton Istanbul",
    passengers: incomingNames([["Ayse", "Yeni"]]),
  }, NOW);
  assert.equal(merged.draft.tripKind, "charter");
  assert.equal(merged.draft.destination, "Hilton Istanbul");
  assert.equal(merged.draft.passengers[0].firstName, "Ayse");
  assert.equal(merged.draft.passengers[0].identityNumber, "11111111111");
  assert.equal(merged.conflicts.some((item) => item.path === "tripKind"), false);
});

test("AI edit tripKind conflict labels are not produced for the choice buttons", () => {
  const { edited } = notified(1);
  const merged = applyAiEditExtraction(edited, { tripKind: "tour" }, NOW);
  const rendered = merged.conflicts.map((conflict) => `${conflict.label}: ${conflict.current} / ${conflict.incoming}`).join("\n");
  assert.equal(rendered.includes("tripKind:"), false);
  assert.equal(rendered.includes("Mevcut değeri koru"), false);
  assert.equal(rendered.includes("Belgedeki değeri kullan"), false);
  assert.equal(merged.draft.tripKind, "tour");
});
