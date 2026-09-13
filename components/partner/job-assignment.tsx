"use client";

import { useActionState, useMemo, useState } from "react";
import { fromStoredPhone } from "@/lib/booking/phone";
import { PhoneField } from "@/components/booking/phone-field";
import { LanguageMultiSelect } from "@/components/partner/language-multi-select";
import { SearchableSelect } from "@/components/partner/searchable-select";
import { DriverTaskSection } from "@/components/ops/driver-task-section";
import { type Locale } from "@/lib/i18n/config";
import { type OpsCopy } from "@/lib/ops/copy";
import { type DriverTaskOpsView } from "@/lib/ops/driver-task-fields";
import {
  partnerAssignDriverAction,
  partnerAssignVehicleAction,
  type PartnerAssignmentFormState,
} from "@/lib/partner/assignment-actions";
import { PARTNER_DEFAULT_COUNTRY_CODE } from "@/lib/partner/constants";
import { type PartnerCopy } from "@/lib/partner/copy";
import { formatPartnerFleetPhone, type PartnerDriverRecord, type PartnerVehicleRecord } from "@/lib/partner/fleet-view";
import { joinPartnerContactName } from "@/lib/partner/contact-name";
import {
  buildDriverAssignmentOptions,
  buildVehicleAssignmentOptions,
  formatAssignmentVehicleName,
  formatDriverLanguagesDisplay,
  NON_TRP_SELECTION,
  type AssignJobError,
  type JobAssignmentView,
} from "@/lib/partner/job-assignment-view";
import { partnerVehicleClassLabel } from "@/lib/partner/vehicle-class";

type PartnerJobAssignmentProps = {
  locale: Locale;
  copy: PartnerCopy;
  jobId: string;
  isPrimaryPartner: boolean;
  assignment: JobAssignmentView;
  drivers: PartnerDriverRecord[];
  vehicles: PartnerVehicleRecord[];
  driverTask?: DriverTaskOpsView | null;
  driverTaskCopy?: OpsCopy;
};

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

function present(value: string | number | null | undefined) {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  const shown = present(value);
  if (!shown) {
    return null;
  }
  return (
    <div className="partner-profile-row">
      <p className="partner-billing-label">{label}</p>
      <p className="partner-billing-value">{shown}</p>
    </div>
  );
}

export function PartnerJobAssignment({
  locale,
  copy,
  jobId,
  isPrimaryPartner,
  assignment,
  drivers,
  vehicles,
  driverTask = null,
  driverTaskCopy,
}: PartnerJobAssignmentProps) {
  const driverOptions = useMemo(
    () => buildDriverAssignmentOptions(drivers, locale, isPrimaryPartner, copy.jobNonTrp),
    [copy.jobNonTrp, drivers, isPrimaryPartner, locale],
  );

  const vehicleOptions = useMemo(
    () => buildVehicleAssignmentOptions(vehicles, locale, isPrimaryPartner, copy.jobNonTrp),
    [copy.jobNonTrp, isPrimaryPartner, locale, vehicles],
  );

  return (
    <div className="partner-job-section partner-job-assignment">
      <h2 className="partner-job-section-title">{copy.jobAssignmentSection}</h2>
      {assignment.locked ? (
        <p className="partner-job-assignment-locked">{copy.jobAssignmentLocked}</p>
      ) : null}
      <DriverAssignmentBlock
        locale={locale}
        copy={copy}
        jobId={jobId}
        assignment={assignment}
        options={driverOptions}
        locked={assignment.locked}
      />
      <VehicleAssignmentBlock
        locale={locale}
        copy={copy}
        jobId={jobId}
        assignment={assignment}
        options={vehicleOptions}
        locked={assignment.locked}
      />
      {driverTask && driverTaskCopy ? (
        <section className="partner-job-assignment-block partner-driver-task-block">
          <DriverTaskSection
            copy={driverTaskCopy}
            reservationId={jobId}
            driverTask={driverTask}
            allowVisibilityControls={false}
          />
        </section>
      ) : null}
    </div>
  );
}

function DriverAssignmentBlock({
  locale,
  copy,
  jobId,
  assignment,
  options,
  locked,
}: {
  locale: Locale;
  copy: PartnerCopy;
  jobId: string;
  assignment: JobAssignmentView;
  options: Array<{ value: string; label: string }>;
  locked: boolean;
}) {
  const driver = assignment.driver;
  const storedPhone = fromStoredPhone(driver.phoneCountryCode, driver.phone);
  const [selection, setSelection] = useState(driver.selection);
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
  const nonTrp = selection === NON_TRP_SELECTION;
  const savedName = (
    joinPartnerContactName(driver.firstName, driver.lastName) ||
    driver.fullName ||
    ""
  ).trim();
  const nonTrpDirty =
    selection !== driver.selection ||
    fullName.trim() !== savedName ||
    phoneCountry !== (storedPhone.iso2 ?? PARTNER_DEFAULT_COUNTRY_CODE) ||
    phoneNational !== storedPhone.national ||
    languages.join(",") !== driver.languageCodes.join(",") ||
    notes !== (driver.notes ?? "");
  const showSave = nonTrp ? nonTrpDirty : Boolean(selection);
  const showRegisteredSummary = driver.kind === "registered";
  const showLockedNonTrpSummary = locked && driver.kind === "non_trp";

  return (
    <section className="partner-job-assignment-block" aria-labelledby="partner-assign-driver">
      <h3 id="partner-assign-driver" className="partner-job-assignment-title">
        {copy.jobAssignedDriver}
      </h3>
      {showLockedNonTrpSummary ? (
        <p className="partner-job-non-trp-badge">{copy.jobNonTrp}</p>
      ) : null}
      {showRegisteredSummary || showLockedNonTrpSummary ? (
        <>
          <InfoRow label={copy.driverFullName} value={driver.fullName} />
          <InfoRow label={copy.phone} value={formatPartnerFleetPhone(driver.phone)} />
          <InfoRow
            label={copy.driverLanguages}
            value={
              driver.languageCodes.length
                ? formatDriverLanguagesDisplay(driver.languageCodes, locale)
                : null
            }
          />
          <InfoRow label={copy.driverNationalId} value={driver.nationalId} />
          <InfoRow label={copy.jobAssignmentNote} value={driver.notes} />
        </>
      ) : locked ? (
        <p className="partner-job-unassigned">{copy.jobUnassigned}</p>
      ) : null}
      {locked ? null : (
        <form action={action} className="partner-job-assignment-form">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={jobId} />
          <input type="hidden" name="existingFirst" value={driver.firstName ?? ""} />
          <input type="hidden" name="existingLast" value={driver.lastName ?? ""} />
          <input type="hidden" name="phoneCountryCode" value={phoneCountry} />
          <input type="hidden" name="phoneNational" value={phoneNational} />
          <div className="ops-field">
            <span>{copy.jobAssignDriver}</span>
            <SearchableSelect
              name="selection"
              value={selection}
              options={options}
              placeholder={copy.jobSelectDriver}
              emptyLabel={copy.jobNoAssignableDrivers}
              onChange={(value) => {
                setSelection(value);
                if (value === NON_TRP_SELECTION && driver.kind !== "non_trp") {
                  setFullName("");
                  setPhoneCountry(PARTNER_DEFAULT_COUNTRY_CODE);
                  setPhoneNational("");
                  setLanguages([]);
                  setNotes("");
                }
              }}
            />
          </div>
          {nonTrp ? (
            <div className="partner-non-trp-fields">
              <label className="ops-field">
                <span>{copy.driverFullName}</span>
                <input
                  name="fullName"
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
                  onChange={setLanguages}
                />
              </div>
              <label className="ops-field">
                <span>{copy.jobAssignmentNote}</span>
                <textarea
                  name="notes"
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>
            </div>
          ) : null}
          {state.error ? (
            <p className="ops-form-error" role="alert">
              {errorText(state.error, copy, DRIVER_ERROR_COPY)}
            </p>
          ) : null}
          {state.ok && !nonTrpDirty ? (
            <p className="partner-job-assignment-ok">{copy.jobAssignmentSaved}</p>
          ) : null}
          {showSave ? (
            <button type="submit" className="ops-btn-primary" disabled={pending}>
              {pending ? copy.savingProfile : copy.jobAssignmentSave}
            </button>
          ) : null}
        </form>
      )}
    </section>
  );
}

function VehicleAssignmentBlock({
  locale,
  copy,
  jobId,
  assignment,
  options,
  locked,
}: {
  locale: Locale;
  copy: PartnerCopy;
  jobId: string;
  assignment: JobAssignmentView;
  options: Array<{ value: string; label: string }>;
  locked: boolean;
}) {
  const vehicle = assignment.vehicle;
  const [selection, setSelection] = useState(vehicle.selection);
  const [plate, setPlate] = useState(vehicle.plate ?? "");
  const [brandModel, setBrandModel] = useState(
    formatAssignmentVehicleName(vehicle.brand, vehicle.model),
  );
  const [features, setFeatures] = useState(vehicle.features ?? vehicle.notes ?? "");
  const [state, action, pending] = useActionState<PartnerAssignmentFormState, FormData>(
    partnerAssignVehicleAction,
    { error: null, ok: false },
  );
  const nonTrp = selection === NON_TRP_SELECTION;
  const savedBrandModel = formatAssignmentVehicleName(vehicle.brand, vehicle.model);
  const nonTrpDirty =
    selection !== vehicle.selection ||
    plate !== (vehicle.plate ?? "") ||
    brandModel !== savedBrandModel ||
    features !== (vehicle.features ?? vehicle.notes ?? "");
  const showSave = nonTrp ? nonTrpDirty : Boolean(selection);
  const showRegisteredSummary = vehicle.kind === "registered";
  const showLockedNonTrpSummary = locked && vehicle.kind === "non_trp";

  return (
    <section className="partner-job-assignment-block" aria-labelledby="partner-assign-vehicle">
      <h3 id="partner-assign-vehicle" className="partner-job-assignment-title">
        {copy.jobAssignedVehicle}
      </h3>
      {showLockedNonTrpSummary ? (
        <p className="partner-job-non-trp-badge">{copy.jobNonTrp}</p>
      ) : null}
      {showRegisteredSummary ? (
        <>
          <InfoRow label={copy.vehiclePlate} value={vehicle.plate} />
          <InfoRow label={copy.vehicleBrand} value={vehicle.brand} />
          <InfoRow label={copy.vehicleModel} value={vehicle.model} />
          <InfoRow
            label={copy.vehicleModelYear}
            value={vehicle.modelYear != null ? String(vehicle.modelYear) : null}
          />
          <InfoRow
            label={copy.vehicleClass}
            value={
              vehicle.vehicleClassCode
                ? partnerVehicleClassLabel(vehicle.vehicleClassCode, locale)
                : null
            }
          />
          <InfoRow
            label={copy.vehiclePassengers}
            value={vehicle.passengerCapacity != null ? String(vehicle.passengerCapacity) : null}
          />
          <InfoRow
            label={copy.vehicleLuggage}
            value={vehicle.luggageCapacity != null ? String(vehicle.luggageCapacity) : null}
          />
          <InfoRow label={copy.vehicleColor} value={vehicle.color} />
          <InfoRow label={copy.vehicleFeatures} value={vehicle.features} />
        </>
      ) : showLockedNonTrpSummary ? (
        <>
          <InfoRow label={copy.vehiclePlate} value={vehicle.plate} />
          <InfoRow
            label={copy.vehicleBrandModel}
            value={formatAssignmentVehicleName(vehicle.brand, vehicle.model)}
          />
          <InfoRow label={copy.vehicleFeatures} value={vehicle.features} />
        </>
      ) : locked ? (
        <p className="partner-job-unassigned">{copy.jobUnassigned}</p>
      ) : null}
      {locked ? null : (
        <form action={action} className="partner-job-assignment-form">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={jobId} />
          <div className="ops-field">
            <span>{copy.jobAssignVehicle}</span>
            <SearchableSelect
              name="selection"
              value={selection}
              options={options}
              placeholder={copy.jobSelectVehicle}
              emptyLabel={copy.jobNoAssignableVehicles}
              onChange={(value) => {
                setSelection(value);
                if (value === NON_TRP_SELECTION && vehicle.kind !== "non_trp") {
                  setPlate("");
                  setBrandModel("");
                  setFeatures("");
                }
              }}
            />
          </div>
          {nonTrp ? (
            <div className="partner-non-trp-fields">
              <label className="ops-field">
                <span>{copy.vehiclePlate}</span>
                <input
                  name="plate"
                  value={plate}
                  autoComplete="off"
                  onChange={(event) => setPlate(event.target.value)}
                />
              </label>
              <label className="ops-field">
                <span>{copy.vehicleBrandModel}</span>
                <input
                  name="brandModel"
                  value={brandModel}
                  autoComplete="off"
                  onChange={(event) => setBrandModel(event.target.value)}
                />
              </label>
              <label className="ops-field">
                <span>{copy.vehicleFeatures}</span>
                <textarea
                  name="features"
                  rows={3}
                  value={features}
                  onChange={(event) => setFeatures(event.target.value)}
                />
              </label>
            </div>
          ) : null}
          {state.error ? (
            <p className="ops-form-error" role="alert">
              {errorText(state.error, copy, VEHICLE_ERROR_COPY)}
            </p>
          ) : null}
          {state.ok && !nonTrpDirty ? (
            <p className="partner-job-assignment-ok">{copy.jobAssignmentSaved}</p>
          ) : null}
          {showSave ? (
            <button type="submit" className="ops-btn-primary" disabled={pending}>
              {pending ? copy.savingProfile : copy.jobAssignmentSave}
            </button>
          ) : null}
        </form>
      )}
    </section>
  );
}
