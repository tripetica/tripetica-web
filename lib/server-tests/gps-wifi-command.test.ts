import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { databaseNameFromUrl } from "@/lib/db/database-target";
import { parseHeartbeatBody } from "@/lib/gps/contract";
import { softwareRebootPayload, wifiConfigPayload } from "@/lib/gps/commands";

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

test("wifi command lifecycle on DEV", { skip: devDatabase ? false : "DEV database is not selected" }, async () => {
  const { getPool, query } = await import("@/lib/db/postgres");
  const { ackDeviceCommand, ingestHeartbeat, pollDeviceCommands } = await import("@/lib/gps/ingest");
  const { createGpsDevice, getGpsDevice, getGpsLive, listGpsCommands, queueGpsCommand, queueGpsWifiShare } = await import("@/lib/gps/queries");
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
  const other = await query<{ id: string }>(
    `SELECT id FROM partners WHERE id <> $1 AND deleted_at IS NULL LIMIT 1`,
    [real.partner_id],
  );
  const created = await createGpsDevice({
    partnerId: real.partner_id,
    vehicleId: null,
    imei: null,
    assignedBy: "wifi-command-test",
  });
  try {
    const own = await getGpsDevice(created.id, real.partner_id);
    assert.equal(own?.partnerId, real.partner_id);
    assert.equal(await getGpsDevice(created.id, other.rows[0]?.id ?? "00000000-0000-4000-8000-000000000000"), null);
    assert.equal(own?.wifiClients, null);
    assert.equal(own?.wifiMaxClients, 8);

    await queueGpsCommand({
      deviceId: created.id,
      partnerId: real.partner_id,
      createdBy: "partner",
      actorLabel: "wifi-command-test",
      kind: "wifi_config",
      payload: wifiConfigPayload({ mode: "on", ssid: "Cabin", password: "correct horse", maxClients: 1 }),
    });
    const queued = await query<{ wifi_max_clients: number; wifi_ssid: string | null }>(
      `SELECT wifi_max_clients, wifi_ssid FROM gps_devices WHERE id = $1`,
      [created.id],
    );
    assert.equal(queued.rows[0]?.wifi_max_clients, 8);
    assert.equal(queued.rows[0]?.wifi_ssid, null);

    const polled = await pollDeviceCommands(created.id);
    assert.equal(polled.length, 1);
    assert.equal(polled[0]?.kind, "wifi_config");
    assert.equal(polled[0]?.payload.password, "correct horse");
    assert.equal(polled[0]?.payload.max_clients, 1);
    const commandId = polled[0]?.id ?? "";
    const listed = await listGpsCommands(created.id, real.partner_id);
    assert.equal(JSON.stringify(listed).includes("correct horse"), false);
    assert.equal(listed[0]?.status, "delivered");

    const acked = await ackDeviceCommand(created.id, commandId, {
      ok: true,
      error: null,
      detail: { password: "correct horse", applied: true },
    });
    assert.equal(acked.http, 200);
    const stored = await query<{ status: string; has_password: boolean; result_password: string | null; wifi_max_clients: number; wifi_ssid: string | null; wifi_mode: string; wifi_password_set: boolean }>(
      `SELECT command.status,
              command.payload ? 'password' AS has_password,
              command.result->>'password' AS result_password,
              device.wifi_max_clients,
              device.wifi_ssid,
              device.wifi_mode,
              device.wifi_password_set
       FROM gps_commands command
       JOIN gps_devices device ON device.id = command.device_id
       WHERE command.id = $1`,
      [commandId],
    );
    assert.equal(stored.rows[0]?.status, "acked");
    assert.equal(stored.rows[0]?.has_password, false);
    assert.equal(stored.rows[0]?.result_password, null);
    assert.equal(stored.rows[0]?.wifi_max_clients, 1);
    assert.equal(stored.rows[0]?.wifi_ssid, "Cabin");
    assert.equal(stored.rows[0]?.wifi_mode, "on");
    assert.equal(stored.rows[0]?.wifi_password_set, true);

    const heartbeat = parseHeartbeatBody({
      firmware: "0.1.0",
      network: "lte",
      operator: "Turkcell",
      wifi_enabled: true,
      wifi_ssid: "Cabin",
      wifi_max_clients: 1,
      wifi_connected_clients: 1,
    });
    assert.ok(heartbeat);
    assert.equal(await ingestHeartbeat(created.id, heartbeat).then((result) => result.http), 200);
    const reported = await getGpsDevice(created.id, real.partner_id);
    assert.equal(reported?.wifiClients, 1);
    assert.equal(reported?.reportedMaxClients, 1);
    assert.equal(reported?.reportedWifiSsid, "Cabin");
    assert.equal(reported?.reportedWifiEnabled, true);

    await queueGpsCommand({
      deviceId: created.id,
      partnerId: real.partner_id,
      createdBy: "partner",
      actorLabel: "wifi-command-test",
      kind: "wifi_config",
      payload: wifiConfigPayload({ mode: "on", ssid: "Cabin", password: "", maxClients: 8 }),
    });
    const blank = await pollDeviceCommands(created.id);
    assert.equal("password" in (blank[0]?.payload ?? {}), false);
    const failed = await ackDeviceCommand(created.id, blank[0]?.id ?? "", {
      ok: false,
      error: "ap_failed",
      detail: null,
    });
    assert.equal(failed.http, 200);
    const kept = await query<{ status: string; wifi_max_clients: number }>(
      `SELECT command.status, device.wifi_max_clients
       FROM gps_commands command
       JOIN gps_devices device ON device.id = command.device_id
       WHERE command.id = $1`,
      [blank[0]?.id],
    );
    assert.equal(kept.rows[0]?.status, "failed");
    assert.equal(kept.rows[0]?.wifi_max_clients, 1);

    const share = await queueGpsWifiShare({
      deviceId: created.id,
      partnerId: real.partner_id,
      createdBy: "partner",
      actorLabel: "wifi-command-test",
      mode: "off",
    });
    assert.ok(share);
    const duplicate = await queueGpsWifiShare({
      deviceId: created.id,
      partnerId: real.partner_id,
      createdBy: "partner",
      actorLabel: "wifi-command-test",
      mode: "off",
    });
    assert.equal(duplicate?.id, share?.id);
    const otherPartner = await queueGpsWifiShare({
      deviceId: created.id,
      partnerId: other.rows[0]?.id ?? "00000000-0000-4000-8000-000000000000",
      createdBy: "partner",
      actorLabel: "wifi-command-test",
      mode: "on",
    });
    assert.equal(otherPartner, null);
    const stillOn = await getGpsLive(created.id, real.partner_id);
    assert.equal(stillOn?.wifiEnabled, true);
    assert.equal(stillOn?.wifiShareCommand?.id, share?.id);
    assert.equal(stillOn?.wifiShareCommand?.mode, "off");
    const shareRow = await query<{ enabled: boolean | null; mode: string }>(
      `SELECT status.wifi_enabled AS enabled, device.wifi_mode AS mode
       FROM gps_devices device
       JOIN gps_device_status status ON status.device_id = device.id
       WHERE device.id = $1`,
      [created.id],
    );
    assert.equal(shareRow.rows[0]?.enabled, true);
    assert.equal(shareRow.rows[0]?.mode, "on");
    assert.equal((await ackDeviceCommand(created.id, share.id, { ok: false, error: "ap_failed", detail: null })).http, 200);
    const afterFailure = await getGpsLive(created.id, real.partner_id);
    assert.equal(afterFailure?.wifiEnabled, true);
    assert.equal(afterFailure?.wifiShareCommand?.status, "failed");

    const beforeReboot = await query<{ token_hash: string; device_code: string }>(
      `SELECT credential.token_hash, device.device_code
       FROM gps_devices device
       JOIN gps_device_credentials credential ON credential.device_id = device.id
       WHERE device.id = $1`,
      [created.id],
    );
    await queueGpsCommand({
      deviceId: created.id,
      partnerId: real.partner_id,
      createdBy: "partner",
      actorLabel: "wifi-command-test",
      kind: "reboot",
      payload: softwareRebootPayload(),
    });
    const reboot = await pollDeviceCommands(created.id);
    assert.deepEqual(reboot[0]?.payload, { scope: "software" });
    assert.equal((await ackDeviceCommand(created.id, reboot[0]?.id ?? "", { ok: true, error: null, detail: null })).http, 200);
    const afterReboot = await query<{ token_hash: string; device_code: string }>(
      `SELECT credential.token_hash, device.device_code
       FROM gps_devices device
       JOIN gps_device_credentials credential ON credential.device_id = device.id
       WHERE device.id = $1`,
      [created.id],
    );
    assert.equal(afterReboot.rows[0]?.token_hash, beforeReboot.rows[0]?.token_hash);
    assert.equal(afterReboot.rows[0]?.device_code, beforeReboot.rows[0]?.device_code);
  } finally {
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
