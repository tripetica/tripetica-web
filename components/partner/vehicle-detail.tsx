"use client";

import { useActionState, useMemo, useState, type ReactNode } from "react";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { UetdsCompanySelect } from "@/components/ops/uetds-company-select";
import { FleetOptionalSelect } from "@/components/partner/fleet-optional-select";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import { VehicleFields, type VehicleDraft } from "@/components/partner/vehicle-fields";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type PartnerCopy } from "@/lib/partner/copy";
import { partnerDriverDetailMode } from "@/lib/partner/driver-detail-view";
import {
  partnerVehicleBrandModel,
  partnerVehicleCapacityLabel,
  vehicleStatusBadgeClass,
  type PartnerVehicleRecord,
} from "@/lib/partner/fleet-view";
import {
  partnerActivateVehicleAction,
  partnerDeactivateVehicleAction,
  partnerDeleteVehicleAction,
  partnerUpdateVehicleAction,
  type PartnerVehicleFormState,
} from "@/lib/partner/vehicle-actions";
import { partnerVehicleClassLabel } from "@/lib/partner/vehicle-class";
import {
  formatVehicleColor,
  formatVehicleFeatures,
  vehicleStatusLabel,
} from "@/lib/partner/vehicle-labels";
import { partnerVehicleErrorField } from "@/lib/partner/vehicle-policy";
import { type FleetChoice } from "@/lib/partner/fleet-pairing-rules";

type PartnerVehicleDetailProps = {
  locale: Locale;
  copy: PartnerCopy;
  vehicle: PartnerVehicleRecord;
  activeUetdsCompanies: readonly UetdsCompanyRef[];
  drivers: readonly FleetChoice[];
  defaultDriverId: string;
};

const ERROR_COPY: Record<
  Exclude<PartnerVehicleFormState["error"], null>,
  keyof PartnerCopy
> = {
  "invalid-plate": "invalidPlate",
  "invalid-brand": "invalidBrand",
  "invalid-model": "invalidModel",
  "invalid-year": "invalidYear",
  "invalid-color": "invalidColor",
  "invalid-passengers": "invalidPassengers",
  "invalid-luggage": "invalidLuggage",
  "invalid-class": "invalidClass",
  "invalid-features": "invalidFeatures",
  "duplicate-plate": "duplicatePlate",
  "needs-approval": "vehicleNeedsApproval",
  "not-found": "vehicleSaveFailed",
  "in-use": "vehicleSaveFailed",
  "invalid-uetds-company": "invalidUetdsCompany",
  "invalid-fleet-pair": "invalidFleetPair",
  failed: "vehicleSaveFailed",
};

function draftFromVehicle(vehicle: PartnerVehicleRecord): VehicleDraft {
  return {
    plate: vehicle.plate,
    brandCode: vehicle.brandCode ?? "",
    modelCode: vehicle.modelCode ?? "",
    modelYear: vehicle.modelYear != null ? String(vehicle.modelYear) : "",
    colorCode: vehicle.colorCode ?? "",
    colorOther: vehicle.colorOther ?? "",
    passengerCapacity: vehicle.passengerCapacity != null ? String(vehicle.passengerCapacity) : "",
    luggageCapacity: vehicle.luggageCapacity != null ? String(vehicle.luggageCapacity) : "",
    vehicleClassCode: vehicle.vehicleClassCode ?? "",
    featureCodes: vehicle.featureCodes,
    featureOther: vehicle.featureOther ?? "",
  };
}

function draftsEqual(left: VehicleDraft, right: VehicleDraft) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none">
      <path
        d="M4 16.5V20h3.5L18.8 8.7a1 1 0 0 0 0-1.4l-2.1-2.1a1 1 0 0 0-1.4 0L4 16.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14.2 6.3 17.7 9.8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function DetailRow({
  label,
  editLabel,
  editing,
  onEdit,
  children,
}: {
  label: string;
  editLabel: string;
  editing: boolean;
  onEdit: () => void;
  children: ReactNode;
}) {
  return (
    <div className="partner-profile-row">
      <div className="partner-profile-row-head">
        <p className="partner-billing-label">{label}</p>
        <button
          type="button"
          className="partner-edit-btn"
          aria-label={editLabel}
          aria-pressed={editing}
          onClick={onEdit}
        >
          <PencilIcon />
        </button>
      </div>
      {children}
    </div>
  );
}

export function PartnerVehicleDetail({
  locale,
  copy,
  vehicle,
  activeUetdsCompanies,
  drivers,
  defaultDriverId: linkedDriverId,
}: PartnerVehicleDetailProps) {
  const baseline = useMemo(() => draftFromVehicle(vehicle), [vehicle]);
  const [draft, setDraft] = useState(baseline);
  const [uetdsCompanyId, setUetdsCompanyId] = useState(vehicle.uetdsCompanyId ?? "");
  const [defaultDriverId, setDefaultDriverId] = useState(linkedDriverId);
  const baselineUetdsCompanyId = vehicle.uetdsCompanyId ?? "";
  const baselineDriverId = linkedDriverId;
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saveState, saveAction, saving] = useActionState<PartnerVehicleFormState, FormData>(
    async (prev, formData) => {
      const result = await partnerUpdateVehicleAction(prev, formData);
      if (result.ok) {
        setEditing(false);
      }
      return result;
    },
    { error: null, ok: false },
  );
  const [activateState, activateAction, activating] = useActionState(
    partnerActivateVehicleAction,
    { error: null, ok: false },
  );
  const [deactivateState, deactivateAction, deactivating] = useActionState(
    partnerDeactivateVehicleAction,
    { error: null, ok: false },
  );
  const [deleteState, deleteAction, deleting] = useActionState(partnerDeleteVehicleAction, {
    error: null,
    ok: false,
  });
  const dirty =
    !draftsEqual(draft, baseline) ||
    uetdsCompanyId !== baselineUetdsCompanyId ||
    defaultDriverId !== baselineDriverId;
  const mode = partnerDriverDetailMode(editing, dirty);
  const listHref = localizedPath(locale, "/partner/vehicles");
  const fieldError =
    saveState.error && mode !== "view"
      ? copy[ERROR_COPY[saveState.error]]
      : null;
  const errorField = saveState.error ? partnerVehicleErrorField(saveState.error) : null;

  function discardEdits() {
    setDraft(baseline);
    setUetdsCompanyId(baselineUetdsCompanyId);
    setDefaultDriverId(baselineDriverId);
    setEditing(false);
  }

  return (
    <section className="partner-billing-card partner-profile-card" aria-labelledby="partner-vehicle-title">
      <div className="partner-driver-detail-head">
        <h1 id="partner-vehicle-title" className="partner-driver-title">
          {vehicle.plate}
        </h1>
        <span className={`ops-status-badge ${vehicleStatusBadgeClass(vehicle.status)}`}>
          {vehicleStatusLabel(vehicle.status, copy)}
        </span>
      </div>

      <form action={saveAction} className="partner-profile-form partner-fleet-form" noValidate>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={vehicle.id} />
        <input type="hidden" name="uetdsCompanyId" value={uetdsCompanyId} />
        {editing ? (
          <VehicleFields
            locale={locale}
            copy={copy}
            values={draft}
            errors={
              errorField && fieldError ? { [errorField]: fieldError } : undefined
            }
            onChange={(patch) => setDraft((current) => ({ ...current, ...patch }))}
          />
        ) : null}
        {editing ? (
          <>
            <UetdsCompanySelect
              name=""
              value={uetdsCompanyId}
              activeCompanies={activeUetdsCompanies}
              currentCompany={vehicle.uetdsCompany ?? null}
              fieldLabel={copy.uetdsNotifyCompany}
              noneLabel={copy.uetdsNotifyNone}
              searchPlaceholder={copy.uetdsCompanySearch}
              emptyLabel={copy.uetdsCompanyEmpty}
              onChange={setUetdsCompanyId}
            />
            <FleetOptionalSelect
              name="defaultDriverId"
              label={copy.defaultDriver}
              value={defaultDriverId}
              emptyLabel={copy.fleetPairNone}
              options={drivers}
              onChange={setDefaultDriverId}
            />
          </>
        ) : (
          <>
            <input type="hidden" name="plate" value={draft.plate} />
            <input type="hidden" name="brandCode" value={draft.brandCode} />
            <input type="hidden" name="modelCode" value={draft.modelCode} />
            <input type="hidden" name="modelYear" value={draft.modelYear} />
            <input type="hidden" name="colorCode" value={draft.colorCode} />
            <input type="hidden" name="colorOther" value={draft.colorOther} />
            <input type="hidden" name="passengerCapacity" value={draft.passengerCapacity} />
            <input type="hidden" name="luggageCapacity" value={draft.luggageCapacity} />
            <input type="hidden" name="vehicleClassCode" value={draft.vehicleClassCode} />
            <input type="hidden" name="featureCodes" value={draft.featureCodes.join(",")} />
            <input type="hidden" name="featureOther" value={draft.featureOther} />
            <DetailRow
              label={copy.vehiclePlate}
              editLabel={`${copy.editField}: ${copy.vehiclePlate}`}
              editing={false}
              onEdit={() => setEditing(true)}
            >
              <p className="partner-billing-value">{draft.plate}</p>
            </DetailRow>
            <DetailRow
              label={copy.vehicleBrandModel}
              editLabel={`${copy.editField}: ${copy.vehicleBrandModel}`}
              editing={false}
              onEdit={() => setEditing(true)}
            >
              <p className="partner-billing-value">{partnerVehicleBrandModel(vehicle)}</p>
            </DetailRow>
            <DetailRow
              label={copy.vehicleModelYear}
              editLabel={`${copy.editField}: ${copy.vehicleModelYear}`}
              editing={false}
              onEdit={() => setEditing(true)}
            >
              <p className="partner-billing-value">{draft.modelYear || "—"}</p>
            </DetailRow>
            <DetailRow
              label={copy.vehicleColor}
              editLabel={`${copy.editField}: ${copy.vehicleColor}`}
              editing={false}
              onEdit={() => setEditing(true)}
            >
              <p className="partner-billing-value">
                {formatVehicleColor(draft.colorCode, draft.colorOther, vehicle.color, copy)}
              </p>
            </DetailRow>
            <DetailRow
              label={copy.vehicleCapacity}
              editLabel={`${copy.editField}: ${copy.vehicleCapacity}`}
              editing={false}
              onEdit={() => setEditing(true)}
            >
              <p className="partner-billing-value">
                {partnerVehicleCapacityLabel(vehicle, copy)}
              </p>
            </DetailRow>
            <DetailRow
              label={copy.vehicleClass}
              editLabel={`${copy.editField}: ${copy.vehicleClass}`}
              editing={false}
              onEdit={() => setEditing(true)}
            >
              <p className="partner-billing-value">
                {draft.vehicleClassCode
                  ? partnerVehicleClassLabel(draft.vehicleClassCode, locale)
                  : "—"}
              </p>
            </DetailRow>
            <DetailRow
              label={copy.vehicleFeatures}
              editLabel={`${copy.editField}: ${copy.vehicleFeatures}`}
              editing={false}
              onEdit={() => setEditing(true)}
            >
              <p className="partner-billing-value">
                {formatVehicleFeatures(draft.featureCodes, draft.featureOther, copy)}
              </p>
            </DetailRow>
            <DetailRow
              label={copy.uetdsNotifyCompany}
              editLabel={`${copy.editField}: ${copy.uetdsNotifyCompany}`}
              editing={false}
              onEdit={() => setEditing(true)}
            >
              <p className="partner-billing-value">
                {vehicle.uetdsCompany?.shortName ?? copy.uetdsNotifyNone}
              </p>
            </DetailRow>
            <input type="hidden" name="defaultDriverId" value={defaultDriverId} />
            <DetailRow
              label={copy.defaultDriver}
              editLabel={`${copy.editField}: ${copy.defaultDriver}`}
              editing={false}
              onEdit={() => setEditing(true)}
            >
              <p className="partner-billing-value">
                {drivers.find((item) => item.id === defaultDriverId)?.label || copy.fleetPairNone}
              </p>
            </DetailRow>
          </>
        )}

        {saveState.ok && mode === "view" ? (
          <p className="ops-form-ok" role="status">
            {copy.vehicleSaved}
          </p>
        ) : null}
        {fieldError && mode !== "view" ? (
          <p className="ops-form-error" role="alert">
            {fieldError}
          </p>
        ) : null}
        {activateState.error || deactivateState.error ? (
          <p className="ops-form-error" role="alert">
            {activateState.error === "needs-approval"
              ? copy.vehicleNeedsApproval
              : copy.vehicleSaveFailed}
          </p>
        ) : null}
        {mode === "edit-dirty" ? (
          <div className="partner-profile-actions">
            <button type="submit" className="ops-btn-primary" disabled={saving}>
              {saving ? copy.savingProfile : copy.saveProfile}
            </button>
          </div>
        ) : null}
      </form>

      <div className="partner-profile-actions partner-driver-status-actions">
        {vehicle.status === "active" ? (
          <form action={deactivateAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={vehicle.id} />
            <button
              type="submit"
              className="ops-btn-cancel-soft"
              disabled={mode !== "view" || deactivating}
            >
              {copy.deactivateVehicle}
            </button>
          </form>
        ) : vehicle.status === "inactive" ? (
          <form action={activateAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={vehicle.id} />
            <button
              type="submit"
              className="ops-btn-activate"
              disabled={mode !== "view" || activating}
            >
              {copy.activateVehicle}
            </button>
          </form>
        ) : null}
        <button
          type="button"
          className="ops-btn-danger"
          disabled={mode !== "view" || deleting}
          onClick={() => setDeleteOpen(true)}
        >
          {copy.deleteVehicle}
        </button>
        {mode === "view" ? (
          <a className="ops-btn-secondary" href={listHref}>
            {copy.closeVehicle}
          </a>
        ) : (
          <button type="button" className="ops-btn-secondary" onClick={discardEdits}>
            {copy.cancelEdit}
          </button>
        )}
      </div>

      <form action={deleteAction} id="partner-vehicle-delete-form" hidden>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={vehicle.id} />
      </form>

      {deleteOpen ? (
        <OpsConfirmDialog
          title={copy.deleteVehicleConfirm}
          error={deleteState.error ? copy.deleteVehicleFailed : null}
          pending={deleting}
          cancelLabel={copy.cancelEdit}
          confirmLabel={deleting ? copy.deleteVehicle : copy.deleteVehicleYes}
          confirmFormId="partner-vehicle-delete-form"
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}
    </section>
  );
}
