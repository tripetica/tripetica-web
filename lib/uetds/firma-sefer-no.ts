function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function snapshotRecord(snapshot: unknown) {
  if (typeof snapshot === "string") {
    try {
      return asRecord(JSON.parse(snapshot));
    } catch {
      return null;
    }
  }
  return asRecord(snapshot);
}

/** Firma Sefer No stored on the notification snapshot. Empty when the submit path never saved it. */
export function readStoredFirmaSeferNo(snapshot: unknown) {
  const row = snapshotRecord(snapshot);
  const ministry = asRecord(row?.ministry);
  const trip = asRecord(row?.trip);
  return text(ministry?.firmaSeferNo) || text(trip?.firmaSeferNo);
}

export function readStoredMinistrySeferRef(snapshot: unknown) {
  const row = snapshotRecord(snapshot);
  return text(asRecord(row?.ministry)?.seferReferansNo);
}

/**
 * Keep the original Firma Sefer No and ministry sefer reference.
 * A later form payload cannot replace, clear, or invent either identity.
 */
export function lockUetdsNotificationIdentities<T extends Record<string, unknown>>(previous: unknown, next: T): T {
  const prev = snapshotRecord(previous) ?? {};
  const prevMinistry = asRecord(prev.ministry) ?? {};
  const prevTrip = asRecord(prev.trip) ?? {};
  const nextMinistry = { ...(asRecord(next.ministry) ?? {}) };
  const nextTrip = asRecord(next.trip);
  const firmaSeferNo = text(prevMinistry.firmaSeferNo) || text(prevTrip.firmaSeferNo);
  const seferReferansNo = text(prevMinistry.seferReferansNo);
  const reservationId = text(prev.reservationId);
  if (firmaSeferNo) nextMinistry.firmaSeferNo = firmaSeferNo;
  else delete nextMinistry.firmaSeferNo;
  if (seferReferansNo) nextMinistry.seferReferansNo = seferReferansNo;
  else delete nextMinistry.seferReferansNo;
  const trip = nextTrip ? { ...nextTrip } : null;
  if (trip) {
    if (text(prevTrip.firmaSeferNo)) trip.firmaSeferNo = text(prevTrip.firmaSeferNo);
    else delete trip.firmaSeferNo;
  }
  return {
    ...next,
    reservationId: reservationId || null,
    ...(trip ? { trip } : {}),
    ministry: nextMinistry,
  };
}
