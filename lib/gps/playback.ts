export const GPS_PLAYBACK_GAP_MS = 120_000;
export const GPS_PLAYBACK_RATES = [1, 5, 10, 30, 60, 120, 200, 300, 400, 500] as const;

export type GpsPlaybackRate = (typeof GPS_PLAYBACK_RATES)[number];

export type GpsPlaybackPoint = {
  recordedAt: string;
  latitude: number;
  longitude: number;
  speedMps: number | null;
  headingDeg: number | null;
};

export type GpsPlaybackFix = {
  at: number;
  latitude: number;
  longitude: number;
  speedMps: number | null;
  headingDeg: number | null;
};

export type GpsPlaybackFrame = {
  at: number;
  latitude: number | null;
  longitude: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  gapMs: number | null;
};

export function playbackFixes(points: GpsPlaybackPoint[]) {
  return points.flatMap((point) => {
    const at = Date.parse(point.recordedAt);
    if (!Number.isFinite(at) || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
      return [];
    }
    return [{
      at,
      latitude: point.latitude,
      longitude: point.longitude,
      speedMps: finiteOrNull(point.speedMps),
      headingDeg: finiteOrNull(point.headingDeg),
    } satisfies GpsPlaybackFix];
  }).sort((left, right) => left.at - right.at);
}

export function playbackGapLimit(fixes: GpsPlaybackFix[]) {
  const spans: number[] = [];
  for (let index = 1; index < fixes.length; index += 1) {
    const span = fixes[index].at - fixes[index - 1].at;
    if (span > 0) spans.push(span);
  }
  if (spans.length < 3) {
    return GPS_PLAYBACK_GAP_MS;
  }
  spans.sort((left, right) => left - right);
  const typical = spans[Math.floor((spans.length - 1) * 0.25)] ?? 0;
  return Math.max(GPS_PLAYBACK_GAP_MS, typical * 3);
}

export function playbackSegments(fixes: GpsPlaybackFix[], gapLimit = playbackGapLimit(fixes)) {
  if (fixes.length === 0) {
    return [];
  }
  const segments: GpsPlaybackFix[][] = [[fixes[0]]];
  for (let index = 1; index < fixes.length; index += 1) {
    const previous = fixes[index - 1];
    const current = fixes[index];
    const segment = segments[segments.length - 1];
    if (!previous || !current || !segment) continue;
    if (current.at - previous.at > gapLimit) {
      segments.push([current]);
    } else {
      segment.push(current);
    }
  }
  return segments;
}

export function playbackFrame(fixes: GpsPlaybackFix[], at: number, gapLimit = playbackGapLimit(fixes)): GpsPlaybackFrame {
  const empty: GpsPlaybackFrame = {
    at,
    latitude: null,
    longitude: null,
    speedMps: null,
    headingDeg: null,
    gapMs: null,
  };
  if (fixes.length === 0 || !Number.isFinite(at)) {
    return empty;
  }
  const index = fixIndexAtOrBefore(fixes, at);
  if (index < 0) {
    const wait = fixes[0].at - at;
    return { ...empty, gapMs: wait > gapLimit ? wait : null };
  }
  const current = fixes[index];
  const next = fixes[index + 1];
  if (!next) {
    const idle = at - current.at;
    return hold(current, at, idle > gapLimit ? idle : null);
  }
  const span = next.at - current.at;
  if (span <= 0) {
    return hold(next, at, null);
  }
  if (span > gapLimit) {
    return hold(current, at, span);
  }
  const ratio = (at - current.at) / span;
  return {
    at,
    latitude: current.latitude + (next.latitude - current.latitude) * ratio,
    longitude: current.longitude + (next.longitude - current.longitude) * ratio,
    speedMps: current.speedMps,
    headingDeg: current.headingDeg,
    gapMs: null,
  };
}

export function playbackShownSample(fixes: GpsPlaybackFix[], at: number, gapLimit = playbackGapLimit(fixes)): GpsPlaybackFrame {
  const frame = playbackFrame(fixes, at, gapLimit);
  if (frame.latitude !== null && frame.longitude !== null) {
    return frame;
  }
  const first = fixes[0];
  if (!first) {
    return frame;
  }
  return {
    at: first.at,
    latitude: first.latitude,
    longitude: first.longitude,
    speedMps: first.speedMps,
    headingDeg: first.headingDeg,
    gapMs: frame.gapMs,
  };
}

export function advancePlaybackCursor(cursor: number, elapsedMs: number, rate: number, end: number) {
  if (!Number.isFinite(cursor) || !Number.isFinite(end)) {
    return cursor;
  }
  const step = Math.max(0, elapsedMs) * (Number.isFinite(rate) && rate > 0 ? rate : 1);
  return Math.min(end, cursor + step);
}

export function nextPlaybackAt(fixes: GpsPlaybackFix[], at: number) {
  for (const fix of fixes) {
    if (fix.at > at + 0.5) {
      return fix.at;
    }
  }
  return null;
}

export function previousPlaybackAt(fixes: GpsPlaybackFix[], at: number) {
  let found: number | null = null;
  for (const fix of fixes) {
    if (fix.at < at - 0.5) {
      found = fix.at;
    } else {
      break;
    }
  }
  return found;
}

export function playbackGapMinutes(gapMs: number | null) {
  if (gapMs === null || gapMs <= GPS_PLAYBACK_GAP_MS) {
    return null;
  }
  return Math.max(1, Math.round(gapMs / 60_000));
}

function hold(fix: GpsPlaybackFix, at: number, gapMs: number | null): GpsPlaybackFrame {
  return {
    at,
    latitude: fix.latitude,
    longitude: fix.longitude,
    speedMps: fix.speedMps,
    headingDeg: fix.headingDeg,
    gapMs,
  };
}

function fixIndexAtOrBefore(fixes: GpsPlaybackFix[], at: number) {
  let low = 0;
  let high = fixes.length - 1;
  let found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (fixes[mid].at <= at) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return found;
}

function finiteOrNull(value: number | null) {
  return value !== null && Number.isFinite(value) ? value : null;
}
