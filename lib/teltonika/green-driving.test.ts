import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { encodeAvl, parseAvlFrame, type TeltonikaRecord } from "@/lib/teltonika/codec";
import { formatGreenDrivingValue, greenDrivingEventError, teltonikaGreenDriving } from "@/lib/teltonika/green-driving";

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
  assert.match(store, /ingestTelemetry\(device\.id, points, \[\], client\)/);
  assert.match(store, /dout1Readings/);
  assert.doesNotMatch(store, /setdigout|gps_ats_settings|UPDATE gps_positions/);
  assert.doesNotMatch(ingest, /green_driving|253|254/);
});

test("both codecs retain unsigned green IO and ignore invalid duplicate fields", () => {
  for (const codec of ["codec8", "codec8e"] as const) {
    for (const kind of [1, 2, 3]) {
      const packet = encodeAvl({ codec, records: [record([
        { id: 253, value: 0 }, { id: 253, value: kind },
        { id: 254, value: null }, { id: 254, value: 65535 },
      ], 239)] });
      // Null variable IO is supported by Codec8E, not Codec8.
      if (codec === "codec8") {
        const parsed = parseAvlFrame(encodeAvl({ codec, records: [record([
          { id: 253, value: 0 }, { id: 253, value: kind }, { id: 254, value: 65535 },
        ], 239)] }));
        assert.ok(parsed.ok);
        if (parsed.ok) assert.equal(teltonikaGreenDriving(parsed.value.records[0]!)?.rawValue, 65535);
      } else {
        const parsed = parseAvlFrame(packet);
        assert.ok(parsed.ok);
        if (parsed.ok) {
          const event = teltonikaGreenDriving(parsed.value.records[0]!);
          assert.equal(event?.kind, ["acceleration", "braking", "cornering"][kind - 1]);
          assert.equal(event?.rawValue, 65535);
        }
      }
    }
  }
});

test("event acceptance is independent of speed, bounded by age and assignment", () => {
  const now = new Date("2026-11-12T12:00:00Z");
  const event = teltonikaGreenDriving({ ...record([{ id: 253, value: 1 }]), timestampMs: now.getTime() - 60 * 60_000 })!;
  assert.equal(greenDrivingEventError(event, now, null), null);
  assert.equal(greenDrivingEventError(event, now, now), "before_assignment");
  assert.equal(greenDrivingEventError({ ...event, recordedAtMs: now.getTime() - 25 * 60 * 60_000 }, now, null), "stale_event");
  assert.equal(greenDrivingEventError({ ...event, recordedAtMs: now.getTime() + 6 * 60_000 }, now, null), "future_time");
  assert.equal(greenDrivingEventError({ ...event, latitude: 91 }, now, null), "invalid_coordinate");
});

test("published Teltonika Codec8 hex decodes green type and value without re-encoding", () => {
  const hex = "000000000000005E08010000017716AE03D8010F0F22D720982E9C007E00120A002F FD 1609E F01F00150011505C80045010101 FD 03 FE 23 0BB5000BB60006423A0018002F430F8A4400000 901301100161200EC13FBD90F0384 02C7 000003BD 1003 066802000100005F75";
  const parsed = parseAvlFrame(Buffer.from(hex.replace(/\s/g, ""), "hex"));
  assert.ok(parsed.ok);
  if (parsed.ok) assert.equal(teltonikaGreenDriving(parsed.value.records[0]!)?.kind, "cornering");
});
