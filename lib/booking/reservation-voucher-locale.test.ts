import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolveReservationCustomerLocale } from "@/lib/booking/reservation-voucher-locale";

test("persisted reservation locale is authoritative over request locale", () => {
  assert.equal(resolveReservationCustomerLocale("ru", "tr"), "ru");
  assert.equal(resolveReservationCustomerLocale("en", "tr"), "en");
  assert.equal(resolveReservationCustomerLocale("tr", "en"), "tr");
  assert.equal(resolveReservationCustomerLocale("ar", "tr"), "ar");
});

test("request locale is only a fallback when stored locale is missing", () => {
  assert.equal(resolveReservationCustomerLocale(null, "tr"), "tr");
  assert.equal(resolveReservationCustomerLocale("", "en"), "en");
  assert.equal(resolveReservationCustomerLocale("de", "tr"), "tr");
  assert.equal(resolveReservationCustomerLocale("  ", undefined), "ru");
});

test("email customer and ops voucher loaders share the same locale resolver", () => {
  const access = readFileSync(
    new URL("./reservation-voucher-access.ts", import.meta.url),
    "utf8",
  );
  const pdf = readFileSync(
    new URL("./reservation-voucher-pdf.ts", import.meta.url),
    "utf8",
  );
  const confirmation = readFileSync(
    new URL("../mail/send-reservation-confirmation.ts", import.meta.url),
    "utf8",
  );
  const opsRoute = readFileSync(
    new URL(
      "../../app/[locale]/ops/(panel)/reservations/[id]/voucher-pdf/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const accountRoute = readFileSync(
    new URL(
      "../../app/[locale]/(public)/account/reservations/[id]/voucher-pdf/route.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const publicRoute = readFileSync(
    new URL("../../app/api/booking/voucher-pdf/route.ts", import.meta.url),
    "utf8",
  );
  assert.match(access, /resolveReservationCustomerLocale\(/);
  assert.match(access, /voucherCopy\[voucherLocale\]/);
  assert.match(pdf, /const locale = data\.locale/);
  assert.match(confirmation, /resolveReservationCustomerLocale\(/);
  assert.match(opsRoute, /buildReservationVoucherPdf\(voucher,\s*voucher\.locale\)/);
  assert.match(
    accountRoute,
    /buildReservationVoucherPdf\(voucher,\s*voucher\.locale\)/,
  );
  assert.match(
    publicRoute,
    /buildReservationVoucherPdf\(voucher,\s*voucher\.locale\)/,
  );
});
