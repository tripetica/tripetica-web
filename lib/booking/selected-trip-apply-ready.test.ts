import test from "node:test";
import assert from "node:assert/strict";
import { selectedTripRowReadyForApply } from "@/lib/booking/selected-trip-apply-ready";

test("istanbul address package tours apply row without selected distance", () => {
  assert.equal(
    selectedTripRowReadyForApply({
      serviceType: "tour",
      tourCode: "istanbul-half-day",
      selectedDurationHours: 6,
      selectedDistanceKm: null,
    }),
    true,
  );
  assert.equal(
    selectedTripRowReadyForApply({
      serviceType: "tour",
      tourCode: "istanbul-full-day",
      selectedDurationHours: 10,
      selectedDistanceKm: null,
    }),
    true,
  );
});

test("sapanca tour apply row without selected distance", () => {
  assert.equal(
    selectedTripRowReadyForApply({
      serviceType: "tour",
      tourCode: "sapanca",
      selectedDurationHours: 11,
      selectedDistanceKm: null,
    }),
    true,
  );
});

test("bursa tour apply row without selected distance", () => {
  assert.equal(
    selectedTripRowReadyForApply({
      serviceType: "tour",
      tourCode: "bursa",
      selectedDurationHours: 12,
      selectedDistanceKm: null,
    }),
    true,
  );
});

test("bosphorus dinner apply row without selected distance", () => {
  assert.equal(
    selectedTripRowReadyForApply({
      serviceType: "tour",
      tourCode: "bosphorus-dinner",
      selectedDurationHours: null,
      selectedDistanceKm: null,
    }),
    true,
  );
});

test("transfer apply row still requires selected distance", () => {
  assert.equal(
    selectedTripRowReadyForApply({
      serviceType: "transfer",
      tourCode: null,
      selectedDurationHours: null,
      selectedDistanceKm: null,
    }),
    false,
  );
});

test("layover tour apply row uses selected distance", () => {
  assert.equal(
    selectedTripRowReadyForApply({
      serviceType: "tour",
      tourCode: "istanbul-layover",
      selectedDurationHours: 7,
      selectedDistanceKm: 42,
    }),
    true,
  );
});
