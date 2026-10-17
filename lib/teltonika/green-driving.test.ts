import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { encodeAvl, parseAvlFrame, type TeltonikaRecord } from "@/lib/teltonika/codec";
import { formatGreenDrivingValue, teltonikaGreenDriving } from "@/lib/teltonika/green-driving";

function record(io: TeltonikaRecord["io"], eventId = 253): TeltonikaRecord {
  return {
    timestampMs: Date.parse("2026-10-14T12:00:00.000Z"),
    priority: 1,
    longitude: 29.0,
    latitude: 41.0,
    altitudeM: 10,
    headingDeg: 90,
    satellites: 12,
    speedKmh: 40,
    eventId,
    io,
  };
}

test("Codec 8 keeps AVL 253 and 254, and only types 1, 2, and 3 are events", () => {
  const packet = encodeAvl({
    codec: "codec8",
    records: [record([{ id: 253, value: 1 }, { id: 254, value: 25 }, { id: 1, value: 1 }])],
  });
  const parsed = parseAvlFrame(packet);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  const event = teltonikaGreenDriving(parsed.value.records[0]!);
  assert.deepEqual(event && { kind: event.kind, rawValue: event.rawValue }, { kind: "acceleration", rawValue: 25 });
  assert.equal(teltonikaGreenDriving(record([{ id: 253, value: 2 }, { id: 254, value: 27 }]))?.kind, "braking");
  assert.equal(teltonikaGreenDriving(record([{ id: 253, value: 3 }, { id: 254, value: 34 }]))?.kind, "cornering");
  assert.equal(teltonikaGreenDriving(record([{ id: 253, value: 0 }, { id: 254, value: 25 }])), null);
  assert.equal(teltonikaGreenDriving(record([{ id: 253, value: 4 }])), null);
  assert.equal(teltonikaGreenDriving(record([{ id: 239, value: 1 }])), null);
  assert.equal(teltonikaGreenDriving(record([{ id: 253, value: 2 }]))?.rawValue, null);
  assert.equal(formatGreenDrivingValue("acceleration", 25, "tr"), "0,25 g");
  assert.equal(formatGreenDrivingValue("cornering", 34, "en"), "0.34 rad/s");
});

test("green driving is stored beside positions and does not enter the immobilizer or ATS path", () => {
  const store = readFileSync(new URL("./store.ts", import.meta.url), "utf8");
  const ingest = readFileSync(new URL("../gps/ingest.ts", import.meta.url), "utf8");
  assert.match(store, /INSERT INTO gps_green_driving_events/);
  assert.match(store, /ON CONFLICT \(device_id, recorded_at, kind\) DO NOTHING/);
  assert.match(store, /ingestTelemetry\(device\.id, points, \[\]\)/);
  assert.match(store, /dout1Readings/);
  assert.doesNotMatch(store, /setdigout|gps_ats_settings|UPDATE gps_positions/);
  assert.doesNotMatch(ingest, /green_driving|253|254/);
});
