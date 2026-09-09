import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACCOUNT_SESSION_COOKIE } from "@/lib/account/constants";
import { OPS_SESSION_COOKIE } from "@/lib/ops/constants";
import {
  PARTNER_MIN_PASSWORD_LENGTH,
  PARTNER_SESSION_COOKIE,
} from "@/lib/partner/constants";
import { partnerCopy } from "@/lib/partner/copy";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("partner session cookie is isolated from ops and customer auth", () => {
  assert.equal(PARTNER_SESSION_COOKIE, "tripetica_partner_session");
  assert.notEqual(PARTNER_SESSION_COOKIE, OPS_SESSION_COOKIE);
  assert.notEqual(PARTNER_SESSION_COOKIE, ACCOUNT_SESSION_COOKIE);
  assert.match(source("proxy.ts"), /PARTNER_SESSION_COOKIE/);
  assert.match(source("proxy.ts"), /x-partner-pathname/);
  assert.doesNotMatch(source("proxy.ts"), /OPS_SESSION_COOKIE.*partner/);
});

test("primary partner is a database flag, not a hardcoded name check", () => {
  const auth = source("lib/partner/auth.ts");
  const session = source("lib/partner/session.ts");
  const bootstrap = source("lib/partner/bootstrap.ts");
  const actions = source("lib/partner/actions.ts");
  assert.match(session, /is_primary_partner/);
  assert.doesNotMatch(auth, /name\s*===\s*["']Tripetica["']/);
  assert.doesNotMatch(session, /name\s*===\s*["']Tripetica["']/);
  assert.doesNotMatch(bootstrap, /name\s*===\s*["']Tripetica["']/);
  assert.doesNotMatch(actions, /formData\.get\(["']partner_id["']\)/);
  assert.doesNotMatch(actions, /formData\.get\(["']user_id["']\)/);
});

test("partner password minimum is 8 characters everywhere", () => {
  assert.equal(PARTNER_MIN_PASSWORD_LENGTH, 8);
  assert.match(partnerCopy.tr.passwordTooShort, /8/);
  assert.doesNotMatch(partnerCopy.tr.passwordTooShort, /12/);
  assert.match(source("lib/security/password-policy.ts"), /MIN_PASSWORD_LENGTH = 8/);
  assert.match(source("lib/partner/constants.ts"), /PARTNER_MIN_PASSWORD_LENGTH/);
  assert.doesNotMatch(source("lib/partner/constants.ts"), /PARTNER_MIN_PASSWORD_LENGTH = 12/);
  assert.doesNotMatch(source("lib/partner/bootstrap.ts"), /12 karakter|12 characters/);
  assert.doesNotMatch(source("scripts/partner-dev-guard.ts"), /12 karakter|12 characters/);
  assert.match(source("components/partner/password-form.tsx"), /PARTNER_MIN_PASSWORD_LENGTH/);
});

test("partner password fields share one show/hide control", () => {
  const field = source("components/partner/password-field.tsx");
  assert.match(field, /type="button"/);
  assert.match(field, /aria-label=\{visible \? hidePasswordLabel : showPasswordLabel\}/);
  assert.match(source("components/partner/login-form.tsx"), /PartnerPasswordField/);
  assert.match(source("components/partner/register-form.tsx"), /PartnerPasswordField/);
  assert.match(source("components/partner/register-form.tsx"), /name="confirmPassword"/);
  assert.match(source("components/partner/password-form.tsx"), /name="currentPassword"/);
  assert.match(source("components/partner/password-form.tsx"), /name="newPassword"/);
  assert.match(source("components/partner/password-form.tsx"), /name="confirmPassword"/);
  assert.doesNotMatch(source("components/partner/login-form.tsx"), /type=\{visible \? "text" : "password"\}/);
  assert.doesNotMatch(source("components/partner/password-form.tsx"), /type=\{visible \? "text" : "password"\}/);
});

test("partner register uses one contact name field and card business-type choices", () => {
  const form = source("components/partner/register-form.tsx");
  assert.match(form, /copy\.contactFullName/);
  assert.match(form, /name="contactName"/);
  assert.match(form, /PartnerBusinessTypeField/);
  assert.match(form, /copy\.legalNameIndividual/);
  assert.match(form, /copy\.legalNameCompany/);
  assert.match(form, /copy\.registerNationalId/);
  assert.match(form, /copy\.registerTaxNumber/);
  assert.match(form, /noValidate/);
  assert.match(form, /onReset=/);
  assert.match(form, /value=\{contactName\}/);
  assert.match(form, /value=\{legalName\}/);
  assert.match(form, /value=\{addressLine\}/);
  assert.match(form, /value=\{taxOffice\}/);
  assert.match(form, /value=\{taxNumber\}/);
  assert.match(form, /value=\{password\}/);
  assert.match(form, /value=\{confirmPassword\}/);
  assert.match(form, /maxLength=\{taxIdMaxLength\}/);
  assert.match(form, /data-register-submit="application"/);
  assert.doesNotMatch(form, /name="contactFirstName"/);
  assert.doesNotMatch(form, /name="contactLastName"/);
  assert.doesNotMatch(form, /ops-check/);
  assert.match(source("lib/partner/actions.ts"), /partnerContactNamesFromForm/);
  assert.match(source("components/ops/partner-info-form.tsx"), /name="contactName"/);
  assert.match(source("components/ops/partner-info-form.tsx"), /PartnerBusinessTypeField/);
});

test("partner login explains pending and inactive only after credentials match", () => {
  const form = source("components/partner/login-form.tsx");
  const auth = source("lib/partner/auth.ts");
  assert.match(form, /pendingLogin/);
  assert.match(form, /inactiveLogin/);
  assert.match(form, /contactLinks\.whatsapp/);
  assert.match(form, /whatsappSupport/);
  assert.match(source("lib/contact/links.ts"), /905422058219/);
  assert.match(auth, /partnerLoginDenialAfterPassword/);
  assert.match(auth, /passwordOk/);
});

test("partner register is public and does not auto-login", () => {
  const proxy = source("proxy.ts");
  const actions = source("lib/partner/actions.ts");
  const registerPage = source("app/[locale]/partner/register/page.tsx");
  assert.match(proxy, /rest === "register"/);
  assert.match(source("components/partner/login-form.tsx"), /\/partner\/register/);
  assert.match(registerPage, /PartnerRegisterForm/);
  assert.match(actions, /createPartnerApplication/);
  assert.doesNotMatch(
    source("lib/partner/register.ts"),
    /writePartnerSessionCookie|createPartnerSession/,
  );
  assert.doesNotMatch(
    actions.slice(actions.indexOf("partnerRegisterAction"), actions.indexOf("partnerLogoutAction")),
    /createPartnerSession|writePartnerSessionCookie/,
  );
});

test("partner portal payloads never include ops priority", () => {
  assert.doesNotMatch(source("lib/partner/session.ts"), /priority_level/);
  assert.doesNotMatch(source("lib/partner/profile.ts"), /priority_level/);
  assert.doesNotMatch(source("lib/partner/profile.ts"), /priorityLevel/);
  assert.doesNotMatch(source("components/partner/profile-form.tsx"), /priority/i);
  assert.doesNotMatch(source("app/[locale]/partner/(panel)/profile/page.tsx"), /priority/i);
});

test("partner header centers the portal name and drawer shows only the firm name", () => {
  const shell = source("components/partner/shell.tsx");
  const nav = source("components/partner/nav.tsx");
  assert.match(shell, /copy\.panelName/);
  assert.match(shell, /partner-topbar-title/);
  assert.doesNotMatch(shell, /\/partner\/password/);
  assert.doesNotMatch(shell, /copy\.changePassword/);
  assert.doesNotMatch(shell, /actor\.email|partner-actor/);
  assert.match(nav, /partnerName/);
  assert.match(nav, /partner-nav-identity/);
  assert.doesNotMatch(nav, /ops-sidebar-brand/);
  assert.doesNotMatch(nav, /ops-sidebar-name/);
  assert.doesNotMatch(nav, /copy\.brand/);
  assert.doesNotMatch(nav, /actor\.email|copy\.email/);
});

test("partner register consumes a verified email challenge before creating a pending partner", () => {
  const register = source("lib/partner/register.ts");
  const actions = source("lib/partner/actions.ts");
  const form = source("components/partner/register-form.tsx");
  assert.match(register, /consumeVerifiedPartnerEmailChallenge|consumeVerified/);
  assert.match(register, /unverified-email/);
  assert.match(register, /'pending', FALSE/);
  assert.doesNotMatch(register, /'active', FALSE/);
  assert.match(register, /allocatePartnerCode/);
  const body = register.slice(register.indexOf("export async function createPartnerApplication"));
  assert.ok(body.indexOf("const consume") < body.indexOf("allocatePartnerCode"));
  assert.ok(body.indexOf("allocatePartnerCode") < body.indexOf("INSERT INTO partners"));
  assert.match(actions, /scheduleOpsPush\("partner-application-created"/);
  assert.ok(
    actions.indexOf("if (!result.ok)") <
      actions.indexOf('scheduleOpsPush("partner-application-created"'),
  );
  assert.match(form, /partnerSendRegisterCodeAction/);
  assert.match(form, /partnerVerifyRegisterCodeAction/);
  assert.match(form, /partnerInvalidateEmailChallengeAction/);
  assert.match(form, /disabled=\{pending \|\| !phase\.emailVerified\}/);
  assert.match(form, /phase\.showForm/);
});

test("partner profile save cannot rewrite legal or login email fields", () => {
  const profile = source("lib/partner/profile.ts");
  const form = source("components/partner/profile-form.tsx");
  const actions = source("lib/partner/actions.ts");
  assert.match(profile, /SET contact_first_name/);
  assert.match(profile, /tax_office = \$7/);
  assert.doesNotMatch(profile, /\bSET name\s*=/);
  assert.doesNotMatch(profile, /\bbusiness_type\s*=/);
  assert.doesNotMatch(profile, /\bcountry_code\s*=/);
  assert.doesNotMatch(profile, /\btax_number\s*=/);
  assert.doesNotMatch(profile, /\bpartner_code\s*=/);
  assert.match(actions, /partnerUpdateProfileAction/);
  assert.doesNotMatch(
    actions.slice(
      actions.indexOf("partnerUpdateProfileAction"),
      actions.indexOf("partnerSendEmailChangeCodeAction"),
    ),
    /formData\.get\(["']name["']\)|formData\.get\(["']email["']\)|formData\.get\(["']taxNumber["']\)/,
  );
  assert.match(form, /copy\.saveProfile/);
  assert.match(form, /dirty \? \(/);
  assert.match(form, /partner-edit-btn/);
  assert.match(form, /copy\.changePasswordSubmit/);
  assert.doesNotMatch(form, /copy\.securityTitle/);
  assert.match(form, /partnerSendEmailChangeCodeAction/);
  assert.match(form, /applyVerifiedPartnerLoginEmail|partnerVerifyEmailChangeAction/);
  assert.match(form, /emailOpen/);
  assert.match(form, /passwordOpen/);
});

test("email change updates login email only after verification consume", () => {
  const actions = source("lib/partner/actions.ts");
  const verify = source("lib/partner/email-verification.ts");
  const emailChange = actions.slice(actions.indexOf("partnerVerifyEmailChangeAction"));
  assert.match(emailChange, /verifyPartnerEmailChallenge/);
  assert.match(emailChange, /consumeVerifiedPartnerEmailChallenge/);
  assert.match(emailChange, /applyVerifiedPartnerLoginEmail/);
  assert.ok(
    emailChange.indexOf("consumeVerifiedPartnerEmailChallenge") <
      emailChange.indexOf("applyVerifiedPartnerLoginEmail"),
  );
  assert.match(emailChange, /notifyPreviousPartnerEmail/);
  assert.match(verify, /purpose === "register"/);
  assert.match(verify, /buildPartnerEmailChangeCodeEmail/);
  assert.doesNotMatch(verify, /UPDATE partners[\s\S]*status/);
});

test("partner onboarding migration is additive and does not rewrite booking tables", () => {
  const sql = source("db/migrations/033_partner_onboarding.sql");
  assert.match(sql, /pending/);
  assert.match(sql, /priority_level/);
  assert.match(sql, /partner_application_created/);
  assert.doesNotMatch(sql, /employer_billing_profile/);
  assert.doesNotMatch(sql, /ALTER TABLE reservations/);
  assert.doesNotMatch(sql, /DROP TABLE/);
  assert.doesNotMatch(sql, /UPDATE partners SET/);
  assert.doesNotMatch(sql, /INSERT INTO partners/);
});

test("migration does not seed passwords or the first partner user", () => {
  const migration = source("db/migrations/031_partner_portal_auth.sql");
  assert.match(migration, /CREATE TABLE partners/);
  assert.match(migration, /CREATE TABLE partner_users/);
  assert.match(migration, /is_primary_partner/);
  assert.doesNotMatch(migration, /info@tripetica\.com/);
  assert.doesNotMatch(migration, /password_hash\s*=/);
  assert.doesNotMatch(migration, /INSERT INTO partners/);
  assert.doesNotMatch(migration, /INSERT INTO partner_users/);
});
