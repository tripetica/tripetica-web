import test from "node:test";
import assert from "node:assert/strict";
import {
  hourlyDropoffBillableDistanceKm,
  hourlyDropoffDistanceFeeEur,
} from "@/lib/booking/hourly-dropoff-distance";

test("hourly dropoff distance fee uses first 10 km free then 0.50 EUR/km", () => {
  assert.equal(hourlyDropoffBillableDistanceKm(0), 0);
  assert.equal(hourlyDropoffBillableDistanceKm(8), 0);
  assert.equal(hourlyDropoffBillableDistanceKm(10), 0);
  assert.equal(hourlyDropoffBillableDistanceKm(15), 5);
  assert.equal(hourlyDropoffDistanceFeeEur(15), 2.5);
  assert.equal(hourlyDropoffDistanceFeeEur(30), 10);
  assert.equal(hourlyDropoffDistanceFeeEur(97), 43.5);
});
