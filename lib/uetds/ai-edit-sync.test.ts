import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyAiEditTargetSnapshot, finishAiEditPortalSync, readUnfinishedPortalSync } from "@/lib/uetds/ai-edit-target";
import { mapAiUetdsExtraction } from "@/lib/uetds/ai-extraction-schema";
import { createEmptyDraft } from "@/lib/uetds/draft";
import { nextPassengerSyncStep, planPassengerReplacements } from "@/lib/uetds/kamu-portal/edit-plan";

const empty = {
  origin: null, destination: null, startDate: null, startTime: null, endDate: null, endTime: null,
  tripKind: null, purpose: null, fare: null, flightCode: null, passengers: [],
};

test("an empty or Diğer group description becomes Transfer", () => {
  const blank = mapAiUetdsExtraction(empty);
  assert.equal(blank.purpose, "Transfer");
  assert.equal(blank.tripKind, "transfer");
  const other = mapAiUetdsExtraction({ ...empty, tripKind: "other", purpose: "Diğer" });
  assert.equal(other.purpose, "Transfer");
  assert.equal(other.tripKind, "transfer");
  const tour = mapAiUetdsExtraction({ ...empty, tripKind: "tour", purpose: "Tur" });
  assert.equal(tour.purpose, "Tur");
  assert.equal(tour.tripKind, "tour");
  const form = readFileSync("components/uetds/uetds-notification-form.tsx", "utf8");
  assert.doesNotMatch(form, /\["other", copy\.tripOther\]/);
  assert.match(form, /\["transfer", copy\.tripTransfer\]/);
  assert.match(form, /\["charter", copy\.tripCharter\]/);
});

test("an explicit description overrides only the fields it names", () => {
  const time = mapAiUetdsExtraction(
    { ...empty, startDate: "2026-10-01", startTime: "18:00", destination: "Taksim" },
    "Alış saati 17:00 olarak değişti.",
  );
  assert.equal(time.startTime, "17:00");
  assert.equal(time.startDate, "2026-10-01");
  assert.equal(time.destination, "Taksim");

  const place = mapAiUetdsExtraction(
    { ...empty, origin: "Havalimanı", destination: "Taksim", startDate: "2026-10-01", startTime: "18:00" },
    "Bırakma yeri Bakırköy olacak.",
  );
  assert.equal(place.destination, "Bakırköy");
  assert.equal(place.origin, "Havalimanı");
  assert.equal(place.startTime, "18:00");
});

test("continue persists the current form as the target and a portal failure does not restore it", () => {
  const previous = {
    source: "manual",
    trip: {
      origin: "Bağcılar",
      destination: "Taksim",
      originLocation: { provinceName: "İstanbul", districtOrAirportName: "Bağcılar", placeName: "Bağcılar" },
      destinationLocation: { provinceName: "İstanbul", districtOrAirportName: "Beyoğlu", placeName: "Taksim" },
      purpose: "Transfer",
      tripKind: "transfer",
    },
    passengers: [{ firstName: "Eski", lastName: "Yolcu", nationality: "TR", identityNumber: "11111111111", gender: "female" }],
    ministry: { seferReferansNo: "2609307206518656" },
  };
  const draft = createEmptyDraft("manual");
  draft.origin = "Küçükçekmece";
  draft.destination = "Bakırköy";
  draft.originLocation = { ...draft.originLocation, provinceName: "İstanbul", districtOrAirportName: "Küçükçekmece", placeName: "Küçükçekmece" };
  draft.destinationLocation = { ...draft.destinationLocation, provinceName: "İstanbul", districtOrAirportName: "Bakırköy", placeName: "Bakırköy" };
  draft.passengers[0] = { ...draft.passengers[0]!, firstName: "Ayşe", lastName: "Yılmaz", nationality: "TR", identityNumber: "11111111111", gender: "female" };
  const saved = applyAiEditTargetSnapshot(previous, draft);
  const trip = saved.trip as { origin: string; destination: string };
  const passengers = saved.passengers as Array<{ firstName: string }>;
  const ministry = saved.ministry as { seferReferansNo: string };
  assert.equal(trip.origin, "Küçükçekmece");
  assert.equal(passengers[0]?.firstName, "Ayşe");
  assert.equal(ministry.seferReferansNo, "2609307206518656");
  const sync = readUnfinishedPortalSync(saved);
  assert.equal(sync?.passengers[0]?.firstName, "Eski");
  assert.equal(sync?.pickup.districtName, "Bağcılar");

  const retry = applyAiEditTargetSnapshot(saved, draft);
  assert.equal((retry.trip as { origin: string }).origin, "Küçükçekmece");
  assert.equal(readUnfinishedPortalSync(retry)?.passengers[0]?.firstName, "Eski");

  const afterPortalFailure = saved;
  assert.equal((afterPortalFailure.trip as { origin: string }).origin, "Küçükçekmece");
  assert.equal((afterPortalFailure.passengers as Array<{ firstName: string }>)[0]?.firstName, "Ayşe");
  const finished = finishAiEditPortalSync(saved);
  assert.equal((finished?.trip as { origin: string }).origin, "Küçükçekmece");
  assert.equal((finished?.passengers as Array<{ firstName: string }>)[0]?.firstName, "Ayşe");
  assert.equal(readUnfinishedPortalSync(finished), null);

  const form = readFileSync("components/uetds/uetds-notification-form.tsx", "utf8");
  const body = form.slice(form.indexOf("async function continueAiEdit"), form.indexOf("const visibleFieldErrors"));
  assert.ok(body.indexOf("await persistAiEditTargetAction") >= 0);
  assert.ok(body.indexOf("await persistAiEditTargetAction") < body.indexOf("setLunaOpen(true)"));
  assert.doesNotMatch(body, /passenger_changes/);
  assert.match(readFileSync("lib/uetds/ai-edit-target-store.ts", "utf8"), /UPDATE uetds_notifications SET snapshot/);
  assert.doesNotMatch(readFileSync("lib/uetds/kamu-portal/live-update.ts", "utf8"), /UPDATE uetds_notifications/);
});

test("a ministry list that already has the target passenger does not report the old passenger as missing", () => {
  const [updated, missing] = planPassengerReplacements(
    [
      { index: 1, nationality: "TR", documentNumber: "11111111111", firstName: "Eski", lastName: "Bir", gender: "female" },
      { index: 2, nationality: "TR", documentNumber: "11111111111", firstName: "Eski", lastName: "Iki", gender: "female" },
    ],
    [
      { index: 1, nationality: "TR", documentNumber: "11111111111", firstName: "Ayşe", lastName: "Yılmaz", gender: "female" },
      { index: 2, nationality: "TR", documentNumber: "11111111111", firstName: "Fatma", lastName: "Yılmaz", gender: "female" },
    ],
  );
  const listed = [
    { index: 4, nationality: "TR", documentNumber: "11111111111", firstName: "Ayşe", lastName: "Yılmaz", gender: "Kadın" },
    { index: 9, nationality: "TR", documentNumber: "11111111111", firstName: "Eski", lastName: "Iki", gender: "Kadın" },
  ];
  assert.equal(nextPassengerSyncStep(updated!, listed).action, "skip");
  assert.deepEqual(nextPassengerSyncStep(missing!, listed), { action: "update", yolcuIndex: 9 });
  const neither = [{ index: 3, nationality: "TR", documentNumber: "AA1", firstName: "Baska", lastName: "Kisi", gender: "Erkek" }];
  assert.equal(nextPassengerSyncStep(missing!, neither).action, "error");
});
