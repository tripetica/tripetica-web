import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { gpsCopy } from "@/lib/gps/copy";
import { opsCopy } from "@/lib/ops/copy";
import { gpsAtsEnableAllowed } from "@/lib/uetds/vehicle-subscription-plan";

const note = "Bu araca fiziksel GPS takip cihazı tanımlanmamış. GPS – ATS aboneliğini etkinleştirmek için önce GPS > Cihazlar bölümünden cihaz ekleyin.";

test("GPS – ATS cannot be newly enabled without an active assigned physical device", () => {
  assert.equal(gpsAtsEnableAllowed({ hasActivePhysicalDevice: false, currentlyEnabled: false, requestedEnabled: true }), false);
  assert.equal(gpsAtsEnableAllowed({ hasActivePhysicalDevice: false, currentlyEnabled: false, requestedEnabled: false }), true);
  assert.equal(gpsAtsEnableAllowed({ hasActivePhysicalDevice: false, currentlyEnabled: true, requestedEnabled: true }), true);
  assert.equal(gpsAtsEnableAllowed({ hasActivePhysicalDevice: false, currentlyEnabled: true, requestedEnabled: false }), true);
  assert.equal(gpsAtsEnableAllowed({ hasActivePhysicalDevice: true, currentlyEnabled: false, requestedEnabled: true }), true);
});

test("the device check ignores connection, fix, and installation, and does not name a plate", () => {
  const store = readFileSync(new URL("./vehicle-subscription-store.ts", import.meta.url), "utf8");
  const check = store.slice(store.indexOf("export async function vehicleHasActivePhysicalGps"), store.indexOf("export async function saveVehicleUetdsSubscription"));
  assert.match(check, /status = 'active'/);
  assert.match(check, /vehicle_id = \$1/);
  assert.doesNotMatch(check, /live_source|installation_status|last_heartbeat|gnss_fix|34ffz620|34egp847/i);
  const action = readFileSync(new URL("../ops/partner-fleet-actions.ts", import.meta.url), "utf8");
  assert.match(action, /gpsAtsEnableAllowed/);
  assert.match(action, /gps-ats-needs-device/);
  assert.doesNotMatch(action, /UPDATE partner_vehicles[\s\S]{0,200}service_gps_ats_enabled = FALSE/i);
});

test("the ops form explains a locked GPS – ATS box and the device button label changes only at the form foot", () => {
  const section = readFileSync(new URL("../../components/uetds/driver-uetds-subscription-section.tsx", import.meta.url), "utf8");
  assert.match(section, /gpsAtsLocked/);
  assert.match(section, /uetds-driver-subscription-lock-note/);
  assert.match(section, /title=\{gpsAtsLocked \? gpsAtsLockedText : undefined\}/);
  assert.equal(opsCopy.tr.gpsAtsNeedsDevice, note);
  assert.equal(gpsCopy.tr.create, "Kaydet ve Etkinleştir");
  assert.equal(gpsCopy.en.create, "Save and activate");
  assert.equal(gpsCopy.ru.create, "Сохранить и активировать");
  assert.equal(gpsCopy.tr.addDevice, "+ Yeni cihaz ekle");
  assert.equal(gpsCopy.en.addDevice, "+ Add device");
  assert.equal(gpsCopy.ru.addDevice, "+ Добавить устройство");
  const form = readFileSync(new URL("../../components/gps/device-create-form.tsx", import.meta.url), "utf8");
  assert.match(form, /\{copy\.create\}/);
  assert.doesNotMatch(form, /copy\.addDevice/);
  const queries = readFileSync(new URL("../gps/queries.ts", import.meta.url), "utf8");
  const create = queries.slice(queries.indexOf("export async function createGpsDevice"), queries.indexOf("export async function rotateGpsDeviceToken"));
  assert.doesNotMatch(create, /service_gps_ats_enabled|ats_ministry_source/);
  const partner = readFileSync(new URL("../../components/partner/vehicle-detail.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(partner, /gpsAtsNeedsDevice|gpsAtsSelectable/);
});
