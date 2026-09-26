import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { missingMandatoryFields, syncDraftLocations, createEmptyDraft } from "@/lib/uetds/draft";
import { applyOfficialLocationSelection, resolveOfficialUetdsLocation } from "@/lib/uetds/official-locations";
import { resolveUetdsLocationFromReservationPlace } from "@/lib/uetds/reservation-location";
import { mergeSavedReservationDraft, prefillUetdsDraftFromReservation } from "@/lib/uetds/prefill";
import { emptyUetdsLocation, isOfficialUetdsLocationReady, uetdsLocationOfficialLabel, uetdsLocationOperationalPrimary, uetdsMinistryYerText } from "@/lib/uetds/location";
import {
  isDevUetdsRuntime,
  isLiveUetdsUrl,
  isProductionUetdsRuntime,
  isTestUetdsUrl,
  resolveUetdsMinistryRuntime,
} from "@/lib/uetds/ministry-env";
import {
  resolveUetdsTestAracPlaka,
  UETDS_OFFICIAL_TEST_ARAC_PLAKA,
  UETDS_OFFICIAL_TEST_USERNAME,
} from "@/lib/uetds/ministry-test-fixtures";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("reservation airport/hotel prefill becomes official U-ETDS location not display-only review", () => {
  const pickup = resolveUetdsLocationFromReservationPlace({
    name: "Istanbul Airport (IST)",
    address: "Tayakadın, Terminal Cd. No:1, 34283 Arnavutköy/İstanbul, Türkiye",
    placeId: "places/ChIJ-airport",
    locationType: "airport",
    airportCode: "IST",
  });
  assert.equal(isOfficialUetdsLocationReady(pickup), true);
  assert.equal(pickup.locationType, "airport");
  assert.equal(pickup.districtOrAirportCode, "99157");
  assert.equal(pickup.districtOrAirportName, "İstanbul Havalimanı");
  assert.equal(pickup.placeName, "Istanbul Airport (IST)");
  assert.notEqual(pickup.districtOrAirportCode, "IST");
  assert.notEqual(pickup.districtOrAirportCode, "2048");

  const dropoff = resolveUetdsLocationFromReservationPlace({
    name: "Hilton İstanbul Bomonti Hotel & Conference Center",
    address: "Silahşör Cad., Şişli/İstanbul",
    placeId: "places/ChIJ-hilton",
    locationType: "hotel",
    airportCode: null,
  });
  assert.equal(isOfficialUetdsLocationReady(dropoff), true);
  assert.equal(dropoff.locationType, "district");
  assert.equal(dropoff.provinceCode, "34");
  assert.equal(dropoff.districtOrAirportCode, "1663");
  assert.equal(dropoff.districtOrAirportName, "ŞİŞLİ");

  const hiltonNeighborhood = resolveUetdsLocationFromReservationPlace({
    name: "Hilton Istanbul Bomonti Hotel & Conference Center",
    address: "Merkez, Silahşör Cd. No:42, 34381 Şişli/İstanbul, Türkiye",
    placeId: "ChIJvVDglxC3yhQR3gaoLNJtRpk",
    locationType: "hotel",
    airportCode: null,
  });
  assert.equal(isOfficialUetdsLocationReady(hiltonNeighborhood), true);
  assert.equal(hiltonNeighborhood.locationType, "district");
  assert.equal(hiltonNeighborhood.provinceCode, "34");
  assert.equal(hiltonNeighborhood.districtOrAirportCode, "1663");
  assert.equal(hiltonNeighborhood.districtOrAirportName, "ŞİŞLİ");
  assert.notEqual(hiltonNeighborhood.districtOrAirportCode, "1105");
  assert.notEqual(hiltonNeighborhood.provinceCode, "2");

  const unknown = resolveUetdsLocationFromReservationPlace({
    name: "Unknown Lodge",
    address: null,
    placeId: null,
    locationType: "other",
    airportCode: null,
  });
  assert.equal(isOfficialUetdsLocationReady(unknown), false);
  assert.equal(unknown.review, true);

  const context = source("lib/uetds/reservation-context.ts");
  assert.match(context, /pickup_place_id/);
  assert.match(context, /pickup_location_type/);
  assert.match(context, /loadPlaceGeoDetails/);
  assert.match(context, /enrichReservationLocation/);
  assert.match(source("lib/uetds/prefill.ts"), /resolveUetdsLocationFromReservationPlace/);
  assert.match(source("lib/uetds/prefill.ts"), /mergeSavedReservationDraft/);
  assert.match(source("app/[locale]/ops/(panel)/uetds/notifications/new/page.tsx"), /mergeSavedReservationDraft/);
  assert.match(source("app/[locale]/partner/(panel)/uetds/notifications/new/page.tsx"), /mergeSavedReservationDraft/);
  assert.doesNotMatch(source("lib/uetds/reservation-location.ts"), /districtOrAirportCode.*airportCode/);
  assert.match(source("lib/booking/location-persist.ts"), /addressTr/);
  assert.match(source("lib/booking/complete-reservation.ts"), /pickup_place_id/);
  assert.doesNotMatch(source("lib/booking/complete-reservation.ts"), /districtOrAirportCode|99157/);
  const draft = prefillUetdsDraftFromReservation({
    reservationId: "11111111-1111-1111-1111-111111111111",
    pickupName: "Istanbul Airport (IST)",
    dropoffName: "Hilton İstanbul Bomonti Hotel & Conference Center",
    pickupAddress: "Arnavutköy/İstanbul",
    dropoffAddress: "Şişli/İstanbul",
    pickupLocationType: "airport",
    pickupAirportCode: "IST",
    pickupAt: "2026-09-21T11:30:00.000Z",
    passengerCount: 1,
    serviceType: "transfer",
    tourCode: null,
    notes: null,
    driverId: "d1",
    vehicleId: "v1",
    driverKind: "registered",
    vehicleKind: "registered",
    passengers: [{ firstName: "Ada", lastName: "Yilmaz", countryCode: "TR", identityNumber: "AB123456", gender: "female" }],
  });
  assert.equal(isOfficialUetdsLocationReady(draft.originLocation), true);
  assert.equal(isOfficialUetdsLocationReady(draft.destinationLocation), true);
  assert.equal(draft.passengers[0]?.identityNumber, "AB123456");
});

test("hotel display text without address stays unresolved", () => {
  const location = resolveUetdsLocationFromReservationPlace({
    name: "Hilton Istanbul Bomonti Hotel & Conference Center",
    address: null,
    placeId: null,
    locationType: "hotel",
    airportCode: null,
  });
  assert.equal(isOfficialUetdsLocationReady(location), false);
  assert.equal(location.review, true);
});

test("saved reservation draft refreshes stale official codes unless user picked Places", () => {
  const fresh = prefillUetdsDraftFromReservation({
    reservationId: "11111111-1111-1111-1111-111111111111",
    pickupName: "Istanbul Airport (IST)",
    dropoffName: "Hilton Istanbul Bomonti Hotel & Conference Center",
    pickupAddress: "Tayakadın, Terminal Cd. No:1, 34283 Arnavutköy/İstanbul, Türkiye",
    dropoffAddress: "Merkez, Silahşör Cd. No:42, 34381 Şişli/İstanbul, Türkiye",
    pickupLocationType: "airport",
    pickupAirportCode: "IST",
    pickupAt: "2026-09-21T11:30:00.000Z",
    passengerCount: 1,
    serviceType: "transfer",
    tourCode: null,
    notes: null,
    driverId: "d1",
    vehicleId: "v1",
    driverKind: "registered",
    vehicleKind: "registered",
    passengers: [],
  });
  const saved = {
    ...fresh,
    destinationLocation: {
      ...fresh.destinationLocation,
      provinceCode: "2",
      provinceName: "ADIYAMAN",
      districtOrAirportCode: "1105",
      districtOrAirportName: "MERKEZ",
      review: false,
    },
  };
  const merged = mergeSavedReservationDraft(saved, fresh);
  assert.equal(merged.destinationLocation.districtOrAirportCode, "1663");
  assert.equal(merged.destinationLocation.districtOrAirportName, "ŞİŞLİ");
  const userPicked = mergeSavedReservationDraft(
    { ...saved, fieldProvenance: { ...saved.fieldProvenance, destination: "user" } },
    fresh,
  );
  assert.equal(userPicked.destinationLocation.districtOrAirportCode, "1105");
});

test("Google neighborhood Merkez does not become Adıyaman MERKEZ", () => {
  const fromAddress = resolveOfficialUetdsLocation({
    placeName: "Hilton Istanbul Bomonti Hotel & Conference Center",
    formattedAddress: "Merkez, Silahşör Cd. No:42, 34381 Şişli/İstanbul, Türkiye",
  });
  assert.equal(fromAddress.provinceCode, "34");
  assert.equal(fromAddress.districtOrAirportCode, "1663");
  assert.equal(fromAddress.districtOrAirportName, "ŞİŞLİ");
  assert.notEqual(fromAddress.districtOrAirportCode, "1105");
  assert.equal(isOfficialUetdsLocationReady(fromAddress), true);

  const neighborhoodLeak = resolveOfficialUetdsLocation({
    details: {
      name: "Hilton Istanbul Bomonti Hotel & Conference Center",
      formattedAddress: "Merkez, Silahşör Cd. No:42, 34381 Şişli/İstanbul, Türkiye",
      region: "İstanbul",
      district: "Merkez",
      countryCode: "TR",
      types: ["lodging"],
    },
  });
  assert.equal(neighborhoodLeak.provinceCode, "34");
  assert.equal(neighborhoodLeak.districtOrAirportCode, "1663");
  assert.notEqual(neighborhoodLeak.districtOrAirportCode, "1105");
  assert.equal(isOfficialUetdsLocationReady(neighborhoodLeak), true);
});

test("Hilton-style Google components resolve to Şişli / İstanbul official codes", () => {
  const location = resolveOfficialUetdsLocation({
    details: {
      name: "Hilton Istanbul Bomonti",
      formattedAddress: "Silahşör Cad., Şişli/İstanbul",
      region: "İstanbul",
      district: "Şişli",
      countryCode: "TR",
      types: ["lodging"],
    },
  });
  assert.equal(location.placeName, "Hilton Istanbul Bomonti");
  assert.equal(location.locationType, "district");
  assert.equal(location.provinceCode, "34");
  assert.equal(location.provinceName, "İSTANBUL");
  assert.equal(location.districtOrAirportCode, "1663");
  assert.equal(location.districtOrAirportName, "ŞİŞLİ");
  assert.equal(location.review, false);
  assert.equal(isOfficialUetdsLocationReady(location), true);
});

test("İstanbul Havalimanı stays an airport and does not become Arnavutköy", () => {
  const location = resolveOfficialUetdsLocation({
    details: {
      name: "İstanbul Havalimanı",
      region: "İstanbul",
      district: "Arnavutköy",
      countryCode: "TR",
      types: ["airport"],
    },
  });
  assert.equal(location.locationType, "airport");
  assert.equal(location.provinceCode, "34");
  assert.equal(location.districtOrAirportCode, "99157");
  assert.equal(location.districtOrAirportName, "İstanbul Havalimanı");
  assert.notEqual(location.districtOrAirportCode, "2048");
  assert.equal(location.review, false);
});

test("Google Istanbul Airport (IST) resolves to official İstanbul Havalimanı not IATA or Arnavutköy", () => {
  const location = resolveOfficialUetdsLocation({
    details: {
      name: "Istanbul Airport (IST)",
      formattedAddress: "Tayakadın, Terminal Cd. No:1, 34283 Arnavutköy/İstanbul, Türkiye",
      region: "İstanbul",
      district: "Arnavutköy",
      countryCode: "TR",
      types: ["airport"],
    },
    placeName: "Istanbul Airport (IST)",
  });
  assert.equal(location.placeName, "Istanbul Airport (IST)");
  assert.equal(location.locationType, "airport");
  assert.equal(location.provinceCode, "34");
  assert.equal(location.provinceName, "İSTANBUL");
  assert.equal(location.districtOrAirportCode, "99157");
  assert.equal(location.districtOrAirportName, "İstanbul Havalimanı");
  assert.notEqual(location.districtOrAirportCode, "2048");
  assert.doesNotMatch(location.districtOrAirportCode, /IST|SAW|AYT/i);
  assert.equal(location.review, false);
  assert.equal(isOfficialUetdsLocationReady(location), true);
});

test("Istanbul Airport display text still resolves when Place Details types are missing", () => {
  const location = resolveOfficialUetdsLocation({
    placeName: "Istanbul Airport (IST)",
    formattedAddress: "Arnavutköy/İstanbul",
  });
  assert.equal(location.locationType, "airport");
  assert.equal(location.districtOrAirportCode, "99157");
  assert.equal(location.review, false);
});

test("unmatched Google place stays in review and cannot submit", () => {
  const location = resolveOfficialUetdsLocation({
    details: {
      name: "Unknown Lodge",
      region: "Narnia",
      district: "Wardrobe",
      countryCode: "TR",
      types: ["lodging"],
    },
  });
  assert.equal(location.review, true);
  assert.equal(isOfficialUetdsLocationReady(location), false);
});

test("manual official airport selection uses ministry codes not IATA", () => {
  const location = applyOfficialLocationSelection({
    current: emptyUetdsLocation(),
    locationType: "airport",
    provinceCode: "34",
    districtOrAirportCode: "99157",
  });
  assert.equal(location.districtOrAirportCode, "99157");
  assert.doesNotMatch(location.districtOrAirportCode, /IST|SAW|AYT/i);
});

test("draft requires official locations, end time and passenger gender", () => {
  const draft = syncDraftLocations(createEmptyDraft("manual", { applyTripDefaults: false }));
  draft.origin = "Şişli";
  draft.destination = "İstanbul Havalimanı";
  draft.startDate = "2026-09-20";
  draft.startTime = "03:00";
  draft.purpose = "Transfer";
  draft.driverId = "d1";
  draft.vehicleId = "v1";
  draft.passengers[0] = {
    ...draft.passengers[0]!,
    firstName: "Ahmed",
    lastName: "Ali",
    nationality: "LY",
    identityNumber: "A12345678",
  };
  assert.equal(draft.passengers[0]!.gender, "female");
  assert.ok(missingMandatoryFields(draft).includes("origin"));
  draft.originLocation = resolveOfficialUetdsLocation({
    details: { name: "Hilton", region: "İstanbul", district: "Şişli", countryCode: "TR", types: [] },
  });
  draft.destinationLocation = resolveOfficialUetdsLocation({
    details: { name: "Istanbul Airport (IST)", region: "İstanbul", district: "Arnavutköy", countryCode: "TR", types: ["airport"] },
  });
  draft.endDate = "2026-09-20";
  draft.endTime = "04:00";
  draft.passengers[0]!.gender = "";
  assert.ok(missingMandatoryFields(draft).includes("passenger.0.gender"));
  draft.passengers[0]!.gender = "male";
  assert.deepEqual(missingMandatoryFields(syncDraftLocations(draft)), []);
});

test("validation messages use Turkish labels instead of internal field names", () => {
  const copy = source("lib/uetds/copy.ts");
  const form = source("components/uetds/uetds-notification-form.tsx");
  assert.match(copy, /Açıklama \/ taşıma amacı zorunludur/);
  assert.match(form, /uetdsMissingFieldMessage/);
  assert.doesNotMatch(form, /summaryMissing\.replace\("\{n\}", key\)/);
});

test("DEV ministry helper fail-closes live U-ETDS URLs", () => {
  assert.equal(isTestUetdsUrl("https://servis.turkiye.gov.tr/services/g2g/kdgm/test/uetdsarizi"), true);
  assert.equal(isLiveUetdsUrl("https://servis.turkiye.gov.tr/services/g2g/kdgm/uetdsarizi"), true);
  assert.equal(isLiveUetdsUrl("https://servis.turkiye.gov.tr/services/g2g/kdgm/test/uetdsarizi"), false);
  assert.equal(isDevUetdsRuntime({ NODE_ENV: "production", EXPECTED_DATABASE: "tripetica_dev" }), false);
  assert.equal(isDevUetdsRuntime({ NODE_ENV: "development", EXPECTED_DATABASE: "tripetica_dev" }), true);
  assert.equal(isProductionUetdsRuntime({ NODE_ENV: "production", EXPECTED_DATABASE: "tripetica" }), true);
  assert.equal(isProductionUetdsRuntime({ NODE_ENV: "development", EXPECTED_DATABASE: "tripetica" }), false);
  assert.equal(
    resolveUetdsMinistryRuntime({ NODE_ENV: "development", EXPECTED_DATABASE: "tripetica_dev" }),
    "test",
  );
  assert.equal(
    resolveUetdsMinistryRuntime({ NODE_ENV: "production", EXPECTED_DATABASE: "tripetica" }),
    "live",
  );
  assert.equal(
    resolveUetdsMinistryRuntime({ NODE_ENV: "production", EXPECTED_DATABASE: "tripetica_dev" }),
    null,
  );
  assert.equal(
    resolveUetdsMinistryRuntime({ NODE_ENV: "development", EXPECTED_DATABASE: "tripetica" }),
    null,
  );
  const env = source("lib/uetds/ministry-env.ts");
  assert.match(env, /\/kdgm\/test\/uetdsarizi/);
  assert.match(env, /\/kdgm\/uetdsarizi/);
  assert.match(source("lib/uetds/submit.ts"), /loadUetdsMinistryCredentials/);
  assert.match(source("lib/uetds/submit.ts"), /no-live-credentials/);
  assert.match(source("lib/uetds/ministry-credentials.ts"), /if \(runtime === "live"\)/);
  assert.doesNotMatch(source("lib/uetds/submit.ts"), /loadUetdsTestCredentials/);
  assert.match(source("components/partner/searchable-select.tsx"), /onPointerDown/);
  assert.match(source("components/partner/searchable-select.tsx"), /preventDefault/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /UetdsLocationField/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /requestSend/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /uetds-gender-toggle/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /firstNamePlaceholder/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /uetds-purpose-chip/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /saveUetdsFormDraftAction/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /adjustUetdsTripTimesForSubmit|startAdjusted/);
  assert.doesNotMatch(source("components/uetds/uetds-notification-form.tsx"), /Bilgileri forma yaz/);
  const soap = source("lib/uetds/ministry-submit.ts");
  assert.match(soap, /ariziSeferBilgileriInput/);
  assert.match(soap, /seferGrupBilgileriInput/);
  assert.match(soap, /seferYolcuBilgileriInput/);
  assert.match(soap, /baslangicIlce/);
  assert.match(soap, /uetdsSeferReferansNo/);
  assert.doesNotMatch(soap, /live_password|IATA|IST\b|SAW\b/);
  assert.equal(
    resolveUetdsTestAracPlaka({
      testUsername: UETDS_OFFICIAL_TEST_USERNAME,
      fleetPlate: "34 EGP 847",
    }),
    UETDS_OFFICIAL_TEST_ARAC_PLAKA,
  );
  assert.equal(
    resolveUetdsTestAracPlaka({
      testUsername: "SEARCH-UNET",
      fleetPlate: "34 EGP 847",
    }),
    "34 EGP 847",
  );
  assert.match(source("lib/uetds/submit.ts"), /resolveUetdsTestAracPlaka/);
  assert.match(source("lib/uetds/ministry-test-fixtures.ts"), /06TARIFESIZ123/);
  assert.doesNotMatch(source("lib/uetds/ministry-test-fixtures.ts"), /999999testtest/);
});

test("text resolve keeps hotels as districts and airports as 99xxx codes", () => {
  const conforium = resolveOfficialUetdsLocation({
    placeName: "The Conforium Hotel İstanbul Zeytinburnu",
    formattedAddress: "The Conforium Hotel İstanbul Zeytinburnu",
  });
  assert.equal(isOfficialUetdsLocationReady(conforium), true);
  assert.equal(conforium.locationType, "district");
  assert.equal(conforium.districtOrAirportCode, "1739");
  assert.equal(conforium.districtOrAirportName, "ZEYTİNBURNU");
  assert.equal(conforium.provinceCode, "34");
  assert.equal(conforium.placeName, "The Conforium Hotel İstanbul Zeytinburnu");

  const saw = resolveOfficialUetdsLocation({
    placeName: "Sabiha Gökçen Havalimanı",
    formattedAddress: "Pendik/İstanbul",
  });
  assert.equal(isOfficialUetdsLocationReady(saw), true);
  assert.equal(saw.locationType, "airport");
  assert.equal(saw.districtOrAirportCode, "99102");
  assert.notEqual(saw.districtOrAirportCode, "1835");

  const sawShort = resolveOfficialUetdsLocation({
    placeName: "Sabiha Havalimanı (SAW)",
    formattedAddress: "Sabiha Havalimanı (SAW)",
  });
  assert.equal(sawShort.districtOrAirportCode, "99102");

  const ist = resolveOfficialUetdsLocation({
    placeName: "İstanbul Havalimanı (IST)",
    formattedAddress: "Arnavutköy/İstanbul",
  });
  assert.equal(ist.locationType, "airport");
  assert.equal(ist.districtOrAirportCode, "99157");
  assert.notEqual(ist.districtOrAirportCode, "2048");

  const marmara = resolveOfficialUetdsLocation({
    placeName: "The Marmara Taksim",
    formattedAddress: "Gümüşsuyu, Taksim, Beyoğlu/İstanbul",
    details: {
      name: "The Marmara Taksim",
      formattedAddress: "Gümüşsuyu, Taksim, Beyoğlu/İstanbul",
      district: "Beyoğlu",
      region: "İstanbul",
      countryCode: "TR",
      types: ["lodging"],
    },
  });
  assert.equal(marmara.districtOrAirportCode, "1186");
  assert.equal(marmara.districtOrAirportName, "BEYOĞLU");

  const ambiguous = resolveOfficialUetdsLocation({
    placeName: "Hilton Hotel",
    formattedAddress: "Hilton Hotel",
  });
  assert.equal(isOfficialUetdsLocationReady(ambiguous), false);
  assert.equal(ambiguous.review, true);
});

test("ministry Yer is empty for ready districts and keeps airport official names", () => {
  const hotel = resolveOfficialUetdsLocation({
    placeName: "The Conforium Hotel",
    formattedAddress: "Kazlıçeşme, Zeytinburnu/İstanbul",
    details: {
      name: "The Conforium Hotel",
      formattedAddress: "Kazlıçeşme, Zeytinburnu/İstanbul",
      district: "Zeytinburnu",
      region: "İstanbul",
      countryCode: "TR",
      types: ["lodging"],
    },
  });
  assert.equal(isOfficialUetdsLocationReady(hotel), true);
  assert.equal(hotel.locationType, "district");
  assert.equal(hotel.districtOrAirportCode, "1739");
  assert.equal(uetdsLocationOperationalPrimary(hotel), "The Conforium Hotel");
  assert.equal(uetdsLocationOfficialLabel(hotel), "ZEYTİNBURNU / İSTANBUL");
  assert.equal(uetdsMinistryYerText(hotel), "");

  const beyoglu = resolveOfficialUetdsLocation({
    placeName: "The Marmara Taksim",
    formattedAddress: "Gümüşsuyu, Taksim, Beyoğlu/İstanbul",
    details: {
      name: "The Marmara Taksim",
      formattedAddress: "Gümüşsuyu, Taksim, Beyoğlu/İstanbul",
      district: "Beyoğlu",
      region: "İstanbul",
      countryCode: "TR",
      types: ["lodging"],
    },
  });
  assert.equal(beyoglu.locationType, "district");
  assert.equal(beyoglu.districtOrAirportCode, "1186");
  assert.equal(uetdsMinistryYerText(beyoglu), "");

  const saw = resolveOfficialUetdsLocation({
    placeName: "İstanbul Sabiha Gökçen Uluslararası Havalimanı",
    formattedAddress: "Sanayi, 34906 Pendik/İstanbul, Türkiye",
    details: {
      name: "İstanbul Sabiha Gökçen Uluslararası Havalimanı",
      formattedAddress: "Sanayi, 34906 Pendik/İstanbul, Türkiye",
      district: "Pendik",
      region: "İstanbul",
      countryCode: "TR",
      types: ["airport"],
    },
  });
  assert.equal(saw.locationType, "airport");
  assert.equal(saw.districtOrAirportCode, "99102");
  assert.equal(uetdsMinistryYerText(saw), "Sabiha Gökçen Havalimanı");

  const ist = resolveOfficialUetdsLocation({
    placeName: "İstanbul Havalimanı",
    formattedAddress: "Arnavutköy/İstanbul",
    details: {
      name: "İstanbul Havalimanı",
      formattedAddress: "Arnavutköy/İstanbul",
      region: "İstanbul",
      countryCode: "TR",
      types: ["airport"],
    },
  });
  assert.equal(ist.locationType, "airport");
  assert.equal(ist.districtOrAirportCode, "99157");
  assert.equal(uetdsMinistryYerText(ist), "İstanbul Havalimanı");

  const unresolved = resolveOfficialUetdsLocation({
    placeName: "Hilton Hotel",
    formattedAddress: "Hilton Hotel",
  });
  assert.equal(isOfficialUetdsLocationReady(unresolved), false);
  assert.equal(uetdsMinistryYerText(unresolved), "Hilton Hotel");

  const submit = source("lib/uetds/ministry-submit.ts");
  const mutate = source("lib/uetds/ministry-mutate.ts");
  assert.match(submit, /yer:\s*uetdsMinistryYerText\(location\)/);
  assert.match(mutate, /yer:\s*uetdsMinistryYerText\(location\)/);
  assert.match(submit, /uetdsMinistryYerText/);
  assert.match(mutate, /uetdsMinistryYerText/);
});

test("Places enrich prefers Conforium hotel over bare Istanbul city", async () => {
  const { enrichUetdsLocationFromText } = await import("@/lib/uetds/resolve-location");
  const location = await enrichUetdsLocationFromText("The Conforium Hotel İstanbul", {
    search: async () => [
      {
        placeId: "city",
        primaryText: "İstanbul",
        secondaryText: "Türkiye",
        types: ["locality", "political"],
      },
      {
        placeId: "hotel",
        primaryText: "The Conforium Hotel İstanbul",
        secondaryText: "Zeytinburnu/İstanbul",
        types: ["lodging", "establishment"],
      },
    ],
    details: async (placeId) =>
      placeId === "hotel"
        ? {
            name: "The Conforium Hotel İstanbul",
            formattedAddress: "Gökalp, Mehmet Alpay Sok. No:21, 34020 Zeytinburnu/İstanbul, Türkiye",
            district: "Zeytinburnu",
            region: "İstanbul",
            countryCode: "TR",
            types: ["lodging", "establishment"],
            placeId: "hotel",
          }
        : {
            name: "İstanbul",
            formattedAddress: "İstanbul, Türkiye",
            region: "İstanbul",
            countryCode: "TR",
            types: ["locality", "political"],
            placeId: "city",
          },
  });
  assert.equal(isOfficialUetdsLocationReady(location), true);
  assert.equal(location.districtOrAirportCode, "1739");
  assert.equal(location.districtOrAirportName, "ZEYTİNBURNU");
  assert.match(location.placeName, /Conforium/i);
  assert.notEqual(location.placeName, "İstanbul");
  assert.match(location.formattedAddress, /Zeytinburnu/i);
});

test("Places enrich leaves ambiguous Hilton Hotel unresolved and accepts unique Bomonti", async () => {
  const { enrichUetdsLocationFromText } = await import("@/lib/uetds/resolve-location");
  const ambiguous = await enrichUetdsLocationFromText("Hilton Hotel", {
    search: async () => [
      { placeId: "a", primaryText: "Hilton Istanbul Bomonti", secondaryText: "Şişli", types: ["lodging"] },
      { placeId: "b", primaryText: "Hilton Istanbul Bosphorus", secondaryText: "Beyoğlu", types: ["lodging"] },
    ],
    details: async (placeId) =>
      placeId === "a"
        ? {
            name: "Hilton Istanbul Bomonti",
            formattedAddress: "Şişli/İstanbul",
            district: "Şişli",
            region: "İstanbul",
            countryCode: "TR",
            types: ["lodging"],
            placeId: "a",
          }
        : {
            name: "Hilton Istanbul Bosphorus",
            formattedAddress: "Beyoğlu/İstanbul",
            district: "Beyoğlu",
            region: "İstanbul",
            countryCode: "TR",
            types: ["lodging"],
            placeId: "b",
          },
  });
  assert.equal(ambiguous.review, true);
  assert.equal(isOfficialUetdsLocationReady(ambiguous), false);
  assert.equal(ambiguous.placeName, "Hilton Hotel");

  const unique = await enrichUetdsLocationFromText("Hilton Istanbul Bomonti", {
    search: async () => [
      {
        placeId: "a",
        primaryText: "Hilton Istanbul Bomonti",
        secondaryText: "Şişli/İstanbul",
        types: ["lodging"],
      },
    ],
    details: async () => ({
      name: "Hilton Istanbul Bomonti Hotel & Conference Center",
      formattedAddress: "Silahşör Cad., Şişli/İstanbul",
      district: "Şişli",
      region: "İstanbul",
      countryCode: "TR",
      types: ["lodging"],
      placeId: "a",
    }),
  });
  assert.equal(isOfficialUetdsLocationReady(unique), true);
  assert.equal(unique.districtOrAirportCode, "1663");
  assert.match(unique.placeName, /Hilton Istanbul Bomonti/);
});

test("manual official override helper preserves operational placeName", () => {
  const current = resolveOfficialUetdsLocation({
    placeName: "The Marmara Taksim",
    formattedAddress: "Taksim, İstanbul",
  });
  current.placeName = "The Marmara Taksim";
  current.formattedAddress = "Gümüşsuyu Mah., Beyoğlu/İstanbul";
  const fixed = applyOfficialLocationSelection({
    current,
    locationType: "district",
    provinceCode: "34",
    districtOrAirportCode: "1186",
  });
  assert.equal(fixed.placeName, "The Marmara Taksim");
  assert.equal(fixed.formattedAddress, "Gümüşsuyu Mah., Beyoğlu/İstanbul");
  assert.equal(fixed.districtOrAirportCode, "1186");
  assert.equal(fixed.review, false);
  assert.match(source("components/uetds/uetds-location-field.tsx"), /officialConfirmed/);
  assert.doesNotMatch(source("components/uetds/uetds-location-field.tsx"), /correctOfficial|uetds-manual-toggle/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /enrichUetdsDraftLocationsFromText/);
  assert.match(source("lib/uetds/ai-extraction-schema.ts"), /airport name \+ IATA/);
});
