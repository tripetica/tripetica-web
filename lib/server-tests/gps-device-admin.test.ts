import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { NextRequest } from "next/server";
import { databaseNameFromUrl } from "@/lib/db/database-target";
import { GPS_BATTERY_UNCHANGED, parseHeartbeatBody, parseTelemetryBody } from "@/lib/gps/contract";
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

test("ops device inventory on DEV", { skip: devDatabase ? false : "DEV database is not selected" }, async () => {
  const { getPool, query } = await import("@/lib/db/postgres");
  const { authenticateDevice } = await import("@/lib/gps/device-auth");
  const { ingestHeartbeat, ingestTelemetry } = await import("@/lib/gps/ingest");
  const {
    assignGpsDevice,
    createGpsDevice,
    getGpsDevice,
    getGpsLive,
    listGpsDevices,
    listGpsRoute,
    deleteGpsDeviceForActor,
    revokeGpsDeviceToken,
  } = await import("@/lib/gps/queries");
  const { GPS_DEVICE_DELETE_ACTOR_ID } = await import("@/lib/gps/delete-access");
  const before = await query<{ token_hash: string; vehicle_id: string; partner_id: string; positions: number }>(
    `SELECT credential.token_hash,
            device.vehicle_id,
            device.partner_id,
            (SELECT COUNT(*)::int FROM gps_positions position WHERE position.device_id = device.id) AS positions
     FROM gps_devices device
     JOIN gps_device_credentials credential ON credential.device_id = device.id
     WHERE device.device_code = 'TPT-1CDBD4475D88'`,
  );
  const real = before.rows[0];
  assert.ok(real);
  const live = await getGpsLive("399933e8-94d2-4115-bd69-060aa881a22a", real.partner_id);
  assert.equal(live?.latitude !== null, true);
  const history = await listGpsRoute({
    deviceId: "399933e8-94d2-4115-bd69-060aa881a22a",
    partnerId: real.partner_id,
    vehicleId: real.vehicle_id,
    from: new Date("2026-10-06T04:00:00.000Z"),
    to: new Date("2026-10-07T00:00:00.000Z"),
  });
  assert.ok(history.total > 0);
  const vehicles = await query<{ id: string }>(
    `SELECT id FROM partner_vehicles
     WHERE partner_id = $1 AND deleted_at IS NULL AND id <> $2
     ORDER BY plate
     LIMIT 1`,
    [real.partner_id, real.vehicle_id],
  );
  const extraDeviceIds: string[] = [];
  const created = await createGpsDevice({
    partnerId: null,
    vehicleId: null,
    imei: null,
    assignedBy: "device-admin-test",
  });
  try {
    const stock = await getGpsDevice(created.id, null);
    assert.equal(stock?.partnerId, null);
    assert.equal(stock?.vehicleId, null);
    assert.equal(stock?.credentialState, "active");
    assert.match(stock?.deviceCode ?? "", /^TPT-[0-9A-F]{12}$/);
    const spare = await createGpsDevice({
      partnerId: null,
      vehicleId: null,
      imei: null,
      assignedBy: "device-admin-test",
    });
    extraDeviceIds.push(spare.id);
    assert.equal(await deleteGpsDeviceForActor("00000000-0000-4000-8000-000000000000", spare.id), "forbidden");
    assert.equal((await getGpsDevice(spare.id, null))?.id, spare.id);
    assert.equal(await deleteGpsDeviceForActor(GPS_DEVICE_DELETE_ACTOR_ID, spare.id), "deleted");
    assert.equal(await getGpsDevice(spare.id, null), null);
    const spareLeft = await query<{ credentials: number; status_rows: number; assignments: number }>(
      `SELECT
         (SELECT COUNT(*)::int FROM gps_device_credentials WHERE device_id = $1) AS credentials,
         (SELECT COUNT(*)::int FROM gps_device_status WHERE device_id = $1) AS status_rows,
         (SELECT COUNT(*)::int FROM gps_device_assignments WHERE device_id = $1) AS assignments`,
      [spare.id],
    );
    assert.equal(spareLeft.rows[0]?.credentials, 0);
    assert.equal(spareLeft.rows[0]?.status_rows, 0);
    assert.equal(spareLeft.rows[0]?.assignments, 0);
    const other = await query<{ partner_id: string; vehicle_id: string }>(
      `SELECT vehicle.partner_id, vehicle.id AS vehicle_id
         FROM partner_vehicles vehicle
        WHERE vehicle.deleted_at IS NULL
          AND vehicle.id <> $1
        LIMIT 1`,
      [real.vehicle_id],
    );
    const otherPartner = other.rows[0];
    assert.ok(otherPartner);
    const heartDevice = await createGpsDevice({
      partnerId: null,
      vehicleId: null,
      imei: null,
      assignedBy: "device-admin-test",
    });
    extraDeviceIds.push(heartDevice.id);
    await query(`UPDATE gps_device_status SET last_heartbeat_at = NOW() WHERE device_id = $1`, [heartDevice.id]);
    assert.equal(await deleteGpsDeviceForActor(GPS_DEVICE_DELETE_ACTOR_ID, heartDevice.id), "used");
    assert.equal((await getGpsDevice(heartDevice.id, null))?.id, heartDevice.id);
    await query(`DELETE FROM gps_devices WHERE id = $1`, [heartDevice.id]);
    const queued = await createGpsDevice({
      partnerId: otherPartner.partner_id,
      vehicleId: null,
      imei: null,
      assignedBy: "device-admin-test",
    });
    extraDeviceIds.push(queued.id);
    await query(
      `INSERT INTO gps_commands (device_id, partner_id, kind, payload, status, created_by)
       VALUES ($1, $2, 'status', '{}'::jsonb, 'queued', 'ops')`,
      [queued.id, otherPartner.partner_id],
    );
    assert.equal(await deleteGpsDeviceForActor(GPS_DEVICE_DELETE_ACTOR_ID, queued.id), "deleted");
    const applied = await createGpsDevice({
      partnerId: otherPartner.partner_id,
      vehicleId: otherPartner.vehicle_id,
      imei: null,
      assignedBy: "device-admin-test",
    });
    extraDeviceIds.push(applied.id);
    await query(
      `INSERT INTO gps_commands (device_id, partner_id, kind, payload, status, created_by)
       VALUES ($1, $2, 'status', '{}'::jsonb, 'acked', 'ops')`,
      [applied.id, otherPartner.partner_id],
    );
    await query(
      `INSERT INTO gps_positions (device_id, partner_id, vehicle_id, seq, recorded_at, latitude, longitude)
       VALUES ($1, $2, $3, 1, NOW(), 41.01, 29.01)`,
      [applied.id, otherPartner.partner_id, otherPartner.vehicle_id],
    );
    assert.equal(await deleteGpsDeviceForActor(GPS_DEVICE_DELETE_ACTOR_ID, applied.id), "used");
    const appliedLeft = await query<{ positions: number; commands: number }>(
      `SELECT
         (SELECT COUNT(*)::int FROM gps_positions WHERE device_id = $1) AS positions,
         (SELECT COUNT(*)::int FROM gps_commands WHERE device_id = $1) AS commands`,
      [applied.id],
    );
    assert.equal(appliedLeft.rows[0]?.positions, 1);
    assert.equal(appliedLeft.rows[0]?.commands, 1);
    await query(`DELETE FROM gps_devices WHERE id = $1`, [applied.id]);
    const liveId = "399933e8-94d2-4115-bd69-060aa881a22a";
    const liveBefore = await query<{ token_hash: string; positions: number; commands: number; assignments: number }>(
      `SELECT credential.token_hash,
              (SELECT COUNT(*)::int FROM gps_positions WHERE device_id = device.id) AS positions,
              (SELECT COUNT(*)::int FROM gps_commands WHERE device_id = device.id) AS commands,
              (SELECT COUNT(*)::int FROM gps_device_assignments WHERE device_id = device.id) AS assignments
         FROM gps_devices device
         JOIN gps_device_credentials credential ON credential.device_id = device.id
        WHERE device.id = $1`,
      [liveId],
    );
    assert.equal(await deleteGpsDeviceForActor(GPS_DEVICE_DELETE_ACTOR_ID, liveId), "used");
    const liveAfter = await query<{ token_hash: string; positions: number; commands: number; assignments: number }>(
      `SELECT credential.token_hash,
              (SELECT COUNT(*)::int FROM gps_positions WHERE device_id = device.id) AS positions,
              (SELECT COUNT(*)::int FROM gps_commands WHERE device_id = device.id) AS commands,
              (SELECT COUNT(*)::int FROM gps_device_assignments WHERE device_id = device.id) AS assignments
         FROM gps_devices device
         JOIN gps_device_credentials credential ON credential.device_id = device.id
        WHERE device.id = $1`,
      [liveId],
    );
    assert.equal(liveAfter.rows[0]?.token_hash, liveBefore.rows[0]?.token_hash);
    assert.equal(liveAfter.rows[0]?.positions, liveBefore.rows[0]?.positions);
    assert.equal(liveAfter.rows[0]?.commands, liveBefore.rows[0]?.commands);
    assert.equal(liveAfter.rows[0]?.assignments, liveBefore.rows[0]?.assignments);
    assert.equal((await listGpsDevices(real.partner_id)).some((device) => device.id === created.id), false);
    const denied = await ingestTelemetry(created.id, [], []);
    assert.equal(denied.http, 200);
    const parsed = parseTelemetryBody({
      points: [{ seq: 1, gnss_time: new Date(Date.now() - 60_000).toISOString(), lat: 41.1, lon: 29.1, speed_mps: 4, heading_deg: 10 }],
    }, new Date());
    assert.ok(parsed);
    const blocked = await ingestTelemetry(created.id, parsed.points, parsed.rejected);
    assert.equal(blocked.http, 409);

    await assignGpsDevice({
      deviceId: created.id,
      partnerId: real.partner_id,
      vehicleId: real.vehicle_id,
      assignedBy: "device-admin-test",
    });
    assert.equal((await listGpsDevices(real.partner_id)).some((device) => device.id === created.id), true);
    assert.equal(await getGpsDevice(created.id, "00000000-0000-4000-8000-000000000000"), null);
    const accepted = await ingestTelemetry(created.id, parsed.points, parsed.rejected);
    assert.equal(accepted.http, 200);
    if (accepted.http === 200) assert.deepEqual(accepted.accepted, [1]);
    const newer = parseTelemetryBody({
      points: [{ seq: 2, gnss_time: new Date().toISOString(), lat: 41.2, lon: 29.2, speed_mps: 6, heading_deg: 20 }],
    }, new Date());
    assert.ok(newer);
    const livePoint = await ingestTelemetry(created.id, newer.points, newer.rejected);
    assert.equal(livePoint.http, 200);
    const older = parseTelemetryBody({
      points: [{ seq: 3, gnss_time: new Date(Date.now() - 120_000).toISOString(), lat: 41.05, lon: 29.05, speed_mps: 1, heading_deg: 5 }],
    }, new Date());
    assert.ok(older);
    const backfill = await ingestTelemetry(created.id, older.points, older.rejected);
    assert.equal(backfill.http, 200);
    if (backfill.http === 200) assert.equal(backfill.liveAdvanced, false);
    const status = await query<{ latitude: string; vehicle_id: string }>(
      `SELECT status.latitude::text AS latitude, device.vehicle_id
       FROM gps_devices device
       JOIN gps_device_status status ON status.device_id = device.id
       WHERE device.id = $1`,
      [created.id],
    );
    assert.equal(Number(status.rows[0]?.latitude), 41.2);
    const nextVehicle = vehicles.rows[0]?.id ?? null;
    await assignGpsDevice({
      deviceId: created.id,
      partnerId: real.partner_id,
      vehicleId: nextVehicle,
      assignedBy: "device-admin-test",
    });
    const kept = await query<{ vehicle_id: string; total: number }>(
      `SELECT vehicle_id, COUNT(*)::int AS total
       FROM gps_positions
       WHERE device_id = $1 AND seq = 1
       GROUP BY vehicle_id`,
      [created.id],
    );
    assert.equal(kept.rows[0]?.vehicle_id, real.vehicle_id);
    assert.equal(kept.rows[0]?.total, 1);
    const currentRoute = nextVehicle
      ? await listGpsRoute({
          deviceId: created.id,
          partnerId: real.partner_id,
          vehicleId: nextVehicle,
          from: new Date(Date.now() - 3_600_000),
          to: new Date(Date.now() + 60_000),
        })
      : { total: 0, points: [] };
    assert.equal(currentRoute.points.some((point) => point.seq === 1), false);
    const oldRoute = await listGpsRoute({
      deviceId: created.id,
      partnerId: real.partner_id,
      vehicleId: real.vehicle_id,
      from: new Date(Date.now() - 3_600_000),
      to: new Date(Date.now() + 60_000),
    });
    assert.equal(oldRoute.points.some((point) => point.seq === 1), true);
    const heart = await ingestHeartbeat(created.id, {
      firmware: null,
      rssi: -70,
      network: "lte",
      operatorName: null,
      wifiEnabled: null,
      wifiSsid: null,
      wifiClients: null,
      gnssFix: true,
      uptimeSeconds: null,
      simStatus: null,
      lteRegistration: null,
      pppStatus: null,
      naptStatus: null,
      ipAddress: null,
      gnssResponse: null,
      wifiPolicy: null,
      apStatus: null,
      reportedMaxClients: null,
      lastRecoveryReason: null,
      lastModemRecoveryAt: null,
      lastGnssRecoveryAt: null,
      resetReason: null,
      powerSource: null,
      vehicleBatteryVoltage: null,
      accState: null,
      powerMode: null,
      cameraAvailable: null,
      cameraReady: null,
      battery: GPS_BATTERY_UNCHANGED,
    });
    assert.equal(heart.http, 200);
    const beat = await query<{ last_heartbeat_at: Date; firmware: string | null }>(
      `SELECT last_heartbeat_at, firmware FROM gps_device_status WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(gpsPresence(beat.rows[0]?.last_heartbeat_at ?? null, new Date()), "online");
    assert.equal(beat.rows[0]?.firmware, null);
    const reported = parseHeartbeatBody({
      firmware: "0.3.6",
      battery_percent: 97,
      battery_voltage: 4.279,
      charging_inferred: true,
    });
    assert.equal(reported?.battery.percent.kind, "set");
    assert.equal((await ingestHeartbeat(created.id, reported!)).http, 200);
    const stored = await query<{
      battery_percent: number | null;
      battery_voltage: string | null;
      charging_inferred: boolean | null;
      battery_measured_at: Date | null;
    }>(
      `SELECT battery_percent, battery_voltage::text, charging_inferred, battery_measured_at
       FROM gps_device_status WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(stored.rows[0]?.battery_percent, 97);
    assert.equal(Number(stored.rows[0]?.battery_voltage), 4.279);
    assert.equal(stored.rows[0]?.charging_inferred, true);
    const measuredAt = stored.rows[0]?.battery_measured_at?.toISOString();
    const live = await getGpsLive(created.id, real.partner_id);
    assert.equal(live?.batteryPercent, 97);
    assert.equal("chargingInferred" in (live ?? {}), false);
    const omitted = parseHeartbeatBody({ firmware: "0.3.6" });
    assert.equal((await ingestHeartbeat(created.id, omitted!)).http, 200);
    const keptBattery = await query<{ battery_percent: number | null; battery_measured_at: Date | null }>(
      `SELECT battery_percent, battery_measured_at FROM gps_device_status WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(keptBattery.rows[0]?.battery_percent, 97);
    assert.equal(keptBattery.rows[0]?.battery_measured_at?.toISOString(), measuredAt);
    const rejected = parseHeartbeatBody({ firmware: "0.3.6", battery_percent: 140 });
    assert.equal(rejected?.battery.percent.kind, "keep");
    assert.equal((await ingestHeartbeat(created.id, rejected!)).http, 200);
    const still = await query<{ battery_percent: number | null }>(
      `SELECT battery_percent FROM gps_device_status WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(still.rows[0]?.battery_percent, 97);
    const zero = parseHeartbeatBody({ firmware: "0.3.6", battery_percent: 0, charging_inferred: false });
    assert.equal((await ingestHeartbeat(created.id, zero!)).http, 200);
    const zeroed = await getGpsLive(created.id, real.partner_id);
    assert.equal(zeroed?.batteryPercent, 0);
    const telemetryBattery = parseTelemetryBody({
      points: [{ seq: 9, gnss_time: new Date(Date.now() - 30_000).toISOString(), lat: 41.3, lon: 29.3 }],
      battery_percent: 50,
      battery_voltage: 3.9,
      charging_inferred: null,
    }, new Date());
    assert.ok(telemetryBattery);
    const beforePositions = await query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM gps_positions WHERE device_id = $1`,
      [created.id],
    );
    const telemetered = await ingestTelemetry(created.id, [], [], telemetryBattery.battery);
    assert.equal(telemetered.http, 200);
    const afterPositions = await query<{ total: number }>(
      `SELECT COUNT(*)::int AS total FROM gps_positions WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(afterPositions.rows[0]?.total, beforePositions.rows[0]?.total);
    const fromTelemetry = await getGpsLive(created.id, real.partner_id);
    assert.equal(fromTelemetry?.batteryPercent, 50);
    assert.equal(gpsPresence(fromTelemetry?.lastHeartbeatAt ?? null, new Date()), "online");
    const authed = await authenticateDevice(new NextRequest("http://127.0.0.1:3000/api/device/v1/telemetry", {
      headers: { authorization: `Bearer ${created.token}` },
    }));
    assert.equal("device" in authed, true);
    assert.equal(await revokeGpsDeviceToken(created.id), true);
    const revoked = await authenticateDevice(new NextRequest("http://127.0.0.1:3000/api/device/v1/telemetry", {
      headers: { authorization: `Bearer ${created.token}` },
    }));
    assert.equal("response" in revoked, true);
  } finally {
    for (const id of extraDeviceIds) {
      await query(`DELETE FROM gps_devices WHERE id = $1`, [id]);
    }
    await query(`DELETE FROM gps_devices WHERE id = $1`, [created.id]);
    const after = await query<{ token_hash: string; vehicle_id: string; positions: number }>(
      `SELECT credential.token_hash,
              device.vehicle_id,
              (SELECT COUNT(*)::int FROM gps_positions position WHERE position.device_id = device.id) AS positions
       FROM gps_devices device
       JOIN gps_device_credentials credential ON credential.device_id = device.id
       WHERE device.device_code = 'TPT-1CDBD4475D88'`,
    );
    assert.equal(after.rows[0]?.token_hash, real.token_hash);
    assert.equal(after.rows[0]?.vehicle_id, real.vehicle_id);
    assert.equal(after.rows[0]?.positions, real.positions);
    await getPool().end();
  }
});
