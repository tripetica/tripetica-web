import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { STANDARD_MINIVAN_CODE } from "@/lib/booking/pricing/vehicle-quote";
import { formatPartnerFleetPhone } from "@/lib/partner/fleet-view";
import { positionFloatingLayer } from "@/lib/partner/floating-layer";
import { shouldDismissFloatingPopoverOnOutsidePress } from "@/lib/partner/floating-popover-dismiss";
import {
  assertAssignmentAccess,
  assertCanClearAssignment,
  buildDriverAssignmentOptions,
  buildVehicleAssignmentOptions,
  emptyDriverAssignment,
  formatDriverAssignmentLines,
  formatVehicleAssignmentLines,
  listDriverAssignmentSummary,
  listVehicleAssignmentSummary,
  NON_TRP_SELECTION,
  parseNonTrpDriverForm,
  parseNonTrpVehicleForm,
  resolveDriverAssignment,
  resolveVehicleAssignment,
} from "@/lib/partner/job-assignment-view";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("assignment access rejects foreign fleet and non-primary NON TRP", () => {
  assert.deepEqual(
    assertAssignmentAccess({
      reservationAcceptedPartnerId: "p1",
      actorPartnerId: "p2",
      actorIsPrimary: false,
      reservationStatus: "confirmed",
      selectionKind: "registered",
      fleetPartnerId: "p2",
    }),
    { ok: false, error: "not-accepted" },
  );
  assert.deepEqual(
    assertAssignmentAccess({
      reservationAcceptedPartnerId: "p1",
      actorPartnerId: "p1",
      actorIsPrimary: false,
      reservationStatus: "confirmed",
      selectionKind: "registered",
      fleetPartnerId: "p-other",
    }),
    { ok: false, error: "foreign-fleet" },
  );
  assert.deepEqual(
    assertAssignmentAccess({
      reservationAcceptedPartnerId: "p1",
      actorPartnerId: "p1",
      actorIsPrimary: false,
      reservationStatus: "confirmed",
      selectionKind: "non_trp",
    }),
    { ok: false, error: "forbidden-non-trp" },
  );
  assert.deepEqual(
    assertAssignmentAccess({
      reservationAcceptedPartnerId: "p1",
      actorPartnerId: "p1",
      actorIsPrimary: true,
      reservationStatus: "cancelled",
      selectionKind: "non_trp",
    }),
    { ok: false, error: "locked" },
  );
  assert.deepEqual(
    assertAssignmentAccess({
      reservationAcceptedPartnerId: "p1",
      actorPartnerId: "p1",
      actorIsPrimary: true,
      reservationStatus: "confirmed",
      selectionKind: "non_trp",
    }),
    { ok: true },
  );
  assert.deepEqual(
    assertAssignmentAccess({
      reservationAcceptedPartnerId: "p1",
      actorPartnerId: "p1",
      actorIsPrimary: false,
      reservationStatus: "confirmed",
      selectionKind: "registered",
      fleetPartnerId: "p1",
    }),
    { ok: true },
  );
});

test("clearing an assignment is partner-scoped and ignores fleet ownership of the previous row", () => {
  assert.deepEqual(
    assertCanClearAssignment({
      reservationAcceptedPartnerId: "p1",
      actorPartnerId: "p1",
      reservationStatus: "confirmed",
    }),
    { ok: true },
  );
  assert.deepEqual(
    assertCanClearAssignment({
      reservationAcceptedPartnerId: "p1",
      actorPartnerId: "p2",
      reservationStatus: "confirmed",
    }),
    { ok: false, error: "not-accepted" },
  );
  assert.deepEqual(
    assertCanClearAssignment({
      reservationAcceptedPartnerId: "p1",
      actorPartnerId: "p1",
      reservationStatus: "cancelled",
    }),
    { ok: false, error: "locked" },
  );
});

test("NON TRP driver and vehicle forms validate required fields", () => {
  const driver = parseNonTrpDriverForm({
    fullName: "Ahmet Kaya",
    phoneCountryCode: "TR",
    phoneNational: "5332058219",
    languageCodes: ["tr", "ru"],
    notes: "external",
  });
  assert.equal(driver.ok, true);
  if (driver.ok) {
    assert.equal(driver.value.firstName, "Ahmet");
    assert.equal(driver.value.lastName, "Kaya");
    assert.equal(driver.value.phoneCountryCode, "TR");
    assert.deepEqual(driver.value.languageCodes, ["tr", "ru"]);
  }
  assert.equal(
    parseNonTrpDriverForm({
      fullName: "Ahmet",
      phoneCountryCode: "TR",
      phoneNational: "5332058219",
      languageCodes: ["tr"],
      notes: "",
    }).ok,
    false,
  );
  const vehicle = parseNonTrpVehicleForm({
    plate: "34 ABC 123",
    brandModel: "Mercedes-Benz Vito",
    features: "VIP iç dizayn, yıldız tavan, ara bölme",
  });
  assert.equal(vehicle.ok, true);
  if (vehicle.ok) {
    assert.equal(vehicle.value.plate, "34 ABC 123");
    assert.equal(vehicle.value.brandModel, "Mercedes-Benz Vito");
    assert.equal(vehicle.value.features, "VIP iç dizayn, yıldız tavan, ara bölme");
  }
  assert.equal(
    parseNonTrpVehicleForm({
      plate: "34 ABC 123",
      brandModel: "",
      features: "deri koltuk",
    }).ok,
    false,
  );
});

test("assignment display lines keep NON TRP label compact for ops cells", () => {
  const driver = resolveDriverAssignment({
    kind: "non_trp",
    driverId: null,
    snapshot: {
      firstName: "Ahmet",
      lastName: "Kaya",
      phone: "+905331112233",
      phoneCountryCode: "TR",
      languageCodes: ["tr", "ru"],
      notes: null,
    },
    live: null,
  });
  assert.deepEqual(
    formatDriverAssignmentLines({
      driver,
      unassignedLabel: "—",
      nonTrpLabel: "NON TRP",
    })[0],
    "NON TRP",
  );
  assert.equal(
    formatDriverAssignmentLines({
      driver: emptyDriverAssignment(),
      unassignedLabel: "—",
      nonTrpLabel: "NON TRP",
    }).join(""),
    "—",
  );
  const vehicle = resolveVehicleAssignment({
    kind: "registered",
    vehicleId: "v1",
    snapshot: null,
    live: {
      id: "v1",
      partnerId: "p1",
      plate: "34 EGP 848",
      brandCode: null,
      modelCode: null,
      brand: "Mercedes-Benz",
      model: "Vito",
      modelYear: 2021,
      colorCode: null,
      colorOther: null,
      color: null,
      passengerCapacity: 7,
      luggageCapacity: 6,
      vehicleClassCode: STANDARD_MINIVAN_CODE,
      featureCodes: [],
      featureOther: null,
      features: null,
      status: "active",
      approvedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  });
  const lines = formatVehicleAssignmentLines({
    vehicle,
    locale: "tr",
    unassignedLabel: "—",
    nonTrpLabel: "NON TRP",
  });
  assert.equal(lines[0], "34 EGP 848");
  assert.equal(lines[1], "Mercedes-Benz Vito");
  const nonTrpVehicle = resolveVehicleAssignment({
    kind: "non_trp",
    vehicleId: null,
    snapshot: {
      plate: "34 ABC 123",
      brandModel: "Mercedes-Benz Vito",
      features: "VIP iç dizayn, yıldız tavan, ara bölme",
    },
    live: null,
  });
  assert.deepEqual(
    formatVehicleAssignmentLines({
      vehicle: nonTrpVehicle,
      locale: "tr",
      unassignedLabel: "—",
      nonTrpLabel: "NON TRP",
    }),
    [
      "NON TRP",
      "34 ABC 123",
      "Mercedes-Benz Vito",
      "VIP iç dizayn, yıldız tavan, ara bölme",
    ],
  );
  const legacy = resolveVehicleAssignment({
    kind: "non_trp",
    vehicleId: null,
    snapshot: {
      plate: "34 XYZ 11",
      brand: "Mercedes-Benz",
      model: "Vito",
      modelYear: 2020,
      vehicleClassCode: STANDARD_MINIVAN_CODE,
      passengerCapacity: 7,
      luggageCapacity: 6,
      notes: "deri koltuk",
    },
    live: null,
  });
  assert.equal(legacy.brand, "Mercedes-Benz Vito");
  assert.equal(legacy.features, "deri koltuk");
});

test("list assignment cells stay compact and NON TRP stays first for primary partners", () => {
  const driver = resolveDriverAssignment({
    kind: "registered",
    driverId: "d1",
    snapshot: null,
    live: {
      id: "d1",
      partnerId: "p1",
      firstName: "Zeynep",
      lastName: "Yılmaz",
      fullName: "Zeynep Yılmaz",
      nationalId: null,
      phone: "+905331112233",
      phoneCountryCode: "TR",
      email: null,
      languageCodes: ["tr"],
      status: "active",
      deletedAt: null,
      updatedAt: new Date().toISOString(),
    },
  });
  assert.deepEqual(listDriverAssignmentSummary(driver, "NON TRP"), {
    kindLabel: null,
    title: "Zeynep Yılmaz",
    subtitle: formatPartnerFleetPhone("+905331112233"),
  });
  const nonTrp = resolveDriverAssignment({
    kind: "non_trp",
    driverId: null,
    snapshot: {
      firstName: "Ahmet",
      lastName: "Kaya",
      phone: "+905339998877",
      phoneCountryCode: "TR",
      languageCodes: ["tr"],
      notes: null,
    },
    live: null,
  });
  const nonTrpSummary = listDriverAssignmentSummary(nonTrp, "NON TRP");
  assert.equal(nonTrpSummary?.kindLabel, "NON TRP");
  assert.equal(nonTrpSummary?.title, "Ahmet Kaya");
  const vehicle = resolveVehicleAssignment({
    kind: "non_trp",
    vehicleId: null,
    snapshot: {
      plate: "34 ABC 123",
      brandModel: "Mercedes-Benz Vito",
      features: "VIP iç dizayn",
    },
    live: null,
  });
  assert.deepEqual(listVehicleAssignmentSummary(vehicle, "NON TRP"), {
    kindLabel: "NON TRP",
    title: "34 ABC 123",
    subtitle: "Mercedes-Benz Vito",
  });
  const driverOptions = buildDriverAssignmentOptions(
    [
      {
        id: "d-b",
        partnerId: "p1",
        firstName: "Burak",
        lastName: "Deniz",
        fullName: "Burak Deniz",
        nationalId: null,
        phone: null,
        phoneCountryCode: null,
        email: null,
        languageCodes: [],
        status: "active",
        deletedAt: null,
        updatedAt: new Date().toISOString(),
      },
      {
        id: "d-a",
        partnerId: "p1",
        firstName: "Ayşe",
        lastName: "Kaya",
        fullName: "Ayşe Kaya",
        nationalId: null,
        phone: null,
        phoneCountryCode: null,
        email: null,
        languageCodes: [],
        status: "active",
        deletedAt: null,
        updatedAt: new Date().toISOString(),
      },
    ],
    "tr",
    true,
    "NON TRP",
  );
  assert.equal(driverOptions[0].value, NON_TRP_SELECTION);
  assert.equal(driverOptions[1].label, "Ayşe Kaya");
  assert.equal(driverOptions[2].label, "Burak Deniz");
  const vehicleOptions = buildVehicleAssignmentOptions(
    [
      {
        id: "v1",
        partnerId: "p1",
        plate: "34 EGP 848",
        brandCode: null,
        modelCode: null,
        brand: "Mercedes-Benz",
        model: "Vito",
        modelYear: 2021,
        colorCode: null,
        colorOther: null,
        color: null,
        passengerCapacity: 7,
        luggageCapacity: 6,
        vehicleClassCode: STANDARD_MINIVAN_CODE,
        featureCodes: [],
        featureOther: null,
        features: null,
        status: "active",
        approvedAt: null,
        deletedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    "tr",
    false,
    "NON TRP",
    true,
  );
  assert.equal(vehicleOptions[0].value, "v1");
  assert.equal(vehicleOptions[0].label, "34 EGP 848 · Mercedes-Benz Vito");
});

test("assignment schema and server path stay partner-scoped", () => {
  const migration = source("db/migrations/041_partner_job_fleet_assignment.sql");
  assert.match(migration, /assigned_driver_snapshot JSONB/);
  assert.match(migration, /assigned_vehicle_snapshot JSONB/);
  assert.match(migration, /assignment_updated_by_partner_user_id/);
  assert.doesNotMatch(migration, /db:migrate:prod/);

  const store = source("lib/partner/job-assignment.ts");
  assert.match(store, /getPartnerDriver\(input\.partnerId, selection\)/);
  assert.match(store, /getPartnerVehicle\(input\.partnerId, selection\)/);
  assert.match(store, /accepted_partner_id = \$/);
  assert.match(store, /selectionKind: "non_trp"/);
  assert.match(store, /assigned_driver_kind = NULL/);
  assert.match(store, /assigned_vehicle_kind = NULL/);
  assert.doesNotMatch(store, /INSERT INTO partner_drivers/);
  assert.doesNotMatch(store, /INSERT INTO partner_vehicles/);
  assert.doesNotMatch(store, /DELETE FROM partner_drivers/);
  assert.doesNotMatch(store, /DELETE FROM partner_vehicles/);
  assert.doesNotMatch(store, /sendAssignmentCustomerNotification/);
  assert.doesNotMatch(store, /sendReservationSmtpMail/);
  assert.doesNotMatch(store, /assignment-customer-notification/);
  assert.match(store, /AND partner_id = \$2/);

  const ui = source("components/partner/job-assignment.tsx");
  const assignmentRender = ui.slice(ui.indexOf("return ("), ui.indexOf("function DriverAssignmentBlock"));
  assert.match(assignmentRender, /VehicleAssignmentBlock/);
  assert.ok(assignmentRender.indexOf("VehicleAssignmentBlock") < assignmentRender.indexOf("DriverTaskSection"));
  assert.match(ui, /allowVisibilityControls=\{false\}/);
  assert.doesNotMatch(ui, /driverTaskShowPrice|driverTaskShowContact|updateDriverTaskVisibilityAction/);
  assert.match(source("lib/partner/driver-task.ts"), /accepted_partner_id = \$2/);
  assert.match(source("lib/partner/driver-task.ts"), /getDriverTaskForOps/);
  assert.match(source("app/[locale]/partner/(panel)/accepted/[id]/page.tsx"), /getDriverTaskForPartner/);
  assert.match(ui, /NON_TRP_SELECTION/);
  assert.match(ui, /isPrimaryPartner/);
  assert.match(ui, /jobAssignDriver/);
  assert.match(ui, /jobAssignVehicle/);
  assert.match(ui, /name="brandModel"/);
  assert.match(ui, /copy\.vehicleBrandModel/);
  assert.match(ui, /name="features"/);
  assert.match(ui, /showRegisteredSummary = vehicle\.kind === "registered"/);
  assert.match(ui, /showLockedNonTrpSummary = locked && vehicle\.kind === "non_trp"/);
  assert.match(ui, /nonTrpDirty/);
  assert.doesNotMatch(ui, /name="modelYear"/);
  assert.doesNotMatch(ui, /name="vehicleClassCode"/);
  assert.doesNotMatch(ui, /name="passengerCapacity"/);
  assert.doesNotMatch(ui, /name="luggageCapacity"/);
  assert.doesNotMatch(ui, /passengerNotify|opsSendAssignmentCustomerNotificationAction|Yolcuya Gönder/);

  const list = source("components/partner/job-list.tsx");
  assert.match(list, /JobDriverAssignmentCell/);
  assert.match(list, /JobVehicleAssignmentCell/);
  assert.match(list, /jobAssignedDriver/);
  assert.match(list, /jobAssignedVehicle/);
  assert.match(list, /mode === "accepted"/);

  const cell = source("components/partner/job-assignment-cell.tsx");
  assert.match(cell, /partnerAssignDriverAction/);
  assert.match(cell, /partnerClearDriverAction/);
  assert.match(cell, /partnerClearVehicleAction/);
  assert.match(cell, /defaultOpen/);
  assert.match(cell, /FloatingPopover/);
  assert.match(cell, /partner-job-assign-chevron/);
  assert.match(cell, /menuInFlow/);
  assert.match(cell, /onDismiss/);
  assert.match(cell, /dismissOnOutsidePress=\{mode !== "nontrp"\}/);
  assert.equal((cell.match(/dismissOnOutsidePress=\{mode !== "nontrp"\}/g) ?? []).length, 2);
  assert.match(cell, /NonTrpAssignPanelHeader/);
  assert.match(cell, /closeLabel=\{copy\.close\}/);

  const popover = source("components/partner/floating-popover.tsx");
  assert.match(popover, /createPortal/);
  assert.match(popover, /document\.body/);
  assert.match(popover, /country-picker-panel/);
  assert.match(popover, /Escape/);
  assert.match(popover, /dismissOnOutsidePress/);
  assert.match(popover, /shouldDismissFloatingPopoverOnOutsidePress/);

  const notify = source("components/ops/assignment-customer-notify-cell.tsx");
  assert.doesNotMatch(notify, /dismissOnOutsidePress=\{false\}/);
  assert.doesNotMatch(notify, /mode !== "nontrp"/);

  const fleetForm = source("components/partner/vehicle-fields.tsx");
  assert.match(fleetForm, /name="modelYear"/);
  assert.match(fleetForm, /name="vehicleClassCode"/);
  assert.match(fleetForm, /name="passengerCapacity"/);
  assert.match(fleetForm, /name="luggageCapacity"/);
  assert.match(fleetForm, /name="brandCode"/);
  assert.match(fleetForm, /name="modelCode"/);

  const select = source("components/partner/searchable-select.tsx");
  assert.match(select, /pointerdown/);
  assert.match(select, /Escape/);
  assert.match(select, /rootRef\.current\?\.contains/);
  assert.match(select, /onDismiss/);
  assert.match(select, /closeMenu\(false\)/);
  assert.match(select, /menuInFlow/);
  assert.match(select, /filterSearchableSelectOptions/);
  assert.match(select, /shouldPreventDefaultOnOptionPointerDown/);
  assert.doesNotMatch(select, /onChange\(\s*""/);
  assert.doesNotMatch(
    select,
    /onPointerDown=\{\(event\) => \{\s*event\.preventDefault\(\);\s*event\.stopPropagation\(\);\s*selectOption/,
  );

  const opsTable = source("components/ops/reservation-table.tsx");
  assert.match(opsTable, /OpsReservationAssignmentCells/);
  assert.match(opsTable, /assignmentPartner/);
  assert.match(opsTable, /assignmentDriver/);
  assert.match(opsTable, /assignmentVehicle/);
  assert.match(opsTable, /ops-col-assignment/);
  assert.match(opsTable, /partner-job-assign-cell/);

  const fleet = source("lib/partner/fleet.ts");
  assert.match(fleet, /assigned_driver_id/);
  assert.match(fleet, /assigned_vehicle_id/);
  assert.match(fleet, /status <> 'cancelled'/);

  const copy = source("lib/partner/copy.ts");
  assert.match(copy, /jobAssignmentSection: "Operasyon Ataması"/);
  assert.match(copy, /jobUnassigned: "Atanmadı"/);
  assert.match(copy, /jobNonTrp: "NON TRP"/);
  assert.match(copy, /close: "Kapat"/);
  assert.match(copy, /close: "Close"/);
  assert.match(copy, /close: "Закрыть"/);
  assert.match(copy, /jobClearDriver: "Şoför atamasını kaldır"/);
  assert.match(copy, /jobUnassigned: "Unassigned"/);
  assert.match(copy, /jobUnassigned: "Не назначен"/);

  const opsCopy = source("lib/ops/copy.ts");
  assert.match(opsCopy, /assignmentSection: "Partner \/ Operasyon Ataması"/);
  assert.match(opsCopy, /assignmentNonTrp: "NON TRP"/);
  assert.match(opsCopy, /assignmentRemovePartnerConfirm/);
  assert.match(opsCopy, /assignmentSelectPartner/);
});

test("floating assignment layers flip above when there is no room below", () => {
  const below = positionFloatingLayer({
    anchor: { top: 80, left: 40, bottom: 120, width: 90 },
    contentWidth: 240,
    contentHeight: 200,
    viewport: { top: 0, width: 1280, height: 800 },
    minWidth: 240,
    maxWidth: 320,
  });
  assert.equal(below.placement, "below");
  assert.equal(below.top, 128);
  const above = positionFloatingLayer({
    anchor: { top: 720, left: 40, bottom: 760, width: 90 },
    contentWidth: 240,
    contentHeight: 280,
    viewport: { top: 0, width: 1280, height: 800 },
    minWidth: 240,
    maxWidth: 320,
  });
  assert.equal(above.placement, "above");
  assert.ok(above.top < 720);
  assert.ok(above.top + Math.min(280, above.maxHeight) <= 720);
});

test("NON-TRP assignment popovers ignore outside press while registered menus still dismiss", () => {
  assert.equal(
    shouldDismissFloatingPopoverOnOutsidePress({
      dismissOnOutsidePress: false,
      targetInsideLayer: false,
      targetInsideAnchor: false,
      targetExempt: false,
    }),
    false,
  );
  assert.equal(
    shouldDismissFloatingPopoverOnOutsidePress({
      dismissOnOutsidePress: true,
      targetInsideLayer: false,
      targetInsideAnchor: false,
      targetExempt: false,
    }),
    true,
  );
  assert.equal(
    shouldDismissFloatingPopoverOnOutsidePress({
      dismissOnOutsidePress: true,
      targetInsideLayer: true,
      targetInsideAnchor: false,
      targetExempt: false,
    }),
    false,
  );
  assert.equal(
    shouldDismissFloatingPopoverOnOutsidePress({
      dismissOnOutsidePress: true,
      targetInsideLayer: false,
      targetInsideAnchor: true,
      targetExempt: false,
    }),
    false,
  );
  assert.equal(
    shouldDismissFloatingPopoverOnOutsidePress({
      dismissOnOutsidePress: true,
      targetInsideLayer: false,
      targetInsideAnchor: false,
      targetExempt: true,
    }),
    false,
  );
});

void NON_TRP_SELECTION;
