import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { getUetdsDriverOption, getUetdsVehicleOption, listUetdsDriverOptions, listUetdsVehicleOptions } from "../uetds/fleet-scope";
import { evaluateUetdsEligibility } from "../uetds/eligibility";
import { selectedFleetCompany } from "../uetds/fleet-options";
import { createEmptyDraft } from "../uetds/draft";
import { submitUetdsNotification } from "../uetds/submit";

const partner = "09c76dba-52fa-4a00-ba89-93310006012a";
const owner = "4691381c-e7bd-4e96-82a3-11e1f4b65499";
const vehicleId = "c4bc6ebf-2623-405f-8670-ea068df4cf9f";
const driverId = "6604016c-0277-49e0-b595-007c7a13f8e4";
const companyId = "1d441e20-8191-45f2-a4fe-3f99b814892f";

test("shared vehicle company repair on isolated production-data DEV copy", { skip: !process.env.SHARED_UETDS_TEST_SOCKET }, async t => {
  const socket = process.env.SHARED_UETDS_TEST_SOCKET!;
  assert.ok(socket.startsWith("/tmp/tripetica-shared-pg."));
  const pool = new Pool({ host: socket, port: 55433, database: "tripetica_dev", user: "postgres" });
  const globals = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const originalPool = globals.tripeticaPgPool;
  const originalFetch = globalThis.fetch;
  const environment = { ...process.env };
  globals.tripeticaPgPool = pool;
  let network = 0;
  globalThis.fetch = async () => { network++; throw new Error("network forbidden in regression"); };
  Object.assign(process.env, { NODE_ENV: "development", EXPECTED_DATABASE: "tripetica_dev" });
  const repair = readFileSync("/var/tmp/repair-shared-uetds-company.sql", "utf8");
  const driverCount = Number((await pool.query("SELECT count(*) FROM partner_drivers")).rows[0].count);
  const notifications = JSON.stringify((await pool.query("SELECT id,md5(row_to_json(n)::text) AS digest FROM uetds_notifications n ORDER BY id")).rows);
  const visibility = JSON.stringify((await pool.query("SELECT p.id,count(n.id) AS count FROM partners p LEFT JOIN uetds_notifications n ON partner_can_access_uetds_notification(p.id,n.id) GROUP BY p.id ORDER BY p.id")).rows);
  const draft = { ...createEmptyDraft(), driverId, vehicleId };
  const input = { actorType: "partner" as const, actorUserId: partner, partnerId: partner, draft };
  const pair = async (partnerId: string) => {
    const driver = await getUetdsDriverOption({ scope: "partner", partnerId, driverId });
    const vehicle = await getUetdsVehicleOption({ scope: "partner", partnerId, vehicleId });
    const eligibility = evaluateUetdsEligibility({ driverId: driver?.id, vehicleId: vehicle?.id,
      driverCompanyId: driver?.uetdsCompanyId, vehicleCompanyId: vehicle?.uetdsCompanyId,
      company: selectedFleetCompany(driver, vehicle) });
    return { driver, vehicle, eligibility };
  };
  try {
    await t.test("reproduce Ugur error while owner remains eligible", async () => {
      const failing = await pair(partner);
      assert.ok(failing.driver && failing.vehicle);
      assert.equal(failing.eligibility.reason, "external");
      assert.equal((await pair(owner)).eligibility.ok, true);
      const result = await submitUetdsNotification(input);
      assert.ok(!result.ok && result.error === "ineligible");
    });
    await t.test("proven own authority repairs exactly one missing binding", async () => {
      await pool.query(repair);
      const fixed = await pair(partner);
      assert.equal(fixed.driver?.uetdsCompanyId, companyId);
      assert.equal(fixed.vehicle?.uetdsCompanyId, companyId);
      assert.equal(fixed.driver?.defaultAuthorityId, "e1c9934c-3178-4216-b441-9c042d17545b");
      assert.equal(fixed.eligibility.ok, true);
      assert.equal((await pair(owner)).eligibility.ok, true);
    });
    await t.test("form lists and server submission agree on company eligibility", async () => {
      const drivers = await listUetdsDriverOptions({ scope: "partner", partnerId: partner });
      const vehicles = await listUetdsVehicleOptions({ scope: "partner", partnerId: partner });
      assert.equal(drivers.find(d => d.id === driverId)?.uetdsCompanyId, companyId);
      assert.equal(vehicles.find(v => v.id === vehicleId)?.uetdsCompanyId, companyId);
      const result = await submitUetdsNotification(input);
      assert.ok(!result.ok && result.error === "missing", "deliberately incomplete draft passes company/subscription gates without sending");
    });
    const outsider = (await pool.query("SELECT id FROM partners p WHERE p.deleted_at IS NULL AND p.status='active' AND NOT partner_can_access_vehicle(p.id,$1) AND NOT partner_can_access_driver(p.id,$2) LIMIT 1", [vehicleId, driverId])).rows[0]?.id;
    assert.ok(outsider);
    await t.test("unshared vehicle and driver remain forbidden", async () => {
      const inaccessible = await pair(outsider);
      assert.equal(inaccessible.driver, null);
      assert.equal(inaccessible.vehicle, null);
      const result = await submitUetdsNotification({ ...input, actorUserId: outsider, partnerId: outsider });
      assert.ok(!result.ok && result.error === "forbidden");
    });
    await t.test("another shared partner does not inherit owner's company", async () => {
      await pool.query("INSERT INTO partner_vehicle_access(vehicle_id,partner_id,uetds_company_id) VALUES($1,$2,NULL)", [vehicleId, outsider]);
      const shared = await pair(outsider);
      assert.ok(shared.vehicle);
      assert.equal(shared.vehicle.uetdsCompanyId, null);
      assert.equal(shared.eligibility.ok, false);
      await pool.query("DELETE FROM partner_vehicle_access WHERE vehicle_id=$1 AND partner_id=$2", [vehicleId, outsider]);
    });
    await t.test("different or missing companies continue to fail", async () => {
      const fixed = await pair(partner);
      assert.equal(evaluateUetdsEligibility({ driverId, vehicleId, driverCompanyId: companyId,
        vehicleCompanyId: "c78c8e3d-34ae-4361-ae30-adcffd9f4ef7", company: fixed.driver!.company }).ok, false);
      await pool.query("UPDATE partner_vehicle_access SET uetds_company_id=NULL WHERE vehicle_id=$1 AND partner_id=$2", [vehicleId, partner]);
      assert.equal((await pair(partner)).eligibility.ok, false);
      await pool.query(repair);
    });
    await t.test("driver identity, notifications and shared visibility are preserved", async () => {
      assert.equal(Number((await pool.query("SELECT count(*) FROM partner_drivers")).rows[0].count), driverCount);
      assert.equal(JSON.stringify((await pool.query("SELECT id,md5(row_to_json(n)::text) AS digest FROM uetds_notifications n ORDER BY id")).rows), notifications);
      assert.equal(JSON.stringify((await pool.query("SELECT p.id,count(n.id) AS count FROM partners p LEFT JOIN uetds_notifications n ON partner_can_access_uetds_notification(p.id,n.id) GROUP BY p.id ORDER BY p.id")).rows), visibility);
      assert.equal(network, 0);
    });
  } finally {
    globals.tripeticaPgPool = originalPool;
    globalThis.fetch = originalFetch;
    for (const key of Object.keys(process.env)) if (!(key in environment)) delete process.env[key];
    Object.assign(process.env, environment);
    await pool.end();
  }
});
