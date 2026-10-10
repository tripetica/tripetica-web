export const GPS_DWELL_RADIUS_M = 50;
export const GPS_PROGRESS_M = 40;
export const GPS_DEPARTURE_SAMPLES = 3;
export const GPS_SHORT_STOP_MS = 20_000;
export const GPS_STILL_MS = 5 * 60 * 1000;
export const GPS_CONTINUITY_GAP_MS = 120_000;

export type GpsMotionKind = "moving" | "stopped" | "still" | "unknown";

export type GpsMotionFix = {
  at: number;
  latitude: number;
  longitude: number;
  speedMps: number | null;
};

export type GpsMotionView = {
  kind: GpsMotionKind;
  latitude: number;
  longitude: number;
  measuredAt: number;
  liveSpeedMps: number | null;
};

type Label = "anchor" | "travel" | "skip";

export function gpsDistanceMeters(
  latitude: number,
  longitude: number,
  otherLatitude: number,
  otherLongitude: number,
) {
  const earth = 6_371_000;
  const fromLat = (latitude * Math.PI) / 180;
  const toLat = (otherLatitude * Math.PI) / 180;
  const dLat = ((otherLatitude - latitude) * Math.PI) / 180;
  const dLon = ((otherLongitude - longitude) * Math.PI) / 180;
  const step = Math.sin(dLat / 2) ** 2
    + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(step)));
}

export function gpsPathMeters(fixes: readonly GpsMotionFix[]) {
  let total = 0;
  for (let index = 1; index < fixes.length; index += 1) {
    const previous = fixes[index - 1];
    const current = fixes[index];
    if (!previous || !current) continue;
    total += gpsDistanceMeters(previous.latitude, previous.longitude, current.latitude, current.longitude);
  }
  return total;
}

export function gpsDisplayTrack(fixes: readonly GpsMotionFix[]) {
  const ordered = orderFixes(fixes);
  const shown: GpsMotionFix[] = [];
  for (const run of continuityRuns(ordered)) {
    const labels = labelRun(run);
    run.forEach((fix, index) => {
      if (labels[index] !== "skip") shown.push(fix);
    });
  }
  return shown;
}

export function gpsMotionView(fixes: readonly GpsMotionFix[], at: number): GpsMotionView | null {
  if (!Number.isFinite(at)) return null;
  const ordered = orderFixes(fixes).filter((fix) => fix.at <= at + 1_000);
  const last = ordered[ordered.length - 1];
  if (!last) return null;
  if (at - last.at > GPS_CONTINUITY_GAP_MS) {
    return {
      kind: "unknown",
      latitude: last.latitude,
      longitude: last.longitude,
      measuredAt: last.at,
      liveSpeedMps: null,
    };
  }
  const run = continuityRuns(ordered).at(-1) ?? [last];
  const labels = labelRun(run);
  const kind = kindAt(run, labels);
  const shown = gpsDisplayTrack(run).at(-1) ?? last;
  return {
    kind,
    latitude: shown.latitude,
    longitude: shown.longitude,
    measuredAt: last.at,
    liveSpeedMps: kind === "moving" ? last.speedMps : null,
  };
}

function orderFixes(fixes: readonly GpsMotionFix[]) {
  return fixes.filter((fix) => (
    Number.isFinite(fix.at)
    && Number.isFinite(fix.latitude)
    && Number.isFinite(fix.longitude)
    && fix.latitude >= -90
    && fix.latitude <= 90
    && fix.longitude >= -180
    && fix.longitude <= 180
  )).slice().sort((left, right) => left.at - right.at || left.latitude - right.latitude);
}

function continuityRuns(fixes: readonly GpsMotionFix[]) {
  const runs: GpsMotionFix[][] = [];
  for (const fix of fixes) {
    const run = runs[runs.length - 1];
    const previous = run?.[run.length - 1];
    if (!run || !previous || fix.at - previous.at > GPS_CONTINUITY_GAP_MS) {
      runs.push([fix]);
    } else {
      run.push(fix);
    }
  }
  return runs;
}

function labelRun(run: readonly GpsMotionFix[]) {
  const labels: Label[] = run.map(() => "skip");
  if (run.length === 0) return labels;
  labels[0] = "anchor";
  let mode: "dwell" | "travel" = "dwell";
  let anchorIndex = 0;
  for (let index = 1; index < run.length; index += 1) {
    const anchor = run[anchorIndex];
    if (!anchor) continue;
    if (mode === "dwell") {
      const pending = run.slice(anchorIndex + 1, index + 1);
      if (isDeparture(anchor, pending)) {
        mode = "travel";
        const tail = Math.max(GPS_DEPARTURE_SAMPLES, 1);
        for (let cursor = anchorIndex + 1; cursor <= index; cursor += 1) {
          labels[cursor] = cursor > index - tail ? "travel" : "skip";
        }
        anchorIndex = index;
      } else {
        labels[index] = "skip";
      }
      continue;
    }
    const pauseStart = dwellStart(run, anchorIndex, index);
    if (pauseStart !== null) {
      mode = "dwell";
      anchorIndex = pauseStart;
      labels[pauseStart] = "anchor";
      for (let cursor = pauseStart + 1; cursor <= index; cursor += 1) labels[cursor] = "skip";
    } else {
      labels[index] = "travel";
      anchorIndex = index;
    }
  }
  return labels;
}

function isDeparture(anchor: GpsMotionFix, pending: readonly GpsMotionFix[]) {
  if (pending.length < GPS_DEPARTURE_SAMPLES) return false;
  const last = pending[pending.length - 1];
  if (!last) return false;
  const distances = pending.map((fix) => gpsDistanceMeters(anchor.latitude, anchor.longitude, fix.latitude, fix.longitude));
  const lastDistance = distances[distances.length - 1] ?? 0;
  const peak = Math.max(...distances);
  if (lastDistance + 15 < peak) return false;
  if (lastDistance < GPS_PROGRESS_M && peak < GPS_DWELL_RADIUS_M) return false;
  return isProgress(anchor, pending) || lastDistance >= GPS_DWELL_RADIUS_M;
}

function isProgress(origin: GpsMotionFix, points: readonly GpsMotionFix[]) {
  if (points.length < GPS_DEPARTURE_SAMPLES) return false;
  const distances = points.map((fix) => gpsDistanceMeters(origin.latitude, origin.longitude, fix.latitude, fix.longitude));
  const last = distances[distances.length - 1] ?? 0;
  const mid = distances[Math.floor(distances.length / 2)] ?? 0;
  const peak = Math.max(...distances);
  if (last < GPS_PROGRESS_M) return false;
  if (last + 15 < peak) return false;
  if (last + 10 < mid) return false;
  let forward = 0;
  for (let index = 1; index < distances.length; index += 1) {
    if ((distances[index] ?? 0) >= (distances[index - 1] ?? 0) - 8) forward += 1;
  }
  return forward >= Math.ceil((distances.length - 1) * 0.6);
}

function dwellStart(run: readonly GpsMotionFix[], travelIndex: number, index: number) {
  const current = run[index];
  if (!current) return null;
  for (let start = travelIndex; start < index; start += 1) {
    const origin = run[start];
    if (!origin) continue;
    const window = run.slice(start, index + 1);
    const duration = current.at - origin.at;
    if (window.length < 2 || duration < GPS_SHORT_STOP_MS) continue;
    const inside = window.every((fix) => (
      gpsDistanceMeters(origin.latitude, origin.longitude, fix.latitude, fix.longitude) <= GPS_DWELL_RADIUS_M
    ));
    if (!inside || isProgress(origin, window.slice(1))) continue;
    return start;
  }
  return null;
}

function kindAt(run: readonly GpsMotionFix[], labels: readonly Label[]): GpsMotionKind {
  const last = run[run.length - 1];
  if (!last || run.length < 2) return "unknown";
  const lastLabel = labels[labels.length - 1];
  if (lastLabel === "travel") return "moving";
  let anchorIndex = labels.length - 1;
  while (anchorIndex > 0 && labels[anchorIndex] !== "anchor") anchorIndex -= 1;
  const anchor = run[anchorIndex];
  if (!anchor || labels[anchorIndex] !== "anchor") return "unknown";
  const duration = last.at - anchor.at;
  const samples = run.slice(anchorIndex).filter((_, offset) => labels[anchorIndex + offset] !== "travel");
  if (samples.length < 2 || duration < GPS_SHORT_STOP_MS) return "unknown";
  return duration >= GPS_STILL_MS ? "still" : "stopped";
}
