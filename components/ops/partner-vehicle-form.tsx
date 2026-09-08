"use client";

import { useActionState, useState } from "react";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { useOpsStickyOffset } from "@/components/ops/use-ops-sticky-offset";
import { VehicleFields, type VehicleDraft } from "@/components/partner/vehicle-fields";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  activateOpsPartnerVehicleAction,
  approveOpsPartnerVehicleAction,
  deactivateOpsPartnerVehicleAction,
  deleteOpsPartnerVehicleAction,
  rejectOpsPartnerVehicleAction,
  updateOpsPartnerVehicleAction,
  type OpsFleetFormState,
} from "@/lib/ops/partner-fleet-actions";
import { type PartnerVehicleRecord } from "@/lib/partner/fleet-view";
import { vehicleStatusBadgeClass } from "@/lib/partner/fleet-view";
import { vehicleStatusLabel } from "@/lib/partner/vehicle-labels";

type PartnerVehicleFormProps = {
  locale: Locale;
  copy: OpsCopy;
  vehicle: PartnerVehicleRecord;
  canManage: boolean;
  linkedPartner?: { id: string; name: string; code: string };
  backHref?: string;
  returnTo?: "ops-vehicles" | "partner";
};

function fleetError(error: OpsFleetFormState["error"], copy: OpsCopy, fallback: string) {
  if (error === "forbidden") {
    return copy.forbidden;
  }
  if (error === "invalid-plate" || error === "duplicate-plate") {
    return copy.duplicatePlate;
  }
  if (error === "invalid-year") {
    return copy.invalidVehicleYear;
  }
  if (error === "in-use") {
    return copy.fleetInUse;
  }
  return fallback;
}

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

function vehicleStamp(vehicle: PartnerVehicleRecord) {
  return [vehicle.id, vehicle.updatedAt, vehicle.status, vehicle.plate, vehicle.vehicleClassCode].join(":");
}

export function PartnerVehicleForm(props: PartnerVehicleFormProps) {
  return <PartnerVehicleFormEditor key={vehicleStamp(props.vehicle)} {...props} />;
}

function PartnerVehicleFormEditor({
  locale,
  copy,
  vehicle,
  canManage,
  linkedPartner,
  backHref,
  returnTo,
}: PartnerVehicleFormProps) {
  const initial = draftFromVehicle(vehicle);
  const [values, setValues] = useState(initial);
  const [baseline] = useState(initial);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const scrolled = useOpsStickyOffset();
  const [saveState, saveAction, savePending] = useActionState<OpsFleetFormState, FormData>(
    updateOpsPartnerVehicleAction,
    { error: null, ok: false },
  );
  const [activateState, activateAction, activatePending] = useActionState<
    OpsFleetFormState,
    FormData
  >(activateOpsPartnerVehicleAction, { error: null, ok: false });
  const [deactivateState, deactivateAction, deactivatePending] = useActionState<
    OpsFleetFormState,
    FormData
  >(deactivateOpsPartnerVehicleAction, { error: null, ok: false });
  const [approveState, approveAction, approvePending] = useActionState<
    OpsFleetFormState,
    FormData
  >(approveOpsPartnerVehicleAction, { error: null, ok: false });
  const [rejectState, rejectAction, rejectPending] = useActionState<
    OpsFleetFormState,
    FormData
  >(rejectOpsPartnerVehicleAction, { error: null, ok: false });
  const [deleteState, deleteAction, deletePending] = useActionState<OpsFleetFormState, FormData>(
    deleteOpsPartnerVehicleAction,
    { error: null, ok: false },
  );

  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);
  const resolvedBack =
    backHref ?? `${localizedPath(locale, `/ops/partners/${vehicle.partnerId}`)}?tab=vehicles`;

  return (
    <section className="ops-page ops-partner-detail ops-partner-entity">
      <form action={saveAction} className="ops-partner-editor" noValidate>
        <div className={scrolled ? "ops-partner-sticky is-scrolled" : "ops-partner-sticky"}>
          <div className="ops-partner-sticky-identity">
            <p className="ops-partner-code">{vehicle.plate}</p>
            <h1 className="ops-partner-title">
              <span>
                {[vehicle.brand, vehicle.model].filter(Boolean).join(" ") || copy.vehicles}
              </span>
              <span className="ops-partner-title-sep" aria-hidden="true">
                -
              </span>
              <span className={`ops-status-badge ${vehicleStatusBadgeClass(vehicle.status)}`}>
                {vehicleStatusLabel(vehicle.status, copy)}
              </span>
            </h1>
            {linkedPartner ? (
              <p className="ops-driver-linked-partner">
                <a href={localizedPath(locale, `/ops/partners/${linkedPartner.id}`)}>
                  {linkedPartner.name} · {linkedPartner.code}
                </a>
              </p>
            ) : null}
          </div>
          <div className="ops-partner-sticky-actions">
            {canManage ? (
              <button type="submit" className="ops-btn-primary" disabled={!dirty || savePending}>
                {savePending ? copy.saving : copy.save}
              </button>
            ) : null}
            {canManage &&
            (vehicle.status === "pending_approval" || vehicle.status === "rejected") ? (
              <button
                type="submit"
                formAction={approveAction}
                className="ops-btn-activate"
                disabled={dirty || approvePending}
              >
                {approvePending ? copy.approvingVehicle : copy.approveVehicle}
              </button>
            ) : null}
            {canManage && vehicle.status === "pending_approval" ? (
              <button
                type="submit"
                formAction={rejectAction}
                className="ops-btn-cancel-soft"
                disabled={dirty || rejectPending}
              >
                {rejectPending ? copy.rejectingVehicle : copy.rejectVehicle}
              </button>
            ) : null}
            {canManage && vehicle.status === "inactive" ? (
              <button
                type="submit"
                formAction={activateAction}
                className="ops-btn-activate"
                disabled={dirty || activatePending}
              >
                {activatePending ? copy.activatingPartner : copy.activatePartner}
              </button>
            ) : null}
            {canManage && vehicle.status === "active" ? (
              <button
                type="submit"
                formAction={deactivateAction}
                className="ops-btn-cancel-soft"
                disabled={dirty || deactivatePending}
              >
                {deactivatePending ? copy.deactivatingPartner : copy.deactivatePartner}
              </button>
            ) : null}
            {canManage ? (
              <button
                type="button"
                className="ops-btn-danger"
                disabled={deletePending}
                onClick={() => setDeleteOpen(true)}
              >
                {deletePending ? copy.deletingPartner : copy.deletePartner}
              </button>
            ) : null}
            <a className="ops-btn-secondary" href={resolvedBack}>
              {copy.back}
            </a>
          </div>
        </div>

        {saveState.ok && !dirty ? <p className="ops-form-ok">{copy.vehicleSaved}</p> : null}
        {saveState.error ? (
          <p className="ops-form-error" role="alert">
            {fleetError(saveState.error, copy, copy.vehicleSaveFailed)}
          </p>
        ) : null}
        {activateState.error ? (
          <p className="ops-form-error" role="alert">
            {fleetError(activateState.error, copy, copy.vehicleActivateFailed)}
          </p>
        ) : null}
        {deactivateState.error ? (
          <p className="ops-form-error" role="alert">
            {fleetError(deactivateState.error, copy, copy.vehicleDeactivateFailed)}
          </p>
        ) : null}
        {approveState.error || rejectState.error ? (
          <p className="ops-form-error" role="alert">
            {copy.vehicleSaveFailed}
          </p>
        ) : null}
        {deleteState.error ? (
          <p className="ops-form-error" role="alert">
            {fleetError(deleteState.error, copy, copy.deleteVehicleFailed)}
          </p>
        ) : null}

        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="partnerId" value={vehicle.partnerId} />
        <input type="hidden" name="id" value={vehicle.id} />
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

        <div className="ops-user-form ops-partner-entity-form">
          <VehicleFields
            locale={locale}
            copy={copy}
            values={values}
            disabled={!canManage}
            onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
          />
        </div>
      </form>

      <form action={deleteAction} id="partner-vehicle-delete-form" hidden>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="partnerId" value={vehicle.partnerId} />
        <input type="hidden" name="id" value={vehicle.id} />
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      </form>

      {deleteOpen ? (
        <OpsConfirmDialog
          title={copy.deleteVehicleConfirm}
          error={deleteState.error ? copy.deleteVehicleFailed : null}
          pending={deletePending}
          cancelLabel={copy.deletePartnerNo}
          confirmLabel={deletePending ? copy.deletingPartner : copy.deletePartnerYes}
          confirmFormId="partner-vehicle-delete-form"
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}
    </section>
  );
}
