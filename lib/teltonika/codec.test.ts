import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { connect, type AddressInfo } from "node:net";
import test from "node:test";
import { pointError } from "@/lib/gps/contract";
import {
  gpsReceiver,
  teltonikaImeiAllowed,
  teltonikaIgnition,
  teltonikaPoint,
  teltonikaSequences,
} from "@/lib/teltonika/accept";
import {
  crc16Ibm,
  encodeAck,
  encodeAvl,
  encodeImei,
  imeiResponse,
  parseAvlFrame,
  parseImeiFrame,
  type TeltonikaPacket,
  type TeltonikaRecord,
} from "@/lib/teltonika/codec";
import { startTeltonikaServer } from "@/lib/teltonika/server";

const now = new Date("2026-10-09T12:00:00.000Z");

function record(override: Partial<TeltonikaRecord> = {}): TeltonikaRecord {
  return {
    timestampMs: Date.parse("2026-10-09T11:30:00.000Z"),
    priority: 0,
    longitude: 28.8129253,
    latitude: 41.0334435,
    altitudeM: 42,
    headingDeg: 180,
    satellites: 14,
    speedKmh: 36,
    eventId: 0,
    io: [{ id: 239, value: 1 }],
    ...override,
  };
}

test("CRC-16/IBM matches the standard check value", () => {
  assert.equal(crc16Ibm(Buffer.from("123456789")), 0xbb3d);
});

test("Codec 8 and Codec 8 Extended round-trip coordinates, ignition, and CRC", () => {
  const codec8: TeltonikaPacket = { codec: "codec8", records: [record(), record({ timestampMs: record().timestampMs + 5_000, speedKmh: 0, io: [{ id: 239, value: 0 }] })] };
  const encoded = encodeAvl(codec8);
  const parsed = parseAvlFrame(encoded);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.codec, "codec8");
  assert.equal(parsed.value.records.length, 2);
  assert.equal(parsed.value.records[0]?.latitude.toFixed(7), "41.0334435");
  assert.equal(parsed.value.records[0]?.longitude.toFixed(7), "28.8129253");
  assert.equal(parsed.value.records[0]?.speedKmh, 36);
  assert.equal(teltonikaIgnition(parsed.value.records[0]!), "on");
  assert.equal(teltonikaIgnition(parsed.value.records[1]!), "off");
  const point = teltonikaPoint(parsed.value.records[0]!, teltonikaSequences(parsed.value.records)[0] ?? 0, now);
  assert.ok("point" in point);
  if ("point" in point) {
    assert.equal(point.point.speedMps, 10);
    assert.equal(pointError(point.point, now), null);
  }

  const codec8e: TeltonikaPacket = {
    codec: "codec8e",
    records: [record({ eventId: 239, io: [{ id: 239, value: 1 }, { id: 66, value: 12_600 }, { id: 900, value: null }] })],
  };
  const extended = parseAvlFrame(encodeAvl(codec8e));
  assert.equal(extended.ok, true);
  if (!extended.ok) return;
  assert.equal(extended.value.codec, "codec8e");
  assert.equal(extended.value.records[0]?.io.find((item) => item.id === 66)?.value, 12_600);
  assert.equal(teltonikaIgnition(extended.value.records[0]!), "on");
});

test("a broken CRC is rejected and a repeated packet keeps the same sequence", () => {
  const packet: TeltonikaPacket = { codec: "codec8", records: [record(), record()] };
  const encoded = encodeAvl(packet);
  encoded[20] ^= 0xff;
  const broken = parseAvlFrame(encoded);
  assert.equal(broken.ok, false);
  if (broken.ok || !("error" in broken)) return;
  assert.equal(broken.error, "crc");
  assert.equal(broken.consumed, encoded.length);
  const first = teltonikaSequences(packet.records);
  const second = teltonikaSequences(packet.records);
  assert.deepEqual(first, second);
  assert.notEqual(first[0], first[1]);
  const noFix = teltonikaPoint(record({ latitude: 0, longitude: 0 }), first[0] ?? 1, now);
  assert.deepEqual(noFix, { error: "invalid_coordinate" });
});

test("IMEI handshake accepts only an active Teltonika row", () => {
  const imei = "356307042441013";
  const frame = parseImeiFrame(encodeImei(imei));
  assert.equal(frame.ok && frame.value, imei);
  assert.deepEqual([...imeiResponse(true)], [1]);
  assert.deepEqual([...imeiResponse(false)], [0]);
  assert.deepEqual([...encodeAck(2)], [0, 0, 0, 2]);
  assert.equal(teltonikaImeiAllowed({ imei, receiver: "teltonika", status: "active", trackerModel: "fmb920" }), true);
  assert.equal(teltonikaImeiAllowed({ imei, receiver: "teltonika", status: "active", trackerModel: "fmc920" }), true);
  assert.equal(teltonikaImeiAllowed({ imei, receiver: "esp32", status: "active", trackerModel: null }), false);
  assert.equal(teltonikaImeiAllowed({ imei, receiver: "teltonika", status: "disabled", trackerModel: "fmb920" }), false);
  assert.equal(teltonikaImeiAllowed({ imei, receiver: "teltonika", status: "active", trackerModel: null }), false);
  assert.equal(gpsReceiver(undefined), "esp32");
  assert.equal(gpsReceiver("teltonika"), "teltonika");
  assert.equal(gpsReceiver("other"), null);
  const partial = parseImeiFrame(encodeImei(imei).subarray(0, 4));
  assert.equal(partial.ok, false);
  if (!partial.ok && "need" in partial) assert.ok(partial.need > 4);
});

test("TCP listener answers the handshake, ACKs AVL, and rejects a second socket for the same IMEI", async () => {
  const imei = "356307042441013";
  const stored: number[] = [];
  const server = await startTeltonikaServer({
    handlers: {
      authorize: async (candidate) => candidate === imei,
      store: async (_candidate, packet) => {
        stored.push(packet.records.length);
        return { ack: packet.records.length };
      },
    },
  });
  const address = server.address() as AddressInfo;
  const packet = encodeAvl({ codec: "codec8", records: [record()] });
  const first = connect(address.port, "127.0.0.1");
  const greeting = encodeImei(imei);
  const accepted = await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    first.on("data", (chunk) => {
      chunks.push(chunk);
      if (Buffer.concat(chunks).length >= 1) resolve(Buffer.concat(chunks));
    });
    first.on("error", reject);
    first.write(greeting.subarray(0, 3));
    first.write(greeting.subarray(3));
  });
  assert.equal(accepted[0], 1);
  const ack = await new Promise<Buffer>((resolve, reject) => {
    first.once("data", (chunk) => resolve(chunk));
    first.on("error", reject);
    first.write(packet.subarray(0, 10));
    first.write(packet.subarray(10));
  });
  assert.deepEqual([...ack], [0, 0, 0, 1]);
  const second = connect(address.port, "127.0.0.1");
  const denied = await new Promise<Buffer>((resolve, reject) => {
    second.on("data", (chunk) => resolve(chunk));
    second.on("error", reject);
    second.write(encodeImei(imei));
  });
  assert.equal(denied[0], 0);
  first.destroy();
  second.destroy();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  assert.deepEqual(stored, [1]);
});

test("ESP32 device API and ATS source selection stay outside the Teltonika listener", () => {
  const routes = [
    "app/api/device/v1/telemetry/route.ts",
    "app/api/device/v1/heartbeat/route.ts",
    "app/api/device/v1/commands/route.ts",
  ];
  for (const route of routes) {
    assert.doesNotMatch(readFileSync(new URL(`../../${route}`, import.meta.url), "utf8"), /teltonika/);
  }
  const ats = readFileSync(new URL("../gps/ats-run.ts", import.meta.url), "utf8");
  assert.match(ats, /settings\.source_device_id/);
  assert.match(ats, /WHERE device_id = \$1 AND vehicle_id = \$2/);
  assert.doesNotMatch(ats, /teltonika|receiver/);
  const store = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
  assert.doesNotMatch(store, /gps_ats_settings|UPDATE gps_positions|DELETE FROM gps/);
  assert.match(store, /receiver/);
  const listener = readFileSync(new URL("../../scripts/teltonika-listen.ts", import.meta.url), "utf8");
  assert.match(listener, /teltonika_listener_blocked/);
  assert.match(listener, /EXPECTED_DATABASE/);
  assert.match(listener, /127\.0\.0\.1/);
  assert.doesNotMatch(listener, /systemctl|tripetica-prod/);
});
