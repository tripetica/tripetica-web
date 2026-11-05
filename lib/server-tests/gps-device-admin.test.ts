import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("device administration provisions and manages Teltonika only", () => {
  const queries = readFileSync(new URL("../gps/queries.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../gps/actions.ts", import.meta.url), "utf8");

  assert.match(queries, /VALUES \(\$1, \$2, \$3, \$4, \$5, 'teltonika'/);
  assert.match(queries, /manufacturer, link_technology/);
  assert.match(queries, /receiver = 'teltonika'/);
  assert.doesNotMatch(queries, /gps_device_credentials|gps_commands|token_hash/);
  assert.match(actions, /receiver !== "teltonika"/);
  assert.doesNotMatch(actions, /rotateGpsDeviceToken|revokeGpsDeviceToken|queueGpsCommand/);
});

test("soft deletion preserves shared history and disables ATS linkage", () => {
  const queries = readFileSync(new URL("../gps/queries.ts", import.meta.url), "utf8");
  const deletion = queries.slice(queries.indexOf("export async function deleteGpsDevice"));

  assert.match(deletion, /FOR UPDATE/);
  assert.match(deletion, /gps_device_deletion_audits/);
  assert.match(deletion, /UPDATE gps_ats_settings/);
  assert.match(deletion, /source_device_id = NULL/);
  assert.match(deletion, /deleted_at = NOW\(\)/);
  assert.doesNotMatch(deletion, /DELETE FROM gps_positions|DELETE FROM gps_ats_submissions/);
});
