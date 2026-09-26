import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptyDraft } from "@/lib/uetds/draft";
import { evaluateUetdsEditFleet, ministryPersonnelHasIdentity, ministryPlateEquals } from "@/lib/uetds/edit-fleet";
import { UETDS_V15_FLEET_MUTATIONS } from "@/lib/uetds/edit-policy";
import { describeUetdsEditChanges, diffUetdsEdit } from "@/lib/uetds/manage-diff";
import { parseUetdsBildirimOzetiXml } from "@/lib/uetds/ministry-ozet-parse";
import { uetdsFormCopyFor } from "@/lib/uetds/copy";
import { type UetdsCompanyReadiness } from "@/lib/uetds/eligibility";
import { type UetdsFleetOption } from "@/lib/uetds/fleet-options";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const company: UetdsCompanyReadiness = {
  id: "company-1",
  shortName: "SEARCH TRAVEL",
  status: "active",
  integrationStatus: "ready",
};

function fleet(id: string, partnerId = "partner-1"): UetdsFleetOption {
  return {
    id,
    label: id,
    partnerId,
    uetdsCompanyId: company.id,
    company,
    hasNationalId: true,
  };
}

test("V15 driver change is personelIptal then personelEkle; vehicle is seferGuncelle", () => {
  assert.deepEqual(UETDS_V15_FLEET_MUTATIONS.driverSequence, ["personelIptal", "personelEkle"]);
  assert.equal(UETDS_V15_FLEET_MUTATIONS.updateVehicle, "seferGuncelle");
  assert.equal(UETDS_V15_FLEET_MUTATIONS.timeWindowMs, null);
  const env = source("lib/uetds/ministry-env.ts");
  assert.match(env, /personelIptal/);
  assert.match(env, /personelEkle/);
  assert.doesNotMatch(env, /personelGuncelle|soforGuncelle|aracGuncelle/);
  const mutate = source("lib/uetds/ministry-mutate.ts");
  assert.match(mutate, /iptalPersonelInput/);
  assert.match(mutate, /personelTCKimlikPasaportNo/);
  assert.match(mutate, /seferPersonelBilgileriInput/);
  const manage = source("lib/uetds/manage.ts");
  assert.match(manage, /mutateUetdsPersonelIptal/);
  assert.match(manage, /mutateUetdsPersonelEkle/);
  assert.match(manage, /syncReservationAssignmentFromUetdsEdit/);
  assert.doesNotMatch(manage, /seferEkle/);
  assert.doesNotMatch(manage, /canChangePassengerCount.*driver|driver.*canChangeStart/);
  assert.match(source("lib/uetds/reservation-assignment-sync.ts"), /assignOpsReservationDriver/);
  assert.match(source("lib/uetds/reservation-assignment-sync.ts"), /assignPartnerJobVehicle/);
  assert.match(source("components/uetds/uetds-notification-edit-form.tsx"), /copy\.driverVehicle/);
  assert.match(source("components/uetds/uetds-notification-edit-form.tsx"), /editConfirmReservationSync/);
});

test("edit fleet blocks different U-ETDS companies and foreign sefer company", () => {
  const other = {
    ...fleet("v2"),
    uetdsCompanyId: "company-2",
    company: { ...company, id: "company-2", shortName: "OTHER" },
  };
  const mismatch = evaluateUetdsEditFleet({
    seferCompanyId: company.id,
    driver: fleet("d1"),
    vehicle: other,
  });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) {
    assert.equal(mismatch.error, "mismatch");
  }
  const seferMismatch = evaluateUetdsEditFleet({
    seferCompanyId: "other-sefer",
    driver: fleet("d1"),
    vehicle: fleet("v1"),
  });
  assert.equal(seferMismatch.ok, false);
  if (!seferMismatch.ok) {
    assert.equal(seferMismatch.error, "company-mismatch");
  }
  const bothNull = evaluateUetdsEditFleet({
    seferCompanyId: company.id,
    driver: { ...fleet("d1"), uetdsCompanyId: null, company: null },
    vehicle: { ...fleet("v1"), uetdsCompanyId: null, company: null },
  });
  assert.equal(bothNull.ok, false);
  if (!bothNull.ok) {
    assert.equal(bothNull.error, "external");
  }
  const ok = evaluateUetdsEditFleet({
    seferCompanyId: company.id,
    driver: fleet("d1"),
    vehicle: fleet("v1"),
    reservationPartnerId: "partner-1",
  });
  assert.equal(ok.ok, true);
  const scope = evaluateUetdsEditFleet({
    seferCompanyId: company.id,
    driver: fleet("d1", "partner-2"),
    vehicle: fleet("v1"),
    reservationPartnerId: "partner-1",
  });
  assert.equal(scope.ok, false);
  if (!scope.ok) {
    assert.equal(scope.error, "reservation-scope");
  }
});

test("diff and confirmation include driver/vehicle only when they change", () => {
  const original = createEmptyDraft("reservation", { applyTripDefaults: false });
  original.reservationId = "11111111-1111-1111-1111-111111111111";
  original.driverId = "driver-a";
  original.vehicleId = "vehicle-x";
  const edited = structuredClone(original);
  assert.deepEqual(diffUetdsEdit(original, edited), []);
  edited.driverId = "driver-b";
  assert.deepEqual(diffUetdsEdit(original, edited), ["driver"]);
  edited.vehicleId = "vehicle-y";
  assert.deepEqual(diffUetdsEdit(original, edited), ["driver", "vehicle"]);
  const lines = describeUetdsEditChanges(original, edited, uetdsFormCopyFor("tr"), {
    driverLabel: (id) => (id === "driver-a" ? "RECEP YILDIRIM" : "AHMET YILMAZ"),
    vehicleLabel: (id) => (id === "vehicle-x" ? "34 EGP 847" : "34 ABC 123"),
  });
  assert.match(lines.join("\n"), /RECEP YILDIRIM/);
  assert.match(lines.join("\n"), /AHMET YILMAZ/);
  assert.match(lines.join("\n"), /34 EGP 847/);
  assert.match(lines.join("\n"), /34 ABC 123/);
});

test("bildirimOzeti exposes plate and active personnel without treating IPTAL as current", () => {
  const xml = `<return>
    <aracPlaka>06TARIFESIZ123</aracPlaka>
    <ariziPersonelListesi>
      <adi>RECEP</adi><soyadi>YILDIRIM</soyadi><tckimlikno>11111111110</tckimlikno>
      <durumAciklama>Geçerli</durumAciklama>
    </ariziPersonelListesi>
    <ariziPersonelListesi>
      <adi>ESKI</adi><soyadi>SOFOR</soyadi><tckimlikno>22222222220</tckimlikno>
      <durumAciklama>İptal</durumAciklama>
    </ariziPersonelListesi>
  </return>`;
  const parsed = parseUetdsBildirimOzetiXml(xml);
  assert.equal(parsed.aracPlaka, "06TARIFESIZ123");
  assert.equal(parsed.activePersonnelCount, 1);
  assert.equal(ministryPersonnelHasIdentity(parsed.personnel, "11111111110"), true);
  assert.equal(ministryPersonnelHasIdentity(parsed.personnel, "22222222220"), false);
  assert.equal(ministryPlateEquals("06 TARIFESIZ 123", "06TARIFESIZ123"), true);
});
