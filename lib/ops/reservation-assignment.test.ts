import { asPanelLocale } from "@/lib/i18n/config";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { opsCopy } from "@/lib/ops/copy";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("ops reservation assignment copy is complete in all locales", () => {
  for (const locale of ["tr", "en", "ru"] as const) {
    const copy = opsCopy[asPanelLocale(locale)];
    assert.ok(copy.assignmentSelectPartner);
    assert.ok(copy.assignmentSearchPartner);
    assert.ok(copy.assignmentRemovePartnerConfirm.includes("?") || copy.assignmentRemovePartnerConfirm.length > 10);
    assert.ok(copy.assignmentRemovePartnerNo);
    assert.ok(copy.assignmentRemovePartnerYes);
    assert.ok(copy.assignmentNeedPartner);
    assert.ok(copy.assignmentForeignFleet);
    assert.equal(copy.assignmentNonTrp, "NON TRP");
    assert.ok(copy.assignmentNote);
    assert.ok(copy.invalidDriverName);
    assert.ok(copy.invalidPhone);
    assert.ok(copy.invalidPlate);
    assert.ok(copy.invalidBrandModel);
  }
  assert.match(
    opsCopy.tr.assignmentRemovePartnerConfirm,
    /Bu partneri rezervasyondan kaldırmak istediğinize emin misiniz\?/,
  );
});

test("ops assignment store keeps partner change atomic and scoped", () => {
  const store = source("lib/ops/reservation-assignment.ts");
  assert.match(store, /BEGIN/);
  assert.match(store, /FOR UPDATE/);
  assert.match(store, /accepted_partner_id = \$2/);
  assert.match(store, /assigned_driver_kind = NULL/);
  assert.match(store, /assigned_vehicle_kind = NULL/);
  assert.match(store, /assigned_driver_snapshot = NULL/);
  assert.match(store, /assigned_vehicle_snapshot = NULL/);
  assert.match(store, /accepted_by_partner_user_id = NULL/);
  assert.match(store, /status = 'active'/);
  assert.match(store, /deleted_at IS NULL/);
  assert.match(store, /getPartnerDriver\(loaded\.partnerId, selection\)/);
  assert.match(store, /getPartnerVehicle\(loaded\.partnerId, selection\)/);
  assert.match(store, /foreign-fleet/);
  assert.match(store, /no-partner/);
  assert.match(store, /inactive-partner/);
  assert.match(store, /isPartnerFleetAssignable/);
  assert.match(store, /NON_TRP_SELECTION/);
  assert.match(store, /assertAssignmentAccess/);
  assert.match(store, /parseNonTrpDriverForm/);
  assert.match(store, /parseNonTrpVehicleForm/);
  assert.match(store, /actorIsPrimary: row\.is_primary_partner/);
  assert.match(store, /assigned_driver_kind = 'non_trp'/);
  assert.match(store, /assigned_vehicle_kind = 'non_trp'/);
  assert.match(store, /is_primary_partner/);
  assert.doesNotMatch(store, /INSERT INTO partner_drivers/);
  assert.doesNotMatch(store, /INSERT INTO partner_vehicles/);
  assert.doesNotMatch(store, /created_at\s*=/);
  assert.doesNotMatch(store, /pickup_at\s*=/);
  assert.doesNotMatch(store, /sendAssignmentCustomerNotification/);
  assert.doesNotMatch(store, /sendReservationSmtpMail/);
  assert.doesNotMatch(store, /assignment-customer-notification/);
});

test("ops assignment actions require reservations.manage and revalidate partner jobs", () => {
  const actions = source("lib/ops/reservation-assignment-actions.ts");
  assert.match(actions, /reservations\.manage/);
  assert.match(actions, /\/partner\/jobs/);
  assert.match(actions, /\/partner\/accepted/);
  assert.match(actions, /\/ops\/reservations/);
  assert.match(actions, /opsAssignReservationPartnerAction/);
  assert.match(actions, /opsClearReservationPartnerAction/);
  assert.match(actions, /fullName/);
  assert.match(actions, /brandModel/);
  assert.match(actions, /NON TRP|non_trp|selection/);
  assert.match(actions, /revalidatePath\(localizedPath\(locale, "\/ops\/reservations"\)\)/);
  assert.match(actions, /reservationId/);
  assert.doesNotMatch(actions, /redirect\(/);
  assert.doesNotMatch(actions, /router\.(push|replace)/);
});

test("ops reservation assignment UI uses existing popover language", () => {
  const cells = source("components/ops/reservation-assignment-cells.tsx");
  assert.match(cells, /FloatingPopover/);
  assert.match(cells, /SearchableSelect/);
  assert.match(cells, /partner-job-assign-chevron/);
  assert.match(cells, /partner-job-assign-clear/);
  assert.match(cells, /assignmentRemovePartnerConfirm/);
  assert.match(cells, /OpsConfirmDialog/);
  assert.doesNotMatch(cells, /createPortal/);

  const confirmDialog = source("components/ops/ops-confirm-dialog.tsx");
  assert.match(confirmDialog, /createPortal/);
  assert.match(confirmDialog, /portal-root/);
  assert.match(confirmDialog, /document\.body/);
  assert.match(confirmDialog, /ops-detail-confirm-backdrop/);
  assert.match(confirmDialog, /ops-detail-confirm-dialog/);
  assert.match(
    source("app/globals.css"),
    /\.ops-detail-confirm-dialog h2\s*\{[^}]*color:\s*#475569/,
  );
  assert.match(confirmDialog, /confirmFormId/);
  assert.match(confirmDialog, /onConfirm/);
  assert.match(cells, /locked \|\| !partnerId/);
  assert.match(cells, /buildDriverAssignmentOptions\(drivers, locale, isPrimaryPartner/);
  assert.match(cells, /buildVehicleAssignmentOptions\(vehicles, locale, isPrimaryPartner/);
  assert.match(cells, /NON_TRP_SELECTION/);
  assert.match(cells, /item\.acceptedPartnerIsPrimary/);
  assert.match(cells, /PhoneField/);
  assert.match(cells, /LanguageMultiSelect/);
  assert.match(cells, /copy\.vehicleBrandModel/);
  assert.match(cells, /copy\.vehicleFeatures/);
  assert.match(cells, /copy\.assignmentNote/);
  assert.match(cells, /mode === "nontrp"/);
  assert.match(cells, /useReservationAction/);
  assert.match(cells, /\[reservationId\]/);
  assert.doesNotMatch(cells, /useActionState/);
  assert.match(cells, /runAssignmentAction\(action, fd\)/);
  assert.match(cells, /runAssignmentAction\(clearAction, fd\)/);
  assert.doesNotMatch(cells, /^\s+action\(fd\);/m);
  assert.doesNotMatch(cells, /^\s+clearAction\(fd\);/m);
  assert.match(cells, /defaultOpen/);
  assert.match(cells, /menuInFlow/);
  assert.match(cells, /onDismiss/);
  assert.match(cells, /dismissOnOutsidePress=\{mode !== "nontrp"\}/);
  assert.equal((cells.match(/dismissOnOutsidePress=\{mode !== "nontrp"\}/g) ?? []).length, 2);
  assert.match(cells, /NonTrpAssignPanelHeader/);
  assert.match(cells, /closeLabel=\{copy\.close\}/);
  assert.doesNotMatch(cells, /dismissOnOutsidePress=\{false\}/);
  assert.match(cells, /router\.refresh\(\)/);
  assert.doesNotMatch(cells, /router\.(push|replace)/);

  const table = source("components/ops/reservation-table.tsx");
  assert.match(table, /OpsReservationAssignmentCells/);
  assert.match(table, /OpsAssignmentCustomerNotifyCell/);
  assert.match(table, /partner-job-assign-cell/);
  assert.match(table, /ops-passenger-notify-cell/);
  assert.match(table, /copy.passengerNotify/);

  const page = source("app/[locale]/ops/(panel)/reservations/page.tsx");
  assert.match(page, /listActiveOpsAssignmentPartners/);
  assert.match(page, /loadOpsAssignmentFleets/);
  assert.match(page, /reservations\.manage/);
});
