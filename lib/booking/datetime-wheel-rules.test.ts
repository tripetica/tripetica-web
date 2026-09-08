import test from "node:test";
import assert from "node:assert/strict";
import {
  ceilIstanbulLocalToFiveMinutes,
  correctMinuteForHour,
  dateHasBookingConstraint,
  effectiveBookingMin,
  isHourWheelItemDisabled,
  isMinuteWheelItemDisabled,
  minuteWheelItems,
  snapHourWheelItem,
  snapMinuteWheelItem,
  hourWheelItems,
} from "@/lib/booking/datetime-wheel-rules";

const MIN = "2026-08-28T20:15";
const DATE = "2026-08-28";

test("ceilIstanbulLocalToFiveMinutes rounds up within the hour", () => {
  assert.equal(
    ceilIstanbulLocalToFiveMinutes("2026-08-28T20:11"),
    "2026-08-28T20:15",
  );
  assert.equal(
    ceilIstanbulLocalToFiveMinutes("2026-08-28T20:58"),
    "2026-08-28T21:00",
  );
});

test("effectiveBookingMin applies five-minute ceiling", () => {
  assert.equal(effectiveBookingMin("2026-08-28T19:11"), "2026-08-28T19:15");
});

test("past hours stay visible but disabled on constrained today", () => {
  assert.equal(isHourWheelItemDisabled("18", DATE, MIN, true), true);
  assert.equal(isHourWheelItemDisabled("20", DATE, MIN, true), false);
  assert.equal(isHourWheelItemDisabled("21", DATE, MIN, true), false);
});

test("invalid hour wheel position snaps forward to minimum hour", () => {
  const items = hourWheelItems();
  assert.equal(snapHourWheelItem("18", items, DATE, MIN, true), "20");
  assert.equal(snapHourWheelItem("19", items, DATE, MIN, true), "20");
  assert.equal(snapHourWheelItem("--", items, DATE, MIN, true), "20");
});

test("first hour interaction keeps unset until interacted", () => {
  const items = hourWheelItems();
  assert.equal(snapHourWheelItem("--", items, DATE, MIN, false), "");
  assert.equal(snapHourWheelItem("--", items, DATE, MIN, true), "20");
});

test("minutes stay locked until hour is selected", () => {
  assert.equal(isMinuteWheelItemDisabled("05", "", DATE, MIN, false), true);
  assert.equal(isMinuteWheelItemDisabled("--", "", DATE, MIN, false), true);
});

test("minimum hour disables early minutes but keeps later ones active", () => {
  assert.equal(isMinuteWheelItemDisabled("00", "20", DATE, MIN, true), true);
  assert.equal(isMinuteWheelItemDisabled("10", "20", DATE, MIN, true), true);
  assert.equal(isMinuteWheelItemDisabled("15", "20", DATE, MIN, true), false);
  assert.equal(isMinuteWheelItemDisabled("00", "21", DATE, MIN, true), false);
});

test("invalid minute snaps to first valid minute for minimum hour", () => {
  const items = minuteWheelItems();
  assert.equal(snapMinuteWheelItem("05", items, "20", DATE, MIN, true), "15");
  assert.equal(snapMinuteWheelItem("--", items, "20", DATE, MIN, true), "15");
});

test("dropping to minimum hour corrects an invalid minute", () => {
  assert.equal(correctMinuteForHour("20", "05", DATE, MIN, true), "15");
});

test("future dates are not constrained by today minimum", () => {
  assert.equal(dateHasBookingConstraint("2026-08-29", MIN), false);
  assert.equal(isHourWheelItemDisabled("08", "2026-08-29", MIN, false), false);
});
