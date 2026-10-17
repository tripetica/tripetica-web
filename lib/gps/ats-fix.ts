export const ATS_POSITION_FUTURE_SKEW_MS = 5 * 60 * 1000;

export type AtsFixPoint = {
  id: string;
  measuredAtMs: number;
  latitude: number;
  longitude: number;
};

export type AtsFixTrip = {
  id: string;
  startMs: number;
};

export type AtsDistrictHit =
  | { ok: true; ilKodu: number; ilceMernisKodu: number }
  | { ok: false };

export type AtsUnresolvedFix = {
  id: string;
  measuredAtMs: number;
  latitude: number;
  longitude: number;
};

export type AtsFixChoice<T extends AtsFixPoint> =
  | {
      ok: true;
      point: T;
      district: { ilKodu: number; ilceMernisKodu: number };
      tripIds: string[];
      unresolved: AtsUnresolvedFix[];
    }
  | {
      ok: false;
      reason: "fix_missing" | "fix_before_window" | "district_unresolved";
      unresolved: AtsUnresolvedFix[];
    };

/**
 * Newest real fix that resolves to one official district and falls inside at
 * least one trip's pre-start window. An unresolved newer coordinate is skipped
 * with its own time and position; the older fix keeps its own coordinate,
 * GNSS time, and district. Nothing is relabelled.
 */
export function chooseAtsFixForTrips<T extends AtsFixPoint>(input: {
  pointsNewestFirst: readonly T[];
  trips: readonly AtsFixTrip[];
  nowMs: number;
  maxAgeBeforeStartMs: number;
  resolve: (latitude: number, longitude: number) => AtsDistrictHit;
}): AtsFixChoice<T> {
  const unresolved: AtsUnresolvedFix[] = [];
  let sawPoint = false;
  let sawInWindow = false;
  for (const point of input.pointsNewestFirst) {
    if (!Number.isFinite(point.measuredAtMs) || point.measuredAtMs > input.nowMs + ATS_POSITION_FUTURE_SKEW_MS) {
      continue;
    }
    sawPoint = true;
    const tripIds = input.trips
      .filter((trip) => point.measuredAtMs >= trip.startMs - input.maxAgeBeforeStartMs)
      .map((trip) => trip.id);
    if (tripIds.length === 0) continue;
    sawInWindow = true;
    const district = input.resolve(point.latitude, point.longitude);
    if (!district.ok) {
      unresolved.push({
        id: point.id,
        measuredAtMs: point.measuredAtMs,
        latitude: point.latitude,
        longitude: point.longitude,
      });
      continue;
    }
    return { ok: true, point, district, tripIds, unresolved };
  }
  if (!sawPoint) return { ok: false, reason: "fix_missing", unresolved };
  if (!sawInWindow) return { ok: false, reason: "fix_before_window", unresolved };
  return { ok: false, reason: "district_unresolved", unresolved };
}
