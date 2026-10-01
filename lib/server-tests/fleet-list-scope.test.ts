import test from "node:test";
import assert from "node:assert/strict";
import { listFleetChoicesForPartners } from "../partner/fleet-pairing";
import {
  setDriverListAuthority,
  setDriverListCompany,
  setDriverListVehicle,
  setVehicleListDriver,
} from "../partner/fleet-list-patch";

const partnerA = "11111111-1111-4111-8111-111111111111";
const partnerB = "22222222-2222-4222-8222-222222222222";
const driverA = "33333333-3333-4333-8333-333333333333";
const foreignDriver = "55555555-5555-4555-8555-555555555555";
const vehicleA = "66666666-6666-4666-8666-666666666666";
const foreignVehicle = "88888888-8888-4888-8888-888888888888";
const authorityA = "99999999-9999-4999-8999-999999999999";
const foreignAuthority = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const companyA = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const companyB = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

test("list choices and inline patches stay inside one partner", async () => {
  const globals = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const before = globals.tripeticaPgPool;
  let authorityCleared = false;

  globals.tripeticaPgPool = {
    query: async (sql: string, values: unknown[] = []) => {
      assert.doesNotMatch(sql, /password_sealed|identity_sealed|SELECT \*/);
      if (sql.includes("FROM partner_vehicles") && sql.includes("plate")) {
        return {
          rows: [
            { id: vehicleA, partner_id: partnerA, plate: "34 A" },
            { id: foreignVehicle, partner_id: partnerB, plate: "06 B" },
          ],
        };
      }
      if (sql.includes("FROM partner_drivers") && sql.includes("first_name") && sql.includes("ANY")) {
        return {
          rows: [
            { id: driverA, partner_id: partnerA, first_name: "A", last_name: "Driver" },
            { id: foreignDriver, partner_id: partnerB, first_name: "B", last_name: "Driver" },
          ],
        };
      }
      if (sql.includes("FROM partner_uetds_authorities a") && sql.includes("array_agg")) {
        return {
          rows: [
            {
              id: authorityA,
              partner_id: partnerA,
              first_name: "A",
              last_name: "Auth",
              company_ids: [companyA],
            },
            {
              id: foreignAuthority,
              partner_id: partnerB,
              first_name: "B",
              last_name: "Auth",
              company_ids: [companyA],
            },
          ],
        };
      }
      if (sql.includes("SELECT uetds_company_id, default_edevlet_authority_id")) {
        if (values[0] === driverA && values[1] === partnerA) {
          return { rows: [{ uetds_company_id: companyA, default_edevlet_authority_id: authorityA }] };
        }
        return { rows: [] };
      }
      if (sql.includes("FROM uetds_companies") && sql.includes("status = 'active'")) {
        return { rows: values[0] === companyB ? [{ id: companyB }] : [] };
      }
      if (sql.includes("SELECT id, short_name FROM uetds_companies")) {
        return { rows: values[0] === companyB ? [{ id: companyB, short_name: "OTHER" }] : [] };
      }
      if (sql.includes("SET uetds_company_id = $3")) {
        return { rows: [] };
      }
      if (sql.includes("FROM partner_uetds_authorities a") && sql.includes("company_id = $3")) {
        return { rows: [] };
      }
      if (sql.includes("SET default_edevlet_authority_id = NULL")) {
        authorityCleared = true;
        return { rows: [] };
      }
      if (sql.includes("JOIN partner_vehicles")) {
        return { rows: [] };
      }
      if (sql.includes("SELECT uetds_company_id") && !sql.includes("default_edevlet_authority_id")) {
        return {
          rows:
            values[0] === driverA && values[1] === partnerA ? [{ uetds_company_id: companyA }] : [],
        };
      }
      if (sql.includes("SELECT id FROM partner_drivers")) {
        return {
          rows: values[0] === driverA && values[1] === partnerA ? [{ id: driverA }] : [],
        };
      }
      if (sql.includes("FROM partner_vehicles") && sql.startsWith("SELECT id")) {
        return { rows: [] };
      }
      if (sql.includes("FROM partner_fleet_defaults")) {
        return { rows: [] };
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
  };

  try {
    const choices = await listFleetChoicesForPartners([partnerA]);
    assert.deepEqual(choices[partnerA]?.vehicles.map((item) => item.id), [vehicleA]);
    assert.equal(choices[partnerA]?.vehicles.some((item) => item.id === foreignVehicle), false);
    assert.deepEqual(choices[partnerA]?.drivers.map((item) => item.id), [driverA]);
    assert.equal(choices[partnerB], undefined);
    assert.deepEqual(choices[partnerA]?.authorities.map((item) => item.id), [authorityA]);
    assert.equal(
      choices[partnerA]?.authorities.some((item) => item.id === foreignAuthority),
      false,
    );

    const company = await setDriverListCompany({
      partnerId: partnerA,
      driverId: driverA,
      companyId: companyB,
    });
    assert.equal(company.ok, true);
    if (company.ok) {
      assert.equal(company.companyId, companyB);
      assert.equal(company.authorityId, null);
    }
    assert.equal(authorityCleared, true);

    assert.equal(
      (
        await setDriverListVehicle({
          partnerId: partnerA,
          driverId: driverA,
          vehicleId: foreignVehicle,
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await setDriverListAuthority({
          partnerId: partnerA,
          driverId: driverA,
          authorityId: foreignAuthority,
        })
      ).ok,
      false,
    );
    assert.equal(
      (
        await setVehicleListDriver({
          partnerId: partnerA,
          vehicleId: vehicleA,
          driverId: foreignDriver,
        })
      ).ok,
      false,
    );
  } finally {
    globals.tripeticaPgPool = before;
  }
});
