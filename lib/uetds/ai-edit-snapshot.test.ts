import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDraft, createPassengerDraft } from "@/lib/uetds/draft";
import { emptyUetdsLocation } from "@/lib/uetds/location";
import { captureAiEditSnapshot, diffAiEditSnapshots, planAiEditContinue, type AiEditSnapshotMeta } from "@/lib/uetds/ai-edit-snapshot";

const meta: AiEditSnapshotMeta = {
  notificationId: "11111111-1111-1111-1111-111111111111",
  partnerId: "22222222-2222-2222-2222-222222222222",
  companyId: "33333333-3333-3333-3333-333333333333",
  companyName: "Search Travel",
  seferReference: "1234567890123456",
  plate: "34 EGP 847",
  driverName: "Ali Demir",
  vehicleLabel: "34 EGP 847",
};

function draft() {
  const next = createEmptyDraft("manual", { applyTripDefaults: false });
  next.origin = "Istanbul Airport";
  next.destination = "Hilton Istanbul";
  next.originLocation = { ...emptyUetdsLocation(), provinceCode: "34", provinceName: "İstanbul", districtOrAirportCode: "IST", districtOrAirportName: "İstanbul Havalimanı", placeName: "Istanbul Airport" };
  next.destinationLocation = { ...emptyUetdsLocation(), provinceCode: "34", provinceName: "İstanbul", districtOrAirportName: "Beşiktaş", placeName: "Hilton Istanbul" };
  next.startDate = "2026-10-02";
  next.startTime = "09:00";
  next.endDate = "2026-10-02";
  next.endTime = "13:00";
  next.groupName = "Grup A";
  next.fare = "100";
  next.tripKind = "transfer";
  next.driverId = "driver-1";
  next.vehicleId = "vehicle-1";
  next.passengers = [
    createPassengerDraft({ key: "p1", firstName: "Ahmet", lastName: "Yilmaz", nationality: "TR", identityNumber: "12345678901", gender: "male", ministryReference: "yolcu-1" }),
    createPassengerDraft({ key: "p2", firstName: "Ayse", lastName: "Kaya", nationality: "TR", identityNumber: "AB123456", gender: "female", ministryReference: "yolcu-2" }),
  ];
  return next;
}

test("OLD snapshot keeps the notified trip, fleet and passengers", () => {
  const old = captureAiEditSnapshot(draft(), meta);
  assert.equal(old.companyName, "Search Travel");
  assert.equal(old.seferReference, "1234567890123456");
  assert.equal(old.startDate, "2026-10-02");
  assert.equal(old.startTime, "09:00");
  assert.equal(old.endTime, "13:00");
  assert.equal(old.plate, "34 EGP 847");
  assert.equal(old.driverName, "Ali Demir");
  assert.equal(old.origin.provinceCode, "34");
  assert.equal(old.origin.districtOrAirportCode, "IST");
  assert.equal(old.destination.placeName, "Hilton Istanbul");
  assert.equal(old.groupName, "Grup A");
  assert.equal(old.fare, "100");
  assert.equal(old.tripKind, "transfer");
  assert.equal(old.passengers[0].index, 1);
  assert.equal(old.passengers[0].firstName, "Ahmet");
  assert.equal(old.passengers[0].ministryReference, "yolcu-1");
  assert.equal(old.passengers[1].documentNumber, "AB123456");
});

test("AI merge does not overwrite the OLD snapshot and maps passengers by index", () => {
  const source = draft();
  const old = captureAiEditSnapshot(source, meta);
  source.passengers[0].firstName = "Ayse";
  source.passengers[0].lastName = "Ketenci";
  source.passengers[0].identityNumber = "11111111111";
  source.origin = "Sabiha Gokcen";
  const next = captureAiEditSnapshot(source, meta);
  assert.equal(old.passengers[0].firstName, "Ahmet");
  assert.equal(old.origin.place, "Istanbul Airport");
  assert.equal(next.passengers[0].index, 1);
  assert.equal(next.passengers[0].firstName, "Ayse");
  assert.equal(next.passengers[1].firstName, "Ayse");
  const plan = diffAiEditSnapshots(old, next);
  assert.equal(plan.pickup_changed, true);
  assert.equal(plan.dropoff_changed, false);
  assert.equal(plan.start_datetime_changed, false);
  assert.equal(plan.passenger_changes.length, 1);
  assert.equal(plan.passenger_changes[0].old_index, 1);
  assert.equal(plan.passenger_changes[0].old.first_name, "Ahmet");
  assert.equal(plan.passenger_changes[0].new.first_name, "Ayse");
  assert.equal(plan.passenger_changes[0].new.document_number, "11111111111");
});

test("Şişli to Fatih is a dropoff change and continue stays allowed", () => {
  const original = draft();
  original.destination = "Şişli";
  const current = draft();
  current.destination = "Fatih";
  const planned = planAiEditContinue({
    existingOld: captureAiEditSnapshot(original, meta),
    originalDraft: original,
    currentDraft: current,
    meta,
    authorityId: "authority-1",
  });
  assert.equal(planned.plan.dropoff_changed, true);
  assert.equal(planned.openLogin, true);
  assert.equal(planned.old.destination.place, "Şişli");
  assert.equal(planned.next.destination.place, "Fatih");
});

test("a changed first passenger is mapped by index and continue stays allowed", () => {
  const original = draft();
  const current = draft();
  current.passengers[0].firstName = "Ayşe";
  current.passengers[0].lastName = "Ketenci";
  const planned = planAiEditContinue({
    existingOld: captureAiEditSnapshot(original, meta),
    originalDraft: original,
    currentDraft: current,
    meta,
    authorityId: "authority-1",
  });
  assert.equal(planned.plan.passenger_changes.length, 1);
  assert.equal(planned.plan.passenger_changes[0].old_index, 1);
  assert.equal(planned.plan.passenger_changes[0].old.first_name, "Ahmet");
  assert.equal(planned.plan.passenger_changes[0].old.last_name, "Yilmaz");
  assert.equal(planned.plan.passenger_changes[0].new.first_name, "Ayşe");
  assert.equal(planned.plan.passenger_changes[0].new.last_name, "Ketenci");
  assert.equal(planned.openLogin, true);
});

test("continue uses the form diff when an extraction result reports no new fields", () => {
  const original = draft();
  original.destination = "Şişli";
  const current = draft();
  current.destination = "Fatih";
  current.passengers[0].firstName = "Ayşe";
  current.passengers[0].lastName = "Ketenci";
  const extractionReportedNewData = false;
  const planned = planAiEditContinue({
    existingOld: captureAiEditSnapshot(original, meta),
    originalDraft: original,
    currentDraft: current,
    meta,
    authorityId: "authority-1",
  });
  assert.equal(extractionReportedNewData, false);
  assert.equal(planned.plan.dropoff_changed, true);
  assert.equal(planned.plan.passenger_changes[0].old_index, 1);
  assert.equal(planned.openLogin, true);
});

test("planning a continue does not overwrite the OLD snapshot", () => {
  const original = draft();
  original.destination = "Şişli";
  original.passengers[0].firstName = "Ahmet";
  const old = captureAiEditSnapshot(original, meta);
  const current = draft();
  current.destination = "Fatih";
  current.passengers[0].firstName = "Ayşe";
  current.passengers[0].lastName = "Ketenci";
  planAiEditContinue({
    existingOld: old,
    originalDraft: original,
    currentDraft: current,
    meta,
    authorityId: "authority-1",
  });
  assert.equal(old.destination.place, "Şişli");
  assert.equal(old.passengers[0].firstName, "Ahmet");
  assert.equal(old.passengers[0].lastName, "Yilmaz");
});

test("an unchanged form can still open the DEV login flow", () => {
  const original = draft();
  const planned = planAiEditContinue({
    existingOld: null,
    originalDraft: original,
    currentDraft: original,
    meta,
    authorityId: "authority-1",
  });
  assert.equal(planned.plan.dropoff_changed, false);
  assert.equal(planned.plan.passenger_changes.length, 0);
  assert.equal(planned.openLogin, true);
  assert.equal(planned.old.destination.place, planned.next.destination.place);
});
