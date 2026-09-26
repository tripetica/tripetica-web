"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { fromStoredPhone } from "@/lib/booking/phone";
import { PhoneField } from "@/components/booking/phone-field";
import { FloatingPopover } from "@/components/partner/floating-popover";
import { LanguageMultiSelect } from "@/components/partner/language-multi-select";
import { NonTrpAssignPanelHeader } from "@/components/partner/non-trp-assign-panel-header";
import { SearchableSelect } from "@/components/partner/searchable-select";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { useReservationAction } from "@/components/ops/use-reservation-action";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  opsAssignReservationDriverAction,
  opsAssignReservationPartnerAction,
  opsAssignReservationVehicleAction,
  opsClearReservationDriverAction,
  opsClearReservationPartnerAction,
  opsClearReservationVehicleAction,
  type OpsAssignmentFormState,
} from "@/lib/ops/reservation-assignment-actions";
import { type OpsAssignmentError, type OpsAssignmentPartnerOption } from "@/lib/ops/reservation-assignment-view";
import { PARTNER_DEFAULT_COUNTRY_CODE } from "@/lib/partner/constants";
import { joinPartnerContactName } from "@/lib/partner/contact-name";
import { type PartnerDriverRecord, type PartnerVehicleRecord } from "@/lib/partner/fleet-view";
import {
  buildDriverAssignmentOptions,
  buildVehicleAssignmentOptions,
  formatAssignmentVehicleName,
  listDriverAssignmentSummary,
  listVehicleAssignmentSummary,
  NON_TRP_SELECTION,
  type JobDriverAssignmentView,
  type JobVehicleAssignmentView,
} from "@/lib/partner/job-assignment-view";

type CellMode = "closed" | "select" | "nontrp";

const INITIAL_ASSIGNMENT_STATE: OpsAssignmentFormState = {
  error: null,
  ok: false,
  reservationId: "",
};

function runAssignmentAction(
  dispatch: (payload: FormData) => void,
  payload: FormData,
) {
  dispatch(payload);
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
  kindLabel?: string | null;
  title: string;
  subtitle?: string | null;
}) {
  return (
    <span className="partner-job-assign-summary">
      {kindLabel ? <span className="partner-job-assign-kind">{kindLabel}</span> : null}
      {title ? <span className="partner-job-assign-title">{title}</span> : null}
      {subtitle ? <span className="partner-job-assign-sub">{subtitle}</span> : null}
    </span>
  );
}

function errorText(error: OpsAssignmentError | null, copy: OpsCopy) {
  if (!error) {
    return null;
  }
  if (error === "forbidden" || error === "forbidden-non-trp") {
    return copy.assignmentForbidden;
  }
  if (error === "foreign-fleet" || error === "inactive-fleet") {
    return copy.assignmentForeignFleet;
  }
  if (error === "inactive-partner") {
    return copy.assignmentInactivePartner;
  }
  if (error === "no-partner" || error === "not-accepted") {
    return copy.assignmentNeedPartner;
  }
  if (error === "invalid-name") {
    return copy.invalidDriverName;
  }
  if (error === "invalid-phone") {
    return copy.invalidPhone;
  }
  if (error === "invalid-languages") {
    return copy.invalidLanguages;
  }
  if (error === "invalid-plate") {
    return copy.invalidPlate;
  }
  if (error === "invalid-brand-model" || error === "invalid-brand" || error === "invalid-model") {
    return copy.invalidBrandModel;
  }
  return copy.assignmentFailed;
}

function OpsPartnerAssignmentCell({
  locale,
  copy,
  reservationId,
  partnerId,
  partnerName,
  partners,
  locked,
}: {
  locale: Locale;
  copy: OpsCopy;
  reservationId: string;
  partnerId: string | null;
  partnerName: string | null;
  partners: readonly OpsAssignmentPartnerOption[];
  locked: boolean;
}) {
  const router = useRouter();
  const cellRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useReservationAction(
    opsAssignReservationPartnerAction,
    INITIAL_ASSIGNMENT_STATE,
    reservationId,
  );
  const [clearState, clearAction, clearing] = useReservationAction(
    opsClearReservationPartnerAction,
    INITIAL_ASSIGNMENT_STATE,
    reservationId,
  );
  const busy = pending || clearing;
  const options = useMemo(
    () =>
      partners.map((partner) => ({
        value: partner.id,
        label: partner.partnerCode
          ? `${partner.name} · ${partner.partnerCode}`
          : partner.name,
      })),
    [partners],
  );

  useEffect(() => {
    setOpen(false);
    setConfirming(false);
  }, [reservationId, partnerId, partnerName]);

  useEffect(() => {
    if (
      (state.ok && state.reservationId === reservationId) ||
      (clearState.ok && clearState.reservationId === reservationId)
    ) {
      router.refresh();
    }
  }, [
    clearState.ok,
    clearState.reservationId,
    reservationId,
    router,
    state.ok,
    state.reservationId,
  ]);

  function submitPartner(nextId: string) {
    if (!nextId || nextId === partnerId) {
      setOpen(false);
      return;
    }
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", reservationId);
    fd.set("partnerId", nextId);
    runAssignmentAction(action, fd);
    setOpen(false);
  }

  function confirmClear() {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", reservationId);
    fd.set("partnerId", partnerId ?? "");
    runAssignmentAction(clearAction, fd);
    setConfirming(false);
  }

  const assigned = Boolean(partnerId && partnerName);
  const error = errorText(state.error ?? clearState.error, copy);

  return (
    <div
      ref={cellRef}
      className={`partner-job-assign-cell${busy ? " is-busy" : ""}${locked ? " is-locked" : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      {assigned ? (
        <div className="partner-job-assign-assigned">
          {locked ? (
            <AssignmentSummary title={partnerName ?? copy.assignmentUnassigned} />
          ) : (
            <>
              <button
                type="button"
                className="partner-job-assign-current"
                disabled={busy}
                aria-expanded={open}
                aria-haspopup="listbox"
                onClick={() => setOpen((current) => !current)}
              >
                <AssignmentSummary title={partnerName ?? ""} />
                <AssignChevron />
              </button>
              <button
                type="button"
                className="partner-job-assign-clear"
                aria-label={copy.assignmentClearPartner}
                disabled={busy}
                onClick={(event) => {
                  event.stopPropagation();
                  setConfirming(true);
                }}
              >
                ×
              </button>
            </>
          )}
        </div>
      ) : locked ? (
        <span className="partner-job-assign-empty">{copy.assignmentUnassigned}</span>
      ) : (
        <button
          type="button"
          className="partner-job-assign-trigger"
          disabled={busy}
          aria-expanded={open}
          aria-haspopup="listbox"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="partner-job-assign-trigger-label">{copy.assignmentSelectPartner}</span>
          <AssignChevron />
        </button>
      )}
      <FloatingPopover
        open={!locked && open}
        anchorRef={cellRef}
        minWidth={240}
        maxWidth={340}
        preferHeight={280}
        className="partner-job-assign-layer partner-job-assign-picker"
        onDismiss={() => setOpen(false)}
      >
        <SearchableSelect
          value={partnerId ?? ""}
          options={options}
          placeholder={copy.assignmentSearchPartner}
          emptyLabel={copy.assignmentEmptyPartners}
          defaultOpen
          menuInFlow
          onChange={submitPartner}
          onDismiss={() => setOpen(false)}
        />
      </FloatingPopover>
      {confirming ? (
        <OpsConfirmDialog
          title={copy.assignmentRemovePartnerConfirm}
          pending={clearing}
          cancelLabel={copy.assignmentRemovePartnerNo}
          confirmLabel={copy.assignmentRemovePartnerYes}
          onConfirm={confirmClear}
          onClose={() => {
            if (!clearing) {
              setConfirming(false);
            }
          }}
        />
      ) : null}
      {error ? (
        <p className="ops-form-error partner-job-assign-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function OpsDriverAssignmentCell({
  locale,
  copy,
  reservationId,
  partnerId,
  locked,
  driver,
  drivers,
  isPrimaryPartner,
}: {
  locale: Locale;
  copy: OpsCopy;
  reservationId: string;
  partnerId: string | null;
  locked: boolean;
  driver: JobDriverAssignmentView;
  drivers: readonly PartnerDriverRecord[];
  isPrimaryPartner: boolean;
}) {
  const router = useRouter();
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
  const [state, action, pending] = useReservationAction(
    opsAssignReservationDriverAction,
    INITIAL_ASSIGNMENT_STATE,
    reservationId,
  );
  const [clearState, clearAction, clearing] = useReservationAction(
    opsClearReservationDriverAction,
    INITIAL_ASSIGNMENT_STATE,
    reservationId,
  );
  const options = useMemo(
    () => buildDriverAssignmentOptions(drivers, locale, isPrimaryPartner, copy.assignmentNonTrp),
    [copy.assignmentNonTrp, drivers, isPrimaryPartner, locale],
  );
  const summary = listDriverAssignmentSummary(driver, copy.assignmentNonTrp);
  const busy = pending || clearing;
  const disabled = locked || !partnerId;
  const pickerOpen = !disabled && (mode === "select" || mode === "nontrp");

  useEffect(() => {
    setMode("closed");
  }, [driver.kind, driver.selection, driver.fullName, driver.phone]);

  useEffect(() => {
    const stored = fromStoredPhone(driver.phoneCountryCode, driver.phone);
    setMode("closed");
    setFullName(
      joinPartnerContactName(driver.firstName, driver.lastName) || driver.fullName || "",
    );
    setPhoneCountry(stored.iso2 ?? PARTNER_DEFAULT_COUNTRY_CODE);
    setPhoneNational(stored.national);
    setLanguages(driver.languageCodes);
    setNotes(driver.notes ?? "");
  }, [reservationId]);

  useEffect(() => {
    if (
      (state.ok && state.reservationId === reservationId) ||
      (clearState.ok && clearState.reservationId === reservationId)
    ) {
      router.refresh();
    }
  }, [
    clearState.ok,
    clearState.reservationId,
    reservationId,
    router,
    state.ok,
    state.reservationId,
  ]);

  function togglePicker() {
    setMode((current) => (current === "closed" ? "select" : "closed"));
  }

  function submitRegistered(selection: string) {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", reservationId);
    fd.set("partnerId", partnerId ?? "");
    fd.set("selection", selection);
    runAssignmentAction(action, fd);
    setMode("closed");
  }

  function submitNonTrp() {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", reservationId);
    fd.set("partnerId", partnerId ?? "");
    fd.set("selection", NON_TRP_SELECTION);
    fd.set("fullName", fullName);
    fd.set("existingFirst", driver.firstName ?? "");
    fd.set("existingLast", driver.lastName ?? "");
    fd.set("phoneCountryCode", phoneCountry);
    fd.set("phoneNational", phoneNational);
    fd.set("languages", languages.join(","));
    fd.set("notes", notes);
    runAssignmentAction(action, fd);
  }

  function clearAssignment() {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", reservationId);
    fd.set("partnerId", partnerId ?? "");
    runAssignmentAction(clearAction, fd);
    setMode("closed");
  }

  const error = errorText(state.error ?? clearState.error, copy);

  return (
    <div
      ref={cellRef}
      className={`partner-job-assign-cell${busy ? " is-busy" : ""}${disabled ? " is-locked" : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      {summary && driver.kind ? (
        <div className="partner-job-assign-assigned">
          {disabled ? (
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
                aria-label={copy.assignmentClearDriver}
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
      ) : disabled ? (
        <span className="partner-job-assign-empty" title={copy.assignmentNeedPartner}>
          {copy.assignmentUnassigned}
        </span>
      ) : (
        <button
          type="button"
          className="partner-job-assign-trigger"
          disabled={busy}
          aria-expanded={pickerOpen}
          aria-haspopup="listbox"
          onClick={togglePicker}
        >
          <span className="partner-job-assign-trigger-label">{copy.assignmentSelectDriver}</span>
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
        dismissOnOutsidePress={mode !== "nontrp"}
        onDismiss={() => setMode("closed")}
      >
        {mode === "nontrp" ? (
          <>
            <NonTrpAssignPanelHeader
              title={copy.assignmentNonTrp}
              closeLabel={copy.close}
              disabled={busy}
              onClose={() => setMode("closed")}
            />
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
              <span>{copy.assignmentNote}</span>
              <textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
            </label>
            <div className="partner-job-assign-panel-actions">
              <button type="button" className="ops-btn-primary" disabled={busy} onClick={submitNonTrp}>
                {busy ? copy.saving : copy.save}
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
            placeholder={copy.assignmentSearchDriver}
            emptyLabel={copy.assignmentEmptyDrivers}
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
            onDismiss={() => setMode("closed")}
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

function OpsVehicleAssignmentCell({
  locale,
  copy,
  reservationId,
  partnerId,
  locked,
  vehicle,
  vehicles,
  isPrimaryPartner,
}: {
  locale: Locale;
  copy: OpsCopy;
  reservationId: string;
  partnerId: string | null;
  locked: boolean;
  vehicle: JobVehicleAssignmentView;
  vehicles: readonly PartnerVehicleRecord[];
  isPrimaryPartner: boolean;
}) {
  const router = useRouter();
  const cellRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<CellMode>("closed");
  const [plate, setPlate] = useState(vehicle.plate ?? "");
  const [brandModel, setBrandModel] = useState(
    formatAssignmentVehicleName(vehicle.brand, vehicle.model),
  );
  const [features, setFeatures] = useState(vehicle.features ?? vehicle.notes ?? "");
  const [state, action, pending] = useReservationAction(
    opsAssignReservationVehicleAction,
    INITIAL_ASSIGNMENT_STATE,
    reservationId,
  );
  const [clearState, clearAction, clearing] = useReservationAction(
    opsClearReservationVehicleAction,
    INITIAL_ASSIGNMENT_STATE,
    reservationId,
  );
  const options = useMemo(
    () => buildVehicleAssignmentOptions(vehicles, locale, isPrimaryPartner, copy.assignmentNonTrp, true),
    [copy.assignmentNonTrp, isPrimaryPartner, locale, vehicles],
  );
  const summary = listVehicleAssignmentSummary(vehicle, copy.assignmentNonTrp);
  const busy = pending || clearing;
  const disabled = locked || !partnerId;
  const pickerOpen = !disabled && (mode === "select" || mode === "nontrp");

  useEffect(() => {
    setMode("closed");
  }, [vehicle.kind, vehicle.selection, vehicle.plate, vehicle.brand, vehicle.model]);

  useEffect(() => {
    setMode("closed");
    setPlate(vehicle.plate ?? "");
    setBrandModel(formatAssignmentVehicleName(vehicle.brand, vehicle.model));
    setFeatures(vehicle.features ?? vehicle.notes ?? "");
  }, [reservationId]);

  useEffect(() => {
    if (
      (state.ok && state.reservationId === reservationId) ||
      (clearState.ok && clearState.reservationId === reservationId)
    ) {
      router.refresh();
    }
  }, [
    clearState.ok,
    clearState.reservationId,
    reservationId,
    router,
    state.ok,
    state.reservationId,
  ]);

  function togglePicker() {
    setMode((current) => (current === "closed" ? "select" : "closed"));
  }

  function submitRegistered(selection: string) {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", reservationId);
    fd.set("partnerId", partnerId ?? "");
    fd.set("selection", selection);
    runAssignmentAction(action, fd);
    setMode("closed");
  }

  function submitNonTrp() {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", reservationId);
    fd.set("partnerId", partnerId ?? "");
    fd.set("selection", NON_TRP_SELECTION);
    fd.set("plate", plate);
    fd.set("brandModel", brandModel);
    fd.set("features", features);
    runAssignmentAction(action, fd);
  }

  function clearAssignment() {
    const fd = new FormData();
    fd.set("locale", locale);
    fd.set("id", reservationId);
    fd.set("partnerId", partnerId ?? "");
    runAssignmentAction(clearAction, fd);
    setMode("closed");
  }

  const error = errorText(state.error ?? clearState.error, copy);

  return (
    <div
      ref={cellRef}
      className={`partner-job-assign-cell${busy ? " is-busy" : ""}${disabled ? " is-locked" : ""}`}
      onClick={(event) => event.stopPropagation()}
    >
      {summary && vehicle.kind ? (
        <div className="partner-job-assign-assigned">
          {disabled ? (
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
                aria-label={copy.assignmentClearVehicle}
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
      ) : disabled ? (
        <span className="partner-job-assign-empty" title={copy.assignmentNeedPartner}>
          {copy.assignmentUnassigned}
        </span>
      ) : (
        <button
          type="button"
          className="partner-job-assign-trigger"
          disabled={busy}
          aria-expanded={pickerOpen}
          aria-haspopup="listbox"
          onClick={togglePicker}
        >
          <span className="partner-job-assign-trigger-label">{copy.assignmentSelectVehicle}</span>
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
        dismissOnOutsidePress={mode !== "nontrp"}
        onDismiss={() => setMode("closed")}
      >
        {mode === "nontrp" ? (
          <>
            <NonTrpAssignPanelHeader
              title={copy.assignmentNonTrp}
              closeLabel={copy.close}
              disabled={busy}
              onClose={() => setMode("closed")}
            />
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
                {busy ? copy.saving : copy.save}
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
            placeholder={copy.assignmentSearchVehicle}
            emptyLabel={copy.assignmentEmptyVehicles}
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
            onDismiss={() => setMode("closed")}
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

export function OpsReservationAssignmentCells({
  locale,
  copy,
  item,
  partners,
  drivers,
  vehicles,
  canAssign,
}: {
  locale: Locale;
  copy: OpsCopy;
  item: {
    id: string;
    acceptedPartnerId: string | null;
    acceptedPartnerName: string | null;
    acceptedPartnerIsPrimary: boolean;
    assignmentLocked: boolean;
    driverAssignment: JobDriverAssignmentView;
    vehicleAssignment: JobVehicleAssignmentView;
  };
  partners: readonly OpsAssignmentPartnerOption[];
  drivers: readonly PartnerDriverRecord[];
  vehicles: readonly PartnerVehicleRecord[];
  canAssign: boolean;
}) {
  const locked = item.assignmentLocked || !canAssign;
  return (
    <>
      <td className="ops-col-assignment">
        <OpsPartnerAssignmentCell
          locale={locale}
          copy={copy}
          reservationId={item.id}
          partnerId={item.acceptedPartnerId}
          partnerName={item.acceptedPartnerName}
          partners={partners}
          locked={locked}
        />
      </td>
      <td className="ops-col-assignment">
        <OpsDriverAssignmentCell
          locale={locale}
          copy={copy}
          reservationId={item.id}
          partnerId={item.acceptedPartnerId}
          locked={locked}
          driver={item.driverAssignment}
          drivers={drivers}
          isPrimaryPartner={item.acceptedPartnerIsPrimary}
        />
      </td>
      <td className="ops-col-assignment">
        <OpsVehicleAssignmentCell
          locale={locale}
          copy={copy}
          reservationId={item.id}
          partnerId={item.acceptedPartnerId}
          locked={locked}
          vehicle={item.vehicleAssignment}
          vehicles={vehicles}
          isPrimaryPartner={item.acceptedPartnerIsPrimary}
        />
      </td>
    </>
  );
}
