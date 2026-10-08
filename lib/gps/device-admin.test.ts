import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { GPS_DEVICE_CODE_PATTERN } from "@/lib/gps/contract";
import { canDeleteGpsDevice, GPS_DEVICE_DELETE_ACTOR_ID } from "@/lib/gps/delete-access";
import { advancePlaybackCursor, GPS_PLAYBACK_RATES } from "@/lib/gps/playback";
import { generateDeviceCode } from "@/lib/gps/token";

test("server device codes stay in the TPT format and playback rates stay intact", () => {
  assert.match(generateDeviceCode(), GPS_DEVICE_CODE_PATTERN);
  assert.deepEqual([...GPS_PLAYBACK_RATES], [1, 5, 10, 30, 60, 120, 200, 300, 400, 500]);
  const origin = Date.parse("2026-10-06T06:00:00.000Z");
  assert.equal(advancePlaybackCursor(origin, 1_000, 500, origin + 10_000_000), origin + 500_000);
});

test("assignment does not rewrite stored positions and partners cannot provision devices", () => {
  const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
  const assign = queries.slice(
    queries.indexOf("export async function assignGpsDevice"),
    queries.indexOf("export async function listGpsAssignments"),
  );
  assert.doesNotMatch(assign, /UPDATE gps_positions|INSERT INTO gps_positions/);
  assert.doesNotMatch(queries.slice(queries.indexOf("const DEVICE_SELECT"), queries.indexOf("function credentialState")), /token_hash/);
  const partnerPage = readFileSync(new URL("../../app/[locale]/partner/(panel)/gps/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(partnerPage, /createGpsDeviceAction|GpsDeviceCreateForm/);
  const workspace = readFileSync(new URL("../../components/gps/device-workspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workspace, /surface === "partner" \? <CommandAudit/);
  assert.match(workspace, /<CommandAudit/);
  assert.match(workspace, /surface === "ops" && route\.step > 1 \? <p>\{copy\.routeSampled\}/);
  assert.match(assign, /INSERT INTO gps_device_assignments/);
  const board = readFileSync(new URL("../../components/gps/device-board.tsx", import.meta.url), "utf8");
  assert.match(board, /ops-table/);
  assert.match(board, /copy\.addDevice/);
  assert.match(board, /creating \?/);
  assert.match(board, /gps-grid/);
  const form = readFileSync(new URL("../../components/gps/device-create-form.tsx", import.meta.url), "utf8");
  const assignment = readFileSync(new URL("../../components/gps/device-assignment-form.tsx", import.meta.url), "utf8");
  assert.match(form, /SearchableSelect/);
  assert.match(assignment, /SearchableSelect/);
  assert.doesNotMatch(form, /name="plate"|name="label"|uetdsCompanyId/);
  assert.doesNotMatch(assignment, /name="plate"|uetdsCompanyId/);
  assert.match(form, /GpsCompanyLock/);
  assert.match(assignment, /GpsCompanyLock/);
  assert.match(form, /vehicle\.partner_id === partnerId/);
  assert.match(queries, /vehicle\.uetds_company_id/);
  const actions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  assert.match(actions, /createGpsDeviceAction[\s\S]*gps\.manage/);
  assert.match(actions, /revokeGpsDeviceTokenAction[\s\S]*gps\.manage/);
  assert.equal(canDeleteGpsDevice(GPS_DEVICE_DELETE_ACTOR_ID), true);
  assert.equal(canDeleteGpsDevice("00000000-0000-4000-8000-000000000000"), false);
  assert.equal(GPS_DEVICE_DELETE_ACTOR_ID, "9403e89a-26da-4330-9a9d-a2e7960ccf75");
  const removal = queries.slice(queries.indexOf("const GPS_DEVICE_USE_SQL"), queries.indexOf("function iso("));
  assert.match(removal, /FOR UPDATE/);
  assert.match(removal, /gps_positions/);
  assert.match(removal, /last_heartbeat_at/);
  assert.match(removal, /status IN \('delivered', 'acked', 'failed', 'expired'\)/);
  assert.match(removal, /gps_camera_sessions/);
  assert.ok(removal.indexOf("last_heartbeat_at") < removal.indexOf("DELETE FROM gps_devices"));
  assert.match(removal, /deleteGpsDeviceForActor/);
  assert.match(removal, /canDeleteGpsDevice\(actorId\)/);
  const deleteAction = actions.slice(actions.indexOf("export async function deleteGpsDeviceAction"));
  assert.match(deleteAction, /canDeleteGpsDevice\(actor\.id\)/);
  assert.match(deleteAction, /deleteGpsDeviceForActor/);
  assert.doesNotMatch(deleteAction, /firstName|lastName|Yıldırım|Yildirim/);
  assert.match(workspace, /canDelete \?/);
  assert.match(workspace, /surface === "ops" && route\.step > 1 \? <p>\{copy\.routeSampled\}/);
  const dialog = readFileSync(new URL("../../components/gps/device-delete.tsx", import.meta.url), "utf8");
  assert.match(dialog, /type="button"/);
  assert.match(dialog, /deleteGpsDeviceAction/);
  assert.doesNotMatch(dialog, /9403e89a|Yıldırım|Yildirim/);
  const opsPage = readFileSync(new URL("../../app/[locale]/ops/(panel)/gps/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(opsPage, /canDelete=\{canDeleteGpsDevice\(actor\.id\)\}/);
});
