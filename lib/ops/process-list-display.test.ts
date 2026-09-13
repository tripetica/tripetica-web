import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  BUSINESS_MINIVAN_CODE,
  FIRST_CLASS_MINIVAN_CODE,
  PREMIUM_ECONOMY_SEDAN_CODE,
  STANDARD_MINIVAN_CODE,
} from "@/lib/booking/pricing/vehicle-quote";
import { formatOpsDistance } from "@/lib/ops/format";
import { opsVehicleLabelFor } from "@/lib/ops/record-detail";
import {
  formatOpsExactCount,
  formatPassengerLuggageBaby,
  preferredProcessCount,
  preferredProcessFlag,
  processListDistanceKm,
  processListFlightCode,
  processListHasSelectedVehicle,
  processListVehicleClassLabel,
} from "@/lib/ops/process-list-display";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("vehicle class uses opsVehicleLabelFor Turkish titles from stored codes", () => {
  assert.equal(opsVehicleLabelFor(STANDARD_MINIVAN_CODE, "tr"), "Standart Minivan");
  assert.equal(
    processListVehicleClassLabel({
      appliedVehicleCode: STANDARD_MINIVAN_CODE,
      selectedVehicleCode: null,
      appliedVehicleLabelTr: null,
      selectedVehicleLabelTr: null,
    }),
    "Standart Minivan",
  );
  assert.equal(
    processListVehicleClassLabel({
      appliedVehicleCode: PREMIUM_ECONOMY_SEDAN_CODE,
      selectedVehicleCode: STANDARD_MINIVAN_CODE,
      appliedVehicleLabelTr: null,
      selectedVehicleLabelTr: null,
    }),
    "Premium Ekonomi Sedan",
  );
  assert.equal(
    processListVehicleClassLabel({
      appliedVehicleCode: null,
      selectedVehicleCode: BUSINESS_MINIVAN_CODE,
      appliedVehicleLabelTr: "ignored english",
      selectedVehicleLabelTr: null,
    }),
    "Business Minivan",
  );
  assert.equal(
    processListVehicleClassLabel({
      appliedVehicleCode: FIRST_CLASS_MINIVAN_CODE,
      selectedVehicleCode: null,
      appliedVehicleLabelTr: null,
      selectedVehicleLabelTr: null,
    }),
    "First Class Minivan",
  );
  assert.notEqual(
    processListVehicleClassLabel({
      appliedVehicleCode: STANDARD_MINIVAN_CODE,
      selectedVehicleCode: null,
      appliedVehicleLabelTr: null,
      selectedVehicleLabelTr: null,
    }),
    processListVehicleClassLabel({
      appliedVehicleCode: BUSINESS_MINIVAN_CODE,
      selectedVehicleCode: null,
      appliedVehicleLabelTr: null,
      selectedVehicleLabelTr: null,
    }),
  );
});

test("missing vehicle class is a dash and is not inferred from price", () => {
  assert.equal(
    processListVehicleClassLabel({
      appliedVehicleCode: null,
      selectedVehicleCode: null,
      appliedVehicleLabelTr: null,
      selectedVehicleLabelTr: null,
    }),
    null,
  );
  assert.equal(
    processListVehicleClassLabel({
      appliedVehicleCode: "unknown-vehicle",
      selectedVehicleCode: "",
      appliedVehicleLabelTr: "  ",
      selectedVehicleLabelTr: null,
    }),
    null,
  );
  const helper = source("lib/ops/process-list-display.ts");
  assert.doesNotMatch(helper, /selectedStoredAmount/);
  assert.match(helper, /opsVehicleLabelFor/);
  assert.equal(
    processListHasSelectedVehicle({
      appliedVehicleCode: STANDARD_MINIVAN_CODE,
      selectedVehicleCode: null,
      appliedVehicleLabelTr: null,
      selectedVehicleLabelTr: null,
    }),
    true,
  );
  assert.equal(
    processListHasSelectedVehicle({
      appliedVehicleCode: null,
      selectedVehicleCode: null,
      appliedVehicleLabelTr: null,
      selectedVehicleLabelTr: null,
    }),
    false,
  );
  assert.equal(
    processListHasSelectedVehicle({
      appliedVehicleCode: null,
      selectedVehicleCode: null,
      appliedVehicleLabelTr: "  ",
      selectedVehicleLabelTr: null,
    }),
    false,
  );
  const money = source("lib/ops/processes.ts");
  assert.match(money, /applied_vehicle_total/);
  assert.match(money, /applied_fx_snapshot/);
});

test("stored Turkish label is used only when no known vehicle code exists", () => {
  assert.equal(
    processListVehicleClassLabel({
      appliedVehicleCode: null,
      selectedVehicleCode: null,
      appliedVehicleLabelTr: "Standart Minivan",
      selectedVehicleLabelTr: null,
    }),
    "Standart Minivan",
  );
});

test("passenger / luggage / baby keeps zero distinct from missing", () => {
  assert.equal(formatOpsExactCount(0), "0");
  assert.equal(formatOpsExactCount(2), "2");
  assert.equal(formatOpsExactCount(null), "—");
  assert.equal(formatOpsExactCount(undefined), "—");
  assert.equal(formatPassengerLuggageBaby(2, 1, 0), "2 / 1 / 0");
  assert.equal(formatPassengerLuggageBaby(2, null, 0), "2 / — / 0");
  assert.equal(formatPassengerLuggageBaby(null, null, null), "— / — / —");
  assert.equal(preferredProcessCount(0, 4), 0);
  assert.equal(preferredProcessCount(null, 0), 0);
  assert.equal(preferredProcessCount(null, null), null);
});

test("meet and greet keeps false distinct from missing", () => {
  assert.equal(preferredProcessFlag(true, false), true);
  assert.equal(preferredProcessFlag(false, true), false);
  assert.equal(preferredProcessFlag(null, true), true);
  assert.equal(preferredProcessFlag(null, false), false);
  assert.equal(preferredProcessFlag(null, null), null);
});

test("process list uses stored flight code without a parallel field", () => {
  assert.equal(processListFlightCode("TK 1953", null), "TK 1953");
  assert.equal(processListFlightCode(null, "PC 2028"), "PC 2028");
  assert.equal(processListFlightCode("  TK 1953  ", "ignored"), "TK 1953");
  assert.equal(processListFlightCode("  ", ""), null);
  assert.equal(processListFlightCode(null, null), null);
});

test("process list kilometre uses stored transfer km and never invents hourly distance", () => {
  assert.equal(processListDistanceKm("transfer", "42.62", null), 42.62);
  assert.equal(processListDistanceKm("transfer", null, "18"), 18);
  assert.equal(processListDistanceKm("transfer", 0, 12), 0);
  assert.equal(processListDistanceKm("transfer", null, null), null);
  assert.equal(processListDistanceKm("hourly", "42.6", "42.6"), null);
  assert.equal(processListDistanceKm("tour", "12", null), null);
  assert.equal(formatOpsDistance(42.62, "tr"), "42,6 km");
  assert.equal(formatOpsDistance(18, "tr"), "18,0 km");
  assert.equal(formatOpsDistance(null, "tr"), "");
});

test("process table shows vehicle class, occupancy triple, and meet and greet", () => {
  const table = source("components/ops/process-table.tsx");
  assert.match(table, /copy\.vehicleClass/);
  assert.match(table, /copy\.passengerLuggageBaby/);
  assert.match(table, /copy\.meetAndGreet/);
  assert.match(table, /copy\.flight/);
  assert.match(table, /copy\.kilometre/);
  assert.match(table, /item\.passengerLuggageBaby/);
  assert.match(table, /item\.flightCode/);
  assert.match(table, /item\.distanceKm/);
  assert.doesNotMatch(table, /from \"@\/lib\/ops\/process-list-display\"/);
  assert.doesNotMatch(table, /<th>\{copy\.passengerCount\}<\/th>/);
  const sql = source("lib/ops/processes.ts");
  assert.match(sql, /applied_vehicle_code/);
  assert.match(sql, /selected_vehicle_code/);
  assert.match(sql, /applied_luggage_count/);
  assert.match(sql, /applied_baby_seat_count/);
  assert.match(sql, /applied_meet_and_greet/);
  assert.match(sql, /applied_flight_code/);
  assert.match(sql, /selected_flight_code/);
  assert.match(sql, /applied_distance_km/);
  assert.match(sql, /selected_distance_km/);
  assert.match(sql, /processListVehicleClassLabel/);
  assert.match(sql, /processListFlightCode/);
  assert.match(sql, /processListDistanceKm/);
  assert.doesNotMatch(sql, /processListHasSelectedVehicle/);
  assert.match(sql, /fxSnapshot: row\.applied_fx_snapshot/);
  assert.doesNotMatch(sql, /googleapis|computeDrivingRoute|computeSelectedRoute/);
  const reservationTable = source("components/ops/reservation-table.tsx");
  assert.doesNotMatch(reservationTable, /copy\.kilometre/);
  const header = table.slice(table.indexOf("<thead>"), table.indexOf("</thead>"));
  const checkbox = header.indexOf('type="checkbox"');
  const rowNum = header.indexOf("ops-row-num-col");
  const transferAt = header.indexOf("{copy.transferAt}");
  const createdAt = header.indexOf("{copy.createdAt}");
  const occupancy = header.indexOf("{copy.passengerLuggageBaby}");
  const vehicle = header.indexOf("{copy.vehicleClass}");
  const flight = header.indexOf("{copy.flight}");
  const meet = header.indexOf("{copy.meetAndGreet}");
  const kilometre = header.indexOf("{copy.kilometre}");
  const total = header.indexOf("{copy.total}");
  const currency = header.indexOf("{copy.currency}");
  assert.equal(checkbox > 0, true);
  assert.equal(rowNum > 0, true);
  assert.equal(transferAt > 0, true);
  assert.equal(checkbox < transferAt, true);
  assert.equal(checkbox < rowNum, true);
  assert.equal(rowNum < transferAt, true);
  assert.equal(transferAt < createdAt, true);
  assert.equal(occupancy < vehicle, true);
  assert.equal(vehicle < flight, true);
  assert.equal(flight < meet, true);
  assert.equal(meet < kilometre, true);
  assert.equal(kilometre < total, true);
  assert.equal(total < currency, true);
});
