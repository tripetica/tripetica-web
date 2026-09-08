"use client";

import { useActionState, useMemo, useState } from "react";
import { CountryPicker } from "@/components/booking/country-picker";
import { PhoneField } from "@/components/booking/phone-field";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { PartnerFleetTable } from "@/components/ops/partner-fleet-table";
import { useOpsStickyOffset } from "@/components/ops/use-ops-sticky-offset";
import { PartnerBusinessTypeField } from "@/components/partner/business-type-field";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import {
  activateOpsPartnerAction,
  deactivateOpsPartnerAction,
  deleteOpsPartnerAction,
  updateOpsPartnerAction,
  type OpsPartnerFormState,
} from "@/lib/ops/partner-actions";
import {
  partnerEditorValuesEqual,
  partnerEditorValuesFromDetail,
} from "@/lib/ops/partner-form-state";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  partnerStatusBadgeClass,
  partnerStatusLabel,
} from "@/lib/ops/partner-labels";
import { partnerActivationReady, type OpsPartnerDetail } from "@/lib/ops/partner-view";
import {
  PARTNER_DEFAULT_COUNTRY_CODE,
  type PartnerBusinessType,
} from "@/lib/partner/constants";
import { PartnerJobTable } from "@/components/ops/partner-job-table";
import {
  filterAndSortPartnerDrivers,
  nextDriverNameSortDir,
  filterPartnerVehicles,
  type DriverNameSortDir,
} from "@/lib/partner/driver-list-view";
import { type PartnerDriverRecord, type PartnerVehicleRecord } from "@/lib/partner/fleet-view";
import { type PartnerJobRecord } from "@/lib/partner/job-types";
import { filterPartnerJobs } from "@/lib/partner/job-view";
import { canDeactivateExternalPartner } from "@/lib/partner/policy";
import {
  PARTNER_PRIMARY_FORM_VALUE,
  partnerPrioritySelectValues,
} from "@/lib/ops/partner-priority";

type PartnerInfoFormProps = {
  locale: Locale;
  copy: OpsCopy;
  partner: OpsPartnerDetail;
  canManage: boolean;
  primaryPartnerId: string | null;
  tab: "jobs" | "info" | "drivers" | "vehicles";
  drivers: PartnerDriverRecord[];
  vehicles: PartnerVehicleRecord[];
  jobs: PartnerJobRecord[];
};

function partnerFormError(
  error: OpsPartnerFormState["error"],
  copy: OpsCopy,
  fallback: string,
) {
  if (error === "forbidden") {
    return copy.forbidden;
  }
  if (error === "duplicate") {
    return copy.emailTaken;
  }
  if (error === "missing-priority") {
    return copy.activatePartnerNeedPriority;
  }
  if (error === "incomplete") {
    return copy.activatePartnerNeedFields;
  }
  if (error === "primary") {
    return copy.forbidden;
  }
  if (error === "invalid-email") {
    return `${fallback} (${copy.partnerEmail})`;
  }
  if (error === "invalid-phone") {
    return `${fallback} (${copy.partnerPhone})`;
  }
  if (error === "invalid-name") {
    return `${fallback} (${copy.partnerLegalName})`;
  }
  if (error === "invalid-contact") {
    return `${fallback} (${copy.partnerContactFullName})`;
  }
  if (error === "invalid-business-type") {
    return `${fallback} (${copy.partnerBusinessType})`;
  }
  if (error === "invalid-address") {
    return `${fallback} (${copy.partnerAddress})`;
  }
  if (error === "invalid-country") {
    return `${fallback} (${copy.partnerCountry})`;
  }
  if (error === "invalid-tax-office") {
    return `${fallback} (${copy.partnerTaxOffice})`;
  }
  if (error === "invalid-tax-number") {
    return `${fallback} (${copy.partnerTaxNumber})`;
  }
  if (error === "invalid-priority") {
    return `${fallback} (${copy.partnerPriority})`;
  }
  if (error === "primary-taken") {
    return copy.primaryPartnerTaken;
  }
  if (error === "not-found" || error === "deleted" || error === "failed") {
    return fallback;
  }
  return fallback;
}

function partnerServerStamp(partner: OpsPartnerDetail) {
  return [
    partner.id,
    partner.updatedAt,
    partner.status,
    partner.email,
    partner.phone,
    partner.priorityLevel,
    partner.isPrimaryPartner,
    partner.contactFirstName,
    partner.contactLastName,
  ].join(":");
}

export function PartnerInfoForm(props: PartnerInfoFormProps) {
  return <PartnerInfoFormEditor key={partnerServerStamp(props.partner)} {...props} />;
}

function PartnerInfoFormEditor({
  locale,
  copy,
  partner,
  canManage,
  primaryPartnerId,
  tab,
  drivers,
  vehicles,
  jobs,
}: PartnerInfoFormProps) {
  const initial = partnerEditorValuesFromDetail(partner);
  const [values, setValues] = useState(initial);
  const [baseline] = useState(initial);
  const [activeTab, setActiveTab] = useState(tab);
  const [driverQuery, setDriverQuery] = useState("");
  const [vehicleQuery, setVehicleQuery] = useState("");
  const [jobQuery, setJobQuery] = useState("");
  const [driverSortDir, setDriverSortDir] = useState<DriverNameSortDir>("asc");
  const toolbarScrolled = useOpsStickyOffset();
  const visibleDrivers = useMemo(
    () => filterAndSortPartnerDrivers(drivers, driverQuery, driverSortDir),
    [drivers, driverQuery, driverSortDir],
  );
  const visibleVehicles = useMemo(
    () => filterPartnerVehicles(vehicles, vehicleQuery),
    [vehicles, vehicleQuery],
  );
  const visibleJobs = useMemo(
    () => filterPartnerJobs(jobs, jobQuery),
    [jobs, jobQuery],
  );

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [saveState, saveAction, savePending] = useActionState<
    OpsPartnerFormState,
    FormData
  >(updateOpsPartnerAction, { error: null, ok: false });
  const [activateState, activateAction, activatePending] = useActionState<
    OpsPartnerFormState,
    FormData
  >(activateOpsPartnerAction, { error: null, ok: false });
  const [deactivateState, deactivateAction, deactivatePending] = useActionState<
    OpsPartnerFormState,
    FormData
  >(deactivateOpsPartnerAction, { error: null, ok: false });
  const [deleteState, deleteAction, deletePending] = useActionState<
    OpsPartnerFormState,
    FormData
  >(deleteOpsPartnerAction, { error: null, ok: false });

  const dirty = !partnerEditorValuesEqual(values, baseline);
  const canActivate = partnerActivationReady(partner);
  const canDeactivate = canDeactivateExternalPartner(partner);
  const showStatusActivate =
    canManage &&
    !partner.isPrimaryPartner &&
    (partner.status === "pending" || partner.status === "inactive");
  const showDeactivate = canManage && canDeactivate;
  const showDelete = canManage;
  const showSave = canManage;
  const activateEnabled = canActivate && !dirty && !savePending && !activatePending;
  const showSaved = saveState.ok && !dirty;

  function switchTab(next: "jobs" | "info" | "drivers" | "vehicles") {
    setActiveTab(next);
    if (typeof window === "undefined") {
      return;
    }
    const url = new URL(window.location.href);
    url.searchParams.set("tab", next);
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }

  return (
    <div className="ops-partner-info">
      <form action={saveAction} className="ops-partner-editor">
        <div className={toolbarScrolled ? "ops-partner-sticky is-scrolled" : "ops-partner-sticky"}>
          <div className="ops-partner-sticky-identity">
            <p className="ops-partner-code">{partner.partnerCode}</p>
            <h1 className="ops-partner-title">
              <span>{partner.name}</span>
              <span className="ops-partner-title-sep" aria-hidden="true">
                -
              </span>
              <span className={`ops-status-badge ${partnerStatusBadgeClass(partner.status)}`}>
                {partnerStatusLabel(partner.status, copy)}
              </span>
            </h1>
          </div>
          {activeTab !== "info" ? (
            <input
              type="search"
              className="ops-partner-sticky-search"
              value={
                activeTab === "drivers"
                  ? driverQuery
                  : activeTab === "vehicles"
                    ? vehicleQuery
                    : jobQuery
              }
              placeholder={
                activeTab === "drivers"
                  ? copy.driverSearchPlaceholder
                  : activeTab === "vehicles"
                    ? copy.vehicleSearchPlaceholder
                    : copy.jobSearchPlaceholder
              }
              aria-label={
                activeTab === "drivers"
                  ? copy.driverSearchPlaceholder
                  : activeTab === "vehicles"
                    ? copy.vehicleSearchPlaceholder
                    : copy.jobSearchPlaceholder
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                }
              }}
              onChange={(event) => {
                const value = event.target.value;
                if (activeTab === "drivers") {
                  setDriverQuery(value);
                } else if (activeTab === "vehicles") {
                  setVehicleQuery(value);
                } else {
                  setJobQuery(value);
                }
              }}
            />
          ) : null}
          <div className="ops-partner-sticky-actions">
            {showSave ? (
              <button
                type="submit"
                className="ops-btn-primary"
                disabled={!dirty || savePending}
              >
                {savePending ? copy.saving : copy.save}
              </button>
            ) : null}
            {showStatusActivate ? (
              <button
                type="submit"
                formAction={activateAction}
                className="ops-btn-activate"
                disabled={!activateEnabled}
              >
                {activatePending ? copy.activatingPartner : copy.activatePartner}
              </button>
            ) : null}
            {showDeactivate ? (
              <button
                type="submit"
                formAction={deactivateAction}
                className="ops-btn-cancel-soft"
                disabled={dirty || deactivatePending}
              >
                {deactivatePending ? copy.deactivatingPartner : copy.deactivatePartner}
              </button>
            ) : null}
            {showDelete ? (
              <button
                type="button"
                className="ops-btn-danger"
                disabled={deletePending}
                onClick={() => setDeleteOpen(true)}
              >
                {deletePending ? copy.deletingPartner : copy.deletePartner}
              </button>
            ) : null}
            <a className="ops-btn-secondary" href={localizedPath(locale, "/ops/partners")}>
              {copy.back}
            </a>
          </div>
        </div>

        {showSaved ? <p className="ops-form-ok">{copy.partnerSaved}</p> : null}
        {saveState.error ? (
          <p className="ops-form-error" role="alert">
            {partnerFormError(saveState.error, copy, copy.partnerSaveFailed)}
          </p>
        ) : null}
        {activateState.error ? (
          <p className="ops-form-error" role="alert">
            {partnerFormError(activateState.error, copy, copy.partnerActivateFailed)}
          </p>
        ) : null}
        {deactivateState.error ? (
          <p className="ops-form-error" role="alert">
            {partnerFormError(deactivateState.error, copy, copy.partnerDeactivateFailed)}
          </p>
        ) : null}
        {deleteState.error ? (
          <p className="ops-form-error" role="alert">
            {partnerFormError(deleteState.error, copy, copy.deletePartnerFailed)}
          </p>
        ) : null}
        {showStatusActivate && !dirty && !partner.priorityLevel ? (
          <p className="partner-field-hint">{copy.activatePartnerNeedPriority}</p>
        ) : showStatusActivate && !dirty && !canActivate ? (
          <p className="partner-field-hint">{copy.activatePartnerNeedFields}</p>
        ) : null}

        <nav className="ops-partner-tabs" aria-label={copy.partners}>
          {(
            [
              ["jobs", copy.partnerTabJobs],
              ["info", copy.partnerTabInfo],
              ["drivers", copy.partnerTabDrivers],
              ["vehicles", copy.partnerTabVehicles],
            ] as const
          ).map(([key, label]) => (
            <a
              key={key}
              href={`${localizedPath(locale, `/ops/partners/${partner.id}`)}?tab=${key}`}
              className={activeTab === key ? "is-current" : undefined}
              onClick={(event) => {
                event.preventDefault();
                switchTab(key);
              }}
            >
              {label}
            </a>
          ))}
        </nav>

        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={partner.id} />
        <input type="hidden" name="phoneCountryCode" value={values.phoneCountry} />
        <input type="hidden" name="phoneNational" value={values.phoneNational} />
        <input type="hidden" name="countryCode" value={values.countryCode} />
        <input type="hidden" name="contactFirstName" value={partner.contactFirstName ?? ""} />
        <input type="hidden" name="contactLastName" value={partner.contactLastName ?? ""} />

        <div className="ops-user-form" hidden={activeTab !== "info"}>
          <label className="ops-field">
            <span>{copy.partnerEmail}</span>
            <input
              type="email"
              name="email"
              value={values.email}
              onChange={(event) =>
                setValues((current) => ({ ...current, email: event.target.value }))
              }
              required
              disabled={!canManage}
            />
          </label>
          <PhoneField
            locale={locale}
            countryCode={values.phoneCountry}
            nationalNumber={values.phoneNational}
            pickerLayout="anchored"
            onCountryChange={(next) =>
              setValues((current) => ({ ...current, phoneCountry: next }))
            }
            onNationalChange={(next) =>
              setValues((current) => ({ ...current, phoneNational: next }))
            }
          />
          <label className="ops-field">
            <span>{copy.partnerContactFullName}</span>
            <input
              name="contactName"
              value={values.contactName}
              onChange={(event) =>
                setValues((current) => ({ ...current, contactName: event.target.value }))
              }
              autoComplete="name"
              required
              disabled={!canManage}
            />
          </label>
          <PartnerBusinessTypeField
            legend={copy.partnerBusinessType}
            value={(values.businessType || "") as PartnerBusinessType | ""}
            individualLabel={copy.partnerIndividual}
            companyLabel={copy.partnerCompany}
            onChange={(next) => setValues((current) => ({ ...current, businessType: next }))}
            required
            disabled={!canManage}
          />
          <label className="ops-field">
            <span>{copy.partnerLegalName}</span>
            <input
              name="name"
              value={values.name}
              onChange={(event) =>
                setValues((current) => ({ ...current, name: event.target.value }))
              }
              required
              disabled={!canManage}
            />
          </label>
          <label className="ops-field">
            <span>{copy.partnerAddress}</span>
            <textarea
              name="addressLine"
              rows={3}
              value={values.addressLine}
              onChange={(event) =>
                setValues((current) => ({ ...current, addressLine: event.target.value }))
              }
              required
              disabled={!canManage}
            />
          </label>
          <div className="ops-field">
            <span>{copy.partnerCountry}</span>
            {canManage ? (
              <CountryPicker
                locale={locale}
                variant="nationality"
                value={values.countryCode}
                ariaLabel={copy.partnerCountry}
                layout="anchored"
                onChange={(next) =>
                  setValues((current) => ({
                    ...current,
                    countryCode: next || PARTNER_DEFAULT_COUNTRY_CODE,
                  }))
                }
              />
            ) : (
              <div className="partner-country-locked">{values.countryCode}</div>
            )}
          </div>
          <label className="ops-field">
            <span>{copy.partnerTaxOffice}</span>
            <input
              name="taxOffice"
              value={values.taxOffice}
              onChange={(event) =>
                setValues((current) => ({ ...current, taxOffice: event.target.value }))
              }
              required
              disabled={!canManage}
            />
          </label>
          <label className="ops-field">
            <span>{copy.partnerTaxNumber}</span>
            <input
              name="taxNumber"
              value={values.taxNumber}
              onChange={(event) =>
                setValues((current) => ({ ...current, taxNumber: event.target.value }))
              }
              required
              disabled={!canManage}
            />
          </label>
          <label className="ops-field">
            <span>{copy.partnerPriority}</span>
            <select
              name="priorityLevel"
              value={values.priorityLevel}
              onChange={(event) =>
                setValues((current) => ({ ...current, priorityLevel: event.target.value }))
              }
              disabled={!canManage}
            >
              {partnerPrioritySelectValues({
                partnerId: partner.id,
                primaryPartnerId,
              }).map((value) => (
                <option key={value || "unset"} value={value}>
                  {value === PARTNER_PRIMARY_FORM_VALUE
                    ? copy.primaryPartner
                    : value === "1"
                      ? copy.partnerPriority1
                      : value === "2"
                        ? copy.partnerPriority2
                        : value === "3"
                          ? copy.partnerPriority3
                          : copy.partnerPriorityUnset}
                </option>
              ))}
            </select>
          </label>
        </div>
      </form>

      {activeTab === "jobs" ? (
        <PartnerJobTable
          locale={locale}
          copy={copy}
          jobs={visibleJobs}
          emptyLabel={jobs.length === 0 ? copy.emptyPartnerJobs : copy.emptyJobSearch}
        />
      ) : activeTab === "drivers" ? (
        <PartnerFleetTable
          locale={locale}
          copy={copy}
          partnerId={partner.id}
          drivers={visibleDrivers}
          emptyLabel={drivers.length === 0 ? copy.emptyPartnerDrivers : copy.emptyDriverSearch}
          nameSortDir={driverSortDir}
          onNameSort={() => setDriverSortDir((current) => nextDriverNameSortDir(current))}
        />
      ) : activeTab === "vehicles" ? (
        <PartnerFleetTable
          locale={locale}
          copy={copy}
          partnerId={partner.id}
          vehicles={visibleVehicles}
          emptyLabel={vehicles.length === 0 ? copy.emptyPartnerVehicles : copy.emptyVehicleSearch}
        />
      ) : null}

      <form action={deleteAction} id="partner-delete-form" hidden>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={partner.id} />
      </form>

      {deleteOpen ? (
        <OpsConfirmDialog
          title={copy.deletePartnerConfirm}
          error={deleteState.error ? copy.deletePartnerFailed : null}
          pending={deletePending}
          cancelLabel={copy.deletePartnerNo}
          confirmLabel={deletePending ? copy.deletingPartner : copy.deletePartnerYes}
          confirmFormId="partner-delete-form"
          onClose={() => setDeleteOpen(false)}
        />
      ) : null}
    </div>
  );
}
