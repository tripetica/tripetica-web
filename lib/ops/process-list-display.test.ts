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
  assert.match(table, /OpsOccupancyCell/);
  assert.match(table, /item\.passengerCount/);
  assert.match(table, /item\.luggageCount/);
  assert.match(table, /item\.babySeatCount/);
  assert.doesNotMatch(table, /item\.passengerLuggageBaby/);
  assert.doesNotMatch(table, /from \"@\/lib\/ops\/process-list-display\"/);
  assert.doesNotMatch(table, /<th>\{copy\.passengerCount\}<\/th>/);
  const cell = source("components/ops/occupancy-cell.tsx");
  assert.match(cell, /formatOpsExactCount/);
  assert.match(cell, /copy\.occupancyPassenger/);
  assert.match(cell, /copy\.occupancyLuggage/);
  assert.match(cell, /copy\.occupancyBaby/);
  assert.doesNotMatch(cell, /\?\? 0/);
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
  assert.match(reservationTable, /OpsOccupancyCell/);
  assert.match(reservationTable, /copy\.passengerLuggageBaby/);
  assert.doesNotMatch(reservationTable, /<th>\{copy\.passengerCount\}<\/th>/);
  assert.doesNotMatch(reservationTable, /item\.passengerCount \?\? "—"/);
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

test("reservation list occupancy uses persisted passenger/luggage/baby_seat counts", () => {
  const list = source("lib/ops/reservations.ts");
  assert.match(list, /jobs\.luggage_count/);
  assert.match(list, /jobs\.baby_seat_count/);
  assert.match(list, /passenger_count, luggage_count, baby_seat_count/);
  assert.match(list, /luggageCount: row\.luggage_count/);
  assert.match(list, /babySeatCount: row\.baby_seat_count/);
  const occupancySql = list.slice(
    list.indexOf("jobs.passenger_count, jobs.luggage_count, jobs.baby_seat_count"),
    list.indexOf("jobs.total_price"),
  );
  assert.doesNotMatch(occupancySql, /total_price|vehicle_total|amount/);
  const types = source("lib/ops/reservation-types.ts");
  assert.match(types, /luggageCount: number \| null/);
  assert.match(types, /babySeatCount: number \| null/);
  const detail = source("lib/ops/record-detail.ts");
  assert.match(detail, /copy\.babySeat/);
  assert.match(detail, /item\.babySeatCount/);
  assert.match(detail, /item\.luggageCount/);
  assert.match(source("lib/ops/copy.ts"), /occupancyPassenger: "Yolcu"/);
  assert.match(source("lib/ops/copy.ts"), /occupancyLuggage: "Valiz"/);
  assert.match(source("lib/ops/copy.ts"), /occupancyBaby: "Bebek"/);
  const occupancyCss = source("app/globals.css");
  const occupancyBlock = occupancyCss.slice(
    occupancyCss.indexOf(".ops-occupancy {"),
    occupancyCss.indexOf(".ops-table th {", occupancyCss.indexOf(".ops-occupancy {")),
  );
  assert.match(occupancyCss, /\.ops-occupancy/);
  assert.match(occupancyBlock, /width: max-content/);
  assert.doesNotMatch(occupancyBlock, /width:\s*1%/);
  assert.doesNotMatch(occupancyBlock, /flex:\s*1|flex-grow|1fr|grid-template-columns/);
  assert.doesNotMatch(occupancyCss, /\.ops-table th\.ops-col-occupancy[\s\S]{0,120}width:\s*1%/);
  assert.match(source("lib/ops/reservation-filters.ts"), /status NOT IN \('cancelled', 'no_show', 'service_failed'\)/);
});
