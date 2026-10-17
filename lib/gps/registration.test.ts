import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  gpsInitialLiveSource,
  gpsInstallPromotion,
  gpsIsLiveMapSource,
  gpsLinkForModel,
  gpsLiveSourceAfterAssignment,
  gpsRegistrationProfile,
  gpsSecretRegistrationField,
  gpsSimPhone,
} from "@/lib/gps/registration";

test("Teltonika model selects the link and starts as installation pending", () => {
  assert.equal(gpsLinkForModel("fmb920"), "2g");
  assert.equal(gpsLinkForModel("fmc920"), "4g");
  const fmb = gpsRegistrationProfile({
    receiver: "teltonika",
    model: "fmb920",
    imei: "990000000920101",
    serial: "SN-1",
    simPhone: "",
    simOperator: "Turkcell",
    simApn: "",
  });
  assert.equal(fmb.ok, true);
  if (!fmb.ok) return;
  assert.equal(fmb.value.manufacturer, "teltonika");
  assert.equal(fmb.value.linkTechnology, "2g");
  assert.equal(fmb.value.installationStatus, "pending");
  assert.equal(fmb.value.serialNumber, "SN-1");
  assert.equal(fmb.value.simOperator, "Turkcell");
  const fmc = gpsRegistrationProfile({
    receiver: "teltonika",
    model: "fmc920",
    imei: "990000000920102",
    serial: "",
    simPhone: "+905551112233",
    simOperator: "Turkcell",
    simApn: "internet",
  });
  assert.equal(fmc.ok && fmc.value.linkTechnology, "4g");
  assert.equal(gpsRegistrationProfile({
    receiver: "teltonika",
    model: "fmb920",
    imei: "",
    serial: "",
    simPhone: "",
    simOperator: "",
    simApn: "",
  }).ok, false);
  assert.equal(gpsRegistrationProfile({
    receiver: "teltonika",
    model: "fmb920",
    imei: "123",
    serial: "",
    simPhone: "",
    simOperator: "",
    simApn: "",
  }).ok, false);
});

test("a new device requires one of the three SIM operators", () => {
  assert.equal(gpsRegistrationProfile({
    receiver: "teltonika",
    model: "fmb920",
    imei: "990000000920103",
    serial: "",
    simPhone: "",
    simOperator: "",
    simApn: "",
  }).ok, false);
  assert.equal(gpsRegistrationProfile({
    receiver: "teltonika",
    model: "fmb920",
    imei: "990000000920104",
    serial: "",
    simPhone: "",
    simOperator: "Türk Telekom",
    simApn: "",
  }).ok, true);
  assert.equal(gpsRegistrationProfile({
    receiver: "esp32",
    model: null,
    imei: "",
    serial: "",
    simPhone: "",
    simOperator: "Vodafone",
    simApn: "internet",
  }).ok, false);
});

test("ESP32 registration stays installed and stores only the selected SIM operator", () => {
  const esp = gpsRegistrationProfile({
    receiver: "esp32",
    model: null,
    imei: "",
    serial: "",
    simPhone: "",
    simOperator: "Turkcell",
    simApn: "",
  });
  assert.equal(esp.ok, true);
  if (!esp.ok) return;
  assert.equal(esp.value.installationStatus, "installed");
  assert.equal(esp.value.trackerModel, null);
  assert.equal(esp.value.imei, null);
  assert.equal(esp.value.simOperator, "Turkcell");
  assert.equal(gpsRegistrationProfile({
    receiver: "esp32",
    model: null,
    imei: "",
    serial: "ABC",
    simPhone: "",
    simOperator: "Turkcell",
    simApn: "",
  }).ok, false);
});

test("a second device is not the live map or assignment source", () => {
  assert.equal(gpsInitialLiveSource({ receiver: "teltonika", hasVehicle: true, vehicleHasLiveSource: true }), false);
  assert.equal(gpsInitialLiveSource({ receiver: "teltonika", hasVehicle: true, vehicleHasLiveSource: false }), false);
  assert.equal(gpsInitialLiveSource({ receiver: "esp32", hasVehicle: true, vehicleHasLiveSource: true }), false);
  assert.equal(gpsInitialLiveSource({ receiver: "esp32", hasVehicle: true, vehicleHasLiveSource: false }), true);
  assert.equal(gpsLiveSourceAfterAssignment({
    liveSource: true,
    vehicleId: "vehicle",
    destinationHasOtherLiveSource: true,
  }), false);
  assert.equal(gpsLiveSourceAfterAssignment({
    liveSource: true,
    vehicleId: null,
    destinationHasOtherLiveSource: false,
  }), true);
  assert.equal(gpsLiveSourceAfterAssignment({
    liveSource: false,
    vehicleId: null,
    destinationHasOtherLiveSource: false,
  }), false);
  const blocked = gpsInstallPromotion({ pending: true, vehicleHasOtherLiveSource: true });
  assert.deepEqual(blocked, { installationStatus: "installed", liveSource: false });
  const open = gpsInstallPromotion({ pending: true, vehicleHasOtherLiveSource: false });
  assert.deepEqual(open, { installationStatus: "installed", liveSource: true });
  assert.equal(gpsInstallPromotion({ pending: false, vehicleHasOtherLiveSource: false }), null);
  assert.equal(gpsIsLiveMapSource({ status: "active", installationStatus: "pending", liveSource: false }), false);
  assert.equal(gpsIsLiveMapSource({ status: "disabled", installationStatus: "installed", liveSource: true }), false);
  assert.equal(gpsIsLiveMapSource({ status: "active", installationStatus: "installed", liveSource: true }), true);
});

test("SIM phone keeps the digits and accepts Turkey and international numbers", () => {
  assert.equal(gpsSimPhone(""), null);
  assert.equal(gpsSimPhone("   "), null);
  assert.equal(gpsSimPhone("+90 532 111 22 33"), "+905321112233");
  assert.equal(gpsSimPhone("0532 111 22 33"), "+905321112233");
  assert.equal(gpsSimPhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(gpsSimPhone("0090 532 111 22 33"), "+905321112233");
  assert.equal(gpsSimPhone("+90 5XX XXX XX XX"), undefined);
  assert.equal(gpsSimPhone("123"), undefined);
  const saved = gpsRegistrationProfile({
    receiver: "teltonika",
    model: "fmb920",
    imei: "990000000920105",
    serial: "",
    simPhone: "+90 532 111 22 33",
    simOperator: "Turkcell",
    simApn: "",
  });
  assert.equal(saved.ok && saved.value.simPhone, "+905321112233");
  const esp = gpsRegistrationProfile({
    receiver: "esp32",
    model: null,
    imei: "",
    serial: "",
    simPhone: "+1 202 555 0123",
    simOperator: "Vodafone",
    simApn: "",
  });
  assert.equal(esp.ok && esp.value.simPhone, "+12025550123");
  assert.equal(esp.ok && esp.value.installationStatus, "installed");
});

test("registration does not accept or store an SMS password", () => {
  assert.equal(gpsSecretRegistrationField("smsPassword"), true);
  assert.equal(gpsSecretRegistrationField("simApn"), false);
  const form = readFileSync(new URL("../../components/gps/device-create-form.tsx", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../db/migrations/083_gps_device_registration.sql", import.meta.url), "utf8");
  const store = readFileSync(new URL("../teltonika/store.ts", import.meta.url), "utf8");
  const ingest = readFileSync(new URL("./ingest.ts", import.meta.url), "utf8");
  assert.doesNotMatch(form, /smsPassword|simPassword|type="password"/);
  assert.match(form, /<select name="simOperator" required/);
  assert.doesNotMatch(form, /<input name="simOperator"/);
  const operatorAt = form.indexOf('name="simOperator"');
  const phoneAt = form.indexOf('name="simPhone"');
  const modelAt = form.indexOf('name="trackerModel"');
  assert.ok(operatorAt >= 0 && phoneAt > operatorAt && modelAt > phoneAt);
  assert.match(form, /placeholder=\{copy\.simPhoneExample\}/);
  assert.doesNotMatch(form, /name="simPhone"[^>]*required/);
  const workspace = readFileSync(new URL("../../components/gps/device-workspace.tsx", import.meta.url), "utf8");
  const live = readFileSync(new URL("../../components/gps/live-section.tsx", import.meta.url), "utf8");
  assert.match(workspace, /updateGpsSimPhoneAction/);
  assert.match(workspace, /copy\.simPhoneMissing/);
  assert.doesNotMatch(live, /simPhone/);
  assert.doesNotMatch(migration, /password|secret/);
  assert.match(migration, /installation_status/);
  assert.match(store, /installation_status = 'pending'/);
  assert.doesNotMatch(store, /gps_ats_settings/);
  assert.doesNotMatch(ingest, /installation_status|teltonika/);
});
