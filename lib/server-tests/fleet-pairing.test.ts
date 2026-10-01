import test from "node:test";
import assert from "node:assert/strict";
import {
  saveDriverAuthority,
  saveDriverVehiclePair,
  saveVehicleDriverPair,
} from "../partner/fleet-pairing";

const partnerA = "11111111-1111-4111-8111-111111111111";
const partnerB = "22222222-2222-4222-8222-222222222222";
const driverA = "33333333-3333-4333-8333-333333333333";
const driverB = "44444444-4444-4444-8444-444444444444";
const foreignDriver = "55555555-5555-4555-8555-555555555555";
const vehicleA = "66666666-6666-4666-8666-666666666666";
const vehicleB = "77777777-7777-4777-8777-777777777777";
const foreignVehicle = "88888888-8888-4888-8888-888888888888";
const authorityA = "99999999-9999-4999-8999-999999999999";
const authorityOff = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const foreignAuthority = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const company = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

type Driver = { id: string; partnerId: string; deleted: boolean; companyId: string | null; authorityId: string | null };
type Vehicle = { id: string; partnerId: string; deleted: boolean };
type Pair = { partnerId: string; driverId: string; vehicleId: string };
type Authority = {
  id: string;
  partnerId: string;
  status: "active" | "inactive";
  deleted: boolean;
  companyIds: string[];
};

test("one fleet pairing is shared, replaceable, and partner-owned", async () => {
  const globals = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const before = globals.tripeticaPgPool;
  const drivers: Driver[] = [
    { id: driverA, partnerId: partnerA, deleted: false, companyId: company, authorityId: null },
    { id: driverB, partnerId: partnerA, deleted: false, companyId: null, authorityId: null },
    { id: foreignDriver, partnerId: partnerB, deleted: false, companyId: company, authorityId: null },
  ];
  const vehicles: Vehicle[] = [
    { id: vehicleA, partnerId: partnerA, deleted: false },
    { id: vehicleB, partnerId: partnerA, deleted: false },
    { id: foreignVehicle, partnerId: partnerB, deleted: false },
  ];
  const authorities: Authority[] = [
    { id: authorityA, partnerId: partnerA, status: "active", deleted: false, companyIds: [company] },
    { id: authorityOff, partnerId: partnerA, status: "inactive", deleted: false, companyIds: [company] },
    { id: foreignAuthority, partnerId: partnerB, status: "active", deleted: false, companyIds: [company] },
  ];
  let pairs: Pair[] = [];

  globals.tripeticaPgPool = {
    query: async (sql: string, values: unknown[]) => {
      assert.doesNotMatch(sql, /password_sealed|identity_sealed|SELECT \*/);
      if (sql.includes("INSERT INTO partner_fleet_defaults")) {
        pairs.push({
          partnerId: String(values[0]),
          driverId: String(values[1]),
          vehicleId: String(values[2]),
        });
        return { rows: [{ driver_id: values[1] }] };
      }
      if (sql.includes("DELETE FROM partner_fleet_defaults") && sql.includes("OR vehicle_id")) {
        pairs = pairs.filter(
          (pair) =>
            !(
              pair.partnerId === values[0] &&
              (pair.driverId === values[1] || pair.vehicleId === values[2])
            ),
        );
        return { rows: [] };
      }
      if (sql.includes("DELETE FROM partner_fleet_defaults") && sql.includes("driver_id = $2")) {
        pairs = pairs.filter((pair) => !(pair.partnerId === values[0] && pair.driverId === values[1]));
        return { rows: [] };
      }
      if (sql.includes("DELETE FROM partner_fleet_defaults") && sql.includes("vehicle_id = $2")) {
        pairs = pairs.filter((pair) => !(pair.partnerId === values[0] && pair.vehicleId === values[1]));
        return { rows: [] };
      }
      if (sql.includes("JOIN partner_vehicles")) {
        const driver = drivers.find(
          (item) => item.id === values[1] && item.partnerId === values[0] && !item.deleted,
        );
        const vehicle = vehicles.find(
          (item) => item.id === values[2] && item.partnerId === values[0] && !item.deleted,
        );
        return { rows: driver && vehicle ? [{ driver_id: driver.id }] : [] };
      }
      if (sql.includes("FROM partner_drivers") && sql.startsWith("SELECT id")) {
        const driver = drivers.find(
          (item) => item.id === values[0] && item.partnerId === values[1] && !item.deleted,
        );
        return { rows: driver ? [{ id: driver.id }] : [] };
      }
      if (sql.includes("FROM partner_vehicles") && sql.startsWith("SELECT id")) {
        const vehicle = vehicles.find(
          (item) => item.id === values[0] && item.partnerId === values[1] && !item.deleted,
        );
        return { rows: vehicle ? [{ id: vehicle.id }] : [] };
      }
      if (sql.includes("FROM partner_uetds_authorities")) {
        const authority = authorities.find(
          (item) =>
            item.id === values[0] &&
            item.partnerId === values[1] &&
            !item.deleted &&
            item.status === "active" &&
            (values[2] == null || item.companyIds.includes(String(values[2]))),
        );
        return { rows: authority ? [{ id: authority.id }] : [] };
      }
      if (sql.includes("SET default_edevlet_authority_id = NULL")) {
        const driver = drivers.find((item) => item.id === values[0] && item.partnerId === values[1]);
        if (driver) driver.authorityId = null;
        return { rows: [] };
      }
      if (sql.includes("SET default_edevlet_authority_id = $3")) {
        const driver = drivers.find((item) => item.id === values[0] && item.partnerId === values[1]);
        if (driver) driver.authorityId = String(values[2]);
        return { rows: [] };
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
  };

  try {
    assert.equal(pairs.length, 0);
    const fromVehicle = await saveVehicleDriverPair({
      partnerId: partnerA,
      vehicleId: vehicleA,
      driverId: driverA,
    });
    assert.equal(fromVehicle.ok, true);
    assert.deepEqual(pairs, [{ partnerId: partnerA, driverId: driverA, vehicleId: vehicleA }]);

    const fromDriver = await saveDriverVehiclePair({
      partnerId: partnerA,
      driverId: driverB,
      vehicleId: vehicleB,
    });
    assert.equal(fromDriver.ok, true);
    assert.equal(pairs.length, 2);

    const replaced = await saveDriverVehiclePair({
      partnerId: partnerA,
      driverId: driverA,
      vehicleId: vehicleB,
    });
    assert.equal(replaced.ok, true);
    assert.deepEqual(pairs, [{ partnerId: partnerA, driverId: driverA, vehicleId: vehicleB }]);

    const cleared = await saveVehicleDriverPair({
      partnerId: partnerA,
      vehicleId: vehicleB,
      driverId: null,
    });
    assert.equal(cleared.ok, true);
    assert.deepEqual(pairs, []);

    assert.equal(
      (await saveDriverVehiclePair({ partnerId: partnerA, driverId: driverA, vehicleId: foreignVehicle })).ok,
      false,
    );
    assert.equal(
      (await saveVehicleDriverPair({ partnerId: partnerA, vehicleId: vehicleA, driverId: foreignDriver })).ok,
      false,
    );
    assert.deepEqual(pairs, []);

    const linked = await saveDriverAuthority({
      partnerId: partnerA,
      driverId: driverA,
      authorityId: authorityA,
      companyId: company,
    });
    assert.equal(linked.ok, true);
    assert.equal(drivers[0]?.authorityId, authorityA);

    assert.equal(
      (
        await saveDriverAuthority({
          partnerId: partnerA,
          driverId: driverA,
          authorityId: foreignAuthority,
          companyId: company,
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await saveDriverAuthority({
          partnerId: partnerA,
          driverId: driverA,
          authorityId: authorityOff,
          companyId: company,
        })
      ).ok,
      false,
    );
    authorities[1]!.deleted = true;
    authorities[1]!.status = "active";
    assert.equal(
      (
        await saveDriverAuthority({
          partnerId: partnerA,
          driverId: driverA,
          authorityId: authorityOff,
          companyId: company,
        })
      ).ok,
      false,
    );
    assert.equal(drivers[0]?.authorityId, authorityA);
    assert.equal(
      (
        await saveDriverAuthority({
          partnerId: partnerA,
          driverId: driverB,
          authorityId: authorityA,
          companyId: null,
        })
      ).ok,
      true,
    );
  } finally {
    globals.tripeticaPgPool = before;
  }
});
