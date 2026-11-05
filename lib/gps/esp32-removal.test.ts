import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("ESP32 HTTP, provisioning, command and camera surfaces are absent", () => {
  const removed = [
    "app/api/device/v1/telemetry/route.ts",
    "app/api/device/v1/heartbeat/route.ts",
    "app/api/device/v1/commands/route.ts",
    "app/api/device/v1/commands/[id]/result/route.ts",
    "app/api/device/v1/camera/session/route.ts",
    "app/api/device/v1/camera/frames/route.ts",
    "components/gps/wifi-panel.tsx",
    "components/gps/camera-live.tsx",
    "lib/gps/device-auth.ts",
    "lib/gps/token.ts",
    "lib/gps/commands.ts",
  ];
  for (const path of removed) {
    assert.equal(existsSync(new URL(`../../${path}`, import.meta.url)), false, path);
  }

  const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
  assert.match(actions, /receiver !== "teltonika"/);
  assert.match(queries, /receiver = 'teltonika'/);
  assert.doesNotMatch(queries, /gps_device_credentials|gps_commands|wifi_config|camera_sessions/);
});

test("final forward migration deletes only the retired ESP32 identity and drops private schema", () => {
  const migration = readFileSync(new URL("../../db/migrations/111_drop_esp32_legacy.sql", import.meta.url), "utf8");
  assert.match(migration, /TPT-1CDBD4475D88/);
  assert.match(migration, /861045082880892/);
  assert.match(migration, /506702d6-63d9-49be-a3f8-03ba5fcc8311/);
  assert.match(migration, /esp32_target_identity_mismatch/);
  assert.match(migration, /DELETE FROM gps_ats_submissions/);
  assert.match(migration, /DELETE FROM gps_ats_control_events/);
  assert.match(migration, /DELETE FROM gps_devices/);
  assert.match(migration, /DROP TABLE gps_device_credentials/);
  assert.match(migration, /DROP TABLE gps_commands/);
  assert.match(migration, /DROP TABLE gps_camera_sessions/);
  assert.match(migration, /DROP TABLE gps_low_battery_pushes/);
  assert.match(migration, /ALTER COLUMN receiver SET DEFAULT 'teltonika'/);
  assert.match(migration, /CHECK \(receiver = 'teltonika'\)/);
});
