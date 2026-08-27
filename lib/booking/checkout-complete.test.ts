import test from "node:test";
import assert from "node:assert/strict";
import {
  captchaProviderForLocale,
  checkoutCanComplete,
} from "@/lib/booking/checkout-complete";

test("all current locales use Google reCAPTCHA", () => {
  assert.equal(captchaProviderForLocale("ru"), "google");
  assert.equal(captchaProviderForLocale("tr"), "google");
  assert.equal(captchaProviderForLocale("en"), "google");
});

test("complete CTA stays off until required checkout fields are valid", () => {
  const ready = {
    emailValid: true,
    phoneValid: true,
    mainPassengerComplete: true,
    payment: "sbp" as const,
    legalAccepted: true,
    captchaVerified: false,
  };
  assert.equal(checkoutCanComplete(ready), true);
  assert.equal(checkoutCanComplete({ ...ready, emailValid: false }), false);
  assert.equal(checkoutCanComplete({ ...ready, phoneValid: false }), false);
  assert.equal(checkoutCanComplete({ ...ready, mainPassengerComplete: false }), false);
  assert.equal(checkoutCanComplete({ ...ready, payment: null }), false);
  assert.equal(checkoutCanComplete({ ...ready, legalAccepted: false }), false);
});

test("cash requires captcha; QR/SBP does not", () => {
  const base = {
    emailValid: true,
    phoneValid: true,
    mainPassengerComplete: true,
    legalAccepted: true,
    captchaVerified: false,
  };
  assert.equal(checkoutCanComplete({ ...base, payment: "cash" }), false);
  assert.equal(
    checkoutCanComplete({ ...base, payment: "cash", captchaVerified: true }),
    true,
  );
  assert.equal(
    checkoutCanComplete({
      ...base,
      payment: "cash",
      captchaVerified: true,
      legalAccepted: false,
    }),
    false,
  );
  assert.equal(checkoutCanComplete({ ...base, payment: "sbp" }), true);
  assert.equal(
    checkoutCanComplete({
      ...base,
      payment: "sbp",
      captchaVerified: true,
      legalAccepted: false,
    }),
    false,
  );
  assert.equal(
    checkoutCanComplete({ ...base, payment: "sbp", captchaVerified: true }),
    true,
  );
});
