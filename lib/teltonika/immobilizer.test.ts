import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { encodeCodec12, parseCodec12, parseGetio, parseSetdigoutReply } from "@/lib/teltonika/codec12";
import { teltonikaDin1, TELTONIKA_DIN1_IO } from "@/lib/teltonika/accept";
import { gpsMapMarkerState, teltonikaMarkerState } from "@/lib/gps/map-popup";
import {
  immobilizerCapabilityChecked,
  dout1Readings,
  doutDispatchAllowed,
  immobilizerCommandText,
  immobilizerControlAllowed,
  immobilizerEnableGate,
  immobilizerSwitchPresentation,
  immobilizerDisplayedPhase,
  immobilizerDuplicate,
  immobilizerReplyPhase,
  immobilizerView,
  nextImmobilizerCapability,
  planImmobilizerCommand,
  setIgnDigoutAvailable,
  starterVerificationDecision,
  starterEffect,
  FMB920_FIRMWARE,
} from "@/lib/teltonika/immobilizer";

const ready = {
  hardwareSupported: true,
  relayInstalled: true,
  installationVerified: true,
  serviceEnabled: true,
  presence: "online" as const,
  ignition: "off" as const,
  gnssAgeMs: 1_000,
};

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
  assert.equal(immobilizerCommandText("on", "fmb920")?.includes("setigndigout"), false);
  assert.equal(immobilizerCommandText("on", "fmc920"), "setdigout 1");
  assert.deepEqual(parseSetdigoutReply("DOUT1:ON Timeout:INFINITY"), { accepted: true, dout1: "on", queued: false });
  assert.deepEqual(parseSetdigoutReply("DOUT1:1 Timeout:15s Speed:20 QUEUED"), { accepted: false, dout1: "on", queued: true });
  assert.equal(parseSetdigoutReply("DOUT1:Is disabled from CFG").accepted, false);
  assert.equal(dout1Readings([{ io: [{ id: 179, value: 1 }, { id: 239, value: 1 }] }, { io: [{ id: 179, value: 0 }] }]), "off");
  assert.equal(dout1Readings([{ io: [{ id: 179, value: 2 }] }]), null);
});

test("a block is queued at any speed and uses setdigout 0 without a speed argument", () => {
  assert.equal(doutDispatchAllowed({}), false);
  assert.equal(doutDispatchAllowed({ ...openGate, NODE_ENV: "production" }), false);
  assert.equal(doutDispatchAllowed({ ...openGate, EXPECTED_DATABASE: "tripetica" }), false);
  const moving = planImmobilizerCommand({ ...ready, request: "on", model: "fmb920", speedMps: 12, ignition: "on", env: openGate });
  assert.equal(moving.phase, "queued");
  assert.equal(moving.reason, "ready");
  assert.equal(moving.commandText, "setdigout 1");
  assert.equal(planImmobilizerCommand({ ...ready, request: "on", model: "fmb920", speedMps: 0, ignition: "off", starterCircuitVerified: false, env: openGate }).phase, "queued");
  assert.equal(planImmobilizerCommand({ ...ready, request: "on", model: "fmb920", speedMps: 0, ignition: "off", starterCircuitVerified: false, env: openGate }).commandText, "setdigout 1");
  assert.equal(planImmobilizerCommand({ ...ready, request: "off", model: "fmc920", speedMps: 12, env: openGate }).phase, "queued");
  assert.equal(planImmobilizerCommand({ ...ready, request: "off", model: "fmc920", speedMps: 12, starterCircuitVerified: false, env: openGate }).commandText, "setdigout 0");
  assert.equal(planImmobilizerCommand({ request: "on", model: null, speedMps: 0, env: openGate }).reason, "unsupported_model");
  assert.equal(immobilizerDuplicate({ request: "on", phase: "sent", ageMs: 1_000 }, "off"), true);
  assert.equal(immobilizerDuplicate({ request: "on", phase: "withheld", ageMs: 1_000 }, "on"), true);
  assert.equal(immobilizerDuplicate({ request: "on", phase: "withheld", ageMs: 6_000 }, "on"), false);
  assert.equal(immobilizerDisplayedPhase("sent", 46_000), "timeout");
  assert.equal(immobilizerDisplayedPhase("queued", 46_000), "queued");
  assert.equal(immobilizerDisplayedPhase("acknowledged", 46_000), "acknowledged");
});

test("capability checkbox values stay checked when the form sends yes", () => {
  assert.equal(immobilizerCapabilityChecked(["yes"]), true);
  assert.equal(immobilizerCapabilityChecked(["on"]), true);
  assert.equal(immobilizerCapabilityChecked(["0", "yes"]), true);
  assert.equal(immobilizerCapabilityChecked([]), false);
  assert.equal(immobilizerCapabilityChecked(["0"]), false);
});

test("relay, verification, and service stay closed unless each previous step is set", () => {
  assert.equal(planImmobilizerCommand({ ...ready, request: "on", model: "fmb920", speedMps: 0, env: openGate, relayInstalled: false }).phase, "queued");
  assert.equal(planImmobilizerCommand({ ...ready, request: "on", model: "fmb920", speedMps: 0, env: openGate, installationVerified: false }).phase, "queued");
  assert.equal(planImmobilizerCommand({ ...ready, request: "on", model: "fmb920", speedMps: 0, env: openGate, serviceEnabled: false }).phase, "queued");
  assert.deepEqual(nextImmobilizerCapability({
    model: "fmb920",
    hardwareSupported: false,
    relayInstalled: true,
    verified: true,
    serviceEnabled: true,
  }), { hardwareSupported: false, relayInstalled: false, verified: false, serviceEnabled: false, starterCircuitVerified: false });
  assert.deepEqual(nextImmobilizerCapability({
    model: null,
    hardwareSupported: true,
    relayInstalled: true,
    verified: true,
    serviceEnabled: true,
  }), { hardwareSupported: false, relayInstalled: false, verified: false, serviceEnabled: false, starterCircuitVerified: false });
  assert.equal(nextImmobilizerCapability({
    model: "fmb920",
    hardwareSupported: true,
    relayInstalled: true,
    verified: true,
    serviceEnabled: true,
    starterCircuitVerified: true,
  }).starterCircuitVerified, true);
  assert.equal(nextImmobilizerCapability({
    model: "fmb920",
    hardwareSupported: true,
    relayInstalled: true,
    verified: true,
    serviceEnabled: false,
    starterCircuitVerified: true,
  }).starterCircuitVerified, false);
  assert.deepEqual(immobilizerReplyPhase("DOUT1:ON Timeout:INFINITY"), { phase: "acknowledged", output: "on" });
  assert.deepEqual(immobilizerReplyPhase("DOUT1:1 Timeout:15s Speed:20 QUEUED"), { phase: "queued", output: "unknown" });
  assert.equal(immobilizerReplyPhase("DOUT1:Is disabled from CFG").phase, "rejected");
  assert.equal(immobilizerReplyPhase("DOUT1:1 IGN ON QUEUED").phase, "queued");
  assert.equal(immobilizerReplyPhase("unknown command or invalid format").phase, "rejected");
  assert.deepEqual(immobilizerReplyPhase("DI1:0 AIN1:13159 DO1:0"), { phase: "acknowledged", output: "off" });
  assert.deepEqual(immobilizerReplyPhase("DI1:1 DO1:1"), { phase: "acknowledged", output: "on" });
});

test("device output, not the user request, decides active and passive", () => {
  assert.equal(immobilizerView({ presence: "offline", output: "on", phase: "none", commandAgeMs: null }), "offline");
  assert.equal(immobilizerView({ presence: "stale", output: "off", phase: "none", commandAgeMs: null }), "offline");
  assert.equal(immobilizerView({ presence: "online", output: "unknown", phase: "withheld", commandAgeMs: 10 }), "unknown");
  assert.equal(immobilizerView({ presence: "online", output: "unknown", phase: "none", commandAgeMs: null }), "unknown");
  assert.equal(immobilizerView({ presence: "online", output: "on", phase: "acknowledged", commandAgeMs: 10 }), "active");
  assert.equal(immobilizerView({ presence: "online", output: "off", phase: "acknowledged", commandAgeMs: 10 }), "passive");
  assert.equal(immobilizerView({ presence: "online", output: "off", phase: "queued", commandAgeMs: 90_000 }), "pending");
  assert.equal(starterEffect({ starterCircuitVerified: false, output: "on" }), "blocked");
  assert.equal(starterEffect({ starterCircuitVerified: true, output: "off" }), "released");
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
  assert.match(live, /GpsImmobilizerSwitch/);
  assert.match(readFileSync(new URL("../../components/gps/immobilizer-switch.tsx", import.meta.url), "utf8"), /aria-checked/);
  assert.doesNotMatch(readFileSync(new URL("../../components/gps/immobilizer-switch.tsx", import.meta.url), "utf8"), /checked=\{currentRequest/);
  assert.match(live, /GpsImmobilizerSwitch/);
  assert.match(readFileSync(new URL("../../components/gps/device-workspace.tsx", import.meta.url), "utf8"), /deviceControls/);
});

test("enable needs a server confirmation, and the switch keeps the verified output", () => {
  assert.equal(immobilizerEnableGate(null).ok, false);
  assert.equal(immobilizerEnableGate("true").ok, false);
  assert.equal(immobilizerEnableGate("11111111-1111-4111-8111-111111111111").ok, true);
  assert.deepEqual(immobilizerSwitchPresentation({ view: "offline", output: "on" }), { checked: false, indeterminate: true, status: "unknown" });
  assert.deepEqual(immobilizerSwitchPresentation({ view: "pending", output: "off" }), { checked: false, indeterminate: false, status: "pending" });
  assert.deepEqual(immobilizerSwitchPresentation({ view: "error", output: "off" }), { checked: false, indeterminate: false, status: "passive" });
  assert.deepEqual(immobilizerSwitchPresentation({ view: "error", output: "on" }), { checked: true, indeterminate: false, status: "active" });
  assert.deepEqual(immobilizerSwitchPresentation({ view: "active", output: "on" }), { checked: true, indeterminate: false, status: "active" });
  assert.deepEqual(immobilizerSwitchPresentation({ view: "passive", output: "off" }), { checked: false, indeterminate: false, status: "passive" });
  assert.deepEqual(immobilizerSwitchPresentation({ view: "unknown", output: "unknown" }), { checked: false, indeterminate: true, status: "unknown" });
  const switchSource = readFileSync(new URL("../../components/gps/immobilizer-switch.tsx", import.meta.url), "utf8");
  const store = readFileSync(new URL("./immobilizer-store.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../gps/immobilizer-actions.ts", import.meta.url), "utf8");
  const begin = store.slice(store.indexOf("export async function beginImmobilizerEnable"), store.indexOf("export async function recordImmobilizerRequest"));
  assert.match(switchSource, /void openEnable\(\)/);
  assert.match(switchSource, /void send\("off"\)/);
  assert.match(switchSource, /immobilizerConfirmEnable/);
  assert.match(switchSource, /immobilizerResultActive/);
  assert.match(switchSource, /immobilizerResultClosed/);
  assert.match(switchSource, /immobilizerCommandTimeout/);
  assert.match(switchSource, /immobilizerCommandRejected/);
  assert.match(switchSource, /is-partner/);
  assert.doesNotMatch(switchSource, /confirmed:\s*true/);
  assert.doesNotMatch(switchSource, /setConfirm\(verifiedOn \? "off"/);
  assert.match(switchSource, /\{partner \? null : <p className="gps-inline-note">\{copy\.immobilizerDisclaimer\}/);
  assert.match(begin, /gps_immobilizer_enable_confirmations/);
  assert.doesNotMatch(begin, /gps_immobilizer_commands/);
  assert.match(store, /used_at IS NULL/);
  assert.match(store, /starter_circuit_verified/);
  assert.match(actions, /confirmationId: input\.request === "on" \? input\.confirmationId : null/);
  assert.doesNotMatch(actions, /confirmed/);
  assert.equal(planImmobilizerCommand({ ...ready, request: "on", model: "fmb920", speedMps: 0, starterCircuitVerified: false, env: openGate }).phase, "queued");
  const moving = planImmobilizerCommand({ ...ready, request: "on", model: "fmb920", speedMps: 12, ignition: "on", starterCircuitVerified: false, env: openGate });
  assert.equal(moving.phase, "queued");
  assert.equal(moving.reason, "ready");
  assert.equal(moving.commandText, "setdigout 1");
  assert.equal(starterVerificationDecision({ intent: "verify", physicalMeasurement: null, clearConfirm: null }), "refuse");
  const workspace = readFileSync(new URL("../../components/gps/device-workspace.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(workspace, /name="physicalMeasurement"/);
  assert.doesNotMatch(workspace, /recordStarterCircuitVerificationAction/);
  assert.doesNotMatch(workspace, /ImmobilizerCapabilityForm|immobilizerSupported|immobilizerSaveCapability/);
  assert.doesNotMatch(switchSource, /immobilizerStarterBlocked/);
  assert.match(store, /starter_circuit_verified = EXCLUDED\.service_enabled/);
  const claim = store.slice(store.indexOf("export async function claimStarterCommand"), store.indexOf("export async function finishStarterCommand"));
  assert.doesNotMatch(claim, /starter_circuit_verified|service_enabled/);
});

test("capability defaults stay closed and the production listener still cannot send DOUT", () => {
  const switchSource = readFileSync(new URL("../../components/gps/immobilizer-switch.tsx", import.meta.url), "utf8");
  assert.match(switchSource, /disabled=\{blocked !== null \|\| busy \|\| view === "pending"\}/);
  assert.match(switchSource, /const blocked = null/);
  const capability = readFileSync(new URL("../../db/migrations/094_gps_immobilizer_capability.sql", import.meta.url), "utf8");
  assert.match(capability, /hardware_supported BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(capability, /service_enabled BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.doesNotMatch(capability, /SET hardware_supported = TRUE|setdigout/);
  const prodListener = readFileSync(new URL("../../scripts/teltonika-listen-prod.ts", import.meta.url), "utf8");
  const prodUnit = readFileSync(new URL("../../deploy/systemd/tripetica-prod-teltonika.service", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../gps/immobilizer-actions.ts", import.meta.url), "utf8");
  assert.doesNotMatch(prodListener, /setdigout|TELTONIKA_DOUT_DISPATCH/);
  assert.doesNotMatch(prodUnit, /TELTONIKA_DOUT_DISPATCH/);
  assert.match(actions, /actorCan\(ops, "gps\.manage"\)/);
  assert.doesNotMatch(actions, /setdigout/);
  const store = readFileSync(new URL("./immobilizer-store.ts", import.meta.url), "utf8");
  assert.match(store, /starter_circuit_verified/);
  assert.match(store, /block\.service_enabled/);
  const migration = readFileSync(new URL("../../db/migrations/095_teltonika_din1_starter.sql", import.meta.url), "utf8");
  assert.match(migration, /starter_circuit_verified BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.doesNotMatch(migration, /SET starter_circuit_verified = TRUE|setdigout/);
  const commandGrant = readFileSync(new URL("../../db/migrations/097_gps_immobilizer_command_update.sql", import.meta.url), "utf8");
  assert.match(commandGrant, /GRANT UPDATE ON TABLE gps_immobilizer_commands TO tripetica_app/);
  assert.doesNotMatch(commandGrant, /setdigout/);
});

test("DIN1 is ignition for Teltonika colors, and other GPS colors stay on the existing marker", () => {
  assert.equal(TELTONIKA_DIN1_IO, 1);
  assert.equal(teltonikaDin1({
    timestampMs: 0,
    priority: 0,
    longitude: 29,
    latitude: 41,
    altitudeM: 0,
    headingDeg: 0,
    satellites: 0,
    speedKmh: 0,
    eventId: 0,
    io: [{ id: 1, value: 1 }, { id: 239, value: 0 }],
  }), "on");
  assert.equal(teltonikaDin1({
    timestampMs: 0,
    priority: 0,
    longitude: 29,
    latitude: 41,
    altitudeM: 0,
    headingDeg: 0,
    satellites: 0,
    speedKmh: 0,
    eventId: 0,
    io: [{ id: 1, value: 0 }, { id: 239, value: 1 }],
  }), "off");
  assert.equal(teltonikaDin1({
    timestampMs: 0,
    priority: 0,
    longitude: 29,
    latitude: 41,
    altitudeM: 0,
    headingDeg: 0,
    satellites: 0,
    speedKmh: 0,
    eventId: 0,
    io: [{ id: 239, value: 1 }],
  }), null);
  const now = Date.parse("2026-10-12T12:00:00Z");
  const fresh = "2026-10-12T11:59:30Z";
  assert.equal(teltonikaMarkerState({ receivedAt: fresh, nowMs: now, din1: "off", speedMps: 0 }), "din-off");
  assert.equal(teltonikaMarkerState({ receivedAt: fresh, nowMs: now, din1: "on", speedMps: 0 }), "din-stopped");
  assert.equal(teltonikaMarkerState({ receivedAt: fresh, nowMs: now, din1: "off", speedMps: 4 }), "din-moving");
  assert.equal(teltonikaMarkerState({ receivedAt: fresh, nowMs: now, din1: null, speedMps: 0 }), "din-pending");
  assert.equal(teltonikaMarkerState({ receivedAt: "2026-10-12T11:50:00Z", nowMs: now, din1: "on", speedMps: 0 }), "din-stopped");
  assert.equal(teltonikaMarkerState({ receivedAt: "2026-10-12T11:40:00Z", nowMs: now, din1: "on", speedMps: 0 }), "din-unknown");
  assert.equal(gpsMapMarkerState({ receivedAt: fresh, nowMs: now, motion: "moving" }), "moving");
  assert.equal(gpsMapMarkerState({ receivedAt: fresh, nowMs: now, motion: "stopped" }), "stopped");
  assert.equal(starterEffect({ starterCircuitVerified: false, output: "on" }), "blocked");
  assert.equal(starterEffect({ starterCircuitVerified: true, output: "off" }), "released");
  assert.equal(starterEffect({ starterCircuitVerified: true, output: "on" }), "blocked");
  const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.gps-status\.is-unknown::before \{ background: #2563eb; \}/);
  assert.match(css, /\.gps-status\.is-din-off::before \{ background: #dc2626; \}/);
  assert.match(css, /\.gps-status\.is-stopped::before \{ background: #f59e0b; \}/);
  assert.match(css, /\.gps-status\.is-din-stopped::before \{ background: #eab308; \}/);
  assert.match(css, /\.gps-status\.is-din-moving::before \{ background: #15803d; \}/);
  assert.match(css, /\.gps-status\.is-din-pending::before \{ background: #d4d4d8; \}/);
  assert.match(css, /\.gps-status\.is-din-unknown::before \{ background: #6b7280; \}/);
  const mobile = readFileSync(new URL("../gps/mobile.ts", import.meta.url), "utf8");
  assert.doesNotMatch(mobile, /teltonikaMarkerState|din-off/);
});
