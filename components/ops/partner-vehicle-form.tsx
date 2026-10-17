"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { UetdsCompanySelect } from "@/components/ops/uetds-company-select";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
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
import {
  DriverUetdsSubscriptionSection,
  driverSubscriptionDraftEquals,
  driverSubscriptionDraftFromState,
  type DriverSubscriptionDraft,
} from "@/components/uetds/driver-uetds-subscription-section";
import { type UetdsDriverSubscriptionState } from "@/lib/uetds/driver-subscription";
import { AtsMinistrySourceField } from "@/components/ops/ats-ministry-source-field";
import { planAtsSourceSave, type AtsMinistrySource, type AtsSourceAudit } from "@/lib/gps/ats-source";

type PartnerVehicleFormProps = {
  locale: Locale;
  copy: OpsCopy;
  vehicle: PartnerVehicleRecord;
  activeUetdsCompanies: readonly UetdsCompanyRef[];
  canManage: boolean;
  linkedPartner?: { id: string; name: string; code: string };
  backHref?: string;
  returnTo?: "ops-vehicles" | "partner";
  subscription: UetdsDriverSubscriptionState;
  atsSource: AtsMinistrySource;
  atsAudits: readonly AtsSourceAudit[];
  hasActiveAtsTrip: boolean;
  gpsAtsSelectable: boolean;
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
  if (error === "invalid-uetds-company") {
    return copy.invalidUetdsCompany;
  }
  if (error === "invalid-subscription-fee") return copy.invalidSubscriptionFee;
  if (error === "invalid-subscription-currency") return copy.invalidSubscriptionCurrency;
  if (error === "ats-source-invalid") return copy.atsSourcePhysicalBlocked;
  if (error === "ats-source-invalid-mobile") return copy.atsSourceMobileBlocked;
  if (error === "ats-source-close") return copy.atsSourceCloseTitle;
  if (error === "gps-ats-needs-device") return copy.gpsAtsNeedsDevice;
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
  return [
    vehicle.id,
    vehicle.updatedAt,
    vehicle.status,
    vehicle.plate,
    vehicle.vehicleClassCode,
    vehicle.uetdsCompanyId ?? "",
  ].join(":");
}

export function PartnerVehicleForm(props: PartnerVehicleFormProps) {
  return <PartnerVehicleFormEditor key={vehicleStamp(props.vehicle)} {...props} />;
}

function PartnerVehicleFormEditor({
  locale,
  copy,
  vehicle,
  activeUetdsCompanies,
  canManage,
  linkedPartner,
  backHref,
  returnTo,
  subscription,
  atsSource,
  atsAudits,
  hasActiveAtsTrip,
  gpsAtsSelectable,
}: PartnerVehicleFormProps) {
  const initial = draftFromVehicle(vehicle);
  const [values, setValues] = useState(initial);
  const [baseline] = useState(initial);
  const [uetdsCompanyId, setUetdsCompanyId] = useState(vehicle.uetdsCompanyId ?? "");
  const [baselineUetdsCompanyId] = useState(vehicle.uetdsCompanyId ?? "");
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

  const panelLocale = locale === "en" || locale === "ru" ? locale : "tr";
  const [subscriptionDraft, setSubscriptionDraft] = useState<DriverSubscriptionDraft>(
    driverSubscriptionDraftFromState(subscription),
  );
  const [subscriptionBaseline] = useState(subscriptionDraft);
  const [source, setSource] = useState<AtsMinistrySource>(atsSource);
  const [sourceBaseline] = useState(atsSource);
  const [closeConfirm, setCloseConfirm] = useState<"" | "switch" | "stop">("");
  const [closeOpen, setCloseOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const submitClose = useRef(false);
  const dirty =
    JSON.stringify(values) !== JSON.stringify(baseline) ||
    uetdsCompanyId !== baselineUetdsCompanyId ||
    source !== sourceBaseline ||
    !driverSubscriptionDraftEquals(subscriptionDraft, subscriptionBaseline);
  const sourceLabels = {
    physical: copy.atsSourcePhysical,
    mobile: copy.atsSourceMobile,
    none: copy.atsSourceNone,
  } as const;
  const closingOther: AtsMinistrySource = atsSource === "physical" ? "mobile" : "physical";
  const otherEnabled = closingOther === "mobile"
    ? subscriptionDraft.services.mobileEnabled
    : subscriptionDraft.services.gpsAtsEnabled;
  const closePlan = planAtsSourceSave({
    currentSource: atsSource,
    nextSource: source,
    gpsAtsEnabled: subscriptionDraft.services.gpsAtsEnabled,
    mobileEnabled: subscriptionDraft.services.mobileEnabled,
    confirm: closeConfirm,
  });
  const resolvedBack =
    backHref ?? `${localizedPath(locale, `/ops/partners/${vehicle.partnerId}`)}?tab=vehicles`;
  useEffect(() => {
    if (!submitClose.current) return;
    submitClose.current = false;
    formRef.current?.requestSubmit();
  }, [closeConfirm, source]);

  return (
    <section className="ops-page ops-partner-detail ops-partner-entity">
      <form
        ref={formRef}
        action={saveAction}
        className="ops-partner-editor"
        noValidate
        onSubmit={(event) => {
          if (closePlan.ok || closeConfirm) return;
          if (closePlan.error !== "ats-source-close") return;
          event.preventDefault();
          setCloseOpen(true);
        }}
      >
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
          <UetdsCompanySelect
            value={uetdsCompanyId}
            activeCompanies={activeUetdsCompanies}
            currentCompany={vehicle.uetdsCompany ?? null}
            fieldLabel={copy.uetdsNotifyCompany}
            noneLabel={copy.uetdsNotifyNone}
            searchPlaceholder={copy.uetdsCompanySearch}
            emptyLabel={copy.uetdsCompanyEmpty}
            disabled={!canManage}
            onChange={setUetdsCompanyId}
          />
          <DriverUetdsSubscriptionSection
            serviceLabels={{
              standard: copy.serviceStandard,
              advanced: copy.serviceAdvanced,
              gpsAts: copy.serviceGpsAts,
              mobile: copy.serviceMobile,
              total: copy.serviceTotal,
            }}
            locale={panelLocale}
            value={subscriptionDraft}
            disabled={!canManage}
            sectionTitle={copy.uetdsSubscriptionTitle}
            enrollLabel={copy.uetdsSubscriptionEnroll}
            enrollHint={copy.uetdsSubscriptionEnrollHint}
            feeLabel={copy.uetdsSubscriptionFee}
            currencyLabel={copy.uetdsSubscriptionCurrency}
            monthsLabel={copy.uetdsSubscriptionMonths}
            statusLabels={{
              unpaid: copy.uetdsSubscriptionUnpaid,
              paid: copy.uetdsSubscriptionPaid,
              free: copy.uetdsSubscriptionFree,
            }}
            gpsAtsSelectable={gpsAtsSelectable}
            gpsAtsLockedText={copy.gpsAtsNeedsDevice}
            onChange={setSubscriptionDraft}
          />
          <AtsMinistrySourceField
            source={source}
            gpsAtsEnabled={subscriptionDraft.services.gpsAtsEnabled}
            mobileEnabled={subscriptionDraft.services.mobileEnabled}
            disabled={!canManage}
            labels={{
              title: copy.atsSourceTitle,
              description: copy.atsSourceDescription,
              physical: copy.atsSourcePhysical,
              mobile: copy.atsSourceMobile,
              none: copy.atsSourceNone,
              statusPhysical: copy.atsSourceStatusPhysical,
              statusMobile: copy.atsSourceStatusMobile,
              statusNone: copy.atsSourceStatusNone,
              physicalBlocked: copy.atsSourcePhysicalBlocked,
              mobileBlocked: copy.atsSourceMobileBlocked,
            }}
            onChange={setSource}
          />
          <input type="hidden" name="atsMinistrySource" value={source} />
          <input type="hidden" name="atsSourceClose" value={closeConfirm} />
          {atsAudits.length > 0 ? (
            <div className="ats-ministry-source-audit">
              <p className="partner-billing-label">{copy.atsSourceAudit}</p>
              <ul>
                {atsAudits.map((audit) => (
                  <li key={`${audit.changedAt}:${audit.newSource}`}>
                    {new Intl.DateTimeFormat(panelLocale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(new Date(audit.changedAt))}
                    {" · "}
                    {sourceLabels[audit.oldSource]}
                    {" → "}
                    {sourceLabels[audit.newSource]}
                    {audit.actorName ? ` · ${audit.actorName}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </form>

      <form action={deleteAction} id="partner-vehicle-delete-form" hidden>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="partnerId" value={vehicle.partnerId} />
        <input type="hidden" name="id" value={vehicle.id} />
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
      </form>

      {closeOpen ? (
        <OpsConfirmDialog
          title={copy.atsSourceCloseTitle}
          pending={savePending}
          cancelLabel={copy.deletePartnerNo}
          confirmLabel={otherEnabled ? copy.atsSourceCloseSwitch : copy.atsSourceCloseStop}
          onClose={() => setCloseOpen(false)}
          onConfirm={() => {
            submitClose.current = true;
            if (otherEnabled) {
              setSource(closingOther);
              setCloseConfirm("switch");
            } else {
              setSource("none");
              setCloseConfirm("stop");
            }
            setCloseOpen(false);
          }}
        >
          <p>
            {hasActiveAtsTrip
              ? (otherEnabled ? copy.atsSourceCloseActiveSwitch : copy.atsSourceCloseActiveStop)
              : copy.atsSourceCloseIdleStop}
          </p>
          {otherEnabled ? (
            <button
              type="button"
              className="ops-btn-secondary"
              onClick={() => {
                submitClose.current = true;
                setSource("none");
                setCloseConfirm("stop");
                setCloseOpen(false);
              }}
            >
              {copy.atsSourceCloseStop}
            </button>
          ) : null}
        </OpsConfirmDialog>
      ) : null}

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
