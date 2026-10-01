import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACCOUNT_SESSION_COOKIE } from "@/lib/account/constants";
import { DRIVER_PORTAL_SESSION_COOKIE } from "@/lib/driver-portal/constants";
import {
  DRIVER_PORTAL_PATH,
  DRIVER_TASK_PATH,
  driverPortalPath,
  driverTaskPath,
  resolveLegacyDriverRedirect,
} from "@/lib/driver-routes";
import { isDriverPortalDevOtpAllowed } from "@/lib/driver-portal/dev-otp";
import {
  buildDriverPortalJobRow,
  driverPortalDropoffName,
  formatDriverPortalDateTime,
  isRegisteredDriverPortalAssignment,
  partitionDriverPortalJobs,
} from "@/lib/driver-portal/jobs-view";
import { driverPortalCopy } from "@/lib/driver-portal/copy";
import { buildDriverPortalLoginEmail } from "@/lib/driver-portal/login-email";
import {
  DRIVER_PORTAL_CODE_TTL_MS,
  DRIVER_PORTAL_MAX_VERIFY_ATTEMPTS,
  DRIVER_PORTAL_RESEND_COOLDOWN_MS,
  DRIVER_PORTAL_RESEND_MAX_PER_WINDOW,
  classifyDriverPortalChallenge,
  createDriverPortalCodeSalt,
  driverPortalCodesEqual,
  generateDriverPortalCode,
  hashDriverPortalCode,
  isDriverPortalCodeFormatValid,
} from "@/lib/driver-portal/otp-policy";
import { OPS_SESSION_COOKIE } from "@/lib/ops/constants";
import { PARTNER_SESSION_COOKIE } from "@/lib/partner/constants";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("driver portal session cookie is isolated from ops, partner, and customer auth", () => {
  assert.equal(DRIVER_PORTAL_SESSION_COOKIE, "tripetica_driver_session");
  assert.notEqual(DRIVER_PORTAL_SESSION_COOKIE, PARTNER_SESSION_COOKIE);
  assert.notEqual(DRIVER_PORTAL_SESSION_COOKIE, OPS_SESSION_COOKIE);
  assert.notEqual(DRIVER_PORTAL_SESSION_COOKIE, ACCOUNT_SESSION_COOKIE);
  const proxy = source("proxy.ts");
  assert.match(proxy, /DRIVER_PORTAL_SESSION_COOKIE/);
  assert.match(proxy, /resolveLegacyDriverRedirect/);
  assert.match(proxy, /\/driver/);
  assert.equal((proxy.match(/sofor-gorevi/g) ?? []).length, 1);
  assert.match(proxy, /sofor\|sofor-gorevi/);
  assert.doesNotMatch(proxy, /\/\(tr\|en\|ru\)\/sofor-gorevi/);
});

test("canonical driver routes replace legacy sofor paths without changing tokens", () => {
  assert.equal(DRIVER_PORTAL_PATH, "/driver");
  assert.equal(DRIVER_TASK_PATH, "/driver-task");
  assert.equal(driverTaskPath("abc+token"), "/driver-task/abc%2Btoken");
  assert.equal(driverPortalPath("res-1"), "/driver/res-1");
  assert.equal(resolveLegacyDriverRedirect("/tr/sofor"), "/tr/driver");
  assert.equal(resolveLegacyDriverRedirect("/en/sofor/isler"), "/en/driver");
  assert.equal(resolveLegacyDriverRedirect("/ru/sofor/gorev/job-1"), "/ru/driver/job-1");
  assert.equal(
    resolveLegacyDriverRedirect("/tr/sofor-gorevi/abc+token"),
    "/tr/driver-task/abc%2Btoken",
  );
  assert.equal(resolveLegacyDriverRedirect("/tr/driver-task/abc"), null);
  assert.match(source("app/[locale]/(driver-portal)/driver/page.tsx"), /getDriverPortalActor/);
  assert.match(source("app/[locale]/(driver-portal)/driver/page.tsx"), /DriverPortalLoginForm/);
  assert.match(source("app/[locale]/(driver-portal)/driver/page.tsx"), /listDriverPortalJobs/);
  assert.doesNotMatch(source("app/[locale]/(driver-portal)/driver/page.tsx"), /\/login/);
  assert.match(
    source("app/[locale]/(driver-task)/driver-task/[token]/page.tsx"),
    /loadDriverTaskByToken/,
  );
  assert.match(
    source("app/[locale]/(driver-task)/sofor-gorevi/[token]/page.tsx"),
    /permanentRedirect/,
  );
});

test("driver portal migration is additive and does not rewrite assignment or driver tasks", () => {
  const sql = source("db/migrations/046_driver_portal.sql");
  assert.match(sql, /ALTER TABLE partner_drivers/);
  assert.match(sql, /ADD COLUMN email TEXT/);
  assert.match(sql, /partner_drivers_email_uidx/);
  assert.match(sql, /lower\(email\)/);
  assert.match(sql, /deleted_at IS NULL/);
  assert.match(sql, /CREATE TABLE driver_portal_challenges/);
  assert.match(sql, /CREATE TABLE driver_portal_sessions/);
  assert.match(sql, /code_hash/);
  assert.match(sql, /token_hash/);
  assert.doesNotMatch(sql, /ALTER TABLE reservations/);
  assert.doesNotMatch(sql, /ALTER TABLE reservation_driver_tasks/);
  assert.doesNotMatch(sql, /DROP TABLE/);
  assert.doesNotMatch(sql, /DROP COLUMN/);
});

test("registered driver email is optional, normalized, and unique among live rows", () => {
  const fleet = source("lib/partner/fleet.ts");
  assert.match(fleet, /normalizePartnerEmail/);
  assert.match(fleet, /invalid-email/);
  assert.match(fleet, /duplicate-email/);
  assert.match(fleet, /email = \$8/);
  assert.match(source("components/partner/driver-create-form.tsx"), /name="email"/);
  assert.match(source("components/partner/driver-detail.tsx"), /copy\.driverEmail/);
  assert.match(source("components/ops/partner-driver-form.tsx"), /name="email"/);
  const nonTrp = source("components/partner/job-assignment.tsx");
  const nonTrpBlock = nonTrp.slice(nonTrp.indexOf("{nonTrp ? ("), nonTrp.indexOf("{state.error ?"));
  assert.match(nonTrpBlock, /copy\.driverFullName/);
  assert.doesNotMatch(nonTrpBlock, /name="email"/);
  assert.doesNotMatch(nonTrpBlock, /copy\.driverEmail/);
});

test("portal OTP reuses hashed partner email codes with expiry and attempt limits", () => {
  const code = generateDriverPortalCode();
  const salt = createDriverPortalCodeSalt();
  assert.equal(isDriverPortalCodeFormatValid(code), true);
  assert.equal(driverPortalCodesEqual(hashDriverPortalCode(code, salt), hashDriverPortalCode(code, salt)), true);
  assert.equal(
    driverPortalCodesEqual(hashDriverPortalCode(code, salt), hashDriverPortalCode("000000", salt)),
    false,
  );
  assert.equal(DRIVER_PORTAL_CODE_TTL_MS, 10 * 60 * 1000);
  assert.equal(DRIVER_PORTAL_MAX_VERIFY_ATTEMPTS, 5);
  assert.equal(DRIVER_PORTAL_RESEND_COOLDOWN_MS, 60 * 1000);
  assert.equal(DRIVER_PORTAL_RESEND_MAX_PER_WINDOW, 5);
  assert.equal(
    classifyDriverPortalChallenge({
      expiresAt: new Date(Date.now() - 1000),
      consumedAt: null,
      attemptCount: 0,
    }),
    "expired",
  );
  assert.equal(
    classifyDriverPortalChallenge({
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: new Date(),
      attemptCount: 0,
    }),
    "consumed",
  );
  assert.equal(
    classifyDriverPortalChallenge({
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
      attemptCount: 5,
    }),
    "locked",
  );
  const otp = source("lib/driver-portal/otp.ts");
  assert.match(otp, /sendPartnerMail/);
  assert.match(otp, /hashDriverPortalCode/);
  assert.match(otp, /consumed_at = NOW\(\)/);
  assert.doesNotMatch(otp, /console\.(log|info|debug).*code/);
  assert.doesNotMatch(source("lib/driver-portal/actions.ts"), /result\.code|otp:/);
  const mail = buildDriverPortalLoginEmail("123456");
  assert.match(mail.text, /123456/);
  assert.match(mail.subject, /Şoför/);
});

test("DEV OTP helper cannot run against production database or production node", () => {
  assert.equal(isDriverPortalDevOtpAllowed("tripetica", "development"), false);
  assert.equal(isDriverPortalDevOtpAllowed("tripetica_dev", "production"), false);
  assert.equal(isDriverPortalDevOtpAllowed("tripetica_dev", "development"), true);
  const helper = source("lib/driver-portal/dev-otp.ts");
  assert.match(helper, /tripetica_dev/);
  assert.doesNotMatch(source("lib/driver-portal/actions.ts"), /writeDriverPortalDevOtp/);
});

test("portal jobs use registered assignment only and keep Driver A/B isolated", () => {
  const driverA = "11111111-1111-4111-8111-111111111111";
  const driverB = "22222222-2222-4222-8222-222222222222";
  assert.equal(
    isRegisteredDriverPortalAssignment({
      assignedDriverKind: "registered",
      assignedDriverId: driverA,
      sessionDriverId: driverA,
    }),
    true,
  );
  assert.equal(
    isRegisteredDriverPortalAssignment({
      assignedDriverKind: "registered",
      assignedDriverId: driverB,
      sessionDriverId: driverA,
    }),
    false,
  );
  assert.equal(
    isRegisteredDriverPortalAssignment({
      assignedDriverKind: "non_trp",
      assignedDriverId: null,
      sessionDriverId: driverA,
    }),
    false,
  );
  assert.equal(
    isRegisteredDriverPortalAssignment({
      assignedDriverKind: "non_trp",
      assignedDriverId: driverA,
      sessionDriverId: driverA,
    }),
    false,
  );
  const jobs = source("lib/driver-portal/jobs.ts");
  assert.match(jobs, /assigned_driver_kind = 'registered'/);
  assert.match(jobs, /assigned_driver_id = \$1/);
  assert.match(jobs, /sessionDriverId: driverId/);
  assert.match(jobs, /loadDriverTaskByToken/);
  assert.doesNotMatch(jobs, /formData\.get\(["']driverId["']\)/);
});

test("portal list rows stay summary-only and do not invent dropoff", () => {
  assert.equal(formatDriverPortalDateTime("2026-09-13T11:30:00.000Z"), "13.09.2026 · 14:30");
  assert.equal(
    driverPortalDropoffName({ serviceType: "hourly", dropoffName: "" }),
    null,
  );
  assert.equal(
    driverPortalDropoffName({ serviceType: "transfer", dropoffName: "Dulcet Hotel" }),
    "Dulcet Hotel",
  );
  const row = buildDriverPortalJobRow({
    reservationId: "r1",
    pickupAt: "2026-09-13T11:30:00.000Z",
    serviceType: "transfer",
    tourCode: null,
    pickupNameTr: "Tu Casa Gelidonya Hotel",
    pickupNameCustomer: null,
    dropoffNameTr: "Dulcet Hotel",
    dropoffNameCustomer: null,
    currentStage: "planned",
  });
  assert.equal(row.serviceLabel, "Özel Transfer & Taksi");
  assert.equal(row.pickupName, "Tu Casa Gelidonya Hotel");
  assert.equal(row.dropoffName, "Dulcet Hotel");
  assert.equal(row.stageLabel, "Planlandı");
  assert.equal(row.completed, false);
  const hourly = buildDriverPortalJobRow({
    reservationId: "r2",
    pickupAt: "2026-09-12T11:30:00.000Z",
    serviceType: "hourly",
    tourCode: null,
    pickupNameTr: "Otel",
    pickupNameCustomer: null,
    dropoffNameTr: null,
    dropoffNameCustomer: null,
    currentStage: "completed",
  });
  assert.equal(hourly.dropoffName, null);
  const split = partitionDriverPortalJobs([hourly, row]);
  assert.deepEqual(
    split.upcoming.map((job) => job.reservationId),
    ["r1"],
  );
  assert.deepEqual(
    split.completed.map((job) => job.reservationId),
    ["r2"],
  );
  const list = source("components/driver-portal/driver-portal-job-list.tsx");
  assert.match(list, /job\.pickupAtLabel/);
  assert.match(list, /job\.serviceLabel/);
  assert.match(list, /driverPortalCopy\.upcoming/);
  assert.doesNotMatch(list, /driverPortalCopy\.completed/);
  assert.doesNotMatch(list, /passenger|passport|price|Nakit Tahsilat/i);
  assert.match(source("lib/driver-portal/jobs.ts"), /current_stage IS DISTINCT FROM 'completed'/);
  assert.match(source("app/[locale]/(driver-portal)/driver/page.tsx"), /jobs=\{jobs\}/);
  assert.doesNotMatch(
    source("app/[locale]/(driver-portal)/driver/page.tsx"),
    /upcoming=\{jobs\.upcoming\}/,
  );
});

test("portal detail reuses Driver Task screen and visibility payload", () => {
  const page = source("app/[locale]/(driver-portal)/driver/[reservationId]/page.tsx");
  assert.match(page, /DriverTaskScreen/);
  assert.match(page, /loadAuthorizedDriverPortalTask/);
  assert.match(page, /DriverPortalHeader/);
  assert.match(page, /action="back"/);
  assert.match(page, /title="ŞOFÖR GÖREVİ"/);
  assert.match(page, /embedded/);
  assert.match(source("components/driver-portal/driver-portal-header.tsx"), /driver-portal-header/);
  assert.match(source("components/driver-task/driver-task-screen.tsx"), /driver-task-body/);
  assert.doesNotMatch(source("app/globals.css"), /driver-task-page[^{]*\{[^}]*justify-content:\s*center/);
  assert.doesNotMatch(page, /showJobsLink|driver-portal-task-nav|logoutDriverPortalAction/);
  assert.doesNotMatch(page, /show_price_info|showPassengerContact/);
  assert.match(source("lib/driver-portal/jobs.ts"), /loadDriverTaskByToken/);
  assert.match(source("app/[locale]/(driver-task)/driver-task/[token]/page.tsx"), /loadDriverTaskByToken/);
  assert.match(source("app/[locale]/(driver-task)/driver-task/[token]/page.tsx"), /DriverTaskScreen/);
  assert.doesNotMatch(
    source("app/[locale]/(driver-task)/driver-task/[token]/page.tsx"),
    /DriverPortalHeader|action="back"/,
  );
  const header = source("components/driver-portal/driver-portal-header.tsx");
  assert.match(header, /DriverPortalNav/);
  assert.match(header, /driver-task-brand/);
  assert.match(header, /driverPortalCopy\.brand/);
  const nav = source("components/driver-portal/driver-portal-nav.tsx");
  assert.match(nav, /driverPortalCopy\.back/);
  assert.match(nav, /localizedPath\(locale, DRIVER_PORTAL_PATH\)/);
  assert.match(nav, /is-start/);
  assert.match(nav, /is-end/);
  assert.doesNotMatch(nav, /jobsNav|showJobsLink/);
  const css = source("app/globals.css");
  assert.match(css, /\.driver-portal-nav\.is-start \{\s*justify-content: flex-start;/);
  assert.match(css, /\.driver-portal-nav\.is-end \{\s*justify-content: flex-end;/);
  assert.match(css, /\.driver-portal-logout:active \{/);
  assert.match(css, /scale\(0\.97\)/);
  assert.match(source("app/[locale]/(driver-portal)/driver/page.tsx"), /DriverPortalHeader/);
  assert.doesNotMatch(source("app/[locale]/(driver-portal)/driver/page.tsx"), /action="back"/);
  assert.equal(driverPortalCopy.back, "Kapat");
  assert.equal(driverPortalCopy.logout, "Çıkış");
  const login = source("components/driver-portal/driver-portal-login-form.tsx");
  assert.match(login, /ŞOFÖR GİRİŞİ|sendDriverPortalCodeAction/);
  assert.match(login, /disabled=\{sending\}/);
  assert.match(login, /if \(sending\)/);
  assert.doesNotMatch(login, /Üye ol|password|partner\/login|register/i);
  assert.match(source("lib/driver-portal/copy.ts"), /Sistemde bu e-posta adresiyle kayıtlı bir şoför bulunamadı/);
  assert.match(source("lib/mail/smtp.ts"), /SMTP retry after transient failure/);
  assert.doesNotMatch(source("lib/mail/smtp.ts"), /pool:\s*true/);
  assert.equal(DRIVER_PORTAL_RESEND_COOLDOWN_MS, 60 * 1000);
  assert.equal(DRIVER_PORTAL_RESEND_MAX_PER_WINDOW, 5);
});
