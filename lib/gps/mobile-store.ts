import "server-only";

import { getPool, query } from "@/lib/db/postgres";
import { acceptMobilePoint, MOBILE_GPS_FRESH_MS, mobileFixFresh, mobileShareAllowed } from "@/lib/gps/mobile";
import { isUetdsDriverSubscriptionEntitled } from "@/lib/uetds/driver-subscription";
import { getDriverUetdsSubscription } from "@/lib/uetds/driver-subscription-store";
import { annotateMobileSpeeds, resolveMobileSpeed, shouldStoreMobilePoint, type MobileSpeedFix } from "@/lib/gps/mobile-speed";
import { normalizeEmail } from "@/lib/uetds/service-subscriptions";

export type MobileActor = {
  surface: "partner" | "driver";
  partnerId: string;
  driverId?: string;
  email?: string;
  isOwner?: boolean;
  clientToken?: string | null;
};

type MatchRow = {
  id: string;
  partner_id: string;
  first_name: string;
  last_name: string;
  status: string;
  service_mobile_gps_enabled: boolean;
  vehicle_id: string | null;
  plate: string | null;
  company_name: string | null;
};

async function matchingDrivers(actor: MobileActor) {
  if (actor.surface === "driver" && actor.driverId) {
    const result = await query<MatchRow>(
      `SELECT d.id, d.partner_id, d.first_name, d.last_name, d.status, d.service_mobile_gps_enabled,
              dv.id AS vehicle_id, dv.plate, uc.short_name AS company_name
         FROM partner_drivers d
         LEFT JOIN partner_fleet_defaults fd ON fd.driver_id = d.id AND fd.partner_id = d.partner_id
         LEFT JOIN partner_vehicles dv ON dv.id = fd.vehicle_id AND dv.deleted_at IS NULL AND dv.status = 'active'
         LEFT JOIN uetds_companies uc ON uc.id = dv.uetds_company_id
        WHERE d.id = $1 AND d.partner_id = $2 AND d.deleted_at IS NULL`,
      [actor.driverId, actor.partnerId],
    );
    return result.rows;
  }
  const email = normalizeEmail(actor.email);
  if (!email) return [];
  const result = await query<MatchRow>(
    `SELECT d.id, d.partner_id, d.first_name, d.last_name, d.status, d.service_mobile_gps_enabled,
            dv.id AS vehicle_id, dv.plate, uc.short_name AS company_name
       FROM partner_drivers d
       LEFT JOIN partner_fleet_defaults fd ON fd.driver_id = d.id AND fd.partner_id = d.partner_id
       LEFT JOIN partner_vehicles dv ON dv.id = fd.vehicle_id AND dv.deleted_at IS NULL AND dv.status = 'active'
       LEFT JOIN uetds_companies uc ON uc.id = dv.uetds_company_id
      WHERE d.partner_id = $1
        AND d.deleted_at IS NULL
        AND lower(btrim(d.email)) = $2`,
    [actor.partnerId, email],
  );
  return result.rows;
}

export async function loadMobileShare(actor: MobileActor) {
  const rows = await matchingDrivers(actor);
  const row = rows.length === 1 ? rows[0] : null;
  const subscription = row ? await getDriverUetdsSubscription(row.id) : null;
  const allowed = mobileShareAllowed({
    matches: rows.length,
    driverActive: row?.status === "active",
    mobileEnabled: Boolean(row?.service_mobile_gps_enabled),
    isOwner: actor.surface === "driver" || actor.isOwner === true,
    subscriptionOpen: subscription
      ? isUetdsDriverSubscriptionEntitled({ enrolled: subscription.enrolled, periods: subscription.periods })
      : false,
  });
  if (!row || !allowed) return null;
  const session = await query<{
    id: string;
    last_fix_at: Date | null;
    last_accuracy_m: string | null;
    share_enabled: boolean;
    client_token: string | null;
  }>(
    `SELECT id, last_fix_at, last_accuracy_m, share_enabled, client_token
       FROM gps_mobile_sessions
      WHERE driver_id = $1 AND status = 'active'
      LIMIT 1`,
    [row.id],
  );
  const active = session.rows[0] ?? null;
  const lastFixAt = active?.last_fix_at?.toISOString() ?? null;
  const enabled = Boolean(active?.share_enabled);
  if (active && enabled) {
    await recordVerifiedStreamLoss({
      partnerId: row.partner_id,
      driverId: row.id,
      vehicleId: row.vehicle_id,
      sessionId: active.id,
    });
  }
  const token = actor.clientToken ?? "";
  return {
    driverId: row.id,
    driverName: `${row.first_name} ${row.last_name}`.trim(),
    partnerId: row.partner_id,
    vehicleId: row.vehicle_id,
    plate: row.plate,
    companyName: row.company_name,
    sessionId: active?.id ?? null,
    sharing: enabled,
    tokenBound: Boolean(active?.client_token),
    tokenMatches: Boolean(active) && (active?.client_token ?? "") === token,
    lastFixAt,
    accuracyM: active?.last_accuracy_m == null ? null : Number(active.last_accuracy_m),
    fresh: mobileFixFresh(lastFixAt),
  };
}

export async function startMobileShare(actor: MobileActor) {
  const share = await loadMobileShare(actor);
  if (!share) return { ok: false as const, error: "forbidden" as const };
  if (actor.surface === "partner" && !share.vehicleId) return { ok: false as const, error: "forbidden" as const };
  const token = actor.clientToken?.trim() ?? "";
  if (!token) return { ok: false as const, error: "forbidden" as const };
  if (share.sessionId && share.sharing && share.tokenMatches) {
    return { ok: true as const, sessionId: share.sessionId, share };
  }
  if (share.sessionId && share.sharing && !share.tokenBound) {
    await query(
      `UPDATE gps_mobile_sessions SET client_token = $2 WHERE id = $1 AND client_token IS NULL`,
      [share.sessionId, token],
    );
    return { ok: true as const, sessionId: share.sessionId, share: { ...share, tokenMatches: true } };
  }
  if (share.sessionId && share.sharing && !share.tokenMatches) {
    return { ok: false as const, error: "other-device" as const };
  }
  if (share.sessionId) {
    await query(
      `UPDATE gps_mobile_sessions
          SET status = 'stopped', stopped_at = NOW(), stop_reason = 'stopped', share_enabled = FALSE
        WHERE id = $1 AND status = 'active'`,
      [share.sessionId],
    );
    await query(
      `INSERT INTO gps_mobile_events (partner_id, driver_id, vehicle_id, session_id, kind)
       SELECT $1, $2, $3, $4, 'stopped'
        WHERE NOT EXISTS (
          SELECT 1 FROM gps_mobile_events
           WHERE session_id = $4 AND kind = 'stopped'
        )`,
      [share.partnerId, share.driverId, share.vehicleId, share.sessionId],
    );
  }
  const inserted = await query<{ id: string }>(
    `INSERT INTO gps_mobile_sessions (partner_id, driver_id, vehicle_id, surface, status, share_enabled, client_token)
     VALUES ($1, $2, $3, $4, 'active', TRUE, $5)
     RETURNING id`,
    [share.partnerId, share.driverId, share.vehicleId, actor.surface, token],
  );
  const sessionId = inserted.rows[0]?.id;
  if (!sessionId) return { ok: false as const, error: "failed" as const };
  await query(
    `INSERT INTO gps_mobile_events (partner_id, driver_id, vehicle_id, session_id, kind)
     VALUES ($1, $2, $3, $4, 'started')`,
    [share.partnerId, share.driverId, share.vehicleId, sessionId],
  );
  return { ok: true as const, sessionId, share: { ...share, sessionId, sharing: true } };
}

export async function stopMobileShare(actor: MobileActor, reason: "stopped" | "permission_denied" | "stream_lost" | "stream_resumed") {
  const share = await loadMobileShare(actor);
  if (!share?.sessionId) return { ok: false as const, error: "forbidden" as const };
  if (reason === "stopped") {
    await query(
      `UPDATE gps_mobile_sessions
          SET status = 'stopped', stopped_at = NOW(), stop_reason = 'stopped', share_enabled = FALSE
        WHERE id = $1 AND status = 'active'`,
      [share.sessionId],
    );
  }
  if (reason === "stream_lost") {
    await recordVerifiedStreamLoss({
      partnerId: share.partnerId,
      driverId: share.driverId,
      vehicleId: share.vehicleId,
      sessionId: share.sessionId,
    });
    return { ok: true as const };
  }
  if (reason === "stream_resumed") {
    return { ok: true as const };
  }
  await query(
    `INSERT INTO gps_mobile_events (partner_id, driver_id, vehicle_id, session_id, kind)
     SELECT $1, $2, $3, $4, $5
      WHERE (
        SELECT kind FROM gps_mobile_events
         WHERE session_id = $4
         ORDER BY created_at DESC
         LIMIT 1
      ) IS DISTINCT FROM $5`,
    [share.partnerId, share.driverId, share.vehicleId, share.sessionId, reason],
  );
  return { ok: true as const };
}

async function recordVerifiedStreamLoss(input: {
  partnerId: string;
  driverId: string;
  vehicleId: string | null;
  sessionId: string;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM gps_mobile_sessions WHERE id = $1 FOR UPDATE`, [input.sessionId]);
    const heard = await client.query<{ heard: Date | null }>(
      `SELECT GREATEST(
          session.last_stream_at,
          (SELECT MAX(position.received_at) FROM gps_mobile_positions position WHERE position.session_id = session.id)
        ) AS heard
         FROM gps_mobile_sessions session
        WHERE session.id = $1 AND session.share_enabled = TRUE AND session.status = 'active'`,
      [input.sessionId],
    );
    const at = heard.rows[0]?.heard ?? null;
    if (!at || Date.now() - at.getTime() <= MOBILE_GPS_FRESH_MS) {
      await client.query("COMMIT");
      return;
    }
    await client.query(
      `INSERT INTO gps_mobile_events (partner_id, driver_id, vehicle_id, session_id, kind, created_at)
       SELECT $1, $2, $3, $4, 'stream_lost', $5::timestamptz + INTERVAL '2 minutes'
        WHERE NOT EXISTS (
          SELECT 1 FROM gps_mobile_events
           WHERE session_id = $4
             AND kind = 'stream_lost'
             AND created_at >= $5::timestamptz
        )`,
      [input.partnerId, input.driverId, input.vehicleId, input.sessionId, at],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function recordVerifiedStreamResume(input: {
  partnerId: string;
  driverId: string;
  vehicleId: string | null;
  sessionId: string;
}) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT id FROM gps_mobile_sessions WHERE id = $1 FOR UPDATE`, [input.sessionId]);
    await client.query(
      `INSERT INTO gps_mobile_events (partner_id, driver_id, vehicle_id, session_id, kind)
       SELECT $1, $2, $3, $4, 'stream_resumed'
        WHERE (
          SELECT kind FROM gps_mobile_events
           WHERE session_id = $4
           ORDER BY created_at DESC
           LIMIT 1
        ) = 'stream_lost'
          AND EXISTS (
            SELECT 1 FROM gps_mobile_positions position
             WHERE position.session_id = $4
               AND position.received_at > (
                 SELECT created_at FROM gps_mobile_events
                  WHERE session_id = $4 AND kind = 'stream_lost'
                  ORDER BY created_at DESC
                  LIMIT 1
               )
          )`,
      [input.partnerId, input.driverId, input.vehicleId, input.sessionId],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function storeMobilePoint(actor: MobileActor, input: {
  sessionId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
  accuracyM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
}) {
  if (!acceptMobilePoint(input)) return { ok: false as const, error: "invalid" as const };
  const share = await loadMobileShare(actor);
  if (!share?.sessionId || share.sessionId !== input.sessionId || !share.sharing) {
    return { ok: false as const, error: "forbidden" as const };
  }
  const token = actor.clientToken ?? "";
  if (share.tokenBound && !share.tokenMatches) {
    return { ok: false as const, error: "forbidden" as const };
  }
  if (!share.tokenBound && token) {
    await query(
      `UPDATE gps_mobile_sessions SET client_token = $2 WHERE id = $1 AND client_token IS NULL`,
      [share.sessionId, token],
    );
  }
  const previous = await query<{ vehicle_id: string | null }>(
    `SELECT vehicle_id FROM gps_mobile_sessions WHERE id = $1`,
    [share.sessionId],
  );
  if ((previous.rows[0]?.vehicle_id ?? null) !== share.vehicleId) {
    await query(
      `INSERT INTO gps_mobile_events (partner_id, driver_id, vehicle_id, session_id, kind)
       VALUES ($1, $2, $3, $4, 'vehicle_changed')`,
      [share.partnerId, share.driverId, share.vehicleId, share.sessionId],
    );
  }
  const prior = await query<{ recorded_at: Date; latitude: number; longitude: number; accuracy_m: string | null }>(
    `SELECT recorded_at, latitude, longitude, accuracy_m::text
       FROM gps_mobile_positions
      WHERE session_id = $1
      ORDER BY recorded_at DESC
      LIMIT 1`,
    [share.sessionId],
  );
  const currentFix: MobileSpeedFix = {
    at: Date.parse(input.recordedAt),
    latitude: input.latitude,
    longitude: input.longitude,
    accuracyM: input.accuracyM,
  };
  const priorRow = prior.rows[0];
  const previousFix: MobileSpeedFix | null = priorRow ? {
    at: priorRow.recorded_at.getTime(),
    latitude: Number(priorRow.latitude),
    longitude: Number(priorRow.longitude),
    accuracyM: priorRow.accuracy_m == null ? null : Number(priorRow.accuracy_m),
  } : null;
  if (previousFix && currentFix.at + 500 < previousFix.at) {
    return { ok: true as const };
  }
  const speed = resolveMobileSpeed({
    reportedMps: input.speedMps,
    previous: previousFix,
    current: currentFix,
  });
  const storePoint = shouldStoreMobilePoint({
    previous: previousFix,
    current: currentFix,
    reportedMps: input.speedMps,
  });
  await query(
    `UPDATE gps_mobile_sessions
        SET last_stream_at = NOW(),
            last_accuracy_m = COALESCE($2, last_accuracy_m),
            vehicle_id = $3
      WHERE id = $1`,
    [share.sessionId, input.accuracyM, share.vehicleId],
  );
  if (!storePoint) return { ok: true as const };
  const insertedPoint = await getPool().query<{ id: string }>(
    `INSERT INTO gps_mobile_positions (
       session_id, partner_id, driver_id, vehicle_id, recorded_at, latitude, longitude, accuracy_m, speed_mps, heading_deg, speed_source
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING id`,
    [
      share.sessionId,
      share.partnerId,
      share.driverId,
      share.vehicleId,
      new Date(input.recordedAt),
      input.latitude,
      input.longitude,
      input.accuracyM,
      speed.speedMps,
      input.headingDeg,
      speed.source,
    ],
  );
  await query(
    `UPDATE gps_mobile_sessions
        SET last_fix_at = $2
      WHERE id = $1`,
    [share.sessionId, new Date(input.recordedAt)],
  );
  if (insertedPoint.rows[0]?.id) {
    await query(
      `INSERT INTO gps_mobile_events (partner_id, driver_id, vehicle_id, session_id, kind)
       SELECT $1, $2, $3, $4, 'first_fix'
        WHERE NOT EXISTS (
          SELECT 1 FROM gps_mobile_events WHERE session_id = $4 AND kind = 'first_fix'
        )`,
      [share.partnerId, share.driverId, share.vehicleId, share.sessionId],
    );
  }
  await recordVerifiedStreamResume({
    partnerId: share.partnerId,
    driverId: share.driverId,
    vehicleId: share.vehicleId,
    sessionId: share.sessionId,
  });
  return { ok: true as const };
}

export async function listMobileFleet(partnerId: string) {
  const result = await query<{
    id: string;
    driver_id: string;
    driver_name: string;
    plate: string | null;
    latitude: number | null;
    longitude: number | null;
    speed_mps: string | null;
    heading_deg: string | null;
    recorded_at: Date | null;
    received_at: Date | null;
    last_stream_at: Date | null;
    accuracy_m: string | null;
  }>(
    `SELECT DISTINCT ON (d.id)
            session.id,
            d.id AS driver_id,
            trim(d.first_name || ' ' || d.last_name) AS driver_name,
            vehicle.plate,
            position.latitude,
            position.longitude,
            position.speed_mps::text AS speed_mps,
            position.heading_deg::text AS heading_deg,
            position.recorded_at,
            position.received_at,
            session.last_stream_at,
            position.accuracy_m::text AS accuracy_m
       FROM partner_drivers d
       JOIN gps_mobile_positions position ON position.driver_id = d.id AND position.partner_id = d.partner_id
       JOIN gps_mobile_sessions session ON session.id = position.session_id
       LEFT JOIN partner_vehicles vehicle ON vehicle.id = position.vehicle_id
      WHERE d.partner_id = $1
        AND d.deleted_at IS NULL
        AND d.status = 'active'
        AND d.service_mobile_gps_enabled
        AND position.latitude BETWEEN -90 AND 90
        AND position.longitude BETWEEN -180 AND 180
      ORDER BY d.id, position.recorded_at DESC`,
    [partnerId],
  );
  const recent = await query<{
    driver_id: string;
    recorded_at: Date;
    latitude: number;
    longitude: number;
    speed_mps: string | null;
  }>(
    `SELECT driver_id, recorded_at, latitude, longitude, speed_mps::text
       FROM (
         SELECT position.driver_id, position.recorded_at, position.latitude, position.longitude, position.speed_mps,
                row_number() OVER (PARTITION BY position.driver_id ORDER BY position.recorded_at DESC) AS n
           FROM gps_mobile_positions position
          WHERE position.partner_id = $1
            AND position.recorded_at > NOW() - INTERVAL '20 minutes'
       ) recent
      WHERE n <= 40
      ORDER BY driver_id, recorded_at`,
    [partnerId],
  );
  const recentByDriver = new Map<string, { at: number; latitude: number; longitude: number; speedMps: number | null }[]>();
  for (const row of recent.rows) {
    const list = recentByDriver.get(row.driver_id) ?? [];
    list.push({
      at: row.recorded_at.getTime(),
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      speedMps: row.speed_mps == null ? null : Number(row.speed_mps),
    });
    recentByDriver.set(row.driver_id, list);
  }
  return result.rows.flatMap((row) => {
    const recordedAt = row.recorded_at?.toISOString() ?? null;
    const receivedAt = row.received_at?.toISOString() ?? recordedAt;
    const streamAt = row.last_stream_at?.toISOString() ?? receivedAt;
    return [{
      id: row.id,
      plate: row.plate,
      deviceCode: row.driver_name,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      speedMps: row.speed_mps == null ? null : Number(row.speed_mps),
      headingDeg: row.heading_deg == null ? null : Number(row.heading_deg),
      recordedAt,
      receivedAt,
      lastHeartbeatAt: streamAt,
      recent: recentByDriver.get(row.driver_id) ?? [],
      gnssFix: true,
      source: "mobile" as const,
      driverName: row.driver_name,
      accuracyM: row.accuracy_m == null ? null : Number(row.accuracy_m),
    }];
  });
}

export async function listMobileRoute(input: { sessionId: string; partnerId: string; from: Date; to: Date }) {
  const result = await query<{
    id: string;
    recorded_at: Date;
    received_at: Date;
    latitude: number;
    longitude: number;
    speed_mps: string | null;
    speed_source: "measured" | "estimated" | null;
    accuracy_m: string | null;
    heading_deg: string | null;
    plate: string | null;
  }>(
    `SELECT position.id, position.recorded_at, position.received_at, position.latitude, position.longitude,
            position.speed_mps::text, position.speed_source, position.accuracy_m::text, position.heading_deg::text, vehicle.plate
       FROM gps_mobile_positions position
       JOIN gps_mobile_sessions focus ON focus.id = $1 AND focus.partner_id = $2
       LEFT JOIN partner_vehicles vehicle ON vehicle.id = position.vehicle_id
      WHERE position.partner_id = focus.partner_id
        AND (
          (focus.vehicle_id IS NOT NULL AND position.vehicle_id = focus.vehicle_id)
          OR (focus.vehicle_id IS NULL AND position.driver_id = focus.driver_id)
        )
        AND position.recorded_at >= $3
        AND position.recorded_at <= $4
      ORDER BY position.recorded_at`,
    [input.sessionId, input.partnerId, input.from, input.to],
  );
  return annotateMobileSpeeds(result.rows.map((row, index) => ({
    id: row.id,
    seq: index + 1,
    recordedAt: row.recorded_at.toISOString(),
    receivedAt: row.received_at.toISOString(),
    latitude: row.latitude,
    longitude: row.longitude,
    accuracyM: row.accuracy_m == null ? null : Number(row.accuracy_m),
    speedMps: row.speed_mps == null ? null : Number(row.speed_mps),
    speedSource: row.speed_source,
    headingDeg: row.heading_deg == null ? null : Number(row.heading_deg),
    satellites: null,
    hdop: null,
    fixMode: null,
    plate: row.plate,
  })));
}

export async function listMobileSessionEvents(sessionId: string, partnerId: string, range?: { from: Date; to: Date }) {
  const result = await query<{ id: string; kind: string; created_at: Date }>(
    `SELECT id, kind, created_at
       FROM gps_mobile_events
      WHERE partner_id = $2
        AND driver_id = (SELECT driver_id FROM gps_mobile_sessions WHERE id = $1 AND partner_id = $2)
        AND ($3::timestamptz IS NULL OR created_at >= $3)
        AND ($4::timestamptz IS NULL OR created_at < $4)
      ORDER BY created_at DESC
      LIMIT 2000`,
    [sessionId, partnerId, range?.from ?? null, range?.to ?? null],
  );
  return result.rows.map((row) => ({ id: row.id, kind: row.kind, createdAt: row.created_at.toISOString() }));
}

export async function listMobileEvents(driverId: string, partnerId: string) {
  const result = await query<{ kind: string; created_at: Date }>(
    `SELECT kind, created_at
       FROM gps_mobile_events
      WHERE driver_id = $1 AND partner_id = $2
      ORDER BY created_at DESC
      LIMIT 100`,
    [driverId, partnerId],
  );
  return result.rows.map((row) => ({ kind: row.kind, createdAt: row.created_at.toISOString() }));
}
