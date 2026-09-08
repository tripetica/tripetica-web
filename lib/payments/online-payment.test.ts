import test from "node:test";
import assert from "node:assert/strict";
import {
  isSbpAllowedCurrency,
  paymentAmountsMatch,
  normalizePaymentCurrency,
} from "@/lib/payments/online-payment";
import { parseTurinvoiceCallbackBody } from "@/lib/payments/turinvoice/callback-payload";

test("SBP allows USD EUR RUB TRY and not GBP", () => {
  assert.equal(isSbpAllowedCurrency("USD"), true);
  assert.equal(isSbpAllowedCurrency("EUR"), true);
  assert.equal(isSbpAllowedCurrency("RUB"), true);
  assert.equal(isSbpAllowedCurrency("TRY"), true);
  assert.equal(isSbpAllowedCurrency("GBP"), false);
});

test("payment amounts match major or minor units", () => {
  assert.equal(paymentAmountsMatch(100.5, 100.5), true);
  assert.equal(paymentAmountsMatch(100.5, 10050), true);
  assert.equal(paymentAmountsMatch(100.5, 99), false);
});

test("callback parser reads Turinvoice fields", () => {
  const parsed = parseTurinvoiceCallbackBody({
    idOrder: "ord-1",
    state: "paid",
    amount: "120.00",
    currency: "rub",
    datePay: "2026-08-30T12:00:00Z",
    secret_key: "secret",
  });
  assert.ok(parsed);
  assert.equal(parsed?.idOrder, "ord-1");
  assert.equal(parsed?.state, "paid");
  assert.equal(parsed?.amount, 120);
  assert.equal(normalizePaymentCurrency(parsed?.currency), "RUB");
  assert.equal(parsed?.secretKey, "secret");
});
