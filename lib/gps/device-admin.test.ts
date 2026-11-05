import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { GPS_DEVICE_CODE_PATTERN } from "@/lib/gps/contract";
import { advancePlaybackCursor, GPS_PLAYBACK_RATES } from "@/lib/gps/playback";

test("server device codes stay in the TPT format and playback rates stay intact", () => {
  const queries = readFileSync(new URL("./queries.ts", import.meta.url), "utf8");
  assert.match(queries, /`TPT-\$\{randomBytes\(6\)\.toString\("hex"\)\.toUpperCase\(\)\}`/);
  assert.match("TPT-1CDBD4475D88", GPS_DEVICE_CODE_PATTERN);
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
  assert.doesNotMatch(queries, /token_hash|gps_device_credentials|gps_commands/);
  const partnerPage = readFileSync(new URL("../../app/[locale]/partner/(panel)/gps/page.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(partnerPage, /createGpsDeviceAction|GpsDeviceCreateForm/);
  const workspace = readFileSync(new URL("../../components/gps/device-workspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workspace, /CommandAudit|GpsTokenRotateForm|GpsRemoteCommands/);
  const history = readFileSync(new URL("../../components/gps/position-history.tsx", import.meta.url), "utf8");
  assert.match(history, /history\.surface === "ops" && history\.step > 1 \? <p>\{copy\.routeSampled\}/);
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
  const removal = queries.slice(queries.indexOf("export type GpsDeviceDeleteResult"), queries.indexOf("function iso("));
  assert.match(removal, /FOR UPDATE/);
  assert.match(removal, /gps_device_deletion_audits/);
  assert.match(removal, /UPDATE gps_ats_settings/);
  assert.match(removal, /source_device_id = NULL/);
  assert.match(removal, /gps_ats_control_events/);
  assert.match(removal, /deleted_at = NOW\(\)/);
  assert.match(removal, /partner_id = NULL/);
  assert.doesNotMatch(removal, /DELETE FROM gps_devices/);
  const deleteAction = actions.slice(
    actions.indexOf("export async function deleteGpsDeviceAction"),
    actions.indexOf("function actorLabel"),
  );
  assert.match(deleteAction, /actorCan\(actor, "gps\.manage"\)/);
  assert.match(deleteAction, /deleteGpsDevice\(deviceId, actor\.id\)/);
  assert.doesNotMatch(deleteAction, /firstName|lastName|Yıldırım|Yildirim/);
  assert.match(workspace, /canDelete \?/);
  assert.match(history, /history\.surface === "ops" && history\.step > 1 \? <p>\{copy\.routeSampled\}/);
  const dialog = readFileSync(new URL("../../components/gps/device-delete.tsx", import.meta.url), "utf8");
  assert.match(dialog, /type="button"/);
  assert.match(dialog, /deleteGpsDeviceAction/);
  assert.doesNotMatch(dialog, /9403e89a|Yıldırım|Yildirim/);
  assert.match(dialog, /copy\.simPhone/);
  assert.match(dialog, /copy\.manufacturer/);
  assert.match(dialog, /copy\.deleteConfirm/);
  const opsPage = readFileSync(new URL("../../app/[locale]/ops/(panel)/gps/[id]/page.tsx", import.meta.url), "utf8");
  assert.match(opsPage, /canDelete=\{actorCan\(actor, "gps\.manage"\)\}/);
  const migration = readFileSync(new URL("../../db/migrations/109_gps_device_soft_delete.sql", import.meta.url), "utf8");
  assert.match(migration, /gps_device_deletion_audits/);
  assert.match(migration, /WHERE imei IS NOT NULL AND deleted_at IS NULL/);
});
