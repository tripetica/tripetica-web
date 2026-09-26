import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDraft, createPassengerDraft } from "@/lib/uetds/draft";
import { countryIso2FromName, extractUetdsFromText, mergeExtractedDraft } from "@/lib/uetds/extract";
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
  assert.equal(countryIso2FromName("Narnia"), null);
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
