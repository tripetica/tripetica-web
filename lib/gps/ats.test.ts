import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dispatchAtsCandidates } from "@/lib/gps/ats-dispatch";
import { isOfficialAtsDistrict, resolveAtsDistrict, type AtsDistrictBoundary } from "@/lib/gps/ats-district";
import { ATS_RETRY_SELECT_SQL } from "@/lib/gps/ats-queue";
import {
  atsPlate,
  decideAtsSubmission,
  nextAtsAttempt,
  planAtsControl,
  type AtsBlockReason,
} from "@/lib/gps/ats-policy";
import { assertAtsWorkerWithheld } from "@/lib/gps/ats-worker-guard";

const square: AtsDistrictBoundary = {
  ilKodu: 34,
  ilceMernisKodu: 2053,
  ring: [[28.6, 41], [28.8, 41], [28.8, 41.1], [28.6, 41.1]],
};
const overlap: AtsDistrictBoundary = {
  ilKodu: 34,
  ilceMernisKodu: 2052,
  ring: [[28.6, 41], [28.8, 41], [28.8, 41.1], [28.6, 41.1]],
};

const ready = {
  runtime: "test" as const,
  liveDispatchApproved: false,
  enabled: true,
  sourceDeviceId: "device-a",
  device: { id: "device-a", vehicleId: "vehicle-1", status: "active" },
  vehicle: { id: "vehicle-1", plate: "34 EGP 847", companyId: "company-1", deleted: false },
  company: { id: "company-1", status: "active", integrationStatus: "ready" },
  position: {
    id: "position-1",
    deviceId: "device-a",
    vehicleId: "vehicle-1",
    recordedAt: "2026-10-08T08:00:00.000Z",
    receivedAt: "2026-10-08T08:05:00.000Z",
    latitude: 41.05,
    longitude: 28.7,
  },
  district: { ok: true as const, ilKodu: 34, ilceMernisKodu: 2053 },
  alreadySubmitted: false,
};

test("official district codes accept MERNIS districts and reject airports", () => {
  assert.equal(isOfficialAtsDistrict(34, 2053), true);
  assert.equal(isOfficialAtsDistrict(34, 99133), false);
  assert.equal(resolveAtsDistrict(41.05, 28.7).ok, false);
  assert.deepEqual(resolveAtsDistrict(41.05, 28.7, [square]), { ok: true, ilKodu: 34, ilceMernisKodu: 2053 });
  assert.equal(resolveAtsDistrict(41.05, 28.7, [square, overlap]).ok, false);
  assert.equal(resolveAtsDistrict(41.05, 28.7, [{ ...square, ilceMernisKodu: 99133 }]).ok, false);
});

test("submission uses the position vehicle, GNSS time, and one explicit device", () => {
  const accepted = decideAtsSubmission(ready);
  assert.equal(accepted.ok, true);
  if (!accepted.ok) return;
  assert.equal(accepted.plate, atsPlate("34 EGP 847", "test"));
  assert.equal(accepted.plate, "34EGP847");
  assert.equal(accepted.gnssTime, ready.position.recordedAt);
  assert.notEqual(accepted.gnssTime, ready.position.receivedAt);

  const cases: Array<[Parameters<typeof decideAtsSubmission>[0], AtsBlockReason]> = [
    [{ ...ready, enabled: false }, "disabled"],
    [{ ...ready, sourceDeviceId: null }, "source_unset"],
    [{ ...ready, position: { ...ready.position, deviceId: "device-b" } }, "not_source_device"],
    [{ ...ready, device: { ...ready.device, vehicleId: "vehicle-2" } }, "device_reassigned"],
    [{ ...ready, vehicle: { ...ready.vehicle, companyId: "company-2" } }, "company"],
    [{ ...ready, company: { ...ready.company, integrationStatus: "incomplete" } }, "company_not_ready"],
    [{ ...ready, district: { ok: false, reason: "unresolved" } }, "district_unresolved"],
    [{ ...ready, alreadySubmitted: true }, "duplicate"],
    [{ ...ready, runtime: "live" }, "live_blocked"],
    [{ ...ready, runtime: null }, "environment"],
    [{ ...ready, position: { ...ready.position, recordedAt: "not-a-time" } }, "gnss_time"],
  ];
  for (const [input, reason] of cases) {
    const decision = decideAtsSubmission(input);
    assert.equal(decision.ok, false, reason);
    if (!decision.ok) assert.equal(decision.reason, reason);
  }
});

test("control changes stay with ops, one device, and keep history on disable", () => {
  const base = {
    actorAllowed: true,
    enable: true,
    device: { id: "device-a", vehicleId: "vehicle-1", status: "active", partnerId: "partner-1" },
    vehicle: { id: "vehicle-1", partnerId: "partner-1", deleted: false, companyId: "company-1" },
    companyReady: true,
    current: null,
  };
  assert.deepEqual(planAtsControl(base), { ok: true, action: "enable", sourceDeviceId: "device-a" });
  assert.equal(planAtsControl({ ...base, actorAllowed: false }).ok, false);
  assert.equal(planAtsControl({ ...base, companyReady: false }).ok, false);
  const other = planAtsControl({
    ...base,
    device: { ...base.device, id: "device-b" },
    current: { enabled: true, sourceDeviceId: "device-a" },
  });
  assert.deepEqual(other, { ok: false, error: "other_source" });
  const disabled = planAtsControl({
    ...base,
    enable: false,
    current: { enabled: true, sourceDeviceId: "device-a" },
  });
  assert.deepEqual(disabled, { ok: true, action: "disable", sourceDeviceId: "device-a" });
});

test("mock dispatch does not send faults, duplicates, or a disabled vehicle", async () => {
  const calls: string[] = [];
  const boundary = [square];
  const candidate = {
    runtime: "test" as const,
    enabled: true,
    sourceDeviceId: "device-a",
    device: ready.device,
    vehicle: ready.vehicle,
    company: ready.company,
    position: ready.position,
    alreadySubmitted: false,
  };
  const first = await dispatchAtsCandidates({
    candidates: [candidate],
    boundaries: boundary,
    transport: async (call) => {
      calls.push(call.positionId);
      return { sonucKodu: 0, sonucMesaji: "ok" };
    },
  });
  assert.deepEqual(calls, ["position-1"]);
  assert.equal(first.sent[0]?.gnssTime, ready.position.recordedAt);
  assert.equal(first.faultReports, 0);
  const second = await dispatchAtsCandidates({
    candidates: [{ ...candidate, alreadySubmitted: true }, { ...candidate, enabled: false, position: { ...ready.position, id: "position-2" } }],
    boundaries: boundary,
    transport: async () => {
      throw new Error("transport should not run");
    },
  });
  assert.deepEqual(second.sent, []);
  assert.deepEqual(second.blocked.map((item) => item.reason), ["duplicate", "disabled"]);
});

test("retries stop when ATS is off, the ministry rejects, or attempts are exhausted", () => {
  const now = new Date("2026-10-08T09:00:00.000Z");
  assert.equal(nextAtsAttempt({ enabled: false, attemptCount: 0, sonucKodu: null, now }).retry, false);
  assert.equal(nextAtsAttempt({ enabled: true, attemptCount: 0, sonucKodu: 4, now }).reason, "rejected");
  const retry = nextAtsAttempt({ enabled: true, attemptCount: 0, sonucKodu: null, now });
  assert.equal(retry.retry, true);
  if (retry.retry) assert.equal(retry.nextAttemptAt.toISOString(), "2026-10-08T09:01:00.000Z");
  assert.equal(nextAtsAttempt({ enabled: true, attemptCount: 3, sonucKodu: null, now }).reason, "exhausted");
  assert.match(ATS_RETRY_SELECT_SQL, /settings\.enabled = TRUE/);
  assert.match(ATS_RETRY_SELECT_SQL, /ministry_env = 'test'/);
  const migration = readFileSync(new URL("../../db/migrations/075_gps_ats.sql", import.meta.url), "utf8");
  assert.match(migration, /position_id UUID NOT NULL UNIQUE/);
  assert.match(migration, /DEFAULT FALSE/);
  assert.doesNotMatch(migration, /INSERT INTO gps_ats_settings/);
});

test("the DEV worker cannot be pointed at production or at a real SOAP call", () => {
  assert.throws(() => assertAtsWorkerWithheld({ NODE_ENV: "production", EXPECTED_DATABASE: "tripetica" }), /ats_worker_blocked/);
  assert.throws(() => assertAtsWorkerWithheld({ NODE_ENV: "development", EXPECTED_DATABASE: "tripetica_dev", ATS_MINISTRY_DISPATCH: "allow-test" }), /ats_ministry_dispatch_disabled/);
  assert.doesNotThrow(() => assertAtsWorkerWithheld({ NODE_ENV: "development", EXPECTED_DATABASE: "tripetica_dev", ATS_MINISTRY_DISPATCH: "withheld" }));
  const script = readFileSync(new URL("../../scripts/gps-ats-dispatch.ts", import.meta.url), "utf8");
  const service = readFileSync(new URL("../../deploy/systemd/tripetica-dev-gps-ats.service", import.meta.url), "utf8");
  assert.doesNotMatch(script, /callUetdsTestSoap|servis\.turkiye\.gov\.tr|atsArizaBildir/);
  assert.match(service, /ATS_MINISTRY_DISPATCH=withheld/);
  assert.match(service, /EXPECTED_DATABASE=tripetica_dev/);
  assert.doesNotMatch(service, /\[Timer\]|OnUnitActiveSec/);
  const actions = readFileSync(new URL("./ats-actions.ts", import.meta.url), "utf8");
  assert.match(actions, /getOpsActor/);
  assert.match(actions, /gps\.manage/);
  const workspace = readFileSync(new URL("../../components/gps/device-workspace.tsx", import.meta.url), "utf8");
  assert.match(workspace, /surface === "ops" \? await loadGpsAtsPanel/);
});
