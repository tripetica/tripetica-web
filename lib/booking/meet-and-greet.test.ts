import test from "node:test";
import assert from "node:assert/strict";
import {
  meetAndGreetMode,
  normalizeMeetAndGreet,
} from "@/lib/booking/meet-and-greet";

test("AYT meet and greet is required and normalizes to true", () => {
  const pickup = { type: "airport", airportCode: "AYT" };
  assert.equal(meetAndGreetMode(pickup), "required");
  assert.equal(normalizeMeetAndGreet(pickup, false), true);
  assert.equal(normalizeMeetAndGreet(pickup, null), true);
});

test("IST and SAW remain optional while non-airports remain hidden", () => {
  assert.equal(
    normalizeMeetAndGreet({ type: "airport", airportCode: "IST" }, false),
    false,
  );
  assert.equal(
    normalizeMeetAndGreet({ type: "airport", airportCode: "SAW" }, true),
    true,
  );
  assert.equal(normalizeMeetAndGreet({ type: "place" }, true), false);
});
