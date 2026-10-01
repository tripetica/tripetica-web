import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { notificationHasGoldDriver } from "../uetds/ai-edit-visibility";
import { createOpsSession, deleteOpsSessionByToken, renewOpsSessionIfNeeded, hashSessionToken } from "../ops/session";
import { OPS_SESSION_MAX_AGE_SECONDS } from "../ops/constants";

test("Gold visibility uses assigned DB driver; standard, missing and lookup failure are hidden", async () => {
  const globals = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const original = globals.tripeticaPgPool;
  let membership: string | null = "gold";
  globals.tripeticaPgPool = { query: async (sql: string, values: string[]) => {
    assert.match(sql, /d.id = n.driver_id/);
    assert.deepEqual(values, ["notification", "partner"]);
    return { rows: membership ? [{ membership_status: membership }] : [] };
  } };
  try {
    assert.equal(await notificationHasGoldDriver("notification", "partner"), true);
    for (membership of ["standard", "unknown", null]) assert.equal(await notificationHasGoldDriver("notification", "partner"), false);
    globals.tripeticaPgPool = { query: async () => { throw new Error("unavailable"); } };
    assert.equal(await notificationHasGoldDriver("notification", "partner"), false);
    const modal = readFileSync("components/uetds/uetds-edit-method-modal.tsx", "utf8");
    const detail = readFileSync("components/uetds/uetds-notification-detail.tsx", "utf8");
    assert.ok(modal.indexOf("copy.editMethodAiTitle") < modal.indexOf("copy.editMethodFormTitle"));
    assert.ok(modal.indexOf("editMethodSeferNo") < modal.indexOf("uetds-edit-method-options"));
    assert.ok(modal.indexOf("editMethodAiBody") < modal.indexOf("editMethodAiImpact"));
    assert.ok(modal.indexOf("editMethodFormBody") < modal.indexOf("editMethodFormImpact"));
    assert.ok(modal.indexOf("editMethodEdevletBody") < modal.indexOf("editMethodEdevletImpact"));
    assert.match(modal, /showAiEdit && aiEditHref \? \(/);
    assert.match(modal, /href=\{aiEditHref\}/);
    assert.doesNotMatch(modal, /setAiNotice/);
    assert.match(modal, /className="uetds-edit-method-option is-ai"/);
    assert.match(modal, /className="uetds-edit-method-option is-form"/);
    assert.match(modal, /className="uetds-edit-method-option is-manual"/);
    assert.match(modal, /copy\.editMethodAiImpact/);
    assert.match(modal, /copy\.editMethodFormImpact/);
    assert.match(modal, /copy\.editMethodEdevletImpact/);
    assert.match(modal, /seferReferansNo/);
    assert.doesNotMatch(modal, /firmaSeferHint|editMethodEdevletHint|editMethodEdevletManual/);
    assert.doesNotMatch(modal, /unsealSecret|saveKamuPortalSession/);
    assert.match(modal, /href=\{formHref\}/);
    assert.match(modal, /window.open\(edevletUrl, "_blank"\)/);
    assert.match(detail, /seferReferansNo=\{seferRef\}/);
    assert.match(detail, /notification\.ministryReference \|\| text\(ministry\?\.seferReferansNo\)/);
  } finally { globals.tripeticaPgPool = original; }
});

test("Ops login/rolling TTL is 30 days, renewal is guarded and logout deletes token", async () => {
  const globals = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const original = globals.tripeticaPgPool;
  const renewal = new Date(Date.now() + 30 * 86400_000);
  let found = true;
  let deleted = false;
  globals.tripeticaPgPool = { query: async (sql: string, values: unknown[]) => {
    if (sql.includes("INSERT INTO")) {
      assert.equal(values[0], "user");
      assert.ok(Math.abs((values[2] as Date).getTime() - renewal.getTime()) < 1000);
    } else if (sql.includes("UPDATE")) {
      assert.equal(values[0], hashSessionToken("fixture"));
      assert.equal(values[1], 30 * 86400);
      assert.match(sql, /s.expires_at > NOW\(\)/);
      assert.match(sql, /u.is_active = TRUE/);
      assert.match(sql, /u.role IN \('owner', 'employee'\)/);
      return { rows: found ? [{ expires_at: renewal }] : [] };
    } else if (sql.includes("DELETE")) { deleted = true; assert.equal(values[0], hashSessionToken("fixture")); }
    return { rows: [] };
  } };
  try {
    assert.equal(OPS_SESSION_MAX_AGE_SECONDS, 30 * 86400);
    await createOpsSession("user");
    assert.equal(await renewOpsSessionIfNeeded("fixture"), renewal);
    found = false;
    assert.equal(await renewOpsSessionIfNeeded("fixture"), null);
    await deleteOpsSessionByToken("fixture"); assert.equal(deleted, true);
    const proxy = readFileSync("proxy.ts", "utf8");
    assert.match(proxy, /if \(token && !isLogin\) await maybeAttachRenewedOpsSessionCookie/);
    assert.match(proxy, /httpOnly: true, sameSite: "lax", secure: requestIsHttps\(request\)/);
  } finally { globals.tripeticaPgPool = original; }
});
