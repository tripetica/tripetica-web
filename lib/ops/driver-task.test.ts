import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  canAdvanceDriverTask,
  driverAssignmentFingerprint,
  DRIVER_TASK_PUBLIC_GRACE_MS,
  driverTaskPath,
  isDriverTaskPublicAccessOpen,
  nextDriverTaskStage,
} from "@/lib/ops/driver-task-stages";
import {
  buildDriverTaskContact,
  buildDriverTaskPrice,
  buildDriverTaskPublicFields,
  googleMapsCoordUrl,
  parseDriverTaskCoords,
  yandexMapsCoordUrl,
} from "@/lib/ops/driver-task-fields";
import { formatOpsSelectedPrice } from "@/lib/ops/money";
import { formatPassengerLuggageBaby } from "@/lib/ops/process-list-display";
import { reservationPriceDisplay } from "@/lib/ops/reservation-price-display";
import { driverTaskStageLabel } from "@/lib/ops/driver-task-copy";
import { opsCopy } from "@/lib/ops/copy";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("driver task stages advance only one step and cannot skip", () => {
  assert.equal(nextDriverTaskStage("planned"), "en_route");
  assert.equal(nextDriverTaskStage("en_route"), "arrived");
  assert.equal(nextDriverTaskStage("arrived"), "picked_up");
  assert.equal(nextDriverTaskStage("picked_up"), "completed");
  assert.equal(nextDriverTaskStage("completed"), null);
  assert.equal(canAdvanceDriverTask("planned", "en_route"), true);
  assert.equal(canAdvanceDriverTask("planned", "arrived"), false);
  assert.equal(canAdvanceDriverTask("en_route", "picked_up"), false);
  assert.equal(canAdvanceDriverTask("completed", "en_route"), false);
});

test("driver fingerprint changes with driver identity but not vehicle fields", () => {
  assert.equal(
    driverAssignmentFingerprint({ kind: null, driverId: null, snapshot: null }),
    "unassigned",
  );
  assert.equal(
    driverAssignmentFingerprint({
      kind: "registered",
      driverId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      snapshot: { firstName: "A" },
    }),
    "registered:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  );
  assert.notEqual(
    driverAssignmentFingerprint({
      kind: "registered",
      driverId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    }),
    driverAssignmentFingerprint({
      kind: "registered",
      driverId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    }),
  );
  assert.notEqual(
    driverAssignmentFingerprint({
      kind: "non_trp",
      snapshot: { firstName: "Ali", lastName: "Yilmaz", phone: "+905551112233" },
    }),
    driverAssignmentFingerprint({
      kind: "non_trp",
      snapshot: { firstName: "Veli", lastName: "Yilmaz", phone: "+905551112233" },
    }),
  );
  assert.equal(
    driverAssignmentFingerprint({
      kind: "registered",
      driverId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    }),
    driverAssignmentFingerprint({
      kind: "registered",
      driverId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      snapshot: { plate: "34ABC123" },
    }),
  );
});

function fieldValue(fields: ReturnType<typeof buildDriverTaskPublicFields>, label: string) {
  return fields.find((field) => field.label === label)?.value ?? null;
}

test("driver task public fields omit commercial data and empty rows", () => {
  const transfer = buildDriverTaskPublicFields({
    serviceType: "transfer",
    tourCode: null,
    pickupAtLabel: "12.09.2026 14:00",
    pickupName: "İstanbul Havalimanı",
    dropoffName: "Taksim",
    pickupAirportCode: "IST",
    pickupLocationType: "airport",
    pickupPlaceId: null,
    flightCode: "TK1453",
    meetAndGreet: true,
    durationHours: null,
    packageCoverage: null,
  });
  const labels = transfer.map((field) => field.label).join("|");
  assert.match(labels, /Tarih \/ Saat/);
  assert.match(labels, /Hizmet Türü/);
  assert.match(labels, /Alış noktası/);
  assert.match(labels, /Bırakma noktası/);
  assert.match(labels, /Uçuş kodu/);
  assert.match(labels, /Karşılama hizmeti/);
  assert.match(labels, /Yolcu \/ Valiz \/ Bebek/);
  assert.doesNotMatch(labels, /fiyat|tutar|ödeme|kur|bütçe/i);
  assert.equal(transfer.at(-1)?.label, opsCopy.tr.passengerLuggageBaby);
  assert.equal(transfer.at(-1)?.value, formatPassengerLuggageBaby(null, null, null));
  const hourly = buildDriverTaskPublicFields({
    serviceType: "hourly",
    tourCode: null,
    pickupAtLabel: "12.09.2026 14:00",
    pickupName: "Otel",
    dropoffName: "",
    pickupAirportCode: null,
    pickupLocationType: "place",
    pickupPlaceId: null,
    flightCode: "TK1",
    meetAndGreet: true,
    durationHours: "5",
    packageCoverage: "uydurma",
  });
  assert.equal(
    hourly.some((field) => field.label === "Uçuş kodu" || field.label === "Paket kapsamı"),
    false,
  );
  assert.equal(hourly.some((field) => field.label === "Süre"), true);
  assert.equal(hourly.some((field) => field.label === "Bırakma noktası"), false);
  const tour = buildDriverTaskPublicFields({
    serviceType: "tour",
    tourCode: "istanbul-half-day",
    pickupAtLabel: "12.09.2026 09:00",
    pickupName: "Otel",
    dropoffName: "",
    pickupAirportCode: null,
    pickupLocationType: "place",
    pickupPlaceId: null,
    flightCode: null,
    meetAndGreet: null,
    durationHours: "7",
    packageCoverage: "4 saat / 80 km",
  });
  assert.equal(tour.some((field) => field.label === "Paket kapsamı"), true);
  assert.equal(tour.some((field) => field.label === "Süre"), false);
});

test("driver task flight and meet fields follow pickup airport only", () => {
  const airportWithFlight = buildDriverTaskPublicFields({
    serviceType: "transfer",
    tourCode: null,
    pickupAtLabel: "12.09.2026 14:00",
    pickupName: "İstanbul Havalimanı",
    dropoffName: "Hilton Istanbul Bomonti",
    pickupAirportCode: "IST",
    pickupLocationType: "airport",
    pickupPlaceId: null,
    flightCode: "TK112",
    meetAndGreet: true,
    durationHours: null,
    packageCoverage: null,
  });
  assert.equal(fieldValue(airportWithFlight, "Uçuş kodu"), "TK112");
  assert.equal(fieldValue(airportWithFlight, "Karşılama hizmeti"), "Evet");

  const airportMissingFlight = buildDriverTaskPublicFields({
    serviceType: "transfer",
    tourCode: null,
    pickupAtLabel: "12.09.2026 14:00",
    pickupName: "İstanbul Havalimanı",
    dropoffName: "Taksim",
    pickupAirportCode: "IST",
    pickupLocationType: "airport",
    pickupPlaceId: null,
    flightCode: null,
    meetAndGreet: false,
    durationHours: null,
    packageCoverage: null,
  });
  assert.equal(fieldValue(airportMissingFlight, "Uçuş kodu"), "Belirtilmedi");
  assert.equal(fieldValue(airportMissingFlight, "Karşılama hizmeti"), "Hayır");

  const hotelToAirport = buildDriverTaskPublicFields({
    serviceType: "transfer",
    tourCode: null,
    pickupAtLabel: "12.09.2026 14:00",
    pickupName: "Hilton Istanbul Bomonti",
    dropoffName: "İstanbul Havalimanı",
    pickupAirportCode: null,
    pickupLocationType: "place",
    pickupPlaceId: null,
    flightCode: "TK112",
    meetAndGreet: true,
    durationHours: null,
    packageCoverage: null,
  });
  assert.equal(fieldValue(hotelToAirport, "Uçuş kodu"), null);
  assert.equal(fieldValue(hotelToAirport, "Karşılama hizmeti"), null);

  const cityToCity = buildDriverTaskPublicFields({
    serviceType: "transfer",
    tourCode: null,
    pickupAtLabel: "12.09.2026 14:00",
    pickupName: "Taksim",
    dropoffName: "Kadıköy",
    pickupAirportCode: null,
    pickupLocationType: "place",
    pickupPlaceId: null,
    flightCode: "TK999",
    meetAndGreet: false,
    durationHours: null,
    packageCoverage: null,
  });
  assert.equal(fieldValue(cityToCity, "Uçuş kodu"), null);
  assert.equal(fieldValue(cityToCity, "Karşılama hizmeti"), null);
});

test("driver task occupancy reuses the ops process list formatter at the end of reservation fields", () => {
  const transfer = buildDriverTaskPublicFields({
    serviceType: "transfer",
    tourCode: null,
    pickupAtLabel: "12.09.2026 14:00",
    pickupName: "Hilton Istanbul Bomonti",
    dropoffName: "İstanbul Havalimanı",
    pickupAirportCode: null,
    pickupLocationType: "place",
    pickupPlaceId: null,
    flightCode: null,
    meetAndGreet: null,
    durationHours: null,
    packageCoverage: null,
    passengerCount: 3,
    luggageCount: 4,
    babySeatCount: null,
  });
  assert.equal(fieldValue(transfer, "Yolcu / Valiz / Bebek"), "3 / 4 / —");
  assert.equal(
    fieldValue(transfer, opsCopy.tr.passengerLuggageBaby),
    formatPassengerLuggageBaby(3, 4, null),
  );
  const labels = transfer.map((field) => field.label);
  assert.ok(labels.indexOf("Bırakma noktası") < labels.indexOf("Yolcu / Valiz / Bebek"));
  assert.equal(labels.at(-1), "Yolcu / Valiz / Bebek");
  assert.equal(labels.includes("Uçuş kodu"), false);

  const airport = buildDriverTaskPublicFields({
    serviceType: "transfer",
    tourCode: null,
    pickupAtLabel: "12.09.2026 14:00",
    pickupName: "İstanbul Havalimanı",
    dropoffName: "Taksim",
    pickupAirportCode: "IST",
    pickupLocationType: "airport",
    pickupPlaceId: null,
    flightCode: "TK1",
    meetAndGreet: true,
    durationHours: null,
    packageCoverage: null,
    passengerCount: 1,
    luggageCount: 0,
    babySeatCount: 0,
  });
  const airportLabels = airport.map((field) => field.label);
  assert.ok(airportLabels.indexOf("Karşılama hizmeti") < airportLabels.indexOf("Yolcu / Valiz / Bebek"));
  assert.equal(fieldValue(airport, "Yolcu / Valiz / Bebek"), formatPassengerLuggageBaby(1, 0, 0));

  const missing = buildDriverTaskPublicFields({
    serviceType: "hourly",
    tourCode: null,
    pickupAtLabel: "12.09.2026 14:00",
    pickupName: "Otel",
    dropoffName: "",
    pickupAirportCode: null,
    pickupLocationType: "place",
    pickupPlaceId: null,
    flightCode: null,
    meetAndGreet: null,
    durationHours: "5",
    packageCoverage: null,
    passengerCount: null,
    luggageCount: null,
    babySeatCount: null,
  });
  assert.equal(fieldValue(missing, "Yolcu / Valiz / Bebek"), "— / — / —");

  const core = source("lib/ops/driver-task.ts");
  assert.match(core, /formatPassengerLuggageBaby|passengerCount: row\.passenger_count/);
  assert.match(core, /r\.passenger_count, r\.luggage_count, r\.baby_seat_count/);
  const fields = source("lib/ops/driver-task-fields.ts");
  assert.match(fields, /formatPassengerLuggageBaby/);
  const screen = source("components/driver-task/driver-task-screen.tsx");
  const passengersAt = screen.indexOf("<h2>Yolcular</h2>");
  assert.doesNotMatch(screen.slice(passengersAt), /Yolcu \/ Valiz \/ Bebek/);
});

test("ops reservation list and detail expose driver task status", () => {
  const table = source("components/ops/reservation-table.tsx");
  const filters = source("components/ops/reservation-filters.tsx");
  const detail = source("components/ops/record-detail.tsx");
  const list = source("lib/ops/reservations.ts");
  const assignment = source("lib/ops/reservation-assignment.ts");
  const partner = source("lib/partner/job-assignment.ts");
  assert.match(list, /ensureDriverTaskForReservation/);
  const complete = source("lib/booking/complete-reservation.ts");
  assert.match(complete, /ensureDriverTaskForReservation/);
  assert.match(list, /NOT EXISTS \(/);
  assert.match(list, /current_stage = 'completed'/);
  assert.match(table, /copy\.operationStatus/);
  assert.match(table, /driverTaskStageLabel/);
  assert.match(filters, /copy\.operationCompleted/);
  assert.match(detail, /DriverTaskSection/);
  assert.match(assignment, /syncDriverTaskAfterAssignment/);
  assert.match(partner, /syncDriverTaskAfterAssignment/);
  const vehicleFn = assignment.slice(assignment.indexOf("export async function assignOpsReservationVehicle"));
  const vehicleBody = vehicleFn.slice(0, vehicleFn.indexOf("export async function clearOpsReservationDriver"));
  assert.doesNotMatch(vehicleBody, /syncDriverTaskAfterAssignment/);
  assert.equal(driverTaskStageLabel("planned", opsCopy.tr), "Planlandı");
  assert.equal(driverTaskStageLabel("en_route", opsCopy.tr), "Yoldayım");
  assert.match(driverTaskPath("abc"), /\/driver-task\/abc/);
});

test("ops driver task visibility controls sit between status and link actions", () => {
  const section = source("components/ops/driver-task-section.tsx");
  const statusAt = section.indexOf("ops-driver-task-status");
  const visibilityAt = section.indexOf("ops-driver-task-visibility");
  const actionsAt = section.indexOf("ops-driver-task-actions");
  assert.ok(statusAt > 0 && visibilityAt > statusAt && actionsAt > visibilityAt);
  assert.match(section, /copy\.driverTaskShowPrice/);
  assert.match(section, /copy\.driverTaskShowContact/);
  assert.match(section, /updateDriverTaskVisibilityAction/);
  assert.match(section, /allowVisibilityControls/);
  assert.doesNotMatch(
    source("components/partner/job-assignment.tsx"),
    /allowVisibilityControls=\{true\}/,
  );
  const actions = source("lib/ops/driver-task-actions.ts");
  assert.match(actions, /reservations\.view/);
  assert.match(actions, /updateDriverTaskVisibility/);
  const advanceFn = actions.slice(actions.indexOf("export async function advanceDriverTaskAction"));
  const advanceBody = advanceFn.slice(
    0,
    advanceFn.indexOf("export async function updateDriverTaskVisibilityAction"),
  );
  assert.doesNotMatch(advanceBody, /show_price_info|showPriceInfo|updateDriverTaskVisibility\(/);
  const core = source("lib/ops/driver-task.ts");
  const visibilityUpdate = core.slice(core.indexOf("export async function updateDriverTaskVisibility"));
  const visibilityBody = visibilityUpdate.slice(0, visibilityUpdate.indexOf("export async function advanceDriverTaskByToken"));
  assert.match(visibilityBody, /show_price_info/);
  assert.match(visibilityBody, /show_passenger_contact/);
  assert.doesNotMatch(visibilityBody, /access_token/);
  const syncFn = core.slice(core.indexOf("export async function syncDriverTaskAfterAssignment"));
  const syncBody = syncFn.slice(0, syncFn.indexOf("export async function getDriverTaskForOps"));
  assert.match(syncBody, /SET driver_fingerprint = \$2/);
  assert.doesNotMatch(syncBody, /access_token/);
  assert.doesNotMatch(syncBody, /createDriverTaskToken/);
});

test("public driver task stays open for two minutes after completed_at", () => {
  const completedAt = new Date("2026-09-13T12:00:00.000Z");
  assert.equal(DRIVER_TASK_PUBLIC_GRACE_MS, 120_000);
  assert.equal(
    isDriverTaskPublicAccessOpen({
      stage: "picked_up",
      completedAt: null,
      now: completedAt,
    }),
    true,
  );
  assert.equal(
    isDriverTaskPublicAccessOpen({
      stage: "completed",
      completedAt,
      now: new Date("2026-09-13T12:01:59.000Z"),
    }),
    true,
  );
  assert.equal(
    isDriverTaskPublicAccessOpen({
      stage: "completed",
      completedAt,
      now: new Date("2026-09-13T12:02:00.000Z"),
    }),
    false,
  );
  assert.equal(
    isDriverTaskPublicAccessOpen({
      stage: "completed",
      completedAt: null,
      now: completedAt,
    }),
    false,
  );

  const core = source("lib/ops/driver-task.ts");
  assert.match(core, /isDriverTaskPublicAccessOpen/);
  assert.match(core, /inspectDriverTaskPublicAccess/);
  assert.match(core, /stage = 'completed'/);
  const inspectFn = core.slice(core.indexOf("export async function inspectDriverTaskPublicAccess"));
  const inspectBody = inspectFn.slice(0, inspectFn.indexOf("export async function loadDriverTaskByToken"));
  assert.match(inspectBody, /current_stage/);
  assert.match(inspectBody, /completed_at/);
  assert.doesNotMatch(
    inspectBody,
    /reservation_code|customer_phone|customer_email|total_price|first_name|identity_number|passenger/,
  );
  const loadFn = core.slice(core.indexOf("export async function loadDriverTaskByToken"));
  const loadBody = loadFn.slice(0, loadFn.indexOf("export async function updateDriverTaskVisibility"));
  assert.match(loadBody, /enforcePublicExpiry/);
  assert.match(loadBody, /reason: "revoked"/);

  const actions = source("lib/ops/driver-task-actions.ts");
  assert.match(actions, /inspectDriverTaskPublicAccessAction/);
  assert.match(actions, /inspectDriverTaskPublicAccess\(/);

  const screen = source("components/driver-task/driver-task-screen.tsx");
  assert.match(screen, /inspectDriverTaskPublicAccessAction/);
  assert.match(screen, /view\.completed/);
  assert.match(screen, /embedded/);
  assert.match(screen, /12_000/);
  assert.match(screen, /clearInterval/);
  assert.match(screen, /window\.location\.reload/);

  const page = source("app/[locale]/(driver-task)/driver-task/[token]/page.tsx");
  assert.match(page, /Bu görev bağlantısı artık geçerli değil\./);
  assert.match(page, /loadDriverTaskByToken/);
  assert.doesNotMatch(page, /enforcePublicExpiry:\s*false/);

  const portalJobs = source("lib/driver-portal/jobs.ts");
  assert.match(portalJobs, /loadDriverTaskByToken\(token, \{ enforcePublicExpiry: false \}\)/);
});

test("public driver task omits contact and price unless ops flags are on", () => {
  assert.equal(buildDriverTaskContact(false, "+905551112233", "a@b.com"), null);
  assert.deepEqual(buildDriverTaskContact(true, "+905551112233", "a@b.com"), {
    phone: "+905551112233",
    email: "a@b.com",
  });
  assert.equal(buildDriverTaskContact(true, "  ", ""), null);
  assert.deepEqual(buildDriverTaskContact(true, " +90 555 ", null), {
    phone: "+90 555",
    email: null,
  });
  assert.equal(
    buildDriverTaskPrice(false, { selectedPrice: "4.000 RUB", otherCurrencies: ["52,05 $"] }),
    null,
  );
  assert.deepEqual(
    buildDriverTaskPrice(true, { selectedPrice: "4.000 RUB", otherCurrencies: ["52,05 $"] }),
    { selectedPrice: "4.000 RUB", otherCurrencies: ["52,05 $"] },
  );
  assert.equal(buildDriverTaskPrice(true, { selectedPrice: null, otherCurrencies: [] }), null);

  const core = source("lib/ops/driver-task.ts");
  assert.match(core, /buildDriverTaskContact\(/);
  assert.match(core, /buildDriverTaskPrice\(/);
  assert.match(core, /reservationPriceDisplay\("tr"/);
  assert.match(core, /Boolean\(row\.show_passenger_contact\)/);
  assert.match(core, /Boolean\(row\.show_price_info\)/);

  const screen = source("components/driver-task/driver-task-screen.tsx");
  const reservationAt = screen.indexOf("<h2>Rezervasyon</h2>");
  const contactAt = screen.indexOf(">Telefon<");
  const priceAt = screen.indexOf("Nakit Tahsilat");
  const passengersAt = screen.indexOf("<h2>Yolcular</h2>");
  assert.ok(reservationAt > 0 && contactAt > reservationAt && priceAt > contactAt);
  assert.ok(passengersAt > priceAt);
  assert.doesNotMatch(screen, /İletişim Bilgileri|Ücret Bilgileri|Seçilen Fiyat/);
  assert.match(screen, /driver-task-sensitive/);
  assert.match(screen, /driver-task-price-other/);
  const passengerCard = screen.slice(passengersAt);
  assert.doesNotMatch(passengerCard, /Nakit Tahsilat|Telefon|E-posta/);
});

test("driver task price display reuses the ops reservation selected/other amounts", () => {
  const display = reservationPriceDisplay("tr", {
    currency: "RUB",
    totalPrice: "4000",
    fxSnapshot: {
      baseCurrency: "EUR",
      totalEur: "44.87",
      capturedAt: "2026-09-12T00:00:00.000Z",
      rates: {
        USD: { quoteCurrency: "USD", rate: "1", source: "test", fetchedAt: "2026-09-12T00:00:00.000Z" },
        EUR: { quoteCurrency: "EUR", rate: "1", source: "test", fetchedAt: "2026-09-12T00:00:00.000Z" },
        TRY: { quoteCurrency: "TRY", rate: "1", source: "test", fetchedAt: "2026-09-12T00:00:00.000Z" },
        RUB: { quoteCurrency: "RUB", rate: "1", source: "test", fetchedAt: "2026-09-12T00:00:00.000Z" },
        GBP: { quoteCurrency: "GBP", rate: "1", source: "test", fetchedAt: "2026-09-12T00:00:00.000Z" },
      },
      totals: {
        USD: "52.05",
        EUR: "44.87",
        TRY: "2530.20",
        RUB: "4000",
        GBP: "38.49",
      },
    },
  });
  assert.equal(display.selectedPrice, formatOpsSelectedPrice("4000", "RUB", "tr"));
  assert.equal(display.otherCurrencies.includes(display.selectedPrice || ""), false);
  assert.ok(display.otherCurrencies.some((value) => value.includes("$")));
  assert.ok(display.otherCurrencies.some((value) => value.includes("€")));
});

test("driver task location groups use stored coords and omit missing address or nav", () => {
  assert.deepEqual(parseDriverTaskCoords(41.01, 28.97), { latitude: 41.01, longitude: 28.97 });
  assert.deepEqual(parseDriverTaskCoords("41.01", "28.97"), { latitude: 41.01, longitude: 28.97 });
  assert.equal(parseDriverTaskCoords(41.01, null), null);
  assert.equal(parseDriverTaskCoords("", 28.97), null);
  const google = googleMapsCoordUrl(41.0123, 28.9765);
  const yandex = yandexMapsCoordUrl(41.0123, 28.9765);
  assert.match(google, /41\.0123,28\.9765/);
  assert.doesNotMatch(google, /Avrupark|[?&](q|query)=/);
  assert.match(yandex, /41\.0123,28\.9765/);
  assert.doesNotMatch(yandex, /Avrupark|[?&]text=/);

  const transfer = buildDriverTaskPublicFields({
    serviceType: "transfer",
    tourCode: null,
    pickupAtLabel: "12.09.2026 14:00",
    pickupName: "Avrupark Hayat",
    pickupAddress: "Yeşilkent Mah. Test Sok. No:1",
    pickupLatitude: 41.01,
    pickupLongitude: 28.97,
    dropoffName: "İstanbul Havalimanı (IST)",
    dropoffAddress: "Tayakadın, Terminal Caddesi",
    dropoffLatitude: 41.2753,
    dropoffLongitude: 28.7519,
    pickupAirportCode: null,
    pickupLocationType: "place",
    pickupPlaceId: null,
    flightCode: "TK112",
    meetAndGreet: true,
    durationHours: null,
    packageCoverage: null,
    passengerCount: 3,
    luggageCount: 4,
    babySeatCount: null,
  });
  const pickup = transfer.find((field) => field.label === "Alış noktası");
  const dropoff = transfer.find((field) => field.label === "Bırakma noktası");
  assert.equal(pickup?.value, "Avrupark Hayat");
  assert.equal(pickup?.address, "Yeşilkent Mah. Test Sok. No:1");
  assert.equal(pickup?.latitude, 41.01);
  assert.equal(pickup?.longitude, 28.97);
  assert.equal(dropoff?.value, "İstanbul Havalimanı (IST)");
  assert.equal(dropoff?.address, "Tayakadın, Terminal Caddesi");
  assert.equal(fieldValue(transfer, "Uçuş kodu"), null);
  const labels = transfer.map((field) => field.label);
  assert.ok(labels.indexOf("Alış noktası") < labels.indexOf("Bırakma noktası"));
  assert.ok(labels.indexOf("Bırakma noktası") < labels.indexOf("Yolcu / Valiz / Bebek"));

  const airportPickup = buildDriverTaskPublicFields({
    serviceType: "transfer",
    tourCode: null,
    pickupAtLabel: "12.09.2026 14:00",
    pickupName: "İstanbul Havalimanı (IST)",
    pickupAddress: null,
    pickupLatitude: 41.2753,
    pickupLongitude: 28.7519,
    dropoffName: "Taksim",
    dropoffAddress: "  ",
    dropoffLatitude: null,
    dropoffLongitude: null,
    pickupAirportCode: "IST",
    pickupLocationType: "airport",
    pickupPlaceId: null,
    flightCode: "TK1",
    meetAndGreet: false,
    durationHours: null,
    packageCoverage: null,
  });
  const airport = airportPickup.find((field) => field.label === "Alış noktası");
  const city = airportPickup.find((field) => field.label === "Bırakma noktası");
  assert.equal(airport?.address, undefined);
  assert.equal(airport?.latitude, 41.2753);
  assert.equal(city?.address, undefined);
  assert.equal(city?.latitude, undefined);
  assert.equal(fieldValue(airportPickup, "Uçuş kodu"), "TK1");
  assert.equal(fieldValue(airportPickup, "Karşılama hizmeti"), "Hayır");

  const hourly = buildDriverTaskPublicFields({
    serviceType: "hourly",
    tourCode: null,
    pickupAtLabel: "12.09.2026 14:00",
    pickupName: "Otel",
    pickupAddress: "Otel adresi",
    pickupLatitude: 41.04,
    pickupLongitude: 28.98,
    dropoffName: "",
    dropoffAddress: "uydurma bırakma",
    dropoffLatitude: 40,
    dropoffLongitude: 29,
    pickupAirportCode: null,
    pickupLocationType: "place",
    pickupPlaceId: null,
    flightCode: null,
    meetAndGreet: null,
    durationHours: "5",
    packageCoverage: null,
  });
  assert.equal(hourly.some((field) => field.label === "Bırakma noktası"), false);

  const screen = source("components/driver-task/driver-task-screen.tsx");
  assert.match(screen, /googleMapsCoordUrl/);
  assert.match(screen, /yandexMapsCoordUrl/);
  assert.match(screen, /driver-task-location-address/);
  assert.doesNotMatch(screen, /maps\/search|query=\$\{field\.address|q=\$\{field/);
  const core = source("lib/ops/driver-task.ts");
  assert.match(core, /pickup_latitude, r\.pickup_longitude/);
  assert.match(core, /dropoff_latitude, r\.dropoff_longitude/);
});
