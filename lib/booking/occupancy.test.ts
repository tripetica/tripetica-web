import test from "node:test";
import assert from "node:assert/strict";
import {
  displayPassengerCount,
  hasAppliedPassengerCount,
  maxKeptDraftPassengerSequence,
  shouldShowFlightCode,
} from "@/lib/booking/occupancy";

test("draft passenger trim keeps 1..N and skips invalid counts", () => {
  assert.equal(maxKeptDraftPassengerSequence(7), 7);
  assert.equal(maxKeptDraftPassengerSequence(3), 3);
  assert.equal(maxKeptDraftPassengerSequence(1), 1);
  assert.equal(maxKeptDraftPassengerSequence(null), null);
  assert.equal(maxKeptDraftPassengerSequence(0), null);
});

test("flight code is shown only when pickup is an airport", () => {
  const ist = { airportCode: "IST", type: "airport" };
  const taksim = { type: "place", airportCode: null };
  assert.equal(shouldShowFlightCode(ist, "TK123"), true);
  assert.equal(shouldShowFlightCode(ist, ""), false);
  assert.equal(shouldShowFlightCode(ist, null), false);
  assert.equal(shouldShowFlightCode(taksim, "TK123"), false);
  assert.equal(shouldShowFlightCode(taksim, ""), false);
});

test("unset passenger count displays as zero and is not a valid applied selection", () => {
  assert.equal(displayPassengerCount(null), 0);
  assert.equal(displayPassengerCount(0), 0);
  assert.equal(displayPassengerCount(3), 3);
  assert.equal(hasAppliedPassengerCount(null), false);
  assert.equal(hasAppliedPassengerCount(0), false);
  assert.equal(hasAppliedPassengerCount(1), true);
  assert.equal(hasAppliedPassengerCount(4), true);
});
