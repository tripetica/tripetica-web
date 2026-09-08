import assert from "node:assert/strict";
import { test } from "node:test";
import { accountCopy } from "@/lib/account/copy";
import {
  accountPaymentMethodLabel,
  accountPaymentStatusLabel,
  accountReservationStatusLabel,
  isOnlineAccountPayment,
} from "@/lib/account/reservation-labels";

test("reservation status maps payment_pending to Active, not raw enum", () => {
  const copy = accountCopy.tr;
  assert.equal(accountReservationStatusLabel("payment_pending", copy), "Aktif");
  assert.equal(accountReservationStatusLabel("confirmed", copy), "Aktif");
  assert.equal(accountReservationStatusLabel("cancelled", copy), "İptal edildi");
  assert.equal(accountReservationStatusLabel("payment_pending", accountCopy.en), "Active");
  assert.equal(accountReservationStatusLabel("cancelled", accountCopy.ru), "Отменено");
});

test("payment labels use localized customer wording", () => {
  const copy = accountCopy.tr;
  assert.equal(accountPaymentStatusLabel("pending", copy), "Bekleniyor");
  assert.equal(accountPaymentStatusLabel("payment_pending", copy), "Bekleniyor");
  assert.equal(accountPaymentStatusLabel("paid", copy), "Tahsil edildi");
  assert.equal(accountPaymentStatusLabel("completed", copy), "Tahsil edildi");
  assert.equal(accountPaymentMethodLabel("sbp", copy), "Online");
  assert.equal(accountPaymentMethodLabel("cash", copy), "Nakit");
  assert.equal(accountPaymentMethodLabel("sbp", accountCopy.en), "Online");
  assert.equal(accountPaymentStatusLabel("paid", accountCopy.en), "Collected");
  assert.equal(accountPaymentMethodLabel("sbp", accountCopy.ru), "Онлайн");
  assert.equal(accountPaymentStatusLabel("pending", accountCopy.ru), "Ожидается");
  assert.equal(isOnlineAccountPayment("sbp"), true);
  assert.equal(isOnlineAccountPayment("cash"), false);
});
