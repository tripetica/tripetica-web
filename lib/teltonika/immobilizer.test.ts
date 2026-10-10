import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { encodeCodec12, parseCodec12, parseGetio, parseSetdigoutReply } from "@/lib/teltonika/codec12";
import {
  dout1Readings,
  doutDispatchAllowed,
  immobilizerCommandText,
  immobilizerControlAllowed,
  immobilizerDuplicate,
  immobilizerView,
  planImmobilizerCommand,
  setIgnDigoutAvailable,
  FMB920_FIRMWARE,
} from "@/lib/teltonika/immobilizer";

const openGate = {
  NODE_ENV: "development",
  EXPECTED_DATABASE: "tripetica_dev",
  TELTONIKA_DOUT_DISPATCH: "dev-approved",
};

test("Codec 12 matches Teltonika's published getio frame and getio reply", () => {
  const frame = encodeCodec12("getio");
  assert.equal(frame.toString("hex"), "000000000000000d0c010500000005676574696f01000000cb");
  const parsed = parseCodec12(frame);
  assert.equal(parsed.ok && parsed.value.text, "getio");
  const reply = Buffer.from(
    "00000000000000370c01060000002f4449313a31204449323a30204449333a302041494e313a302041494e323a313639323420444f313a3020444f323a3101000066e3",
    "hex",
  );
  const response = parseCodec12(reply);
  assert.equal(response.ok && response.value.kind, "response");
  if (!response.ok) return;
  assert.equal(response.value.text, "DI1:1 DI2:0 DI3:0 AIN1:0 AIN2:16924 DO1:0 DO2:1");
  assert.deepEqual(parseGetio(response.value.text), { dout1: "off" });
  const broken = Buffer.from(frame);
  broken[20] ^= 0xff;
  const rejected = parseCodec12(broken);
  assert.equal(rejected.ok, false);
  if (!rejected.ok && "error" in rejected) assert.equal(rejected.error, "crc");
});

test("FMB920 03.27.14 uses setdigout without a speed queue, and setigndigout is a later firmware", () => {
  assert.equal(setIgnDigoutAvailable(FMB920_FIRMWARE), false);
  assert.equal(setIgnDigoutAvailable("03.28.02.Rev.00"), false);
  assert.equal(setIgnDigoutAvailable("03.28.03.Rev.00"), true);
  assert.equal(immobilizerCommandText("on", "fmb920"), "setdigout 1");
  assert.equal(immobilizerCommandText("off", "fmc920"), "setdigout 0");
  assert.equal(immobilizerCommandText("on", "fmb920")?.includes("?"), false);
  assert.equal(immobilizerCommandText("on", "fmc920")?.includes("setigndigout"), false);
  assert.deepEqual(parseSetdigoutReply("DOUT1:ON Timeout:INFINITY"), { accepted: true, dout1: "on", queued: false });
  assert.deepEqual(parseSetdigoutReply("DOUT1:1 Timeout:15s Speed:20 QUEUED"), { accepted: false, dout1: "on", queued: true });
  assert.equal(parseSetdigoutReply("DOUT1:Is disabled from CFG").accepted, false);
  assert.equal(dout1Readings([{ io: [{ id: 179, value: 1 }, { id: 239, value: 1 }] }, { io: [{ id: 179, value: 0 }] }]), "off");
  assert.equal(dout1Readings([{ io: [{ id: 179, value: 2 }] }]), null);
});

test("output commands stay closed, and a moving vehicle is not queued for later", () => {
  assert.equal(doutDispatchAllowed({}), false);
  assert.equal(doutDispatchAllowed({ ...openGate, NODE_ENV: "production" }), false);
  assert.equal(doutDispatchAllowed({ ...openGate, EXPECTED_DATABASE: "tripetica" }), false);
  assert.equal(planImmobilizerCommand({ request: "on", model: "fmb920", speedMps: 0, env: {} }).phase, "withheld");
  assert.equal(planImmobilizerCommand({ request: "on", model: "fmc920", speedMps: 12, env: openGate }).reason, "moving");
  assert.equal(planImmobilizerCommand({ request: "on", model: "fmb920", speedMps: null, env: openGate }).reason, "speed_unknown");
  assert.equal(planImmobilizerCommand({ request: "off", model: "fmc920", speedMps: 0, env: openGate }).phase, "queued");
  assert.equal(planImmobilizerCommand({ request: "on", model: null, speedMps: 0, env: openGate }).reason, "unsupported_model");
  assert.equal(immobilizerDuplicate({ request: "on", phase: "sent", ageMs: 1_000 }, "off"), true);
  assert.equal(immobilizerDuplicate({ request: "on", phase: "withheld", ageMs: 1_000 }, "on"), true);
  assert.equal(immobilizerDuplicate({ request: "on", phase: "withheld", ageMs: 6_000 }, "on"), false);
});

test("device output, not the user request, decides active and passive", () => {
  assert.equal(immobilizerView({ presence: "offline", output: "on", phase: "none", commandAgeMs: null }), "offline");
  assert.equal(immobilizerView({ presence: "stale", output: "off", phase: "none", commandAgeMs: null }), "offline");
  assert.equal(immobilizerView({ presence: "online", output: "unknown", phase: "withheld", commandAgeMs: 10 }), "unknown");
  assert.equal(immobilizerView({ presence: "online", output: "unknown", phase: "none", commandAgeMs: null }), "unknown");
  assert.equal(immobilizerView({ presence: "online", output: "on", phase: "acknowledged", commandAgeMs: 10 }), "active");
  assert.equal(immobilizerView({ presence: "online", output: "off", phase: "acknowledged", commandAgeMs: 10 }), "passive");
  assert.equal(immobilizerView({ presence: "online", output: "off", phase: "sent", commandAgeMs: 1_000 }), "pending");
  assert.equal(immobilizerView({ presence: "online", output: "off", phase: "sent", commandAgeMs: 46_000 }), "error");
  assert.equal(immobilizerView({ presence: "online", output: "on", phase: "rejected", commandAgeMs: 10 }), "error");
  const allowed = {
    surface: "partner" as const,
    opsCanManage: false,
    partnerIsPrimary: true,
    actorPartnerId: "partner-1",
    devicePartnerId: "partner-1",
    deviceReceiver: "teltonika",
    vehicleId: "vehicle-1",
    deviceVehicleId: "vehicle-1",
    deviceCount: 1,
  };
  assert.equal(immobilizerControlAllowed(allowed), true);
  assert.equal(immobilizerControlAllowed({ ...allowed, partnerIsPrimary: false }), false);
  assert.equal(immobilizerControlAllowed({ ...allowed, actorPartnerId: "other" }), false);
  assert.equal(immobilizerControlAllowed({ ...allowed, deviceReceiver: "esp32" }), false);
  assert.equal(immobilizerControlAllowed({ ...allowed, deviceCount: 2 }), false);
  assert.equal(immobilizerControlAllowed({ ...allowed, surface: "ops", partnerIsPrimary: false }), false);
  assert.equal(immobilizerControlAllowed({ ...allowed, surface: "ops", opsCanManage: true }), true);
});

test("immobilizer requests stay out of the ESP32 command queue and the AVL listener", () => {
  const action = readFileSync(new URL("../gps/immobilizer-actions.ts", import.meta.url), "utf8");
  const listener = readFileSync(new URL("../../scripts/teltonika-listen.ts", import.meta.url), "utf8");
  const ats = readFileSync(new URL("../gps/ats-run.ts", import.meta.url), "utf8");
  const live = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(action, /queueGpsCommand|setdigout|gps_commands/);
  assert.doesNotMatch(listener, /setdigout|immobilizer/);
  assert.doesNotMatch(ats, /immobilizer|setdigout/);
  assert.match(live, /immobilizer \?/);
  assert.match(live, /fleetNoPosition/);
  assert.match(readFileSync(new URL("../../components/gps/immobilizer-switch.tsx", import.meta.url), "utf8"), /aria-checked/);
  assert.doesNotMatch(readFileSync(new URL("../../components/gps/immobilizer-switch.tsx", import.meta.url), "utf8"), /checked=\{currentRequest/);
  assert.match(live, /GpsImmobilizerSwitch/);
  assert.match(readFileSync(new URL("../../components/gps/device-workspace.tsx", import.meta.url), "utf8"), /deviceControls/);
});
