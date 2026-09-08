import { type CheckoutPaymentMethod } from "@/lib/booking/checkout-complete";
import { emailValidity, phoneValidity } from "@/lib/booking/phone";
import type { PassengerFieldErrors, PassengerFormValue } from "@/components/booking/checkout-passenger-form";

export type CheckoutScrollField =
  | "email"
  | "phone"
  | "nationality"
  | "firstName"
  | "lastName"
  | "legal"
  | "payment"
  | "captcha";

export const CHECKOUT_FIELD_IDS: Record<CheckoutScrollField, string> = {
  email: "checkout-email",
  phone: "checkout-phone",
  nationality: "main-nationality-field",
  firstName: "main-first",
  lastName: "main-last",
  legal: "checkout-legal",
  payment: "checkout-payment",
  captcha: "checkout-captcha",
};

export type CheckoutValidationMessages = {
  required: string;
  emailInvalid: string;
  phoneInvalid: string;
  legalRequired: string;
  paymentRequired: string;
  captchaRequired: string;
};

export type CheckoutValidationInput = {
  email: string;
  phoneCountry: string | null;
  phoneNational: string;
  mainPassenger: PassengerFormValue;
  legalAccepted: boolean;
  payment: CheckoutPaymentMethod | null;
  captchaToken: string | null;
  /** Final submit requires a selected payment method. */
  requirePayment: boolean;
  /** Final submit requires a completed reCAPTCHA token for every payment mode. */
  requireCaptcha: boolean;
};

export type CheckoutValidationErrors = {
  emailError: string | null;
  phoneError: string | null;
  mainErrors: PassengerFieldErrors;
  legalError: string | null;
  paymentError: string | null;
  captchaError: string | null;
  firstInvalid: CheckoutScrollField | null;
  isValid: boolean;
};

function emailErrorMessage(value: string, copy: CheckoutValidationMessages) {
  const status = emailValidity(value);
  if (status === "empty") {
    return copy.required;
  }
  if (status === "invalid") {
    return copy.emailInvalid;
  }
  return null;
}

function phoneErrorMessage(
  country: string | null,
  national: string,
  copy: CheckoutValidationMessages,
) {
  const status = phoneValidity(country, national);
  if (status === "valid") {
    return null;
  }
  if (!country || status === "empty") {
    return copy.required;
  }
  return copy.phoneInvalid;
}

export function validateCheckoutForm(
  input: CheckoutValidationInput,
  copy: CheckoutValidationMessages,
): CheckoutValidationErrors {
  const emailError = emailErrorMessage(input.email, copy);
  const phoneError = phoneErrorMessage(input.phoneCountry, input.phoneNational, copy);

  const passenger = input.mainPassenger;
  const countryError = passenger.countryCode ? null : copy.required;
  const firstNameError = passenger.firstName.trim() ? null : copy.required;
  const lastNameError = passenger.lastName.trim() ? null : copy.required;
  const legalError = input.legalAccepted ? null : copy.legalRequired;
  const paymentError =
    input.requirePayment && !input.payment ? copy.paymentRequired : null;
  const captchaError =
    input.requireCaptcha && Boolean(input.payment) && !input.captchaToken?.trim()
      ? copy.captchaRequired
      : null;

  const mainErrors: PassengerFieldErrors = {
    countryCode: countryError,
    firstName: firstNameError,
    lastName: lastNameError,
  };

  const order: Array<[CheckoutScrollField, string | null]> = [
    ["email", emailError],
    ["phone", phoneError],
    ["nationality", countryError],
    ["firstName", firstNameError],
    ["lastName", lastNameError],
    ["legal", legalError],
    ["payment", paymentError],
    ["captcha", captchaError],
  ];

  const firstInvalid = order.find(([, message]) => message)?.[0] ?? null;
  const passengerComplete = Boolean(
    passenger.countryCode &&
      passenger.firstName.trim() &&
      passenger.lastName.trim() &&
      (passenger.gender === "female" || passenger.gender === "male"),
  );

  return {
    emailError,
    phoneError,
    mainErrors,
    legalError,
    paymentError,
    captchaError,
    firstInvalid,
    isValid:
      !emailError &&
      !phoneError &&
      passengerComplete &&
      !legalError &&
      !paymentError &&
      !captchaError,
  };
}

export function scrollToCheckoutField(field: CheckoutScrollField) {
  const target = document.getElementById(CHECKOUT_FIELD_IDS[field]);
  if (!target) {
    return;
  }
  window.requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}
