import test from "node:test";
import assert from "node:assert/strict";
import {
  firstIncompleteExtraSequence,
  isPassengerFormComplete,
  type PassengerFormValue,
} from "@/components/booking/checkout-passenger-form";

function extra(
  partial: Partial<PassengerFormValue> = {},
): PassengerFormValue {
  return {
    countryCode: "TR",
    identityNumber: "",
    firstName: "Recep",
    lastName: "Yıldırım",
    gender: "male",
    ...partial,
  };
}

test("extra passenger is complete without passport or national id", () => {
  assert.equal(isPassengerFormComplete(extra()), true);
  assert.equal(isPassengerFormComplete(extra({ identityNumber: "" })), true);
  assert.equal(isPassengerFormComplete(extra({ firstName: "" })), false);
  assert.equal(isPassengerFormComplete(extra({ lastName: "  " })), false);
  assert.equal(isPassengerFormComplete(extra({ countryCode: null })), false);
});

test("opens the first incomplete extra passenger in sequence order", () => {
  const sequences = [2, 3, 4, 5, 6, 7];
  const values = {
    2: extra(),
    3: extra({ firstName: "Ayse" }),
    4: extra({ firstName: "Can" }),
    5: extra({ firstName: "Deniz" }),
    6: extra({ firstName: "", lastName: "", countryCode: null }),
    7: extra({ firstName: "", lastName: "", countryCode: null }),
  };
  assert.equal(firstIncompleteExtraSequence(sequences, values), 6);
});

test("opens the first extra when none are filled", () => {
  const sequences = [2, 3, 4, 5];
  const empty = extra({ countryCode: null, firstName: "", lastName: "" });
  assert.equal(
    firstIncompleteExtraSequence(sequences, { 2: empty, 3: empty, 4: empty, 5: empty }),
    2,
  );
});

test("opens nothing when every extra passenger is complete", () => {
  const sequences = [2, 3, 4];
  assert.equal(
    firstIncompleteExtraSequence(sequences, { 2: extra(), 3: extra(), 4: extra() }),
    null,
  );
});

test("skips completed extras even when a later passenger is also incomplete", () => {
  const sequences = [2, 3, 4, 5];
  const empty = extra({ countryCode: null, firstName: "", lastName: "" });
  assert.equal(
    firstIncompleteExtraSequence(sequences, {
      2: extra(),
      3: empty,
      4: extra(),
      5: empty,
    }),
    3,
  );
});
