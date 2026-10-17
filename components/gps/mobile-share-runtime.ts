"use client";

import { useSyncExternalStore } from "react";
import {
  initialMobileShareRuntime,
  mobileShareLeaderCurrent,
  mobileShareView,
  reduceMobileShare,
  type MobileShareEvent,
  type MobileShareRuntime,
} from "@/lib/gps/mobile-share-phase";

const TOKEN_KEY = "tripetica.mobileShareToken";
const TAB_KEY = "tripetica.mobileShareTab";
const LEADER_KEY = "tripetica.mobileShareLeader";
const STOP_KEY = "tripetica.mobileShareStopped";

export type MobileShareSnapshot = {
  driverName: string;
  plate: string | null;
  vehicleId?: string | null;
  sessionId: string | null;
  sharing: boolean;
  tokenMatches: boolean;
  tokenBound?: boolean;
  lastFixAt: string | null;
  lastStreamAt?: string | null;
  accuracyM: number | null;
  fresh: boolean;
};

let runtime: MobileShareRuntime = initialMobileShareRuntime(Date.now(), false);
let watchStop: (() => void) | null = null;
let identity: MobileShareSnapshot | null = null;
const listeners = new Set<() => void>();

function publish() {
  for (const listener of listeners) listener();
}

function detachWatch() {
  watchStop?.();
  watchStop = null;
}

function apply(event: MobileShareEvent) {
  const next = reduceMobileShare(runtime, event, Date.now());
  runtime = next.state;
  if (next.effect.clearWatch) detachWatch();
  if (next.effect.ensureWatch) attachWatch();
  publish();
}

function tabId() {
  const existing = window.sessionStorage.getItem(TAB_KEY);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(TAB_KEY, created);
  return created;
}

function readLeader() {
  const raw = window.localStorage.getItem(LEADER_KEY);
  if (!raw) return null;
  const split = raw.lastIndexOf(":");
  if (split <= 0) return null;
  const tab = raw.slice(0, split);
  const at = Number(raw.slice(split + 1));
  if (!tab || !Number.isFinite(at)) return null;
  return { tab, at };
}

function claimLeader(force: boolean) {
  const now = Date.now();
  const leader = readLeader();
  const held = leader != null && leader.tab !== tabId() && mobileShareLeaderCurrent(leader, leader.tab, now);
  if (!force && held) return false;
  window.localStorage.setItem(LEADER_KEY, `${tabId()}:${now}`);
  return mobileShareLeaderCurrent(readLeader(), tabId(), Date.now());
}

function releaseLeader() {
  if (readLeader()?.tab === tabId()) window.localStorage.removeItem(LEADER_KEY);
}

export function mobileShareToken() {
  const local = window.localStorage.getItem(TOKEN_KEY);
  const session = window.sessionStorage.getItem(TOKEN_KEY);
  const token = local || session || crypto.randomUUID();
  window.localStorage.setItem(TOKEN_KEY, token);
  window.sessionStorage.setItem(TOKEN_KEY, token);
  return token;
}

async function postShare(body: unknown) {
  const response = await fetch("/api/gps/mobile/session", {
    method: "POST",
    headers: { "content-type": "application/json", "x-mobile-client": mobileShareToken() },
    body: JSON.stringify(body),
  });
  return response.json() as Promise<{ ok?: boolean; sessionId?: string; error?: string }>;
}

function attachWatch() {
  if (watchStop || !runtime.sessionId || !runtime.armed || runtime.explicitStop) return;
  if (!claimLeader(false)) return;
  if (!navigator.geolocation) {
    releaseLeader();
    apply({ type: "watch-error", permission: false });
    return;
  }
  const sessionId = runtime.sessionId;
  let cancelled = false;
  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      apply({ type: "watch-callback" });
      const recordedAt = new Date(position.timestamp).toISOString();
      void fetch("/api/gps/mobile/points", {
        method: "POST",
        headers: { "content-type": "application/json", "x-mobile-client": mobileShareToken() },
        body: JSON.stringify({
          sessionId,
          clientToken: mobileShareToken(),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          recordedAt,
          accuracyM: position.coords.accuracy,
          speedMps: position.coords.speed,
          headingDeg: position.coords.heading,
        }),
      }).then(async (response) => {
        const result = await response.json().catch(() => null) as { ok?: boolean } | null;
        if (response.ok && result?.ok) {
          apply({ type: "accepted" });
          return;
        }
        apply({ type: "post-failed" });
      }).catch(() => {
        apply({ type: "post-failed" });
      });
    },
    (error) => {
      cancelled = true;
      detachWatch();
      releaseLeader();
      if (error.code === 1) {
        void postShare({ action: "permission_denied", clientToken: mobileShareToken() });
      }
      apply({ type: "watch-error", permission: error.code === 1 });
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
  );
  if (cancelled || !mobileShareLeaderCurrent(readLeader(), tabId(), Date.now())) {
    navigator.geolocation.clearWatch(watchId);
    if (cancelled) releaseLeader();
    return;
  }
  watchStop = () => navigator.geolocation.clearWatch(watchId);
  apply({ type: "watch-on" });
}

export function mobileShareButtonState(now = Date.now()) {
  return mobileShareView(runtime, now);
}

export function rememberMobileShare(share: MobileShareSnapshot | null) {
  identity = share;
  if (!share) return;
  apply({
    type: "server",
    sharing: share.sharing,
    tokenMatches: share.tokenMatches,
    lastStreamAt: share.lastStreamAt ? Date.parse(share.lastStreamAt) : share.lastFixAt ? Date.parse(share.lastFixAt) : null,
    sessionId: share.sessionId,
  });
}

export async function pressMobileShare() {
  const view = mobileShareView(runtime, Date.now());
  if (view.action === "none") return;
  if (view.action === "stop") {
    window.sessionStorage.setItem(STOP_KEY, "1");
    releaseLeader();
    apply({ type: "stop" });
    await postShare({ action: "stop", clientToken: mobileShareToken() });
    publish();
    return;
  }
  window.sessionStorage.removeItem(STOP_KEY);
  claimLeader(true);
  apply({ type: "start" });
  const result = await postShare({ action: "start", clientToken: mobileShareToken() });
  if (!result.ok || !result.sessionId) {
    releaseLeader();
    apply({ type: "rejected", reason: result.error === "other-device" ? "other-device" : "failed" });
    return;
  }
  apply({
    type: "server",
    sharing: true,
    tokenMatches: true,
    lastStreamAt: null,
    sessionId: result.sessionId,
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function snapshot() {
  return runtime;
}

export function useMobileShareRuntime() {
  const state = useSyncExternalStore(subscribe, snapshot, snapshot);
  return { state, view: mobileShareView(state, Date.now()), identity };
}

async function pullShare() {
  const token = window.localStorage.getItem(TOKEN_KEY) || window.sessionStorage.getItem(TOKEN_KEY);
  const response = await fetch("/api/gps/mobile/session", {
    cache: "no-store",
    headers: token ? { "x-mobile-client": token } : {},
  });
  const body = await response.json() as { share?: MobileShareSnapshot | null };
  if (!body.share) return;
  identity = body.share;
  apply({
    type: "server",
    sharing: body.share.sharing,
    tokenMatches: body.share.tokenMatches,
    lastStreamAt: body.share.lastStreamAt ? Date.parse(body.share.lastStreamAt) : null,
    sessionId: body.share.sessionId,
  });
}

export function bindMobileShareOwner(share: MobileShareSnapshot | null) {
  runtime = initialMobileShareRuntime(Date.now(), window.sessionStorage.getItem(STOP_KEY) === "1");
  identity = share;
  void pullShare();
  const onHidden = () => {
    if (document.visibilityState === "hidden") apply({ type: "hidden" });
    else apply({ type: "visible" });
  };
  const onOffline = () => apply({ type: "offline" });
  const onOnline = () => apply({ type: "online" });
  const onLeader = (event: StorageEvent) => {
    if (event.key !== LEADER_KEY) return;
    if (watchStop && !mobileShareLeaderCurrent(readLeader(), tabId(), Date.now())) detachWatch();
  };
  document.addEventListener("visibilitychange", onHidden);
  window.addEventListener("offline", onOffline);
  window.addEventListener("online", onOnline);
  window.addEventListener("storage", onLeader);
  const timer = window.setInterval(() => {
    if (watchStop && mobileShareLeaderCurrent(readLeader(), tabId(), Date.now())) {
      window.localStorage.setItem(LEADER_KEY, `${tabId()}:${Date.now()}`);
    }
    runtime = { ...runtime };
    publish();
  }, 5000);
  const poll = window.setInterval(() => {
    void pullShare().catch(() => undefined);
  }, 10000);
  return () => {
    document.removeEventListener("visibilitychange", onHidden);
    window.removeEventListener("offline", onOffline);
    window.removeEventListener("online", onOnline);
    window.removeEventListener("storage", onLeader);
    window.clearInterval(timer);
    window.clearInterval(poll);
    detachWatch();
    releaseLeader();
    runtime = initialMobileShareRuntime(Date.now(), window.sessionStorage.getItem(STOP_KEY) === "1");
  };
}
