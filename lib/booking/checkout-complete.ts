import { type Locale } from "@/lib/i18n/config";

export type CheckoutPaymentMethod = "cash" | "sbp";

export type CaptchaProvider = "google" | "yandex";

export function captchaProviderForLocale(_locale: Locale): CaptchaProvider {
  // /ru can switch back to Yandex SmartCaptcha later without a larger refactor.
  return "google";
}

export function recaptchaSiteKey() {
  return (
    process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ||
    process.env.RECAPTCHA_SITE_KEY?.trim() ||
    ""
  );
}

export function yandexCaptchaClientKey() {
  return (
    process.env.NEXT_PUBLIC_YANDEX_SMARTCAPTCHA_CLIENT_KEY?.trim() ||
    process.env.YANDEX_SMARTCAPTCHA_CLIENT_KEY?.trim() ||
    ""
  );
}

export function captchaSiteKeyFor(locale: Locale) {
  return captchaProviderForLocale(locale) === "yandex"
    ? yandexCaptchaClientKey()
    : recaptchaSiteKey();
}

export function checkoutCanComplete(input: {
  emailValid: boolean;
  phoneValid: boolean;
  mainPassengerComplete: boolean;
  payment: CheckoutPaymentMethod | null;
  legalAccepted: boolean;
  captchaVerified: boolean;
}) {
  if (!input.emailValid || !input.phoneValid || !input.mainPassengerComplete) {
    return false;
  }
  if (!input.payment || !input.legalAccepted) {
    return false;
  }
  if (!input.captchaVerified) {
    return false;
  }
  return true;
}
