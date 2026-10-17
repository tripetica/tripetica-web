import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { uetdsValidationErrorKeys } from "@/components/uetds/use-uetds-validation";
import { createEmptyDraft } from "@/lib/uetds/draft";

const driverId = "11111111-1111-4111-8111-111111111111";
const vehicleId = "22222222-2222-4222-8222-222222222222";

test("a selected driver and vehicle are not treated as missing", () => {
  const draft = createEmptyDraft("manual");
  draft.driverId = driverId;
  draft.vehicleId = vehicleId;
  const keys = uetdsValidationErrorKeys(draft);
  assert.equal(keys.includes("driverId"), false);
  assert.equal(keys.includes("vehicleId"), false);
});

test("an empty driver or vehicle stays required", () => {
  const missingDriver = createEmptyDraft("manual");
  missingDriver.vehicleId = vehicleId;
  assert.equal(uetdsValidationErrorKeys(missingDriver).includes("driverId"), true);
  assert.equal(uetdsValidationErrorKeys(missingDriver).includes("vehicleId"), false);

  const missingVehicle = createEmptyDraft("manual");
  missingVehicle.driverId = driverId;
  assert.equal(uetdsValidationErrorKeys(missingVehicle).includes("driverId"), false);
  assert.equal(uetdsValidationErrorKeys(missingVehicle).includes("vehicleId"), true);
});

test("changing another field keeps the selected ids in the validation keys", () => {
  const draft = createEmptyDraft("manual");
  draft.driverId = driverId;
  draft.vehicleId = vehicleId;
  draft.groupName = "Sabah transferi";
  draft.purpose = "Havalimanı karşılama";
  const keys = uetdsValidationErrorKeys(draft);
  assert.equal(keys.includes("driverId"), false);
  assert.equal(keys.includes("vehicleId"), false);
});

test("the form stores option ids and does not mark a selected fleet as empty", () => {
  const hook = readFileSync(new URL("./use-uetds-validation.ts", import.meta.url), "utf8");
  const form = readFileSync(new URL("./uetds-notification-form.tsx", import.meta.url), "utf8");
  const select = readFileSync(new URL("../partner/searchable-select.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(hook, /errors\.push\("driverId", "vehicleId"\)/);
  assert.match(form, /value: item\.id/);
  assert.match(form, /value=\{draft\.driverId\}/);
  assert.match(form, /value=\{draft\.vehicleId\}/);
  assert.match(select, /options\.find\(\(option\) => option\.value === value\)/);
  assert.match(select, /selectOption\(option\.value\)/);
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.driver-portal \.uetds-form input/);
  assert.match(css, /color: #1f2937/);
  assert.match(css, /color: #64748b/);
});
