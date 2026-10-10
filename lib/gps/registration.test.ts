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
    simOperator: "",
    simApn: "",
  });
  assert.equal(fmb.ok, true);
  if (!fmb.ok) return;
  assert.equal(fmb.value.manufacturer, "teltonika");
  assert.equal(fmb.value.linkTechnology, "2g");
  assert.equal(fmb.value.installationStatus, "pending");
  assert.equal(fmb.value.serialNumber, "SN-1");
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

test("ESP32 registration stays installed and does not take Teltonika SIM fields", () => {
  const esp = gpsRegistrationProfile({
    receiver: "esp32",
    model: null,
    imei: "",
    serial: "",
    simPhone: "",
    simOperator: "",
    simApn: "",
  });
  assert.equal(esp.ok, true);
  if (!esp.ok) return;
  assert.equal(esp.value.installationStatus, "installed");
  assert.equal(esp.value.trackerModel, null);
  assert.equal(esp.value.imei, null);
  assert.equal(gpsRegistrationProfile({
    receiver: "esp32",
    model: null,
    imei: "",
    serial: "ABC",
    simPhone: "",
    simOperator: "",
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

test("registration does not accept or store an SMS password", () => {
  assert.equal(gpsSecretRegistrationField("smsPassword"), true);
  assert.equal(gpsSecretRegistrationField("simApn"), false);
  const form = readFileSync(new URL("../../components/gps/device-create-form.tsx", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../db/migrations/083_gps_device_registration.sql", import.meta.url), "utf8");
  const store = readFileSync(new URL("../teltonika/store.ts", import.meta.url), "utf8");
  const ingest = readFileSync(new URL("./ingest.ts", import.meta.url), "utf8");
  assert.doesNotMatch(form, /smsPassword|simPassword|type="password"/);
  assert.doesNotMatch(migration, /password|secret/);
  assert.match(migration, /installation_status/);
  assert.match(store, /installation_status = 'pending'/);
  assert.doesNotMatch(store, /gps_ats_settings/);
  assert.doesNotMatch(ingest, /installation_status|teltonika/);
});
