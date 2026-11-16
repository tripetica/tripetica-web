import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { storeTeltonikaPacket } from "../teltonika/store";
import { listVehicleGreenDriving } from "../gps/drive-store";
import { encodeAvl, parseAvlFrame, type TeltonikaRecord } from "../teltonika/codec";

test("real PostgreSQL green-driving atomicity and retries", { skip: !process.env.GREEN_DRIVING_TEST_SOCKET }, async () => {
  const socket = process.env.GREEN_DRIVING_TEST_SOCKET!;
  assert.ok(socket.startsWith("/tmp/tripetica-green-pg."));
  const pool = new Pool({ host: socket, port: 55432, database: "tripetica_dev", user: "postgres", max: 4 });
  const globals = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const before = globals.tripeticaPgPool;
  const deviceId = randomUUID();
  const imei = "999999999999991";
  try {
    const identity = await pool.query("SELECT current_database() AS name");
    assert.equal(identity.rows[0].name, "tripetica_dev");
    const fixture = (await pool.query("SELECT id, partner_id FROM partner_vehicles WHERE partner_id IS NOT NULL AND deleted_at IS NULL LIMIT 1")).rows[0];
    assert.ok(fixture);
    await pool.query("INSERT INTO gps_devices(id,imei,receiver,status,tracker_model,partner_id,vehicle_id,label,device_code) VALUES($1,$2,'teltonika','active','fmb920',$3,$4,'isolated-test','TPT-AABBCCDDEEFF')", [deviceId, imei, fixture.partner_id, fixture.id]);
    await pool.query("INSERT INTO gps_device_status(device_id) VALUES($1)", [deviceId]);
    globals.tripeticaPgPool = pool;
    const now = new Date();
    const record = (delta = 0, raw = 25): TeltonikaRecord => ({ timestampMs: now.getTime() + delta, priority: 1,
      longitude: 29, latitude: 41, altitudeM: 10, headingDeg: 90, satellites: 10, speedKmh: 40,
      eventId: 253, io: [{ id: 253, value: 1 }, { id: 254, value: raw }] });
    const packet = (records: TeltonikaRecord[], codec: "codec8" | "codec8e" = "codec8") => {
      const parsed = parseAvlFrame(encodeAvl({ codec, records }));
      assert.ok(parsed.ok);
      if (!parsed.ok) throw new Error("fixture_codec");
      return parsed.value;
    };
    const count = async (table: string) => Number((await pool.query(`SELECT count(*) FROM ${table} WHERE device_id=$1`, [deviceId])).rows[0].count);
    let injectFailure = true;
    globals.tripeticaPgPool = { connect: async () => {
      const client = await pool.connect();
      const query = client.query.bind(client);
      return { release: () => client.release(), query: async (sql: string, values: unknown[]) => {
        if (injectFailure && sql.includes("INSERT INTO gps_green_driving_events")) {
          injectFailure = false;
          throw Object.assign(new Error("private fixture detail"), { code: "23514" });
        }
        return query(sql, values);
      } };
    } };
    await assert.rejects(storeTeltonikaPacket(imei, packet([record()]), now));
    assert.equal(await count("gps_positions"), 0, "position rolls back when event insert fails");
    assert.equal(await count("gps_green_driving_events"), 0);
    globals.tripeticaPgPool = pool;
    assert.equal((await storeTeltonikaPacket(imei, packet([record()]), now)).ack, 1);
    await storeTeltonikaPacket(imei, packet([record()]), now);
    assert.equal(await count("gps_positions"), 1);
    assert.equal(await count("gps_green_driving_events"), 1);
    await storeTeltonikaPacket(imei, packet([record(0, 26)], "codec8e"), now);
    await storeTeltonikaPacket(imei, packet([record(0, 26)], "codec8e"), now);
    assert.equal(await count("gps_green_driving_event_variants"), 1, "distinct value preserved once");
    await Promise.all(Array.from({ length: 8 }, () => storeTeltonikaPacket(imei, packet([record(1000)]), now)));
    assert.equal(await count("gps_green_driving_events"), 2, "concurrent duplicate is idempotent");
    await storeTeltonikaPacket(imei, packet([record(-60 * 60_000)]), now);
    assert.equal(await count("gps_green_driving_events"), 3, "late event within bound survives stale position");
    assert.equal(await count("gps_positions"), 2);
    await storeTeltonikaPacket(imei, packet([{ ...record(2000), speedKmh: 65535 }]), now);
    assert.equal(await count("gps_green_driving_events"), 4, "invalid speed does not discard valid event");
    await storeTeltonikaPacket(imei, packet([record(-25 * 60 * 60_000)]), now);
    assert.equal(await count("gps_green_driving_events"), 4);
    await storeTeltonikaPacket(imei, packet(Array.from({ length: 12 }, (_, i) => record(3000, i + 10))), now);
    assert.equal(await count("gps_green_driving_events"), 5);
    assert.equal(await count("gps_green_driving_event_variants"), 12, "events beyond sequence occurrence cap retained");
    for (const [index, kind] of [2, 3].entries()) {
      const reading = record(4000 + index * 1000);
      reading.io[0].value = kind;
      await storeTeltonikaPacket(imei, packet([reading], "codec8e"), now);
    }
    const view = await listVehicleGreenDriving({ partnerId: fixture.partner_id, vehicleId: fixture.id,
      from: new Date(now.getTime() - 2 * 60 * 60_000), to: new Date(now.getTime() + 60_000) });
    assert.ok(view.events.some(event => event.rawValue === 26), "variant reaches driving analysis query");
    assert.ok(view.events.some(event => event.kind === "braking"));
    assert.ok(view.events.some(event => event.kind === "cornering"));
  } finally {
    globals.tripeticaPgPool = before;
    await pool.end();
  }
});
