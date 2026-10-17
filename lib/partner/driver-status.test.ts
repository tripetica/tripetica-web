import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("partner driver status changes only from an explicit intent", () => {
  const action = readFileSync("lib/partner/driver-actions.ts", "utf8");
  const detail = readFileSync("components/partner/driver-detail.tsx", "utf8");
  const status = action.slice(action.indexOf("async function changeOwnDriverStatus"));
  assert.match(status, /formData\.get\("intent"\)/);
  assert.match(status, /deactivatePartnerDriver\(/);
  assert.match(status, /activatePartnerDriver\(/);
  assert.match(detail, /partnerDeactivateDriverAction/);
  assert.match(detail, /name="intent" value="deactivate"/);
  assert.match(detail, /name="intent" value="activate"/);
  assert.match(detail, /ops-btn-cancel-soft/);
  assert.match(detail, /ops-btn-activate/);
  assert.equal(detail.includes('name="intent"'), true);
  const saveForm = detail.slice(detail.indexOf("partnerUpdateDriverAction"), detail.indexOf("partner-driver-status-actions"));
  assert.equal(saveForm.includes('name="intent"'), false);
  const ops = readFileSync("lib/ops/partner-fleet-actions.ts", "utf8");
  assert.match(ops, /deactivateOpsPartnerDriverAction/);
  assert.match(ops, /deactivatePartnerDriver\(/);
});

test("partner vehicle status changes only from an explicit intent and both are audited", () => {
  const action = readFileSync("lib/partner/vehicle-actions.ts", "utf8");
  const detail = readFileSync("components/partner/vehicle-detail.tsx", "utf8");
  const fleet = readFileSync("lib/partner/fleet.ts", "utf8");
  assert.match(action, /formData\.get\("intent"\)/);
  assert.match(detail, /name="intent" value="deactivate"/);
  assert.match(detail, /name="intent" value="activate"/);
  assert.match(fleet, /recordFleetStatusAudit/);
  assert.match(readFileSync("db/migrations/092_partner_fleet_status_audits.sql", "utf8"), /partner_fleet_status_audits/);
});
