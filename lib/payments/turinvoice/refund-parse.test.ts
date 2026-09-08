import test from "node:test";
import assert from "node:assert/strict";
import {
  parseTurinvoiceOrderRefundEntries,
  parseTurinvoiceRefundResponse,
  shouldMarkRefundCompletedFromOrderRefunds,
} from "@/lib/payments/turinvoice/refund-parse";

test("refund OK + idRefund means accepted submitted request only", () => {
  const parsed = parseTurinvoiceRefundResponse(
    {
      idRefund: 123,
      code: "OK",
      message: {
        TR: "İade talebi kabul edildi, yerine getirilmesini bekleyin.",
      },
    },
    "ord-1",
  );
  assert.equal(parsed.accepted, true);
  assert.equal(parsed.idRefund, "123");
  assert.equal(parsed.code, "OK");
  assert.match(parsed.message ?? "", /İade talebi kabul edildi/);
});

test("refund without OK is not accepted", () => {
  const parsed = parseTurinvoiceRefundResponse(
    { idRefund: 1, code: "ERROR", message: "no" },
    "ord-1",
  );
  assert.equal(parsed.accepted, false);
});

test("order refund array is parsed but never auto-completed", () => {
  const entries = parseTurinvoiceOrderRefundEntries([
    { idRefund: 9, status: "done", amount: 10, currency: "RUB" },
  ]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.idRefund, "9");
  assert.equal(shouldMarkRefundCompletedFromOrderRefunds(entries), false);
  assert.equal(shouldMarkRefundCompletedFromOrderRefunds([]), false);
});
