import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { asPanelLocale } from "@/lib/i18n/config";
import { partnerCopy } from "@/lib/partner/copy";
import { maskPartnerEmail } from "@/lib/partner/mask-email";
import {
  PARTNER_EMAIL_CODE_TTL_MS,
  PARTNER_EMAIL_MAX_VERIFY_ATTEMPTS,
  PARTNER_EMAIL_RESEND_COOLDOWN_MS,
  type PartnerEmailChallengePurpose,
} from "@/lib/partner/email-verification-policy";
import { PARTNER_SESSION_MAX_AGE_SECONDS } from "@/lib/partner/constants";
import { OPS_SESSION_MAX_AGE_SECONDS } from "@/lib/ops/constants";
import {
  buildPartnerPasswordResetCodeEmail,
} from "@/lib/partner/verification-email";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("password reset purpose is allowed in schema and policy", () => {
  const purposes: PartnerEmailChallengePurpose[] = [
    "register",
    "email_change",
    "password_reset",
  ];
  assert.ok(purposes.includes("password_reset"));
  assert.match(
    source("db/migrations/062_partner_password_reset_purpose.sql"),
    /password_reset/,
  );
  assert.match(
    source("lib/partner/email-verification-policy.ts"),
    /password_reset/,
  );
  assert.equal(PARTNER_EMAIL_CODE_TTL_MS, 10 * 60 * 1000);
  assert.equal(PARTNER_EMAIL_MAX_VERIFY_ATTEMPTS, 5);
  assert.equal(PARTNER_EMAIL_RESEND_COOLDOWN_MS, 60 * 1000);
});

test("password reset reuses hashed challenges and never stores plaintext codes", () => {
  const reset = source("lib/partner/password-reset.ts");
  const verification = source("lib/partner/email-verification.ts");
  assert.match(reset, /purpose: "password_reset"/);
  assert.match(reset, /issuePartnerEmailChallenge/);
  assert.match(reset, /consumeVerifiedPartnerEmailChallenge/);
  assert.match(reset, /deletePartnerSessionsForUser/);
  assert.match(reset, /notifyPartnerPasswordChanged/);
  assert.doesNotMatch(reset, /createPartnerSession|writePartnerSessionCookie/);
  assert.doesNotMatch(reset, /localStorage|sessionStorage/);
  assert.match(verification, /buildPartnerPasswordResetCodeEmail/);
  assert.doesNotMatch(verification, /console\.(log|info|debug)\([^\n]*code/);
});

test("password reset mail explains Partner Portal reset and 10-minute validity", () => {
  for (const locale of ["tr", "en", "ru"] as const) {
    const mail = buildPartnerPasswordResetCodeEmail(locale, "123456");
    assert.match(mail.subject, /Partner|партнёра|партнера/i);
    assert.match(mail.text, /123456/);
    assert.match(mail.text, /10/);
  }
});

test("unknown email shows apply CTA that reuses existing register flow", () => {
  const form = source("components/partner/forgot-password-form.tsx");
  assert.match(form, /passwordResetNotFound/);
  assert.match(form, /\/partner\/register/);
  assert.match(form, /encodeURIComponent\(email/);
  assert.match(source("components/partner/register-form.tsx"), /initialEmail/);
  assert.match(source("app/[locale]/partner/register/page.tsx"), /searchParams/);
  assert.match(source("proxy.ts"), /forgot-password/);
});

test("login keeps apply CTA and adds right-aligned forgot password link", () => {
  const form = source("components/partner/login-form.tsx");
  assert.match(form, /partner-forgot-row/);
  assert.match(form, /copy\.forgotPassword/);
  assert.match(form, /\/partner\/forgot-password/);
  assert.match(form, /copy\.applyCta/);
  assert.match(form, /\/partner\/register/);
  assert.match(form, /initialEmail/);
  assert.match(form, /resetSuccess/);
});

test("successful reset redirects to login with email and does not auto-login", () => {
  const actions = source("lib/partner/actions.ts");
  const complete = actions.slice(actions.indexOf("partnerCompletePasswordResetAction"));
  assert.match(complete, /partner\/login/);
  assert.match(complete, /reset=1/);
  assert.match(complete, /encodeURIComponent\(result\.email\)/);
  assert.doesNotMatch(complete, /createPartnerSession|writePartnerSessionCookie/);
});

test("maskPartnerEmail hides most of the local part", () => {
  assert.equal(maskPartnerEmail("ab@example.com"), "a***@example.com");
  assert.equal(maskPartnerEmail("info@tripetica.com"), "in***@tripetica.com");
});

test("forgot-password copy exists in tr, en, and ru", () => {
  for (const locale of ["tr", "en", "ru"] as const) {
    const copy = partnerCopy[asPanelLocale(locale)];
    assert.ok(copy.forgotPassword);
    assert.ok(copy.forgotPasswordTitle);
    assert.ok(copy.sendResetCode);
    assert.ok(copy.passwordResetNotFound);
    assert.ok(copy.passwordResetCodeTitle);
    assert.ok(copy.resendResetCode);
    assert.ok(copy.saveNewPassword);
    assert.ok(copy.passwordResetSuccess);
  }
});

test("password reset does not change partner sliding session or ops TTL", () => {
  assert.equal(PARTNER_SESSION_MAX_AGE_SECONDS, 60 * 60 * 24 * 30);
  assert.equal(OPS_SESSION_MAX_AGE_SECONDS, 60 * 60 * 12);
  assert.doesNotMatch(
    source("lib/partner/password-reset.ts"),
    /PARTNER_SESSION_MAX_AGE|OPS_SESSION/,
  );
});
