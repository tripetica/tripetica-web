import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gpsCopy } from "@/lib/gps/copy";
import { maintenanceDriverNotice, maintenanceEmail, maintenancePhoneLink } from "@/lib/gps/maintenance-mail";
import {
  displayMaintenanceKm,
  foldMaintenanceDistance,
  maintenanceAlertThreshold,
  maintenanceDeliveryPlan,
  maintenanceDistanceSource,
  maintenanceFigures,
  maintenanceLockKey,
  maintenanceNoticeDue,
  maintenancePartnerRecipients,
  maintenancePositionSql,
  validateMaintenanceEdit,
  validateMaintenanceSetup,
} from "@/lib/gps/maintenance";

const today = "2026-10-13";

function north(latitude: number, meters: number) {
  return latitude + (meters / 6_371_000) * (180 / Math.PI);
}

test("maintenance setup validates the first readings and the service interval", () => {
  const saved = validateMaintenanceSetup({
    startKm: "674469",
    previousKm: "665000",
    previousOn: "2026-09-15",
    intervalKm: "10000",
    today,
  });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  const figures = maintenanceFigures({
    verifiedKm: saved.startKm,
    distanceM: 0,
    lastServiceKm: saved.previousKm,
    intervalKm: saved.intervalKm,
  });
  assert.equal(figures.nextServiceKm, 675000);
  assert.equal(figures.estimatedKm, 674469);
  assert.equal(figures.remainingKm, 531);
  assert.equal(validateMaintenanceSetup({ startKm: "-1", previousKm: "0", previousOn: "2026-09-15", intervalKm: "10000", today }).ok, false);
  assert.equal(validateMaintenanceSetup({ startKm: "10", previousKm: "1", previousOn: "2026-09-15", intervalKm: "0", today }).error, "interval");
  assert.equal(validateMaintenanceSetup({ startKm: "10", previousKm: "1", previousOn: "2026-12-01", intervalKm: "1000", today }).error, "future");
  assert.equal(validateMaintenanceSetup({ startKm: "100", previousKm: "150", previousOn: "2026-09-15", intervalKm: "1000", today }).error, "order");
  assert.equal(validateMaintenanceSetup({ startKm: "10.5", previousKm: "1", previousOn: "2026-09-15", intervalKm: "1000", today }).error, "invalid");
  assert.equal(validateMaintenanceEdit({ lastServiceKm: "676240", lastServiceOn: "2026-10-13", intervalKm: "10000", today }).ok, true);
  assert.equal(validateMaintenanceEdit({ lastServiceKm: "1", lastServiceOn: "2026-10-14", intervalKm: "10000", today }).error, "future");
});

test("estimated mileage adds later GPS distance and keeps service targets fixed", () => {
  assert.equal(displayMaintenanceKm(676240, 1000), 676241);
  assert.equal(displayMaintenanceKm(676240, 100_000), 676340);
  const completed = maintenanceFigures({
    verifiedKm: 676240,
    distanceM: 0,
    lastServiceKm: 676240,
    intervalKm: 10000,
  });
  assert.equal(completed.estimatedKm, 676240);
  assert.equal(completed.nextServiceKm, 686240);
  const driven = maintenanceFigures({
    verifiedKm: 676240,
    distanceM: 100_000,
    lastServiceKm: 676240,
    intervalKm: 10000,
  });
  assert.equal(driven.estimatedKm, 676340);
  assert.equal(driven.nextServiceKm, 686240);
  assert.equal(driven.remainingKm, 9900);
  assert.equal(driven.line, "remaining");
  const due = maintenanceFigures({ verifiedKm: 686240, distanceM: 0, lastServiceKm: 676240, intervalKm: 10000 });
  assert.equal(due.remainingKm, 0);
  assert.equal(due.line, "due");
  const overdue = maintenanceFigures({ verifiedKm: 686440, distanceM: 0, lastServiceKm: 676240, intervalKm: 10000 });
  assert.equal(overdue.remainingKm, -200);
  assert.equal(overdue.line, "overdue");
  const corrected = maintenanceFigures({ verifiedKm: 680050, distanceM: 1000, lastServiceKm: 676240, intervalKm: 10000 });
  assert.equal(corrected.estimatedKm, 680051);
  assert.equal(corrected.nextServiceKm, 686240);
});

test("GPS distance ignores jumps, duplicates, gaps, late points, and a second feed", () => {
  const start = Date.parse("2026-10-13T08:00:00Z");
  const anchor = { id: "a", at: start, latitude: 41, longitude: 29 };
  const oneKm = foldMaintenanceDistance({
    cursor: null,
    nowMs: start + 60_000,
    points: [anchor, { id: "b", at: start + 60_000, latitude: north(41, 1000), longitude: 29 }],
  });
  assert.ok(oneKm.addedMeters > 990 && oneKm.addedMeters < 1010);
  assert.equal(displayMaintenanceKm(676240, oneKm.addedMeters), 676241);
  const hundred = foldMaintenanceDistance({
    cursor: null,
    nowMs: start + 20 * 60_000,
    points: [
      anchor,
      { id: "c1", at: start + 10 * 60_000, latitude: north(41, 50_000), longitude: 29 },
      { id: "c2", at: start + 20 * 60_000, latitude: north(41, 100_000), longitude: 29 },
    ],
  });
  assert.ok(hundred.addedMeters > 99_000 && hundred.addedMeters < 101_000);
  const jump = foldMaintenanceDistance({
    cursor: { at: start, latitude: 41, longitude: 29, pointId: "a" },
    nowMs: start + 1_000,
    points: [{ id: "jump", at: start + 1_000, latitude: north(41, 8_000), longitude: 29 }],
  });
  assert.equal(jump.addedMeters, 0);
  const duplicate = foldMaintenanceDistance({
    cursor: { at: start, latitude: 41, longitude: 29, pointId: "a" },
    nowMs: start + 60_000,
    points: [
      { id: "a", at: start, latitude: 41, longitude: 29 },
      { id: "same", at: start + 1_000, latitude: 41, longitude: 29 },
    ],
  });
  assert.equal(duplicate.addedMeters, 0);
  const late = foldMaintenanceDistance({
    cursor: { at: start, latitude: 41, longitude: 29, pointId: "a" },
    nowMs: start + 120_000,
    points: [{ id: "late", at: start - 60_000, latitude: north(41, 1000), longitude: 29 }],
  });
  assert.equal(late.addedMeters, 0);
  assert.equal(late.cursor?.pointId, "a");
  const gap = foldMaintenanceDistance({
    cursor: { at: start, latitude: 41, longitude: 29, pointId: "a" },
    nowMs: start + 30 * 60_000,
    points: [{ id: "gap", at: start + 20 * 60_000, latitude: north(41, 2000), longitude: 29 }],
  });
  assert.equal(gap.addedMeters, 0);
  assert.equal(gap.gap, true);
  const invalid = foldMaintenanceDistance({
    cursor: null,
    nowMs: start + 60_000,
    points: [{ id: "zero", at: start, latitude: 0, longitude: 0 }],
  });
  assert.equal(invalid.cursor, null);
  assert.equal(maintenanceDistanceSource(true), "physical");
  assert.equal(maintenanceDistanceSource(false), "mobile");
  assert.doesNotMatch(maintenancePositionSql("physical"), /gps_mobile_positions/);
  assert.match(maintenancePositionSql("physical"), /ignition/);
  assert.match(maintenancePositionSql("mobile"), /gps_mobile_positions/);
  assert.doesNotMatch(maintenancePositionSql("mobile"), /FROM gps_positions|ignition/);
});

test("ignition-off movement does not raise estimated km, and unknown ignition still does", () => {
  const start = Date.parse("2026-10-13T10:00:00Z");
  const origin = { id: "drive", at: start, latitude: 41, longitude: 29, ignition: "on" as const };
  const driving = foldMaintenanceDistance({
    cursor: null,
    nowMs: start + 10 * 60_000,
    useIgnition: true,
    points: [origin, { id: "on-1", at: start + 60_000, latitude: north(41, 1000), longitude: 29, ignition: "on" }],
  });
  assert.ok(driving.addedMeters > 990 && driving.addedMeters < 1010);
  assert.equal(driving.cursor?.ignition, "on");
  const ferry = foldMaintenanceDistance({
    cursor: driving.cursor,
    nowMs: start + 20 * 60_000,
    useIgnition: true,
    points: [
      { id: "off-1", at: start + 2 * 60_000, latitude: north(41, 1100), longitude: 29, ignition: "off" },
      { id: "off-2", at: start + 12 * 60_000, latitude: north(41, 6100), longitude: 29, ignition: "off" },
    ],
  });
  assert.ok(ferry.addedMeters > 90 && ferry.addedMeters < 110);
  assert.equal(ferry.cursor?.ignition, "off");
  assert.ok((ferry.cursor?.latitude ?? 0) > north(41, 6000));
  const resumed = foldMaintenanceDistance({
    cursor: ferry.cursor,
    nowMs: start + 30 * 60_000,
    useIgnition: true,
    points: [
      { id: "on-again", at: start + 13 * 60_000, latitude: north(41, 7000), longitude: 29, ignition: "on" },
      { id: "on-drive", at: start + 14 * 60_000, latitude: north(41, 8000), longitude: 29, ignition: "on" },
    ],
  });
  assert.ok(resumed.addedMeters > 990 && resumed.addedMeters < 1010);
  assert.equal(resumed.cursor?.ignition, "on");
  const carried = foldMaintenanceDistance({
    cursor: ferry.cursor,
    nowMs: start + 30 * 60_000,
    useIgnition: true,
    points: [{ id: "off-silent", at: start + 18 * 60_000, latitude: north(41, 9000), longitude: 29 }],
  });
  assert.equal(carried.addedMeters, 0);
  assert.equal(carried.cursor?.ignition, "off");
  const unknown = foldMaintenanceDistance({
    cursor: null,
    nowMs: start + 10 * 60_000,
    useIgnition: true,
    points: [
      { id: "u1", at: start, latitude: 41, longitude: 29 },
      { id: "u2", at: start + 60_000, latitude: north(41, 1000), longitude: 29 },
    ],
  });
  assert.ok(unknown.addedMeters > 990 && unknown.addedMeters < 1010);
  assert.equal(unknown.cursor?.ignition, null);
  const dropped = foldMaintenanceDistance({
    cursor: { at: start, latitude: 41, longitude: 29, pointId: "on", ignition: "on" },
    nowMs: start + 30 * 60_000,
    useIgnition: true,
    points: [{ id: "lost", at: start + 20 * 60_000, latitude: north(41, 2000), longitude: 29, ignition: "on" }],
  });
  assert.equal(dropped.addedMeters, 0);
  assert.equal(dropped.gap, true);
  const mobile = foldMaintenanceDistance({
    cursor: null,
    nowMs: start + 20 * 60_000,
    useIgnition: false,
    points: [
      { id: "m1", at: start, latitude: 41, longitude: 29, ignition: "off" },
      { id: "m2", at: start + 10 * 60_000, latitude: north(41, 5000), longitude: 29, ignition: "off" },
    ],
  });
  assert.ok(mobile.addedMeters > 4900 && mobile.addedMeters < 5100);
  assert.equal(mobile.cursor?.ignition, null);
  const again = foldMaintenanceDistance({
    cursor: ferry.cursor,
    nowMs: start + 40 * 60_000,
    useIgnition: true,
    points: [{ id: "off-3", at: start + 19 * 60_000, latitude: north(41, 11000), longitude: 29, ignition: "off" }],
  });
  assert.equal(again.addedMeters, 0);
  const figures = maintenanceFigures({ verifiedKm: 675000, distanceM: ferry.addedMeters, lastServiceKm: 665000, intervalKm: 10000 });
  assert.equal(figures.estimatedKm, 675000);
  assert.equal(figures.nextServiceKm, 675000);
});

test("service reminders fire once for the current threshold and restart on a new cycle", () => {
  assert.equal(maintenanceAlertThreshold(600), null);
  assert.deepEqual([450, 350, 250, 150, 50, 0, -50, -100, -250].map(maintenanceAlertThreshold), [500, 400, 300, 200, 100, 0, 0, -100, -200]);
  const sent = new Set<number>();
  const first = maintenanceNoticeDue(50, sent);
  assert.equal(first, 100);
  sent.add(first ?? 0);
  assert.equal(maintenanceNoticeDue(50, sent), null);
  assert.equal(maintenanceNoticeDue(-250, new Set()), -200);
  assert.equal(maintenanceNoticeDue(450, new Set([-200])), 500);
  assert.equal(maintenanceNoticeDue(450, new Set([500])), null);
  assert.equal(maintenanceNoticeDue(450, new Set()), 500);
  assert.deepEqual(maintenancePartnerRecipients([" A@Example.com ", "a@example.com", ""]), ["a@example.com"]);
});

test("maintenance email names the vehicle and links the assigned driver's phone", () => {
  const approaching = maintenanceEmail({
    locale: "tr",
    line: "remaining",
    thresholdKm: 500,
    plate: "34ABC123",
    brand: "Mercedes",
    model: "Sprinter",
    driverName: "Ada Lovelace",
    driverPhone: "+905551112233",
    estimatedKm: 674500,
    lastServiceKm: 665000,
    lastServiceOn: "2026-09-15",
    intervalKm: 10000,
    nextServiceKm: 675000,
    remainingKm: 500,
  });
  assert.equal(approaching.subject, "Araç Bakım Hatırlatması — 34ABC123 — 500 km Kaldı");
  assert.match(approaching.text, /Mercedes \/ Sprinter/);
  assert.match(approaching.text, /Ada Lovelace/);
  assert.match(approaching.html, /href="tel:\+905551112233"/);
  assert.match(approaching.html, /\+90 555 111 22 33/);
  const overdue = maintenanceEmail({
    ...{
      locale: "tr" as const,
      line: "overdue" as const,
      thresholdKm: -200,
      plate: "34ABC123",
      brand: "Mercedes",
      model: "Sprinter",
      driverName: "Ada Lovelace",
      driverPhone: "+905551112233",
      estimatedKm: 675200,
      lastServiceKm: 665000,
      lastServiceOn: "2026-09-15",
      intervalKm: 10000,
      nextServiceKm: 675000,
      remainingKm: -200,
    },
  });
  assert.equal(overdue.subject, "Araç Bakımı Gecikti — 34ABC123 — 200 km");
  assert.match(overdue.text, /Bakım Gecikmesi: 200 km/);
  const unassigned = maintenanceEmail({
    locale: "en",
    line: "remaining",
    thresholdKm: 500,
    plate: "34ABC123",
    brand: null,
    model: null,
    driverName: null,
    driverPhone: null,
    estimatedKm: 1,
    lastServiceKm: 0,
    lastServiceOn: "2026-09-15",
    intervalKm: 1000,
    nextServiceKm: 1000,
    remainingKm: 500,
  });
  assert.doesNotMatch(unassigned.html, /tel:/);
  assert.doesNotMatch(unassigned.text, /Driver:/);
  assert.equal(maintenancePhoneLink(null), null);
  assert.equal(maintenancePhoneLink("+905551112233")?.href, "tel:+905551112233");
});

test("maintenance stays on the partner GPS page and does not notify the driver", () => {
  const live = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  const panel = readFileSync(new URL("../../components/gps/maintenance-section.tsx", import.meta.url), "utf8");
  const store = readFileSync(new URL("./maintenance-store.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("./maintenance-actions.ts", import.meta.url), "utf8");
  const historyAt = live.indexOf("copy.showHistory");
  const maintenanceAt = live.indexOf("copy.showMaintenance");
  const deviceAt = live.indexOf("copy.showDevice");
  assert.ok(historyAt >= 0 && historyAt < maintenanceAt && maintenanceAt < deviceAt);
  assert.match(live, /surface === "partner" && \(picking \|\| selectedFleet\?\.vehicleId\)/);
  assert.match(live, /copy\.maintenancePick/);
  assert.match(live, /key=\{selectedFleet\.vehicleId\}/);
  assert.match(live, /mergeGpsFleetIdentity\(current \?\? fleetVehicles, next\)/);
  const fleetRoute = readFileSync(new URL("../../app/api/gps/fleet/route.ts", import.meta.url), "utf8");
  assert.match(fleetRoute, /vehicleId: device\.vehicleId/);
  assert.equal(gpsCopy.tr.showMaintenance, "Araç bakım takibini göster");
  assert.equal(gpsCopy.tr.hideMaintenance, "Araç bakım takibini gizle");
  assert.equal(gpsCopy.tr.maintenanceTitle, "Araç Bakım Takibi");
  assert.equal(gpsCopy.tr.maintenanceSaveStart, "Kaydet ve Takibi Başlat");
  assert.equal(gpsCopy.tr.maintenanceConfirmSave, "Bakımı Onayla ve Kaydet");
  assert.equal(gpsCopy.en.maintenanceTitle, "Vehicle service tracking");
  assert.equal(gpsCopy.ru.maintenanceTitle, "Учёт обслуживания автомобиля");
  assert.doesNotMatch(panel, /10000/);
  assert.match(actions, /getPartnerActor/);
  assert.match(actions, /partnerId: current\.partnerId/);
  assert.match(store, /assignedMaintenanceDriver/);
  assert.match(store, /maintenanceDeliveryPlan/);
  assert.match(store, /driver_push_subscriptions/);
  assert.match(panel, /portalActor === "driver" && notice\.driverBody/);
  assert.doesNotMatch(store, /ats-run|immobilizer|setdigout|driver-portal/);
  assert.match(store, /listActivePartnerPushSubscriptionsForPartner/);
  assert.match(store, /useIgnition: source === "physical"/);
  assert.doesNotMatch(store, /acc_state/);
  const listener = readFileSync(new URL("../teltonika/store.ts", import.meta.url), "utf8");
  assert.match(listener, /ignition: din1Reading/);
  assert.match(listener, /teltonikaIgnition\(record\)/);
  assert.equal(maintenanceLockKey("vehicle"), "maintenance:vehicle");
  const correct = store.slice(
    store.indexOf("export async function correctVehicleMaintenance"),
    store.indexOf("export async function completeVehicleMaintenance"),
  );
  const complete = store.slice(
    store.indexOf("export async function completeVehicleMaintenance"),
    store.indexOf("export async function editVehicleMaintenance"),
  );
  assert.match(correct, /verified_km = \$3/);
  assert.doesNotMatch(correct, /last_service_km =/);
  assert.match(complete, /last_service_km = \$3/);
  assert.match(complete, /cycle_id = gen_random_uuid\(\)/);
  assert.doesNotMatch(complete, /verified_km =/);
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.gps-maintenance-pair/);
  assert.match(css, /@media \(max-width: 719px\)/);
});

test("maintenance delivery reaches the assigned driver without a second copy for the same address", () => {
  const samePerson = maintenanceDeliveryPlan({
    partnerEmails: ["Ada@Trip.com"],
    driverEmail: "ada@trip.com",
  });
  assert.deepEqual(samePerson.partnerEmails, []);
  assert.equal(samePerson.driverEmail, "ada@trip.com");
  assert.equal(samePerson.samePerson, true);

  const ownerAndStaff = maintenanceDeliveryPlan({
    partnerEmails: ["owner@trip.com", "office@trip.com"],
    driverEmail: "owner@trip.com",
  });
  assert.deepEqual(ownerAndStaff.partnerEmails, ["office@trip.com"]);
  assert.equal(ownerAndStaff.driverEmail, "owner@trip.com");
  assert.equal(ownerAndStaff.samePerson, true);

  const separate = maintenanceDeliveryPlan({
    partnerEmails: ["owner@trip.com"],
    driverEmail: "driver@trip.com",
  });
  assert.deepEqual(separate.partnerEmails, ["owner@trip.com"]);
  assert.equal(separate.driverEmail, "driver@trip.com");
  assert.equal(separate.samePerson, false);

  const otherVehicle = maintenanceDeliveryPlan({
    partnerEmails: ["owner@trip.com", "office@trip.com"],
    driverEmail: "other-driver@trip.com",
  });
  assert.deepEqual(otherVehicle.partnerEmails, ["owner@trip.com", "office@trip.com"]);
  assert.equal(otherVehicle.driverEmail, "other-driver@trip.com");

  const changedDriver = maintenanceDeliveryPlan({
    partnerEmails: ["owner@trip.com"],
    driverEmail: "new-driver@trip.com",
  });
  assert.equal(changedDriver.driverEmail, "new-driver@trip.com");
  assert.deepEqual(changedDriver.partnerEmails, ["owner@trip.com"]);

  const unassigned = maintenanceDeliveryPlan({
    partnerEmails: [" Owner@Trip.com "],
    driverEmail: null,
  });
  assert.deepEqual(unassigned.partnerEmails, ["owner@trip.com"]);
  assert.equal(unassigned.driverEmail, null);
  assert.equal(unassigned.samePerson, false);
});

test("driver maintenance notices use the driver copy and leave the partner mail unchanged", () => {
  const approaching = maintenanceDriverNotice({
    locale: "tr",
    line: "remaining",
    plate: "34 ABC 123",
    firstName: "Ahmet",
    estimatedKm: 49500,
    lastServiceKm: 40000,
    nextServiceKm: 50000,
    remainingKm: 500,
  });
  assert.equal(approaching.title, "🔧 Araç Bakım Hatırlatması");
  assert.equal(approaching.subject, "Araç Bakım Hatırlatması – 34 ABC 123");
  assert.match(approaching.body, /34 ABC 123 plakalı aracınızın periyodik bakımına 500 km kaldı/);
  assert.match(approaching.body, /Tahmini güncel kilometre: 49\.500 km/);
  assert.match(approaching.body, /Sıradaki bakım: 50\.000 km/);
  assert.match(approaching.text, /Merhaba Ahmet Bey,/);
  assert.match(approaching.text, /Son bakım kilometresi: 40\.000 km/);
  assert.match(approaching.text, /Bakıma kalan: 500 km/);
  assert.match(approaching.text, /Bakımı Yaptırdım/);
  assert.match(approaching.text, /Tripetica Araç Bakım Takip Sistemi/);
  assert.doesNotMatch(approaching.text, /Ahmet Bey:/);
  assert.doesNotMatch(approaching.text, /Telefon/);
  assert.doesNotMatch(approaching.html, /tel:/);

  const overdue = maintenanceDriverNotice({
    locale: "tr",
    line: "overdue",
    plate: "34 ABC 123",
    firstName: "Ahmet",
    estimatedKm: 50300,
    lastServiceKm: 40000,
    nextServiceKm: 50000,
    remainingKm: -300,
  });
  assert.equal(overdue.title, "⚠️ Araç Bakımı Gecikti");
  assert.equal(overdue.subject, "Araç Bakımı Gecikti – 34 ABC 123");
  assert.match(overdue.body, /bakım kilometresi 300 km aşıldı/);
  assert.match(overdue.body, /Tahmini güncel kilometre: 50\.300 km/);
  assert.match(overdue.body, /Planlanan bakım: 50\.000 km/);
  assert.match(overdue.text, /Bakım gecikmesi: 300 km/);
  assert.match(overdue.text, /partner yetkilisiyle/);
  assert.doesNotMatch(overdue.text, /Telefon/);

  const partner = maintenanceEmail({
    locale: "tr",
    line: "remaining",
    thresholdKm: 500,
    plate: "34 ABC 123",
    brand: "Mercedes",
    model: "Sprinter",
    driverName: "Ahmet Yılmaz",
    driverPhone: "+905551112233",
    estimatedKm: 49500,
    lastServiceKm: 40000,
    lastServiceOn: "2026-09-15",
    intervalKm: 10000,
    nextServiceKm: 50000,
    remainingKm: 500,
  });
  assert.equal(partner.subject, "Araç Bakım Hatırlatması — 34 ABC 123 — 500 km Kaldı");
  assert.match(partner.text, /Şoför: Ahmet Yılmaz/);
  assert.match(partner.text, /Partner Portal/);
});
