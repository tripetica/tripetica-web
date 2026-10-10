import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertProdTeltonikaListener } from "@/lib/teltonika/listener-guard";

const approved = {
  NODE_ENV: "production",
  EXPECTED_DATABASE: "tripetica",
  TELTONIKA_LISTENER: "approved",
  DATABASE_URL: "postgresql://tripetica_app@127.0.0.1:5432/tripetica",
};

test("production Teltonika listener stays closed unless explicitly approved", () => {
  assert.doesNotThrow(() => assertProdTeltonikaListener(approved));
  assert.throws(() => assertProdTeltonikaListener({ ...approved, NODE_ENV: "development" }), /teltonika_listener_blocked/);
  assert.throws(() => assertProdTeltonikaListener({ ...approved, EXPECTED_DATABASE: "tripetica_dev" }), /teltonika_listener_blocked/);
  assert.throws(() => assertProdTeltonikaListener({ ...approved, TELTONIKA_LISTENER: undefined }), /teltonika_listener_blocked/);
  assert.throws(() => assertProdTeltonikaListener({
    ...approved,
    DATABASE_URL: "postgresql://tripetica_app@127.0.0.1:5432/tripetica_dev",
  }), /Database target mismatch/);
  assert.throws(() => assertProdTeltonikaListener({
    ...approved,
    TELTONIKA_DOUT_DISPATCH: "dev-approved",
  }), /teltonika_dout_dispatch_blocked/);
});

test("production listener service does not enable output commands", () => {
  const script = readFileSync(new URL("../../scripts/teltonika-listen-prod.ts", import.meta.url), "utf8");
  const unit = readFileSync(new URL("../../deploy/systemd/tripetica-prod-teltonika.service", import.meta.url), "utf8");
  const devListener = readFileSync(new URL("../../scripts/teltonika-listen.ts", import.meta.url), "utf8");
  assert.match(script, /database !== "tripetica"/);
  assert.doesNotMatch(script, /setdigout|TELTONIKA_DOUT_DISPATCH=dev-approved/);
  assert.match(unit, /TELTONIKA_PORT=5027/);
  assert.match(unit, /TELTONIKA_LISTENER=approved/);
  assert.doesNotMatch(unit, /TELTONIKA_DOUT_DISPATCH/);
  assert.match(devListener, /teltonika_listener_blocked/);
  assert.match(devListener, /127\.0\.0\.1/);
  for (const name of [
    "079_gps_device_receiver.sql",
    "080_gps_immobilizer.sql",
    "081_gps_immobilizer_grants.sql",
    "082_gps_tracker_model.sql",
    "083_gps_device_registration.sql",
  ]) {
    const sql = readFileSync(new URL(`../../db/migrations/${name}`, import.meta.url), "utf8");
    assert.doesNotMatch(sql, /ALTER TABLE gps_ats|UPDATE gps_ats|INSERT INTO gps_ats|DELETE FROM gps_ats/);
  }
});
