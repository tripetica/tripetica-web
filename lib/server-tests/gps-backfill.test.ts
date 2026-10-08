import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { databaseNameFromUrl } from "@/lib/db/database-target";
import { GPS_MAX_BATCH } from "@/lib/gps/contract";
import { playbackFixes, playbackFrame, playbackGapLimit } from "@/lib/gps/playback";
import { gpsPresence } from "@/lib/gps/presence";

function loadEnv(path: string) {
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnv(new URL("../../.env.development.local", import.meta.url).pathname);
process.env.EXPECTED_DATABASE = "tripetica_dev";

const devDatabase = process.env.DATABASE_URL ? databaseNameFromUrl(process.env.DATABASE_URL) === "tripetica_dev" : false;

test("store-and-forward backfill on DEV", { skip: devDatabase ? false : "DEV database is not selected" }, async () => {
  const { getPool, query } = await import("@/lib/db/postgres");
  const { createGpsDevice, getGpsLive, listGpsRoute } = await import("@/lib/gps/queries");
  const anchor = await query<{ partner_id: string; vehicle_id: string }>(
    `SELECT partner_id, vehicle_id
     FROM gps_devices
     WHERE device_code = 'TPT-1CDBD4475D88'
       AND vehicle_id IS NOT NULL
     LIMIT 1`,
  );
  const owner = anchor.rows[0];
  assert.ok(owner);
  const code = `TPT-${randomBytes(6).toString("hex").toUpperCase()}`;
  const created = await createGpsDevice({
    partnerId: owner.partner_id,
    vehicleId: owner.vehicle_id,
    deviceCode: code,
    label: "backfill probe",
    imei: null,
    assignedBy: "backfill-test",
  });
  const heartbeatAt = new Date(Date.now() - 30_000);
  const base = Date.now() - 5 * 60_000;
  const at = (minutes: number) => new Date(base + minutes * 60_000).toISOString();
  try {
    await query(
      `UPDATE gps_device_status SET last_heartbeat_at = $2 WHERE device_id = $1`,
      [created.id, heartbeatAt.toISOString()],
    );
    const denied = await postTelemetry(null, { points: [fix(1, at(0), 41.1, 29.1, 1)] });
    assert.equal(denied.status, 401);

    const liveEarly = await postTelemetry(created.token, {
      points: [fix(1, at(0), 41.1, 29.1, 1, 15)],
    });
    assert.equal(liveEarly.status, 200);
    assert.equal(liveEarly.body.ok, true);
    assert.deepEqual(liveEarly.body.accepted, [1]);
    assert.equal(liveEarly.body.live_advanced, true);

    const liveNow = await postTelemetry(created.token, {
      points: [fix(5, at(5), 41.5, 29.5, 12, 90)],
    });
    assert.equal(liveNow.status, 200);
    assert.deepEqual(liveNow.body.accepted, [5]);
    assert.equal(liveNow.body.live_advanced, true);
    assert.equal(liveNow.body.acked_through, 1);

    const before = await listGpsRoute({
      deviceId: created.id,
      partnerId: owner.partner_id,
      vehicleId: owner.vehicle_id,
      from: new Date(base - 60_000),
      to: new Date(base + 10 * 60_000),
    });
    const beforeFixes = playbackFixes(before.points.map(playbackPoint));
    const hole = playbackFrame(beforeFixes, Date.parse(at(3)), playbackGapLimit(beforeFixes));
    assert.equal(hole.latitude, 41.1);
    assert.ok(hole.gapMs !== null);

    const backfill = {
      points: [
        fix(4, at(4), 41.4, 29.4, 8, 40),
        fix(2, at(2), 41.2, 29.2, 4, 20),
        fix(3, at(3), 41.3, 29.3, 6, 30),
      ],
    };
    const filled = await postTelemetry(created.token, backfill);
    assert.equal(filled.status, 200);
    assert.deepEqual(filled.body.accepted, [2, 3, 4]);
    assert.equal(filled.body.live_advanced, false);
    assert.equal(filled.body.acked_through, 5);
    for (let retry = 0; retry < 4; retry += 1) {
      const again = await postTelemetry(created.token, backfill);
      assert.equal(again.status, 200);
      assert.deepEqual(again.body.duplicate, [2, 3, 4]);
      assert.deepEqual(again.body.accepted, []);
      assert.equal(again.body.live_advanced, false);
    }

    const mixed = await postTelemetry(created.token, {
      points: [
        fix(8, at(1.5), 41.15, 29.15, 2, 12),
        fix(2, at(2), 41.99, 29.99, 9, 1),
        fix(6, at(5.5), 41.6, 29.6, 14, 100),
        { seq: 9, gnss_time: at(5.2), lat: 0, lon: 0 },
      ],
    });
    assert.equal(mixed.status, 200);
    assert.deepEqual(mixed.body.accepted, [6, 8]);
    assert.deepEqual(mixed.body.duplicate, [2]);
    assert.deepEqual(mixed.body.rejected, [{ seq: 9, error: "invalid_coordinate" }]);
    assert.equal(mixed.body.live_advanced, true);

    const counts = await query<{ seq: string; total: number }>(
      `SELECT seq::text AS seq, COUNT(*)::int AS total
       FROM gps_positions
       WHERE device_id = $1
       GROUP BY seq
       ORDER BY seq`,
      [created.id],
    );
    assert.deepEqual(counts.rows.map((row) => [Number(row.seq), row.total]), [
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 1],
      [6, 1],
      [8, 1],
    ]);
    const stored = await query<{ seq: string; recorded_at: Date; received_at: Date; latitude: string }>(
      `SELECT seq::text AS seq, recorded_at, received_at, latitude::text AS latitude
       FROM gps_positions
       WHERE device_id = $1
       ORDER BY recorded_at, seq`,
      [created.id],
    );
    assert.deepEqual(stored.rows.map((row) => Number(row.seq)), [1, 8, 2, 3, 4, 5, 6]);
    const backfilled = stored.rows.find((row) => Number(row.seq) === 2);
    assert.ok(backfilled);
    assert.equal(backfilled.recorded_at.toISOString(), at(2));
    assert.ok(backfilled.received_at.getTime() > backfilled.recorded_at.getTime());
    assert.equal(Number(backfilled.latitude), 41.2);

    const status = await query<{ latitude: string; recorded_at: Date; last_heartbeat_at: Date }>(
      `SELECT latitude::text AS latitude, recorded_at, last_heartbeat_at
       FROM gps_device_status
       WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(Number(status.rows[0]?.latitude), 41.6);
    assert.equal(status.rows[0]?.recorded_at.toISOString(), at(5.5));
    assert.equal(status.rows[0]?.last_heartbeat_at.toISOString(), heartbeatAt.toISOString());
    assert.equal(gpsPresence(status.rows[0]?.last_heartbeat_at ?? null, new Date()), "online");

    const live = await getGpsLive(created.id, owner.partner_id);
    assert.equal(live?.latitude, 41.6);
    assert.equal(live?.longitude, 29.6);
    assert.equal(live?.recordedAt, at(5.5));
    assert.equal(live?.lastHeartbeatAt, heartbeatAt.toISOString());

    const route = await listGpsRoute({
      deviceId: created.id,
      partnerId: owner.partner_id,
      vehicleId: owner.vehicle_id,
      from: new Date(base - 60_000),
      to: new Date(base + 10 * 60_000),
    });
    assert.deepEqual(route.points.map((point) => point.seq), [1, 8, 2, 3, 4, 5, 6]);
    const fixes = playbackFixes(route.points.map(playbackPoint));
    const frame = playbackFrame(fixes, Date.parse(at(3)), playbackGapLimit(fixes));
    assert.equal(frame.latitude, 41.3);
    assert.equal(frame.longitude, 29.3);
    assert.equal(frame.speedMps, 6);
    assert.equal(frame.headingDeg, 30);
    assert.equal(frame.gapMs, null);
    assert.ok(GPS_MAX_BATCH >= route.points.length);
  } finally {
    await query(`DELETE FROM gps_devices WHERE id = $1`, [created.id]);
    const left = await query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM gps_positions WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(left.rows[0]?.total, 0);
    await getPool().end();
  }
});

function fix(seq: number, gnssTime: string, lat: number, lon: number, speed: number, heading = 0) {
  return {
    seq,
    gnss_time: gnssTime,
    lat,
    lon,
    speed_mps: speed,
    heading_deg: heading,
    satellites: 10,
  };
}

function playbackPoint(point: { recordedAt: string; latitude: number; longitude: number; speedMps: number | null; headingDeg: number | null }) {
  return {
    recordedAt: point.recordedAt,
    latitude: point.latitude,
    longitude: point.longitude,
    speedMps: point.speedMps,
    headingDeg: point.headingDeg,
  };
}

async function postTelemetry(token: string | null, body: unknown) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch("http://127.0.0.1:3000/api/device/v1/telemetry", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = await response.json() as {
    ok?: boolean;
    accepted?: number[];
    duplicate?: number[];
    rejected?: { seq: number; error: string }[];
    acked_through?: number;
    live_advanced?: boolean;
  };
  return { status: response.status, body: payload };
}
