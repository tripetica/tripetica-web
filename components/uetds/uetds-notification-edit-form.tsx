"use client";
import { useUetdsValidation } from "@/components/uetds/use-uetds-validation";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { OpsConfirmDialog } from "@/components/ops/ops-confirm-dialog";
import { SearchableSelect } from "@/components/partner/searchable-select";
import { UetdsLocationField } from "@/components/uetds/uetds-location-field";
import { UetdsPassengerRemoveButton } from "@/components/uetds/uetds-passenger-remove-button";
import { countries } from "@/lib/geo/countries";
import { type Locale } from "@/lib/i18n/config";
import {
  replaceCompany,
  replaceCount,
  uetdsEligibilityMessage,
  type UetdsFormCopy,
} from "@/lib/uetds/copy";
import { evaluateUetdsEligibility } from "@/lib/uetds/eligibility";
import { selectedFleetCompany, type UetdsFleetOption } from "@/lib/uetds/fleet-options";
import {
  allowedAuthorityIds,
  applyDriverVehicleDefault,
  authorityForDriverChange,
  showGoldAuthorityField,
  type AuthorityChoice,
} from "@/lib/partner/fleet-pairing-rules";
import {
  createPassengerDraft,
  missingMandatoryFields,
  type UetdsDraft,
  type UetdsPassengerDraft,
} from "@/lib/uetds/draft";
import { describeUetdsEditChanges, diffUetdsEdit } from "@/lib/uetds/manage-diff";
import { type UetdsEditWindow, uetdsDateInputValue, uetdsTimeInputValue } from "@/lib/uetds/edit-policy";
import { isExistingMinistryPassenger } from "@/lib/uetds/passenger-class";
import { type UetdsLocation } from "@/lib/uetds/location";
import {
  updateUetdsNotificationAction,
  type UetdsManageFormState,
} from "@/lib/uetds/notification-actions";
import { applyUetdsStartToEnd, isUetdsEndAfterStart } from "@/lib/uetds/trip-time";

type UetdsNotificationEditFormProps = {
  locale: Locale;
  copy: UetdsFormCopy;
  actor: "partner" | "ops";
  ministryEnv: "test" | "live" | null;
  notificationId: string;
  seferReferansNo: string;
  initialDraft: UetdsDraft;
  originalDraft: UetdsDraft;
  editWindow: UetdsEditWindow;
  drivers: UetdsFleetOption[];
  vehicles: UetdsFleetOption[];
  authorities: AuthorityChoice[];
  seferCompanyId: string | null;
  listHref: string;
};

function manageMessage(
  error: string | null,
  copy: UetdsFormCopy,
  detail?: string | null,
  ministryEnv?: "test" | "live" | null,
  actor?: "partner" | "ops",
) {
  if (error === "start-locked") {
    return copy.editStartLocked;
  }
  if (error === "start-too-soon") {
    return copy.editStartTooSoon;
  }
  if (error === "new-passenger-blocked") {
    return copy.editNewPassengerBlocked;
  }
  if (error === "removed-passenger-blocked") {
    return copy.editRemovedPassengerBlocked;
  }
  if (error === "passenger-correction-blocked") {
    return copy.editPassengerCorrectionBlocked;
  }
  if (error === "passenger-count-mismatch") {
    return copy.editPassengerCountMismatch;
  }
  if (error === "missing-passenger-ref") {
    return copy.editMissingPassengerRef;
  }
  if (error === "kamu-session-required") {
    return copy.editKamuSessionRequired;
  }
  if (error === "kamu-session-expired") {
    return copy.editKamuSessionExpired;
  }
  if (error === "kamu-firm-required") {
    return copy.editKamuFirmRequired;
  }
  if (error === "kamu-sefer-not-found") {
    return copy.editKamuSeferNotFound;
  }
  if (error === "kamu-yolcu-not-found") {
    return copy.editKamuYolcuNotFound;
  }
  if (error === "kamu-update-failed") {
    return copy.editKamuUpdateFailed;
  }
  if (error === "kamu-flush-blocked") {
    return copy.editKamuFlushBlocked;
  }
  if (error === "kamu-ref-changed") {
    return copy.editKamuRefChanged;
  }
  if (error === "kamu-verify-failed") {
    return copy.editKamuVerifyFailed;
  }
  if (
    error === "mismatch" ||
    error === "incomplete" ||
    error === "external" ||
    error === "unassigned" ||
    error === "inactive" ||
    error === "not-ready"
  ) {
    return uetdsEligibilityMessage(error, copy);
  }
  if (error === "company-mismatch") {
    return copy.editCompanyMismatch;
  }
  if (error === "driver-identity") {
    return copy.missingDriverIdentity;
  }
  if (error === "subscription") {
    return actor === "partner" ? copy.reasonSubscriptionPartner : copy.reasonSubscription;
  }
  if (error === "reservation-scope") {
    return copy.forbidden;
  }
  if (error === "fleet-verify") {
    return copy.editFleetVerifyFailed;
  }
  if (error === "assignment-sync") {
    return copy.editAssignmentFailed;
  }
  if (error === "ministry") {
    return detail?.trim() || (ministryEnv === "test" ? copy.ministryFailed : copy.ministryFailedLive);
  }
  if (error === "live-blocked") {
    return copy.liveBlocked;
  }
  if (error === "no-test-credentials") {
    return copy.missingTestCredentials;
  }
  if (error === "no-live-credentials") {
    return copy.missingLiveCredentials;
  }
  if (error === "forbidden") {
    return copy.forbidden;
  }
  return copy.saveFailed;
}

export function UetdsNotificationEditForm({
  locale,
  copy,
  actor,
  ministryEnv,
  notificationId,
  seferReferansNo,
  initialDraft,
  originalDraft,
  editWindow,
  drivers,
  vehicles,
  authorities,
  seferCompanyId,
  listHref,
}: UetdsNotificationEditFormProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [authorityId, setAuthorityId] = useState(() => {
    const driver = drivers.find((item) => item.id === initialDraft.driverId);
    return authorityForDriverChange({
      previousDriverId: "",
      nextDriverId: initialDraft.driverId,
      currentAuthorityId: "",
      membershipStatus: driver?.membershipStatus,
      defaultAuthorityId: driver?.defaultAuthorityId,
      allowedAuthorityIds: allowedAuthorityIds(driver, authorities),
    });
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setMounted(true);
  }, []);

  const [state, action, pending] = useActionState<UetdsManageFormState, FormData>(
    updateUetdsNotificationAction,
    { ok: false, error: null, message: null },
  );
  const missing = missingMandatoryFields(draft);
  const endBeforeStart = Boolean(
    draft.startDate &&
      draft.startTime &&
      draft.endDate &&
      draft.endTime &&
      !isUetdsEndAfterStart(draft.startDate, draft.startTime, draft.endDate, draft.endTime),
  );
  const driverOptions = useMemo(
    () => drivers.map((item) => ({ value: item.id, label: item.label })),
    [drivers],
  );
  const vehicleOptions = useMemo(
    () => vehicles.map((item) => ({ value: item.id, label: item.label })),
    [vehicles],
  );
  const selectedDriver = drivers.find((item) => item.id === draft.driverId) ?? null;
  const selectedVehicle = vehicles.find((item) => item.id === draft.vehicleId) ?? null;
  const goldAuthority = showGoldAuthorityField(selectedDriver?.membershipStatus);
  const authorityOptions = useMemo(() => {
    const allowed = new Set(allowedAuthorityIds(selectedDriver, authorities));
    return authorities
      .filter((item) => allowed.has(item.id))
      .map((item) => ({ value: item.id, label: item.label }));
  }, [authorities, selectedDriver]);
  const eligibility = evaluateUetdsEligibility({
    driverId: draft.driverId,
    vehicleId: draft.vehicleId,
    driverKind: draft.driverId ? "registered" : null,
    vehicleKind: draft.vehicleId ? "registered" : null,
    driverCompanyId: selectedDriver?.uetdsCompanyId ?? null,
    vehicleCompanyId: selectedVehicle?.uetdsCompanyId ?? null,
    company: selectedFleetCompany(selectedDriver, selectedVehicle),
  });
  const seferCompanyMismatch = Boolean(
    seferCompanyId && eligibility.companyId && eligibility.companyId !== seferCompanyId,
  );
  const fleetBlocked = !eligibility.ok || seferCompanyMismatch || selectedDriver?.hasNationalId === false;
  const changes = useMemo(() => diffUetdsEdit(originalDraft, draft), [draft, originalDraft]);
  const changeLines = useMemo(
    () =>
      describeUetdsEditChanges(originalDraft, draft, copy, {
        driverLabel: (id) => drivers.find((item) => item.id === id)?.label || id,
        vehicleLabel: (id) => vehicles.find((item) => item.id === id)?.label || id,
      }),
    [copy, draft, drivers, originalDraft, vehicles],
  );
  const reservationSync =
    draft.source === "reservation" &&
    Boolean(draft.reservationId) &&
    (changes.includes("driver") || changes.includes("vehicle"));
  const countryOptions = useMemo(
    () =>
      countries()
        .map((country) => ({
          value: country.iso2,
          label: country.names[locale] || country.names.en,
        }))
        .sort((a, b) => a.label.localeCompare(b.label, locale)),
    [locale],
  );

  const validation = useUetdsValidation(draft, copy, fleetBlocked);

  function updateLocation(key: "originLocation" | "destinationLocation", location: UetdsLocation) {
    setDraft((current) => ({
      ...current,
      [key]: location,
      [key === "originLocation" ? "origin" : "destination"]: location.placeName,
    }));
  }

  function updateStart(next: { startDate?: string; startTime?: string }) {
    if (!editWindow.canChangeStart) {
      return;
    }
    setDraft((current) => {
      const startDate = next.startDate ?? current.startDate;
      const startTime = next.startTime ?? current.startTime;
      const end = applyUetdsStartToEnd({
        startDate,
        startTime,
        endDate: current.endDate,
        endTime: current.endTime,
        endManual: current.endManual,
      });
      return { ...current, startDate, startTime, endDate: end.endDate, endTime: end.endTime };
    });
  }

  function updatePassenger(index: number, patch: Partial<UetdsPassengerDraft>) {
    setDraft((current) => ({
      ...current,
      passengers: current.passengers.map((passenger, itemIndex) =>
        itemIndex === index ? { ...passenger, ...patch } : passenger,
      ),
    }));
  }

  if (state.ok) {
    return (
      <section className="uetds-form" ref={validation.rootRef}>
        <p className="uetds-form-info" role="status">
          {state.warning
            ? manageMessage(state.warning, copy, state.message, ministryEnv, actor)
            : state.status === "partial_update"
              ? state.message || copy.editPartial
              : copy.editUpdated}
        </p>
        {state.status === "partial_update" && state.warning ? (
          <p className="uetds-form-info">{copy.editPartial}</p>
        ) : null}
        <a className="ops-btn-secondary" href={listHref}>
          {copy.backToList}
        </a>
      </section>
    );
  }

  return (
    <section className="uetds-form" ref={validation.rootRef}>
      <h2>{copy.editTitle}</h2>
      <p className="uetds-field-hint">
        {copy.seferRef}: {seferReferansNo}
      </p>
      {!editWindow.canChangeStart ? <p className="uetds-form-info">{copy.editStartLocked}</p> : null}
      {!editWindow.canChangePassengerCount ? (
        <p className="uetds-form-info">{copy.editPassengerCountLocked}</p>
      ) : null}

      <div className="uetds-grid">
        <UetdsLocationField
          locale={locale}
          copy={copy}
          label={copy.origin}
          fieldId="uetds-origin"
          value={draft.originLocation}
          invalid={missing.includes("origin")}
          onChange={(location) => updateLocation("originLocation", location)}
        />
        <UetdsLocationField
          locale={locale}
          copy={copy}
          label={copy.destination}
          fieldId="uetds-destination"
          value={draft.destinationLocation}
          invalid={missing.includes("destination")}
          onChange={(location) => updateLocation("destinationLocation", location)}
        />
        <label data-uetds-field="startDate">
            {copy.startDate}
          <input
            type={mounted ? "date" : "text"}
            value={uetdsDateInputValue(draft.startDate)}
            disabled={!editWindow.canChangeStart}
            autoComplete="off"
            inputMode="numeric"
            onChange={(event) => updateStart({ startDate: uetdsDateInputValue(event.target.value) })}
          />
        </label>
        <label data-uetds-field="startTime">
            {copy.startTime}
          <input
            type={mounted ? "time" : "text"}
            value={uetdsTimeInputValue(draft.startTime)}
            disabled={!editWindow.canChangeStart}
            autoComplete="off"
            inputMode="numeric"
            onChange={(event) => updateStart({ startTime: uetdsTimeInputValue(event.target.value) })}
          />
        </label>
        <label data-uetds-field="endDate">
            {copy.endDate}
          <input
            type={mounted ? "date" : "text"}
            value={uetdsDateInputValue(draft.endDate)}
            autoComplete="off"
            inputMode="numeric"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                endDate: uetdsDateInputValue(event.target.value),
                endManual: true,
              }))
            }
          />
        </label>
        <label data-uetds-field="endTime">
            {copy.endTime}
          <input
            type={mounted ? "time" : "text"}
            value={uetdsTimeInputValue(draft.endTime)}
            autoComplete="off"
            inputMode="numeric"
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                endTime: uetdsTimeInputValue(event.target.value),
                endManual: true,
              }))
            }
          />
        </label>
        <label className="uetds-span-2" data-uetds-field="purpose">
            {copy.purpose}
          <input
            value={draft.purpose}
            autoComplete="off"
            onChange={(event) => setDraft((current) => ({ ...current, purpose: event.target.value }))}
          />
        </label>
        <label>
          {copy.groupName}
          <input
            value={draft.groupName}
            onChange={(event) => setDraft((current) => ({ ...current, groupName: event.target.value }))}
          />
        </label>
        <label data-uetds-field="fare">
            {copy.fare}
          <input
            inputMode="decimal"
            value={draft.fare}
            onChange={(event) => setDraft((current) => ({ ...current, fare: event.target.value }))}
          />
        </label>
      </div>

      <div className="uetds-form-section">
        <h2>{copy.passengers}</h2>
        <div className="uetds-passenger-table">
        <div className="uetds-passenger-head"><span>{copy.listNo}</span><span>{copy.nationality}</span><span>{copy.identity}</span><span>{copy.firstName}</span><span>{copy.lastName}</span><span>{copy.gender}</span><span /></div>
        {draft.passengers.map((passenger, index) => {
          const existing = isExistingMinistryPassenger(passenger, originalDraft);
          const canRemoveRow = existing
            ? editWindow.canRemoveExistingPassenger && draft.passengers.length > 1
            : draft.passengers.length > 1;
          return (
            <div key={passenger.key} className="uetds-passenger-row">
              <p className="uetds-passenger-title">{replaceCount(copy.passengerN, index + 1)}</p>
              <span className="uetds-passenger-number" aria-hidden="true">{index + 1}.</span>
              <label data-label={copy.nationality} data-uetds-field={`passenger.${index}.nationality`}>
                <SearchableSelect
                  value={passenger.nationality}
                  options={countryOptions}
                  placeholder={copy.nationality}
                  emptyLabel={copy.missing}
                  onChange={(value) => updatePassenger(index, { nationality: value })}
                />
              </label>
              <label data-label={copy.identity} data-uetds-field={`passenger.${index}.identity`}>
                <input
                  value={passenger.identityNumber}
                  placeholder={copy.identity}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(event) => updatePassenger(index, { identityNumber: event.target.value })}
                />
              </label>
              <label data-label={copy.firstName} data-uetds-field={`passenger.${index}.firstName`}>
                <input
                  value={passenger.firstName}
                  placeholder={copy.firstNamePlaceholder}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(event) => updatePassenger(index, { firstName: event.target.value })}
                />
              </label>
              <label data-label={copy.lastName} data-uetds-field={`passenger.${index}.lastName`}>
                <input
                  value={passenger.lastName}
                  placeholder={copy.lastNamePlaceholder}
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                  onChange={(event) => updatePassenger(index, { lastName: event.target.value })}
                />
              </label>
              <label data-label={copy.gender} data-uetds-field={`passenger.${index}.gender`}>
                <span className="uetds-gender-toggle" role="group" aria-label={copy.gender}>
                  <button
                    type="button"
                    className={passenger.gender === "female" ? "is-selected" : undefined}
                    aria-pressed={passenger.gender === "female"}
                    onClick={() => updatePassenger(index, { gender: "female" })}
                  >
                    {copy.genderFemale}
                  </button>
                  <span className="uetds-gender-sep" aria-hidden="true">
                    |
                  </span>
                  <button
                    type="button"
                    className={passenger.gender === "male" ? "is-selected" : undefined}
                    aria-pressed={passenger.gender === "male"}
                    onClick={() => updatePassenger(index, { gender: "male" })}
                  >
                    {copy.genderMale}
                  </button>
                </span>
              </label>
              {canRemoveRow ? (
                <UetdsPassengerRemoveButton
                  passenger={passenger}
                  nationalityLabel={countryOptions.find((country) => country.value === passenger.nationality)?.label ?? passenger.nationality}
                  copy={copy}
                  onConfirm={() =>
                    setDraft((current) => {
                      const selected = current.passengers.find((item) => item.key === passenger.key);
                      if (!selected || current.passengers.length <= 1 ||
                        (isExistingMinistryPassenger(selected, originalDraft) && !editWindow.canRemoveExistingPassenger)) {
                        return current;
                      }
                      return {
                        ...current,
                        passengers: current.passengers.filter((item) => item.key !== passenger.key),
                      };
                    })
                  }
                />
              ) : null}
            </div>
          );
        })}
        </div>
        {editWindow.canChangePassengerCount ? (
          <button
            type="button"
            className="ops-btn-secondary"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                passengers: [...current.passengers, createPassengerDraft()],
              }))
            }
          >
            {copy.addPassenger}
          </button>
        ) : null}
      </div>

      <div className="uetds-form-section">
        <h2>{copy.driverVehicle}</h2>
        <div className="uetds-grid">
          <label data-uetds-field="driverId">
            {copy.driver}
            <SearchableSelect
              fieldId="uetds-edit-driver"
              value={draft.driverId}
              options={driverOptions}
              placeholder={copy.selectDriver}
              emptyLabel={copy.noDrivers}
              onChange={(value) => {
                const nextDriver = drivers.find((item) => item.id === value);
                setDraft((current) =>
                  applyDriverVehicleDefault(
                    current,
                    value,
                    nextDriver?.defaultVehicleId,
                    vehicles.map((item) => item.id),
                  ),
                );
                setAuthorityId((currentAuthority) =>
                  authorityForDriverChange({
                    previousDriverId: draft.driverId,
                    nextDriverId: value,
                    currentAuthorityId: currentAuthority,
                    membershipStatus: nextDriver?.membershipStatus,
                    defaultAuthorityId: nextDriver?.defaultAuthorityId,
                    allowedAuthorityIds: allowedAuthorityIds(nextDriver, authorities),
                  }),
                );
              }}
            />
          </label>
          <label data-uetds-field="vehicleId">
            {copy.vehicle}
            <SearchableSelect
              fieldId="uetds-edit-vehicle"
              value={draft.vehicleId}
              options={vehicleOptions}
              placeholder={copy.selectVehicle}
              emptyLabel={copy.noVehicles}
              onChange={(value) => setDraft((current) => ({ ...current, vehicleId: value }))}
            />
          </label>
          {goldAuthority ? (
            <label data-uetds-field="edevletAuthorityId">
              {copy.edevletAuthority}
              <SearchableSelect
                fieldId="uetds-edit-authority"
                value={authorityId}
                options={authorityOptions}
                placeholder={copy.selectEdevletAuthority}
                emptyLabel={copy.noEdevletAuthorities}
                onChange={setAuthorityId}
              />
            </label>
          ) : null}
        </div>
        {eligibility.ok && !seferCompanyMismatch && eligibility.companyShortName ? (
          <p className="uetds-eligible">{replaceCompany(copy.eligibleVia, eligibility.companyShortName)}</p>
        ) : draft.driverId || draft.vehicleId ? (
          <p className="uetds-notify-reason">
            {seferCompanyMismatch
              ? copy.editCompanyMismatch
              : selectedDriver?.hasNationalId === false
                ? copy.missingDriverIdentity
                : uetdsEligibilityMessage(eligibility.reason, copy)}
          </p>
        ) : null}
      </div>

      {endBeforeStart ? <p className="ops-form-error">{copy.endBeforeStart}</p> : null}
      {state.error ? (
        <p className="ops-form-error">{manageMessage(state.error, copy, state.message, ministryEnv, actor)}</p>
      ) : null}

      <form ref={formRef} action={action} id="uetds-edit-submit">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="actor" value={actor} />
        <input type="hidden" name="id" value={notificationId} />
        <input type="hidden" name="draft" value={mounted ? JSON.stringify(draft) : ""} />
      </form>
      <button
        type="button"
        className="ops-btn-primary"
        disabled={pending}
        onClick={() => { if (validation.validate() && changes.length > 0 && !fleetBlocked) setConfirmOpen(true); }}
      >
        {copy.editSave}
      </button>
      <a className="ops-btn-secondary" href={listHref}>
        {copy.confirmNo}
      </a>

      {confirmOpen ? (
        <OpsConfirmDialog
          title={copy.editConfirmTitle}
          pending={pending}
          cancelLabel={copy.confirmNo}
          confirmLabel={copy.editConfirmYes}
          confirmTone="positive"
          onConfirm={() => {
            if (!validation.validate()) { setConfirmOpen(false); return; }
            const field = formRef.current?.elements.namedItem("draft") as HTMLInputElement | null;
            if (field) {
              field.value = JSON.stringify(draftRef.current);
            }
            formRef.current?.requestSubmit();
          }}
          onClose={() => setConfirmOpen(false)}
        >
          <p>{copy.editConfirmTitle}</p>
          <p>
            {copy.seferRef}: {seferReferansNo}
          </p>
          {reservationSync ? <p>{copy.editConfirmReservationSync}</p> : null}
          <p>{copy.editChanges}</p>
          <ul>
            {changeLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </OpsConfirmDialog>
      ) : null}
    </section>
  );
}
