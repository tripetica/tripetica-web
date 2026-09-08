import test from "node:test";
import assert from "node:assert/strict";
import {
  completionEmailQueueTimestampSql,
  completionRequiresCaptcha,
  paidCallbackQueuesReservationNotifications,
  paymentPendingExpiryPredicateSql,
} from "@/lib/booking/completion-security-policy";

test("cash and online/SBP completion both require CAPTCHA", () => {
  assert.equal(completionRequiresCaptcha("cash"), true);
  assert.equal(completionRequiresCaptcha("sbp"), true);
});

test("cash queues confirmation at completion while unpaid SBP does not", () => {
  assert.equal(completionEmailQueueTimestampSql("cash"), "NOW()");
  assert.equal(completionEmailQueueTimestampSql("sbp"), "NULL");
});

test("verified initial payment queues confirmation but additional payment does not", () => {
  assert.equal(
    paidCallbackQueuesReservationNotifications("initial_payment"),
    true,
  );
  assert.equal(
    paidCallbackQueuesReservationNotifications("additional_payment"),
    false,
  );
});

test("pending expiry predicate excludes paid, confirmed, deleted, and non-SBP rows", () => {
  const sql = paymentPendingExpiryPredicateSql("reservation");
  assert.match(sql, /status = 'payment_pending'/);
  assert.match(sql, /payment_status = 'pending'/);
  assert.match(sql, /payment_method = 'sbp'/);
  assert.match(sql, /paid_at IS NULL/);
  assert.match(sql, /confirmed_at IS NULL/);
  assert.match(sql, /deleted_at IS NULL/);
});
