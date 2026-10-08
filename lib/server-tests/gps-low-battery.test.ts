import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { databaseNameFromUrl } from "@/lib/db/database-target";
import { parseHeartbeatBody } from "@/lib/gps/contract";

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

test("low battery ingest, command auth, and one push claim", { skip: devDatabase ? false : "DEV database is not selected" }, async () => {
  const { getPool, query } = await import("@/lib/db/postgres");
  const { ingestHeartbeat } = await import("@/lib/gps/ingest");
  const { createGpsDevice, queueGpsLowBattery } = await import("@/lib/gps/queries");
  const real = await query<{ partner_id: string; positions: number }>(
    `SELECT device.partner_id,
            (SELECT COUNT(*)::int FROM gps_positions position WHERE position.device_id = device.id) AS positions
     FROM gps_devices device
     WHERE device.device_code = 'TPT-1CDBD4475D88'`,
  );
  const partnerId = real.rows[0]?.partner_id;
  assert.ok(partnerId);
  const other = await query<{ id: string }>(
    `SELECT id FROM partners WHERE id <> $1 AND deleted_at IS NULL LIMIT 1`,
    [partnerId],
  );
  const created = await createGpsDevice({
    partnerId,
    vehicleId: null,
    imei: null,
    assignedBy: "low-battery-test",
  });
  const beat = (extra: Record<string, unknown>) => {
    const parsed = parseHeartbeatBody({ firmware: "0.3.6", network: "lte", ...extra });
    assert.ok(parsed);
    return parsed;
  };
  try {
    const first = await ingestHeartbeat(created.id, beat({ battery_percent: 100 }));
    assert.equal(first.http, 200);
    if (first.http === 200) assert.equal(first.lowBatteryAlert, null);
    const kept = await query<{ battery_percent: number | null; positions: number }>(
      `SELECT status.battery_percent,
              (SELECT COUNT(*)::int FROM gps_positions position WHERE position.device_id = $1) AS positions
       FROM gps_device_status status
       WHERE status.device_id = $1`,
      [created.id],
    );
    assert.equal(kept.rows[0]?.battery_percent, 100);
    assert.equal(kept.rows[0]?.positions, 0);
    await ingestHeartbeat(created.id, beat({ battery_percent: null }));
    const still = await query<{ battery_percent: number | null }>(
      `SELECT battery_percent FROM gps_device_status WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(still.rows[0]?.battery_percent, 100);

    const grace = await ingestHeartbeat(created.id, beat({
      battery_percent: 19,
      low_battery_state: "grace",
      low_battery_grace_remaining_seconds: 573,
      wifi_enabled: true,
    }));
    assert.equal(grace.http, 200);
    if (grace.http !== 200 || !grace.lowBatteryAlert) {
      assert.fail("grace heartbeat did not claim a push");
    }
    assert.equal(grace.lowBatteryAlert.batteryPercent, 19);
    assert.equal(grace.lowBatteryAlert.partnerId, partnerId);
    const stored = await query<{ state: string; remaining: number; wifi_enabled: boolean }>(
      `SELECT low_battery_state AS state,
              low_battery_grace_remaining_seconds AS remaining,
              wifi_enabled
       FROM gps_device_status
       WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(stored.rows[0]?.state, "grace");
    assert.equal(stored.rows[0]?.remaining, 573);
    assert.equal(stored.rows[0]?.wifi_enabled, true);

    const again = await ingestHeartbeat(created.id, beat({
      low_battery_state: "grace",
      low_battery_grace_remaining_seconds: 568,
    }));
    assert.equal(again.http, 200);
    if (again.http === 200) assert.equal(again.lowBatteryAlert, null);
    const resynced = await query<{ remaining: number; battery_percent: number }>(
      `SELECT low_battery_grace_remaining_seconds AS remaining, battery_percent
       FROM gps_device_status WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(resynced.rows[0]?.remaining, 568);
    assert.equal(resynced.rows[0]?.battery_percent, 19);

    await ingestHeartbeat(created.id, beat({
      low_battery_state: "panic",
      low_battery_grace_remaining_seconds: -1,
    }));
    const untouched = await query<{ state: string; remaining: number }>(
      `SELECT low_battery_state AS state, low_battery_grace_remaining_seconds AS remaining
       FROM gps_device_status WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(untouched.rows[0]?.state, "grace");
    assert.equal(untouched.rows[0]?.remaining, 568);

    const oldPayload = await ingestHeartbeat(created.id, beat({}));
    assert.equal(oldPayload.http, 200);
    const afterOld = await query<{ state: string; remaining: number }>(
      `SELECT low_battery_state AS state, low_battery_grace_remaining_seconds AS remaining
       FROM gps_device_status WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(afterOld.rows[0]?.state, "grace");
    assert.equal(afterOld.rows[0]?.remaining, 568);

    assert.equal(await queueGpsLowBattery({
      deviceId: created.id,
      partnerId: other.rows[0]?.id ?? "00000000-0000-4000-8000-000000000000",
      actorLabel: "other",
      action: "keep_on",
    }), null);
    const keep = await queueGpsLowBattery({
      deviceId: created.id,
      partnerId,
      actorLabel: "low-battery-test",
      action: "keep_on",
    });
    assert.ok(keep?.id);
    const payload = await query<{ kind: string; action: string }>(
      `SELECT kind, payload->>'action' AS action FROM gps_commands WHERE id = $1`,
      [keep?.id],
    );
    assert.equal(payload.rows[0]?.kind, "low_battery_action");
    assert.equal(payload.rows[0]?.action, "keep_on");

    const keptOn = await ingestHeartbeat(created.id, beat({
      low_battery_state: "keep_on",
      low_battery_grace_remaining_seconds: null,
      wifi_enabled: true,
    }));
    assert.equal(keptOn.http, 200);
    if (keptOn.http === 200) assert.equal(keptOn.lowBatteryAlert, null);

    const nextGrace = await ingestHeartbeat(created.id, beat({
      low_battery_state: "grace",
      low_battery_grace_remaining_seconds: 600,
    }));
    assert.equal(nextGrace.http, 200);
    if (nextGrace.http !== 200 || !nextGrace.lowBatteryAlert) assert.fail("new grace episode was not claimed");
    assert.notEqual(nextGrace.lowBatteryAlert.episodeAt, grace.lowBatteryAlert.episodeAt);

    const save = await queueGpsLowBattery({
      deviceId: created.id,
      partnerId,
      actorLabel: "low-battery-test",
      action: "save_power",
    });
    const savePayload = await query<{ action: string }>(
      `SELECT payload->>'action' AS action FROM gps_commands WHERE id = $1`,
      [save?.id],
    );
    assert.equal(savePayload.rows[0]?.action, "save_power");
    await ingestHeartbeat(created.id, beat({
      low_battery_state: "saving",
      low_battery_grace_remaining_seconds: null,
      wifi_enabled: false,
    }));
    const saving = await query<{ state: string; wifi_enabled: boolean; last_heartbeat_at: Date | null }>(
      `SELECT low_battery_state AS state, wifi_enabled, last_heartbeat_at
       FROM gps_device_status WHERE device_id = $1`,
      [created.id],
    );
    assert.equal(saving.rows[0]?.state, "saving");
    assert.equal(saving.rows[0]?.wifi_enabled, false);
    assert.ok(saving.rows[0]?.last_heartbeat_at);
  } finally {
    await query(`DELETE FROM gps_devices WHERE id = $1`, [created.id]);
    const after = await query<{ positions: number }>(
      `SELECT (SELECT COUNT(*)::int FROM gps_positions position WHERE position.device_id = device.id) AS positions
       FROM gps_devices device
       WHERE device.device_code = 'TPT-1CDBD4475D88'`,
    );
    assert.equal(after.rows[0]?.positions, real.rows[0]?.positions);
    await getPool().end();
  }
});
