import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MOBILE_SHARE_LEADER_LEASE_MS,
  MOBILE_SHARE_STILL_GRACE_MS,
  SHARE_LABEL_START,
  SHARE_LABEL_STARTING,
  SHARE_LABEL_STOP,
  initialMobileShareRuntime,
  mobileShareLeaderCurrent,
  mobileShareView,
  reduceMobileShare,
  type MobileShareRuntime,
} from "./mobile-share-phase";

const now = Date.parse("2026-10-10T18:00:00Z");

function armedWatch(patch: Partial<MobileShareRuntime> = {}): MobileShareRuntime {
  return {
    ...initialMobileShareRuntime(now - 10_000),
    armed: true,
    explicitStop: false,
    starting: false,
    watchAttached: true,
    sessionId: "session-1",
    attemptAt: now - 10_000,
    lastAcceptedAt: now - 5_000,
    lastWatchCallbackAt: now - 5_000,
    pageVisible: true,
    visibleSince: now - 10_000,
    ...patch,
  };
}

test("sharing starts as Konum Paylaş and shows Başlatılıyor until the server accepts a point", () => {
  const idle = mobileShareView(initialMobileShareRuntime(now), now);
  assert.equal(idle.phase, "idle");
  assert.equal(idle.label, SHARE_LABEL_START);
  assert.equal(idle.action, "start");
  const started = reduceMobileShare(initialMobileShareRuntime(now), { type: "start" }, now);
  assert.equal(started.effect.ensureWatch, true);
  assert.equal(mobileShareView(started.state, now).label, SHARE_LABEL_STARTING);
  const watching = reduceMobileShare(started.state, { type: "watch-on" }, now).state;
  const called = reduceMobileShare(watching, { type: "watch-callback" }, now + 1000).state;
  assert.equal(mobileShareView(called, now + 1000).phase, "starting");
  const accepted = reduceMobileShare(called, { type: "accepted" }, now + 1200).state;
  const live = mobileShareView(accepted, now + 1200);
  assert.equal(live.phase, "live");
  assert.equal(live.label, SHARE_LABEL_STOP);
  assert.equal(live.action, "stop");
});

test("an explicit stop stays stopped and does not ask for another watch", () => {
  const stopped = reduceMobileShare(armedWatch(), { type: "stop" }, now);
  assert.equal(stopped.effect.clearWatch, true);
  assert.equal(stopped.effect.ensureWatch, false);
  assert.equal(stopped.state.explicitStop, true);
  assert.equal(mobileShareView(stopped.state, now).label, SHARE_LABEL_START);
  const polled = reduceMobileShare(stopped.state, {
    type: "server",
    sharing: true,
    tokenMatches: true,
    lastStreamAt: now,
    sessionId: "session-1",
  }, now + 1000);
  assert.equal(polled.effect.ensureWatch, false);
  assert.equal(polled.state.armed, false);
  const returned = reduceMobileShare(stopped.state, { type: "visible" }, now + 2000);
  assert.equal(returned.effect.ensureWatch, false);
});

test("offline, a rejected point, and a watch error show Konum Paylaş without clearing a healthy watch", () => {
  for (const event of [
    { type: "offline" } as const,
    { type: "post-failed" } as const,
  ]) {
    const next = reduceMobileShare(armedWatch(), event, now);
    assert.equal(next.effect.clearWatch, false);
    assert.equal(next.effect.ensureWatch, false);
    assert.equal(mobileShareView(next.state, now).phase, "interrupted");
    assert.equal(mobileShareView(next.state, now).label, SHARE_LABEL_START);
    assert.equal(mobileShareView(next.state, now).action, "start");
  }
  const error = reduceMobileShare(armedWatch(), { type: "watch-error", permission: false }, now);
  assert.equal(error.effect.ensureWatch, false);
  assert.equal(mobileShareView(error.state, now).phase, "interrupted");
  const denied = reduceMobileShare(armedWatch(), { type: "watch-error", permission: true }, now);
  const back = reduceMobileShare(denied.state, { type: "visible" }, now + 1000);
  assert.equal(back.effect.ensureWatch, false);
});

test("a hidden page can recover after a real server accept, and silence becomes Konum Paylaş", () => {
  const hidden = reduceMobileShare(armedWatch(), { type: "hidden" }, now);
  assert.equal(hidden.effect.clearWatch, false);
  assert.equal(mobileShareView(hidden.state, now).phase, "live");
  const shown = reduceMobileShare(hidden.state, { type: "visible" }, now + 1000);
  assert.equal(shown.effect.ensureWatch, false);
  const recovered = reduceMobileShare(
    reduceMobileShare(shown.state, { type: "watch-callback" }, now + 2000).state,
    { type: "accepted" },
    now + 2200,
  ).state;
  assert.equal(mobileShareView(recovered, now + 2200).label, SHARE_LABEL_STOP);
  const quiet = armedWatch({
    lastAcceptedAt: now - MOBILE_SHARE_STILL_GRACE_MS - 1000,
    lastWatchCallbackAt: now - MOBILE_SHARE_STILL_GRACE_MS - 1000,
    visibleSince: now - MOBILE_SHARE_STILL_GRACE_MS - 1000,
    attemptAt: now - MOBILE_SHARE_STILL_GRACE_MS - 5000,
  });
  assert.equal(mobileShareView(quiet, now).phase, "interrupted");
  assert.equal(mobileShareView(quiet, now).action, "start");
});

test("a stationary gap inside the still grace stays live and does not use a second watch", () => {
  assert.ok(MOBILE_SHARE_STILL_GRACE_MS > 30_000);
  const still = armedWatch({
    attemptAt: now - 50_000,
    lastAcceptedAt: now - 40_000,
    lastWatchCallbackAt: now - 40_000,
  });
  assert.equal(mobileShareView(still, now).phase, "live");
  const again = reduceMobileShare(still, {
    type: "server",
    sharing: true,
    tokenMatches: true,
    lastStreamAt: now - 40_000,
    sessionId: "session-1",
  }, now);
  assert.equal(again.effect.ensureWatch, false);
  assert.equal(again.effect.clearWatch, false);
});

test("coming online or back to a dropped watch asks for one watch, not a second one", () => {
  const dropped = armedWatch({ watchAttached: false, lastWatchCallbackAt: null, lastAcceptedAt: null, starting: false });
  const online = reduceMobileShare(dropped, { type: "online" }, now);
  assert.equal(online.effect.ensureWatch, true);
  assert.equal(online.effect.clearWatch, false);
  const attached = reduceMobileShare(online.state, { type: "watch-on" }, now).state;
  const twice = reduceMobileShare(attached, { type: "visible" }, now + 1000);
  assert.equal(twice.effect.ensureWatch, false);
});

test("one tab keeps the watch and a dead tab lease can be taken", () => {
  const now = 1_700_000_000_000;
  assert.equal(mobileShareLeaderCurrent({ tab: "a", at: now - 5_000 }, "a", now), true);
  assert.equal(mobileShareLeaderCurrent({ tab: "a", at: now - 5_000 }, "b", now), false);
  assert.equal(mobileShareLeaderCurrent({ tab: "a", at: now - MOBILE_SHARE_LEADER_LEASE_MS - 1 }, "a", now), false);
  const runtime = readFileSync(new URL("../../components/gps/mobile-share-runtime.ts", import.meta.url), "utf8");
  assert.match(runtime, /localStorage.getItem\(TOKEN_KEY\)/);
  assert.match(runtime, /if \(!claimLeader\(false\)\) return/);
  assert.match(runtime, /claimLeader\(true\)/);
  assert.match(runtime, /releaseLeader\(\)/);
});

test("the partner and driver buttons read the phase label and do not stop the watch when it changes", () => {
  const button = readFileSync(new URL("../../components/partner/share-button.tsx", import.meta.url), "utf8");
  const runtime = readFileSync(new URL("../../components/gps/mobile-share-runtime.ts", import.meta.url), "utf8");
  const share = readFileSync(new URL("../../components/gps/mobile-share.tsx", import.meta.url), "utf8");
  assert.match(button, /mobileShareView/);
  assert.doesNotMatch(button, /share\.sharing \? "Konum Paylaşmayı Durdur"/);
  assert.match(share, /MobileShareOwner/);
  assert.match(runtime, /visibilityState === "hidden"/);
  assert.doesNotMatch(runtime, /visibilityState === "hidden"[\s\S]{0,120}stream_lost/);
  assert.match(runtime, /if \(next\.effect\.clearWatch\) detachWatch\(\)/);
  assert.match(runtime, /if \(next\.effect\.ensureWatch\) attachWatch\(\)/);
});

test("button state does not change ATS dispatch or the mobile store interval", () => {
  const phase = readFileSync(new URL("./mobile-share-phase.ts", import.meta.url), "utf8");
  const speed = readFileSync(new URL("./mobile-speed.ts", import.meta.url), "utf8");
  assert.doesNotMatch(phase, /ats-run|postAts|share_enabled/);
  assert.match(speed, /MOBILE_STORE_MOVING_MS = 3_000/);
  assert.match(speed, /MOBILE_STORE_STILL_MS = 30_000/);
  const gap = readFileSync(new URL("./mobile-reminders.ts", import.meta.url), "utf8");
  assert.doesNotMatch(gap, /Durdur butonuna basıp/);
});
