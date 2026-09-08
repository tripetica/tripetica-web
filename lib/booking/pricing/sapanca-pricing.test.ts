import test from "node:test";
import assert from "node:assert/strict";
import {
  isSapancaTour,
  quoteSapancaBase,
  SAPANCA_PACKAGE_HOURS,
  SAPANCA_TOUR_CODE,
} from "@/lib/booking/pricing/sapanca-pricing";

const pickupGeo = {
  provinceCode: "istanbul" as const,
  districtCode: "besiktas",
};

test("sapanca tour detection", () => {
  assert.equal(isSapancaTour("tour", SAPANCA_TOUR_CODE), true);
  assert.equal(isSapancaTour("tour", "istanbul-half-day"), false);
  assert.equal(isSapancaTour("transfer", SAPANCA_TOUR_CODE), false);
});

test("sapanca base quote uses configured fare", () => {
  const quote = quoteSapancaBase(pickupGeo);
  assert.ok(quote);
  assert.equal(quote?.baseTransferFeeEur, 170);
});

test("sapanca package is 11 hours", () => {
  assert.equal(SAPANCA_PACKAGE_HOURS, 11);
});
