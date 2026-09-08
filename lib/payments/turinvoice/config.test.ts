import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTurinvoiceBaseUrl,
  resolveTurinvoiceEnv,
  turinvoiceCallbackUrl,
  turinvoiceRedirectUrl,
  type TurinvoiceConfig,
} from "@/lib/payments/turinvoice/config";

test("normalizeTurinvoiceBaseUrl strips trailing slash and /api/v1", () => {
  assert.equal(
    normalizeTurinvoiceBaseUrl("https://hesap.turinvoice.com/api/v1/"),
    "https://hesap.turinvoice.com",
  );
  assert.equal(
    normalizeTurinvoiceBaseUrl("https://hesap.dev.turinvoice.com"),
    "https://hesap.dev.turinvoice.com",
  );
});

test("resolveTurinvoiceEnv defaults to live", () => {
  assert.equal(resolveTurinvoiceEnv(undefined), "live");
  assert.equal(resolveTurinvoiceEnv("live"), "live");
  assert.equal(resolveTurinvoiceEnv("TEST"), "test");
  assert.equal(resolveTurinvoiceEnv("other"), "live");
});

test("callback and locale redirect URLs use APP_BASE_URL only", () => {
  const config: TurinvoiceConfig = {
    env: "live",
    baseUrl: "https://hesap.turinvoice.com",
    login: "x",
    password: "x",
    tspId: "1",
    callbackSecret: "x",
    appBaseUrl: "https://dev.tripetica.com",
  };
  assert.equal(
    turinvoiceCallbackUrl(config),
    "https://dev.tripetica.com/api/payments/turinvoice/callback",
  );
  assert.equal(
    turinvoiceRedirectUrl("tr", config),
    "https://dev.tripetica.com/tr/booking/success",
  );
  assert.equal(
    turinvoiceRedirectUrl("en", config),
    "https://dev.tripetica.com/en/booking/success",
  );
  assert.equal(
    turinvoiceRedirectUrl("ru", config),
    "https://dev.tripetica.com/ru/booking/success",
  );
});
