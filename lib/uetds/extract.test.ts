import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDraft, createPassengerDraft } from "@/lib/uetds/draft";
import { countryIso2FromName, extractUetdsFromText, mergeExtractedDraft } from "@/lib/uetds/extract";
import { mapAiUetdsExtraction, mergeAiUetdsExtraction } from "@/lib/uetds/ai-extraction-schema";
import { isOfficialUetdsLocationReady } from "@/lib/uetds/location";
import { prefillUetdsDraftFromReservation } from "@/lib/uetds/prefill";

test("text extraction fills known fields and does not invent identity numbers", () => {
  const extracted = extractUetdsFromText(`
    From: Istanbul Airport
    To: Hilton Istanbul Bomonti
    Date: 21.09.2026
    Time: 14:30
    PAX: 3
    Name: Ahmed Ali
    Passport: A12345678
    Nationality: Libya
  `);
  assert.equal(extracted.origin, "Istanbul Airport");
  assert.equal(extracted.destination, "Hilton Istanbul Bomonti");
  assert.equal(extracted.startDate, "2026-09-21");
  assert.equal(extracted.startTime, "14:30");
  assert.equal(extracted.passengerCount, 3);
  assert.equal(extracted.passengers?.[0]?.firstName, "Ahmed");
  assert.equal(extracted.passengers?.[0]?.lastName, "Ali");
  assert.equal(extracted.passengers?.[0]?.identityNumber, "A12345678");
  assert.equal(extracted.passengers?.[0]?.nationality, "LY");
  assert.doesNotMatch(JSON.stringify(extracted), /11111111111/);
});

test("country names resolve without inventing unknown codes", () => {
  assert.equal(countryIso2FromName("Libya"), "LY");
  assert.equal(countryIso2FromName("Türkiye"), "TR");
  assert.equal(countryIso2FromName("İngiltere"), "GB");
  assert.equal(countryIso2FromName("England"), "GB");
  assert.equal(countryIso2FromName("Narnia"), null);
});

const EXAMPLE_LIST = `
Not: İsimler örnek olarak oluşturulmuştur gerçek yolcu isimleri değildir.
İsim Soyisim:
1. Oliver Bennett
2. Charlotte Bennett
3. William Parker
4. Emily Parker
Ülke: İngiltere
Kişi Sayısı: 4
Saat: 15:30
Alış: Sultanahmet
Bırakış: İstanbul Havalimanı (IST)
Açıklama: Transfer
Ücret: 40 TL
`;

test("a numbered example list keeps every passenger and the shared country", () => {
  const extracted = extractUetdsFromText(EXAMPLE_LIST);
  assert.equal(extracted.passengers?.length, 4);
  assert.deepEqual(extracted.passengers?.map((passenger) => [passenger.firstName, passenger.lastName, passenger.nationality]), [
    ["Oliver", "Bennett", "GB"],
    ["Charlotte", "Bennett", "GB"],
    ["William", "Parker", "GB"],
    ["Emily", "Parker", "GB"],
  ]);
  assert.equal(extracted.startTime, "15:30");
  assert.equal(extracted.origin, "Sultanahmet");
  assert.equal(extracted.destination, "İstanbul Havalimanı (IST)");
  assert.equal(extracted.fare, "40");
  assert.equal(extracted.passengerCount, 4);
});

test("an image extraction with an empty passenger array still uses the visible list", () => {
  const mapped = mapAiUetdsExtraction({
    origin: null,
    destination: null,
    startDate: null,
    startTime: "15:30",
    endDate: null,
    endTime: null,
    tripKind: "transfer",
    purpose: "Transfer",
    fare: "40",
    flightCode: null,
    visibleText: EXAMPLE_LIST,
    passengers: [],
  });
  assert.equal(mapped.passengers?.length, 4);
  assert.equal(mapped.passengers?.[0]?.firstName, "Oliver");
  assert.equal(mapped.passengers?.[3]?.lastName, "Parker");
  assert.equal(mapped.passengers?.every((passenger) => passenger.nationality === "GB"), true);
  const merged = mergeAiUetdsExtraction(createEmptyDraft("manual"), mapped, Date.parse("2026-10-10T09:00:00Z"));
  assert.equal(merged.draft.passengers.length, 4);
  assert.equal(merged.draft.passengers[1]?.firstName, "Charlotte");
  assert.equal(merged.draft.passengers[1]?.nationality, "GB");
  assert.equal(merged.draft.fare, "40");
  assert.equal(merged.draft.startTime, "15:30");
  assert.equal(merged.draft.origin, "Sultanahmet");
  assert.equal(merged.draft.destination, "İstanbul Havalimanı (IST)");
});

test("nameless model shells do not hide the readable passenger list", () => {
  const mapped = mapAiUetdsExtraction({
    origin: null,
    destination: null,
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
    tripKind: "transfer",
    purpose: null,
    fare: "40",
    flightCode: null,
    visibleText: EXAMPLE_LIST,
    passengers: [
      { firstName: null, lastName: null, nationality: "İngiltere", identityNumber: null, gender: "male" },
      { firstName: null, lastName: null, nationality: "İngiltere", identityNumber: null, gender: "female" },
    ],
  });
  assert.equal(mapped.passengers?.length, 4);
  assert.deepEqual(
    mapped.passengers?.map((passenger) => [passenger.firstName, passenger.lastName, passenger.nationality]),
    [
      ["Oliver", "Bennett", "GB"],
      ["Charlotte", "Bennett", "GB"],
      ["William", "Parker", "GB"],
      ["Emily", "Parker", "GB"],
    ],
  );
  assert.equal(mapped.fare, "40");
  assert.equal(mapped.startTime, "15:30");
  assert.equal(mapped.origin, "Sultanahmet");
});

test("a user-edited passenger name is kept when a document extraction disagrees", () => {
  const draft = createEmptyDraft("manual");
  draft.passengers[0] = createPassengerDraft({
    firstName: "Ayşe",
    lastName: "Yılmaz",
    provenance: { ...draft.passengers[0].provenance, firstName: "user", lastName: "user" },
  });
  const merged = mergeExtractedDraft(draft, {
    passengers: [{ firstName: "Oliver", lastName: "Bennett", nationality: "GB" }],
  });
  assert.equal(merged.draft.passengers[0]?.firstName, "Ayşe");
  assert.equal(merged.draft.passengers[0]?.lastName, "Yılmaz");
  assert.equal(merged.draft.passengers[0]?.nationality, "GB");
  assert.equal(merged.conflicts.some((conflict) => conflict.path === "passengers.0.firstName"), true);
});

test("a model passenger who is not in the readable list is kept", () => {
  const mapped = mapAiUetdsExtraction({
    origin: null,
    destination: null,
    startDate: null,
    startTime: null,
    endDate: null,
    endTime: null,
    tripKind: null,
    purpose: null,
    fare: null,
    flightCode: null,
    visibleText: "1. Someone Else\nÜlke: Libya",
    passengers: [
      { firstName: "Oliver", lastName: "Bennett", nationality: "GB", identityNumber: "A12345678", gender: "male" },
    ],
  });
  assert.equal(mapped.passengers?.length, 1);
  assert.equal(mapped.passengers?.[0]?.firstName, "Oliver");
  assert.equal(mapped.passengers?.[0]?.identityNumber, "A12345678");
  assert.equal(mapped.passengers?.[0]?.nationality, "GB");
});

test("İngiltere on a structured passenger maps to the ministry country code", () => {
  const mapped = mapAiUetdsExtraction({
    origin: "Sultanahmet",
    destination: "İstanbul Havalimanı (IST)",
    startDate: null,
    startTime: "15:30",
    endDate: null,
    endTime: null,
    tripKind: "transfer",
    purpose: "Transfer",
    fare: "40",
    flightCode: null,
    visibleText: null,
    passengers: [
      { firstName: "Oliver Bennett", lastName: null, nationality: "İngiltere", identityNumber: null, gender: "male" },
    ],
  });
  assert.equal(mapped.passengers?.[0]?.firstName, "Oliver");
  assert.equal(mapped.passengers?.[0]?.lastName, "Bennett");
  assert.equal(mapped.passengers?.[0]?.nationality, "GB");
});

test("extraction does not silently overwrite reservation prefill", () => {
  const draft = prefillUetdsDraftFromReservation({
    reservationId: "11111111-1111-1111-1111-111111111111",
    pickupName: "Istanbul Airport",
    dropoffName: "Sisli",
    pickupAt: "2026-09-21T11:30:00.000Z",
    passengerCount: 3,
    serviceType: "transfer",
    tourCode: null,
    notes: null,
    driverId: "d1",
    vehicleId: "v1",
    driverKind: "registered",
    vehicleKind: "registered",
    passengers: [
      {
        firstName: "Ahmed",
        lastName: "Ali",
        countryCode: "LY",
        identityNumber: null,
        gender: "male",
      },
    ],
  });
  assert.equal(draft.passengers.length, 3);
  assert.equal(draft.passengers[0]?.firstName, "Ahmed");
  assert.equal(draft.passengers[1]?.firstName, "");
  assert.equal(draft.passengers[0]?.identityNumber, "11111111111");
  assert.equal(isOfficialUetdsLocationReady(draft.originLocation), true);
  assert.equal(draft.originLocation.locationType, "airport");
  assert.equal(draft.originLocation.districtOrAirportCode, "99157");
  assert.doesNotMatch(draft.originLocation.districtOrAirportCode, /IST/i);
  assert.equal(isOfficialUetdsLocationReady(draft.destinationLocation), true);
  const merged = mergeExtractedDraft(draft, {
    passengers: [{ firstName: "Ahmed", lastName: "Aly" }],
  });
  assert.equal(merged.draft.passengers[0]?.lastName, "Ali");
  assert.equal(merged.conflicts.length, 1);
  assert.equal(merged.conflicts[0]?.incoming, "Aly");
});

test("informal voucher and WhatsApp text maps onto the canonical form fields", () => {
  const extracted = extractUetdsFromText(`
20.09.2026
Alış saati 03:00
Bırakma saati 04:30
Alış yeri İstanbul Havalimanı
Bırakma yeri Başakşehir
3 pax
Ahmed Ali
Passport: A12345678
Nationality: Libya
  `);
  assert.equal(extracted.origin, "İstanbul Havalimanı");
  assert.equal(extracted.destination, "Başakşehir");
  assert.equal(extracted.startDate, "2026-09-20");
  assert.equal(extracted.startTime, "03:00");
  assert.equal(extracted.endTime, "04:30");
  assert.equal(extracted.passengerCount, 3);
  assert.equal(extracted.passengers?.[0]?.identityNumber, "A12345678");
  assert.equal(extracted.passengers?.[0]?.nationality, "LY");
  assert.doesNotMatch(JSON.stringify(extracted), /11111111111/);
});

test("empty identity stays empty when merging a blank extraction", () => {
  const draft = createEmptyDraft("manual");
  draft.passengers = [createPassengerDraft({ firstName: "Ada" })];
  const merged = mergeExtractedDraft(draft, { passengers: [{ firstName: "Ada" }] });
  assert.equal(merged.draft.passengers[0]?.identityNumber, "");
  assert.doesNotMatch(JSON.stringify(merged.draft), /11111111111/);
});

test("document gender overrides default Kadın when an explicit value arrives", () => {
  const draft = createEmptyDraft("manual");
  assert.equal(draft.passengers[0]?.gender, "female");
  assert.equal(draft.purpose, "Transfer");
  const merged = mergeExtractedDraft(draft, { passengers: [{ gender: "male" }] });
  assert.equal(merged.draft.passengers[0]?.gender, "male");
  assert.equal(merged.conflicts.length, 0);
});
