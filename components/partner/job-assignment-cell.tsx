"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { fromStoredPhone } from "@/lib/booking/phone";
import { PhoneField } from "@/components/booking/phone-field";
import { FloatingPopover } from "@/components/partner/floating-popover";
import { LanguageMultiSelect } from "@/components/partner/language-multi-select";
import { SearchableSelect } from "@/components/partner/searchable-select";
import { type Locale } from "@/lib/i18n/config";
import {
  partnerAssignDriverAction,
  partnerAssignVehicleAction,
  partnerClearDriverAction,
  partnerClearVehicleAction,
  type PartnerAssignmentFormState,
} from "@/lib/partner/assignment-actions";
import { PARTNER_DEFAULT_COUNTRY_CODE } from "@/lib/partner/constants";
import { type PartnerCopy } from "@/lib/partner/copy";
import { joinPartnerContactName } from "@/lib/partner/contact-name";
import { type PartnerDriverRecord, type PartnerVehicleRecord } from "@/lib/partner/fleet-view";
import {
  buildDriverAssignmentOptions,
  buildVehicleAssignmentOptions,
  formatAssignmentVehicleName,
  listDriverAssignmentSummary,
  listVehicleAssignmentSummary,
  NON_TRP_SELECTION,
  type AssignJobError,
  type JobDriverAssignmentView,
  type JobVehicleAssignmentView,
} from "@/lib/partner/job-assignment-view";

type CellMode = "closed" | "select" | "nontrp";

const DRIVER_ERROR_COPY: Partial<Record<AssignJobError, keyof PartnerCopy>> = {
  "invalid-name": "invalidDriverName",
  "invalid-phone": "invalidPhone",
  "invalid-languages": "invalidDriverLanguages",
  "invalid-notes": "jobAssignmentFailed",
  "invalid-selection": "jobAssignmentFailed",
  "forbidden-non-trp": "jobAssignmentForbidden",
  "foreign-fleet": "jobAssignmentForbidden",
  "not-accepted": "jobAssignmentNotAccepted",
  locked: "jobAssignmentLocked",
  "inactive-fleet": "jobAssignmentFailed",
  "not-found": "jobAssignmentFailed",
  failed: "jobAssignmentFailed",
};

const VEHICLE_ERROR_COPY: Partial<Record<AssignJobError, keyof PartnerCopy>> = {
  "invalid-plate": "invalidPlate",
  "invalid-brand": "invalidBrand",
  "invalid-brand-model": "invalidBrandModel",
  "invalid-model": "invalidModel",
  "invalid-year": "invalidYear",
  "invalid-class": "invalidClass",
  "invalid-passengers": "invalidPassengers",
  "invalid-luggage": "invalidLuggage",
  "invalid-notes": "jobAssignmentFailed",
  "invalid-selection": "jobAssignmentFailed",
  "forbidden-non-trp": "jobAssignmentForbidden",
  "foreign-fleet": "jobAssignmentForbidden",
  "not-accepted": "jobAssignmentNotAccepted",
  locked: "jobAssignmentLocked",
  "inactive-fleet": "jobAssignmentFailed",
  "not-found": "jobAssignmentFailed",
  failed: "jobAssignmentFailed",
};

function errorText(
  error: AssignJobError | null,
  copy: PartnerCopy,
  map: Partial<Record<AssignJobError, keyof PartnerCopy>>,
) {
  if (!error) {
    return null;
  }
  const key = map[error] ?? "jobAssignmentFailed";
  return copy[key];
}

function AssignChevron() {
  return (
    <span className="partner-job-assign-chevron" aria-hidden="true">
      ▾
    </span>
  );
}

function AssignmentSummary({
  kindLabel,
  title,
  subtitle,
}: {
  kindLabel: string | null;
  title: string;
  subtitle: string | null;
}) {
  return (
    <span className="partner-job-assign-summary">
      {kindLabel ? <span className="partner-job-assign-kind">{kindLabel}</span> : null}
      {title ? <span className="partner-job-assign-title">{title}</span> : null}
      {subtitle ? <span className="partner-job-assign-sub">{subtitle}</span> : null}
    </span>
  );
}

export function JobDriverAssignmentCell({
  locale,
  copy,
  jobId,
  locked,
  driver,
  drivers,
  isPrimaryPartner,
}: {
  locale: Locale;
  copy: PartnerCopy;
  jobId: string;
  locked: boolean;
  driver: JobDriverAssignmentView;
  drivers: PartnerDriverRecord[];
  isPrimaryPartner: boolean;
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<CellMode>("closed");
  const storedPhone = fromStoredPhone(driver.phoneCountryCode, driver.phone);
  const [fullName, setFullName] = useState(
    joinPartnerContactName(driver.firstName, driver.lastName) || driver.fullName || "",
  );
  const [phoneCountry, setPhoneCountry] = useState(
    storedPhone.iso2 ?? PARTNER_DEFAULT_COUNTRY_CODE,
  );
  const [phoneNational, setPhoneNational] = useState(storedPhone.national);
  const [languages, setLanguages] = useState(driver.languageCodes);
  const [notes, setNotes] = useState(driver.notes ?? "");
  const [state, action, pending] = useActionState<PartnerAssignmentFormState, FormData>(
    partnerAssignDriverAction,
    { error: null, ok: false },
  );
  const [clearState, clearAction, clearing] = useActionState<PartnerAssignmentFormState, FormData>(
    partnerClearDriverAction,
    { error: null, ok: false },
  );
  const options = useMemo(
    () => buildDriverAssignmentOptions(drivers, locale, isPrimaryPartner, copy.jobNonTrp),
    [copy.jobNonTrp, drivers, isPrimaryPartner, locale],
  );
  const summary = listDriverAssignmentSummary(driver, copy.jobNonTrp);
  const busy = pending || clearing;
  const pickerOpen = !locked && (mode === "select" || mode === "nontrp");

  useEffect(() => {
    setMode("closed");
  }, [driver.kind, driver.selection, driver.fullName, driver.phone]);

  function togglePicker() {
    setMode((current) => (current === "closed" ? "select" : "closed"));
  }

  function submitRegistered(selection: string) {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", jobId);
    fd.set("selection", selection);
    action(fd);
    setMode("closed");
  }

  function submitNonTrp() {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", jobId);
    fd.set("selection", NON_TRP_SELECTION);
    fd.set("fullName", fullName);
    fd.set("existingFirst", driver.firstName ?? "");
    fd.set("existingLast", driver.lastName ?? "");
    fd.set("phoneCountryCode", phoneCountry);
    fd.set("phoneNational", phoneNational);
    fd.set("languages", languages.join(","));
    fd.set("notes", notes);
    action(fd);
  }

  function clearAssignment() {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", jobId);
    clearAction(fd);
    setMode("closed");
  }

  const error = errorText(state.error ?? clearState.error, copy, DRIVER_ERROR_COPY);

  return (
    <div ref={cellRef} className={`partner-job-assign-cell${busy ? " is-busy" : ""}`}>
      {summary && driver.kind ? (
        <div className="partner-job-assign-assigned">
          {locked ? (
            <AssignmentSummary
              kindLabel={summary.kindLabel}
              title={summary.title}
              subtitle={summary.subtitle}
            />
          ) : (
            <>
              <button
                type="button"
                className="partner-job-assign-current"
                disabled={busy}
                aria-expanded={pickerOpen}
                aria-haspopup="listbox"
                onClick={togglePicker}
              >
                <AssignmentSummary
                  kindLabel={summary.kindLabel}
                  title={summary.title}
                  subtitle={summary.subtitle}
                />
                <AssignChevron />
              </button>
              <button
                type="button"
                className="partner-job-assign-clear"
                aria-label={copy.jobClearDriver}
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation();
                  clearAssignment();
                }}
              >
                ×
              </button>
            </>
          )}
        </div>
      ) : locked ? (
        <span className="partner-job-assign-empty">{copy.jobUnassigned}</span>
      ) : (
        <button
          type="button"
          className="partner-job-assign-trigger"
          disabled={busy}
          aria-expanded={pickerOpen}
          aria-haspopup="listbox"
          onClick={togglePicker}
        >
          <span className="partner-job-assign-trigger-label">{copy.jobAssignDriver}</span>
          <AssignChevron />
        </button>
      )}
      <FloatingPopover
        open={pickerOpen}
        anchorRef={cellRef}
        minWidth={mode === "nontrp" ? 300 : 240}
        maxWidth={mode === "nontrp" ? 380 : 320}
        preferHeight={mode === "nontrp" ? 520 : 280}
        className={
          mode === "nontrp"
            ? "partner-job-assign-layer partner-job-assign-panel"
            : "partner-job-assign-layer partner-job-assign-picker"
        }
        onDismiss={() => setMode("closed")}
      >
        {mode === "nontrp" ? (
          <>
            <p className="partner-job-assign-kind">{copy.jobNonTrp}</p>
            <label className="ops-field">
              <span>{copy.driverFullName}</span>
              <input
                value={fullName}
                autoComplete="name"
                onChange={(event) => setFullName(event.target.value)}
              />
            </label>
            <PhoneField
              locale={locale}
              countryCode={phoneCountry}
              nationalNumber={phoneNational}
              pickerLayout="anchored"
              onCountryChange={setPhoneCountry}
              onNationalChange={setPhoneNational}
            />
            <div className="ops-field">
              <span>{copy.driverLanguages}</span>
              <LanguageMultiSelect
                locale={locale}
                value={languages}
                searchLabel={copy.languageSearch}
                emptyLabel={copy.languageNoResults}
                selectedLabel={copy.languageSelected}
                includeFormField={false}
                onChange={setLanguages}
              />
            </div>
            <label className="ops-field">
              <span>{copy.jobAssignmentNote}</span>
              <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <div className="partner-job-assign-panel-actions">
              <button type="button" className="ops-btn-primary" disabled={busy} onClick={submitNonTrp}>
                {busy ? copy.savingProfile : copy.jobAssignmentSave}
              </button>
              <button
                type="button"
                className="ops-btn-secondary"
                disabled={busy}
                onClick={() => setMode("closed")}
              >
                {copy.cancelEdit}
              </button>
            </div>
          </>
        ) : (
          <SearchableSelect
            value={driver.selection}
            options={options}
            placeholder={copy.jobSelectDriver}
            emptyLabel={copy.jobNoAssignableDrivers}
            defaultOpen
            menuInFlow
            onChange={(value) => {
              if (value === NON_TRP_SELECTION) {
                if (driver.kind !== "non_trp") {
                  setFullName("");
                  setPhoneCountry(PARTNER_DEFAULT_COUNTRY_CODE);
                  setPhoneNational("");
                  setLanguages([]);
                  setNotes("");
                } else {
                  setFullName(
                    joinPartnerContactName(driver.firstName, driver.lastName) ||
                      driver.fullName ||
                      "",
                  );
                  setPhoneCountry(storedPhone.iso2 ?? PARTNER_DEFAULT_COUNTRY_CODE);
                  setPhoneNational(storedPhone.national);
                  setLanguages(driver.languageCodes);
                  setNotes(driver.notes ?? "");
                }
                setMode("nontrp");
                return;
              }
              submitRegistered(value);
            }}
          />
        )}
      </FloatingPopover>
      {error ? (
        <p className="ops-form-error partner-job-assign-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function JobVehicleAssignmentCell({
  locale,
  copy,
  jobId,
  locked,
  vehicle,
  vehicles,
  isPrimaryPartner,
}: {
  locale: Locale;
  copy: PartnerCopy;
  jobId: string;
  locked: boolean;
  vehicle: JobVehicleAssignmentView;
  vehicles: PartnerVehicleRecord[];
  isPrimaryPartner: boolean;
}) {
  const cellRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<CellMode>("closed");
  const [plate, setPlate] = useState(vehicle.plate ?? "");
  const [brandModel, setBrandModel] = useState(
    formatAssignmentVehicleName(vehicle.brand, vehicle.model),
  );
  const [features, setFeatures] = useState(vehicle.features ?? vehicle.notes ?? "");
  const [state, action, pending] = useActionState<PartnerAssignmentFormState, FormData>(
    partnerAssignVehicleAction,
    { error: null, ok: false },
  );
  const [clearState, clearAction, clearing] = useActionState<PartnerAssignmentFormState, FormData>(
    partnerClearVehicleAction,
    { error: null, ok: false },
  );
  const options = useMemo(
    () => buildVehicleAssignmentOptions(vehicles, locale, isPrimaryPartner, copy.jobNonTrp, true),
    [copy.jobNonTrp, isPrimaryPartner, locale, vehicles],
  );
  const summary = listVehicleAssignmentSummary(vehicle, copy.jobNonTrp);
  const busy = pending || clearing;
  const pickerOpen = !locked && (mode === "select" || mode === "nontrp");

  useEffect(() => {
    setMode("closed");
  }, [vehicle.kind, vehicle.selection, vehicle.plate, vehicle.brand, vehicle.model]);

  function togglePicker() {
    setMode((current) => (current === "closed" ? "select" : "closed"));
  }

  function submitRegistered(selection: string) {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", jobId);
    fd.set("selection", selection);
    action(fd);
    setMode("closed");
  }

  function submitNonTrp() {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", jobId);
    fd.set("selection", NON_TRP_SELECTION);
    fd.set("plate", plate);
    fd.set("brandModel", brandModel);
    fd.set("features", features);
    action(fd);
  }

  function clearAssignment() {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", jobId);
    clearAction(fd);
    setMode("closed");
  }

  const error = errorText(state.error ?? clearState.error, copy, VEHICLE_ERROR_COPY);

  return (
    <div ref={cellRef} className={`partner-job-assign-cell${busy ? " is-busy" : ""}`}>
      {summary && vehicle.kind ? (
        <div className="partner-job-assign-assigned">
          {locked ? (
            <AssignmentSummary
              kindLabel={summary.kindLabel}
              title={summary.title}
              subtitle={summary.subtitle}
            />
          ) : (
            <>
              <button
                type="button"
                className="partner-job-assign-current"
                disabled={busy}
                aria-expanded={pickerOpen}
                aria-haspopup="listbox"
                onClick={togglePicker}
              >
                <AssignmentSummary
                  kindLabel={summary.kindLabel}
                  title={summary.title}
                  subtitle={summary.subtitle}
                />
                <AssignChevron />
              </button>
              <button
                type="button"
                className="partner-job-assign-clear"
                aria-label={copy.jobClearVehicle}
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation();
                  clearAssignment();
                }}
              >
                ×
              </button>
            </>
          )}
        </div>
      ) : locked ? (
        <span className="partner-job-assign-empty">{copy.jobUnassigned}</span>
      ) : (
        <button
          type="button"
          className="partner-job-assign-trigger"
          disabled={busy}
          aria-expanded={pickerOpen}
          aria-haspopup="listbox"
          onClick={togglePicker}
        >
          <span className="partner-job-assign-trigger-label">{copy.jobAssignVehicle}</span>
          <AssignChevron />
        </button>
      )}
      <FloatingPopover
        open={pickerOpen}
        anchorRef={cellRef}
        minWidth={mode === "nontrp" ? 300 : 240}
        maxWidth={mode === "nontrp" ? 380 : 320}
        preferHeight={mode === "nontrp" ? 420 : 280}
        className={
          mode === "nontrp"
            ? "partner-job-assign-layer partner-job-assign-panel"
            : "partner-job-assign-layer partner-job-assign-picker"
        }
        onDismiss={() => setMode("closed")}
      >
        {mode === "nontrp" ? (
          <>
            <p className="partner-job-assign-kind">{copy.jobNonTrp}</p>
            <label className="ops-field">
              <span>{copy.vehiclePlate}</span>
              <input
                value={plate}
                autoComplete="off"
                onChange={(event) => setPlate(event.target.value)}
              />
            </label>
            <label className="ops-field">
              <span>{copy.vehicleBrandModel}</span>
              <input
                value={brandModel}
                autoComplete="off"
                onChange={(event) => setBrandModel(event.target.value)}
              />
            </label>
            <label className="ops-field">
              <span>{copy.vehicleFeatures}</span>
              <textarea
                rows={2}
                value={features}
                onChange={(event) => setFeatures(event.target.value)}
              />
            </label>
            <div className="partner-job-assign-panel-actions">
              <button type="button" className="ops-btn-primary" disabled={busy} onClick={submitNonTrp}>
                {busy ? copy.savingProfile : copy.jobAssignmentSave}
              </button>
              <button
                type="button"
                className="ops-btn-secondary"
                disabled={busy}
                onClick={() => setMode("closed")}
              >
                {copy.cancelEdit}
              </button>
            </div>
          </>
        ) : (
          <SearchableSelect
            value={vehicle.selection}
            options={options}
            placeholder={copy.jobSelectVehicle}
            emptyLabel={copy.jobNoAssignableVehicles}
            defaultOpen
            menuInFlow
            onChange={(value) => {
              if (value === NON_TRP_SELECTION) {
                if (vehicle.kind !== "non_trp") {
                  setPlate("");
                  setBrandModel("");
                  setFeatures("");
                } else {
                  setPlate(vehicle.plate ?? "");
                  setBrandModel(formatAssignmentVehicleName(vehicle.brand, vehicle.model));
                  setFeatures(vehicle.features ?? vehicle.notes ?? "");
                }
                setMode("nontrp");
                return;
              }
              submitRegistered(value);
            }}
          />
        )}
      </FloatingPopover>
      {error ? (
        <p className="ops-form-error partner-job-assign-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
