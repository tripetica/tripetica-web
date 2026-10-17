/** How long a quiet watch may stay "live" without a new server accept. */
export const MOBILE_SHARE_STILL_GRACE_MS = 75_000;
/** How long a tab may keep the only watch before another tab on this phone can take it. */
export const MOBILE_SHARE_LEADER_LEASE_MS = 20_000;

export function mobileShareLeaderCurrent(leader: { tab: string; at: number } | null, tab: string, now: number) {
  if (!leader || leader.tab !== tab) return false;
  return now - leader.at <= MOBILE_SHARE_LEADER_LEASE_MS && leader.at <= now + 5_000;
}

export const SHARE_LABEL_START = "Konum Paylaş";
export const SHARE_LABEL_STARTING = "Başlatılıyor…";
export const SHARE_LABEL_STOP = "Konum Paylaşmayı Durdur";
export const SHARE_NOTE_INTERRUPTED = "Bağlantı kesildi. Konum Paylaş ile yeniden başlatabilirsiniz.";
export const SHARE_NOTE_DENIED = "Konum izni reddedildi.";
export const SHARE_NOTE_OTHER = "Konum paylaşımı başka bir telefonda açık.";
export const SHARE_NOTE_FAILED = "Konum paylaşımı başlatılamadı.";

export type MobileSharePhase = "idle" | "starting" | "live" | "interrupted";

export type MobileShareRuntime = {
  armed: boolean;
  explicitStop: boolean;
  permissionDenied: boolean;
  blocked: "other-device" | "failed" | null;
  starting: boolean;
  watchAttached: boolean;
  watchFailed: boolean;
  transportDown: boolean;
  sessionId: string | null;
  lastAcceptedAt: number | null;
  lastWatchCallbackAt: number | null;
  pageVisible: boolean;
  visibleSince: number | null;
  attemptAt: number | null;
};

export type MobileShareEffect = {
  clearWatch: boolean;
  ensureWatch: boolean;
};

export type MobileShareEvent =
  | { type: "start" }
  | { type: "stop" }
  | { type: "watch-on" }
  | { type: "watch-callback" }
  | { type: "accepted" }
  | { type: "post-failed" }
  | { type: "watch-error"; permission: boolean }
  | { type: "online" }
  | { type: "offline" }
  | { type: "visible" }
  | { type: "hidden" }
  | { type: "rejected"; reason: "other-device" | "failed" }
  | { type: "server"; sharing: boolean; tokenMatches: boolean; lastStreamAt: number | null; sessionId: string | null };

const none: MobileShareEffect = { clearWatch: false, ensureWatch: false };

export function initialMobileShareRuntime(now: number, explicitStop = false): MobileShareRuntime {
  return {
    armed: false,
    explicitStop,
    permissionDenied: false,
    blocked: null,
    starting: false,
    watchAttached: false,
    watchFailed: false,
    transportDown: false,
    sessionId: null,
    lastAcceptedAt: null,
    lastWatchCallbackAt: null,
    pageVisible: true,
    visibleSince: now,
    attemptAt: null,
  };
}

function age(at: number | null, now: number) {
  if (at == null) return Number.POSITIVE_INFINITY;
  return now - at;
}

export function mobileShareView(state: MobileShareRuntime, now: number) {
  if (state.blocked === "other-device") {
    return { phase: "idle" as const, label: SHARE_LABEL_START, note: SHARE_NOTE_OTHER, action: "start" as const };
  }
  if (!state.armed || state.explicitStop) {
    const note = state.permissionDenied ? SHARE_NOTE_DENIED : state.blocked === "failed" ? SHARE_NOTE_FAILED : "";
    return { phase: "idle" as const, label: SHARE_LABEL_START, note, action: "start" as const };
  }
  if (state.permissionDenied || state.watchFailed || state.transportDown) {
    return {
      phase: "interrupted" as const,
      label: SHARE_LABEL_START,
      note: state.permissionDenied ? SHARE_NOTE_DENIED : SHARE_NOTE_INTERRUPTED,
      action: "start" as const,
    };
  }
  const recentAccept = age(state.lastAcceptedAt, now) <= MOBILE_SHARE_STILL_GRACE_MS;
  const recentCallback = age(state.lastWatchCallbackAt, now) <= MOBILE_SHARE_STILL_GRACE_MS;
  const acceptedThisAttempt = state.lastAcceptedAt != null && state.attemptAt != null && state.lastAcceptedAt >= state.attemptAt;
  const visibleFor = state.pageVisible ? age(state.visibleSince, now) : Number.POSITIVE_INFINITY;
  if (acceptedThisAttempt && recentAccept && recentCallback) {
    return { phase: "live" as const, label: SHARE_LABEL_STOP, note: "", action: "stop" as const };
  }
  if (!state.pageVisible && acceptedThisAttempt && recentAccept) {
    return { phase: "live" as const, label: SHARE_LABEL_STOP, note: "", action: "stop" as const };
  }
  const waiting = !state.watchAttached || state.starting || (state.pageVisible && visibleFor <= MOBILE_SHARE_STILL_GRACE_MS);
  if (waiting && age(state.attemptAt, now) <= MOBILE_SHARE_STILL_GRACE_MS) {
    return { phase: "starting" as const, label: SHARE_LABEL_STARTING, note: "", action: "none" as const };
  }
  return {
    phase: "interrupted" as const,
    label: SHARE_LABEL_START,
    note: SHARE_NOTE_INTERRUPTED,
    action: "start" as const,
  };
}

export function reduceMobileShare(state: MobileShareRuntime, event: MobileShareEvent, now: number) {
  const next = { ...state };
  let effect = none;
  if (event.type === "stop") {
    next.armed = false;
    next.explicitStop = true;
    next.starting = false;
    next.permissionDenied = false;
    next.blocked = null;
    next.watchFailed = false;
    next.watchAttached = false;
    next.sessionId = null;
    next.attemptAt = null;
    effect = { clearWatch: state.watchAttached, ensureWatch: false };
  } else if (event.type === "start") {
    next.armed = true;
    next.explicitStop = false;
    next.permissionDenied = false;
    next.blocked = null;
    next.watchFailed = false;
    next.transportDown = false;
    next.starting = true;
    next.attemptAt = now;
    next.visibleSince = now;
    next.pageVisible = true;
    next.watchAttached = false;
    next.lastWatchCallbackAt = null;
    effect = { clearWatch: state.watchAttached, ensureWatch: true };
  } else if (event.type === "rejected") {
    next.armed = false;
    next.starting = false;
    next.blocked = event.reason;
    next.watchAttached = false;
    effect = { clearWatch: state.watchAttached, ensureWatch: false };
  } else if (event.type === "watch-on") {
    if (next.armed && !next.explicitStop) next.watchAttached = true;
  } else if (event.type === "watch-callback") {
    if (next.armed) next.lastWatchCallbackAt = now;
  } else if (event.type === "accepted") {
    if (next.armed) {
      next.lastAcceptedAt = now;
      next.transportDown = false;
      next.watchFailed = false;
      next.starting = false;
    }
  } else if (event.type === "post-failed" || event.type === "offline") {
    if (next.armed) next.transportDown = true;
  } else if (event.type === "online") {
    next.transportDown = false;
    if (next.armed && !next.explicitStop && !next.permissionDenied && !next.watchAttached) {
      next.starting = true;
      next.attemptAt = now;
      next.watchFailed = false;
      effect = { clearWatch: false, ensureWatch: true };
    }
  } else if (event.type === "watch-error") {
    next.watchAttached = false;
    next.watchFailed = true;
    next.starting = false;
    next.permissionDenied = event.permission;
    effect = { clearWatch: false, ensureWatch: false };
  } else if (event.type === "hidden") {
    next.pageVisible = false;
  } else if (event.type === "visible") {
    next.pageVisible = true;
    next.visibleSince = now;
    if (next.armed && !next.explicitStop && !next.permissionDenied && !next.watchAttached) {
      next.starting = true;
      next.watchFailed = false;
      next.attemptAt = now;
      effect = { clearWatch: false, ensureWatch: true };
    }
  } else if (event.type === "server") {
    if (next.explicitStop) {
      effect = none;
    } else if (!event.sharing || !event.tokenMatches) {
      const drop = next.watchAttached;
      next.armed = false;
      next.starting = false;
      next.watchAttached = false;
      if (!event.sharing) next.sessionId = null;
      effect = { clearWatch: drop, ensureWatch: false };
    } else {
      next.armed = true;
      next.sessionId = event.sessionId ?? next.sessionId;
      if (event.lastStreamAt != null && (next.lastAcceptedAt == null || event.lastStreamAt > next.lastAcceptedAt)) {
        next.lastAcceptedAt = event.lastStreamAt;
      }
      if (!next.watchAttached && !next.permissionDenied && !next.watchFailed) {
        next.starting = true;
        next.attemptAt = next.attemptAt ?? now;
        effect = { clearWatch: false, ensureWatch: true };
      }
    }
  }
  return { state: next, effect };
}
