import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  PARTNER_SESSION_COOKIE,
  PARTNER_SESSION_MAX_AGE_SECONDS,
  PARTNER_SESSION_RENEW_WITHIN_SECONDS,
} from "@/lib/partner/constants";
import {
  nextPartnerSessionExpiry,
  partnerSessionCookieOptions,
  partnerSessionNeedsRenewal,
} from "@/lib/partner/session-expiry";
import { OPS_SESSION_COOKIE, OPS_SESSION_MAX_AGE_SECONDS } from "@/lib/ops/constants";
import { ACCOUNT_SESSION_MAX_AGE_SECONDS } from "@/lib/account/constants";
import { DRIVER_PORTAL_SESSION_MAX_AGE_SECONDS } from "@/lib/driver-portal/constants";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const DAY = 60 * 60 * 24;
const HOUR = 60 * 60;

test("partner session max age is 30 days sliding window", () => {
  assert.equal(PARTNER_SESSION_MAX_AGE_SECONDS, DAY * 30);
  assert.equal(PARTNER_SESSION_RENEW_WITHIN_SECONDS, DAY * 7);
  assert.equal(PARTNER_SESSION_COOKIE, "tripetica_partner_session");
});

test("Ops now also has 30 days; driver/account TTLs remain unchanged", () => {
  assert.equal(OPS_SESSION_MAX_AGE_SECONDS, DAY * 30);
  assert.equal(DRIVER_PORTAL_SESSION_MAX_AGE_SECONDS, HOUR * 12);
  assert.equal(ACCOUNT_SESSION_MAX_AGE_SECONDS, DAY * 30);
  assert.notEqual(PARTNER_SESSION_COOKIE, OPS_SESSION_COOKIE);
});

test("new login expiry is approximately now + 30 days", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");
  const expires = nextPartnerSessionExpiry(now);
  assert.equal(expires.toISOString(), "2026-10-31T12:00:00.000Z");
});

test("renewal threshold: outside window does not need renewal", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");
  // 30d remaining (fresh login)
  assert.equal(
    partnerSessionNeedsRenewal(new Date("2026-10-31T12:00:00.000Z"), now),
    false,
  );
  // 8d remaining — still above 7d threshold
  assert.equal(
    partnerSessionNeedsRenewal(new Date("2026-10-09T12:00:00.000Z"), now),
    false,
  );
});

test("renewal threshold: inside window needs renewal", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");
  // exactly under 7d
  assert.equal(
    partnerSessionNeedsRenewal(new Date("2026-10-08T11:59:59.000Z"), now),
    true,
  );
  // legacy 12h session still valid after deploy
  assert.equal(
    partnerSessionNeedsRenewal(new Date("2026-10-01T23:00:00.000Z"), now),
    true,
  );
});

test("expired sessions never need renewal (no revive)", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");
  assert.equal(
    partnerSessionNeedsRenewal(new Date("2026-10-01T11:59:59.000Z"), now),
    false,
  );
  assert.equal(
    partnerSessionNeedsRenewal(new Date("2026-09-01T12:00:00.000Z"), now),
    false,
  );
});

test("sliding example: idle then use extends window by ~30 days from renew time", () => {
  const loginAt = new Date("2026-10-01T12:00:00.000Z");
  const initialExpiry = nextPartnerSessionExpiry(loginAt);
  assert.equal(initialExpiry.toISOString(), "2026-10-31T12:00:00.000Z");

  // 5 days idle — still outside renew threshold (25d left)
  const day5 = new Date("2026-10-06T12:00:00.000Z");
  assert.equal(partnerSessionNeedsRenewal(initialExpiry, day5), false);

  // Advance until remaining < 7d (e.g. day 24: 6d left)
  const day24 = new Date("2026-10-25T12:00:00.000Z");
  assert.equal(partnerSessionNeedsRenewal(initialExpiry, day24), true);
  const renewed = nextPartnerSessionExpiry(day24);
  assert.equal(renewed.toISOString(), "2026-11-24T12:00:00.000Z");
});

test("partner session cookie security flags are preserved", () => {
  const expiresAt = new Date("2026-10-31T12:00:00.000Z");
  const opts = partnerSessionCookieOptions(expiresAt, true);
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, "lax");
  assert.equal(opts.secure, true);
  assert.equal(opts.path, "/");
  assert.equal(opts.expires, expiresAt);

  const insecure = partnerSessionCookieOptions(expiresAt, false);
  assert.equal(insecure.secure, false);
  assert.equal(insecure.httpOnly, true);
});

test("session module renews only under threshold and never revives expired rows", () => {
  const session = source("lib/partner/session.ts");
  assert.match(session, /renewPartnerSessionIfNeeded/);
  assert.match(session, /expires_at > NOW\(\)/);
  assert.match(session, /expires_at < NOW\(\) \+ \(\$3 \* INTERVAL '1 second'\)/);
  assert.match(session, /PARTNER_SESSION_MAX_AGE_SECONDS/);
  assert.match(session, /PARTNER_SESSION_RENEW_WITHIN_SECONDS/);
  assert.match(session, /partnerSessionCookieOptions/);
  assert.match(session, /tryWriteRenewedPartnerSessionCookie/);
  assert.doesNotMatch(session, /localStorage|sessionStorage/);
});

test("proxy renews partner cookie on panel navigations (RSC cannot Set-Cookie)", () => {
  const proxy = source("proxy.ts");
  assert.match(proxy, /maybeAttachRenewedPartnerSessionCookie/);
  assert.match(proxy, /renewPartnerSessionIfNeeded/);
  assert.match(proxy, /partnerSessionCookieOptions/);
  assert.match(proxy, /export async function proxy/);
  // Ops gate unchanged — still cookie presence only, no partner renew helpers on ops branch
  const opsBlock = proxy.slice(
    proxy.indexOf("const opsMatch"),
    proxy.indexOf("const driverPortalMatch"),
  );
  assert.doesNotMatch(opsBlock, /renewPartnerSession/);
  assert.match(opsBlock, /OPS_SESSION_COOKIE/);
});

test("password change and logout still revoke partner sessions", () => {
  assert.match(
    source("lib/partner/password-change.ts"),
    /deletePartnerSessionsForUser/,
  );
  assert.match(source("lib/partner/auth.ts"), /deletePartnerSessionByToken/);
  assert.match(source("lib/partner/auth.ts"), /clearPartnerSessionCookie/);
  assert.match(source("lib/partner/session.ts"), /deletePartnerSessionByToken/);
});

test("ops partner inactive/delete still deletes partner_sessions", () => {
  const partners = source("lib/ops/partners.ts");
  assert.match(partners, /DELETE FROM partner_sessions/);
});

test("getPartnerActor still enforces eligibility (inactive/deleted cannot auth)", () => {
  const session = source("lib/partner/session.ts");
  assert.match(session, /isPartnerAccountLoginEligible/);
  assert.match(session, /p\.deleted_at IS NULL/);
  assert.match(session, /expires_at > NOW\(\)/);
});
