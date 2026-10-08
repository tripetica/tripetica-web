export function formatGraceClock(totalSeconds: number) {
  const total = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function graceSecondsRemaining(baseSeconds: number, syncedAtMs: number, nowMs: number) {
  const elapsed = Math.max(0, Math.floor((nowMs - syncedAtMs) / 1000));
  return Math.max(0, Math.floor(baseSeconds) - elapsed);
}

export function cameraNeedsLowBatteryConfirm(state: string | null) {
  return state === "saving";
}
