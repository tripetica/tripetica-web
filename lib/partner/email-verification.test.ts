import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PARTNER_EMAIL_CODE_LENGTH,
  PARTNER_EMAIL_CODE_TTL_MS,
  PARTNER_EMAIL_MAX_VERIFY_ATTEMPTS,
  classifyPartnerEmailChallenge,
  createPartnerEmailCodeSalt,
  generatePartnerEmailCode,
  hashPartnerEmailCode,
  isPartnerEmailCodeFormatValid,
  partnerEmailCodesEqual,
  partnerEmailVerificationStillBound,
} from "@/lib/partner/email-verification-policy";
import { partnerLoginDenialAfterPassword } from "@/lib/partner/login-status";
import { isPartnerAccountLoginEligible } from "@/lib/partner/policy";
import { partnerCopy } from "@/lib/partner/copy";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

function challenge(overrides: Partial<Parameters<typeof classifyPartnerEmailChallenge>[0]> = {}) {
  return classifyPartnerEmailChallenge({
    email: "abc@example.com",
    expectedEmail: "abc@example.com",
    expiresAt: new Date(Date.now() + 60_000),
    verifiedAt: null,
    consumedAt: null,
    attemptCount: 0,
    ...overrides,
  });
}

test("partner email codes are 6-digit hashed one-time challenges", () => {
  assert.equal(PARTNER_EMAIL_CODE_LENGTH, 6);
  assert.equal(PARTNER_EMAIL_CODE_TTL_MS, 10 * 60 * 1000);
  assert.equal(PARTNER_EMAIL_MAX_VERIFY_ATTEMPTS, 5);
  const code = generatePartnerEmailCode();
  assert.equal(isPartnerEmailCodeFormatValid(code), true);
  const salt = createPartnerEmailCodeSalt();
  const hash = hashPartnerEmailCode(code, salt);
  assert.equal(partnerEmailCodesEqual(hash, hashPartnerEmailCode(code, salt)), true);
  assert.equal(partnerEmailCodesEqual(hash, hashPartnerEmailCode("000000", salt)), false);
  assert.doesNotMatch(source("db/migrations/036_partner_email_challenges.sql"), /code TEXT|plaintext|verification_code/);
  assert.match(source("db/migrations/036_partner_email_challenges.sql"), /code_hash/);
  assert.doesNotMatch(source("lib/partner/email-verification.ts"), /123456|000000|HARDCODE|DEV_BYPASS|bypass/);
});

test("unverified, wrong, expired, used, and mismatched emails are classified separately", () => {
  assert.equal(challenge(), "pending");
  assert.equal(
    challenge({
      email: "xyz@example.com",
      expectedEmail: "abc@example.com",
    }),
    "email-mismatch",
  );
  assert.equal(challenge({ expiresAt: new Date(Date.now() - 1) }), "expired");
  assert.equal(challenge({ consumedAt: new Date() }), "consumed");
  assert.equal(
    challenge({
      attemptCount: PARTNER_EMAIL_MAX_VERIFY_ATTEMPTS,
    }),
    "locked",
  );
  assert.equal(challenge({ verifiedAt: new Date() }), "verified");
  assert.equal(
    partnerEmailVerificationStillBound({
      verifiedEmail: "abc@example.com",
      currentEmail: "ABC@example.com",
    }),
    true,
  );
  assert.equal(
    partnerEmailVerificationStillBound({
      verifiedEmail: "abc@example.com",
      currentEmail: "xyz@example.com",
    }),
    false,
  );
});

test("changing the form email after verification unbinds the challenge", () => {
  const verified = {
    email: "abc@example.com",
    expectedEmail: "abc@example.com",
    expiresAt: new Date(Date.now() + 60_000),
    verifiedAt: new Date(),
    consumedAt: null,
    attemptCount: 0,
  };
  assert.equal(classifyPartnerEmailChallenge(verified), "verified");
  assert.equal(
    classifyPartnerEmailChallenge({
      ...verified,
      email: "xyz@example.com",
    }),
    "email-mismatch",
  );
  assert.match(source("components/partner/register-form.tsx"), /partnerInvalidateEmailChallengeAction/);
  assert.match(source("lib/partner/register.ts"), /unverified-email/);
});

test("email verification never activates a partner and pending still cannot log in", () => {
  const verification = source("lib/partner/email-verification.ts");
  const register = source("lib/partner/register.ts");
  assert.doesNotMatch(verification, /UPDATE partners/);
  assert.doesNotMatch(verification, /status = 'active'/);
  assert.match(register, /'pending', FALSE/);
  assert.doesNotMatch(register, /VALUES \([\s\S]*'active'/);
  assert.equal(
    isPartnerAccountLoginEligible({
      userStatus: "pending",
      partnerStatus: "pending",
    }),
    false,
  );
  assert.equal(
    partnerLoginDenialAfterPassword({
      userStatus: "pending",
      partnerStatus: "pending",
    }),
    "pending",
  );
  assert.equal(
    isPartnerAccountLoginEligible({
      userStatus: "active",
      partnerStatus: "active",
    }),
    true,
  );
});

test("partner verification copy exists in tr, en, and ru", () => {
  for (const locale of ["tr", "en", "ru"] as const) {
    assert.ok(partnerCopy[locale].sendVerificationCode);
    assert.ok(partnerCopy[locale].emailVerifiedBadge);
    assert.ok(partnerCopy[locale].unverifiedEmail);
    assert.ok(partnerCopy[locale].securityTitle);
    assert.ok(partnerCopy[locale].confirmNewEmail);
    assert.ok(partnerCopy[locale].emailTaken);
    assert.ok(partnerCopy[locale].changePasswordSubmit);
  }
  assert.match(source("lib/partner/mail.ts"), /sendAccountSmtpMail/);
  assert.match(source("lib/partner/mail.ts"), /ACCOUNT_EMAIL_PROVIDER/);
  assert.doesNotMatch(source("lib/partner/mail.ts"), /twilio|netgsm|vonage|sendgrid/i);
});

test("password change still requires the current password in optional mode", () => {
  const actions = source("lib/partner/actions.ts");
  const password = source("lib/partner/password-change.ts");
  assert.match(password, /requireCurrent/);
  assert.match(password, /current-invalid/);
  assert.match(
    actions.slice(actions.indexOf("partnerPasswordChangeAction")),
    /requireCurrent: true/,
  );
});
