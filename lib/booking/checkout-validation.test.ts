import test from "node:test";
import assert from "node:assert/strict";
import { validateCheckoutForm } from "@/lib/booking/checkout-validation";

const copy = {
  required: "This field is required.",
  emailInvalid: "Enter a valid email.",
  phoneInvalid: "Enter a valid phone.",
  legalRequired: "Legal consent is required.",
  paymentRequired: "Select a payment method.",
  captchaRequired: "Complete the captcha.",
};

const passenger = {
  countryCode: "TR",
  identityNumber: "",
  firstName: "Trip",
  lastName: "Test",
  gender: "male" as const,
};

test("reports every missing checkout field at once", () => {
  const result = validateCheckoutForm(
    {
      email: "",
      phoneCountry: null,
      phoneNational: "",
      mainPassenger: {
        countryCode: null,
        identityNumber: "",
        firstName: "",
        lastName: "",
        gender: "female",
      },
      legalAccepted: false,
      payment: null,
      captchaToken: null,
      requirePayment: true,
      requireCaptcha: true,
    },
    copy,
  );
  assert.equal(result.isValid, false);
  assert.equal(result.emailError, copy.required);
  assert.equal(result.phoneError, copy.required);
  assert.equal(result.mainErrors.countryCode, copy.required);
  assert.equal(result.mainErrors.firstName, copy.required);
  assert.equal(result.mainErrors.lastName, copy.required);
  assert.equal(result.legalError, copy.legalRequired);
  assert.equal(result.paymentError, copy.paymentRequired);
  assert.equal(result.captchaError, null);
  assert.equal(result.firstInvalid, "email");
});

test("cash final submit requires captcha but payment selection does not", () => {
  const ready = {
    email: "trip@example.com",
    phoneCountry: "TR",
    phoneNational: "5551112233",
    mainPassenger: passenger,
    legalAccepted: true,
    payment: "cash" as const,
    captchaToken: null,
  };
  assert.equal(
    validateCheckoutForm({ ...ready, requireCaptcha: false, requirePayment: false }, copy).isValid,
    true,
  );
  const withCaptcha = validateCheckoutForm(
    { ...ready, requireCaptcha: true, requirePayment: true },
    copy,
  );
  assert.equal(withCaptcha.isValid, false);
  assert.equal(withCaptcha.captchaError, copy.captchaRequired);
  assert.equal(withCaptcha.firstInvalid, "captcha");
});

test("sbp requires captcha on final submit", () => {
  const result = validateCheckoutForm(
    {
      email: "trip@example.com",
      phoneCountry: "TR",
      phoneNational: "5551112233",
      mainPassenger: passenger,
      legalAccepted: true,
      payment: "sbp",
      captchaToken: null,
      requirePayment: true,
      requireCaptcha: true,
    },
    copy,
  );
  assert.equal(result.isValid, false);
  assert.equal(result.captchaError, copy.captchaRequired);
});
