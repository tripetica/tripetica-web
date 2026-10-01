"use client";

import { useActionState, useRef, useState } from "react";
import { UetdsCompanySelect } from "@/components/ops/uetds-company-select";
import { FleetOptionalSelect } from "@/components/partner/fleet-optional-select";
import {
  emptyVehicleDraft,
  VehicleFields,
  type VehicleDraft,
} from "@/components/partner/vehicle-fields";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type FleetChoice } from "@/lib/partner/fleet-pairing-rules";
import {
  partnerCreateVehicleAction,
  type PartnerVehicleFormState,
} from "@/lib/partner/vehicle-actions";
import {
  parsePartnerVehicleInput,
  partnerVehicleErrorField,
  type PartnerVehicleField,
} from "@/lib/partner/vehicle-policy";

type PartnerVehicleCreateFormProps = {
  locale: Locale;
  copy: PartnerCopy;
  activeUetdsCompanies: readonly UetdsCompanyRef[];
  drivers: readonly FleetChoice[];
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

export function PartnerVehicleCreateForm({
  locale,
  copy,
  activeUetdsCompanies,
  drivers,
}: PartnerVehicleCreateFormProps) {
  const [state, action, pending] = useActionState<PartnerVehicleFormState, FormData>(
    partnerCreateVehicleAction,
    { error: null, ok: false },
  );
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState<VehicleDraft>(emptyVehicleDraft);
  const [uetdsCompanyId, setUetdsCompanyId] = useState("");
  const [defaultDriverId, setDefaultDriverId] = useState("");
  const [clientErrors, setClientErrors] = useState<Partial<Record<PartnerVehicleField, string>>>({});
  const [cleared, setCleared] = useState<Partial<Record<PartnerVehicleField, true>>>({});
  const [ignoreServer, setIgnoreServer] = useState(false);

  const fieldErrors: Partial<Record<PartnerVehicleField, string>> = {
    ...(!ignoreServer && state.error
      ? (() => {
          const field = partnerVehicleErrorField(state.error);
          return field ? { [field]: copy[ERROR_COPY[state.error]] } : {};
        })()
      : {}),
    ...clientErrors,
  };
  for (const field of Object.keys(cleared) as PartnerVehicleField[]) {
    delete fieldErrors[field];
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const parsed = parsePartnerVehicleInput({
      ...values,
      featureCodes: values.featureCodes,
    });
    if (!parsed.ok) {
      event.preventDefault();
      setIgnoreServer(true);
      setCleared({});
      setClientErrors({
        [partnerVehicleErrorField(parsed.error) ?? "plate"]: copy[ERROR_COPY[parsed.error]],
      });
      return;
    }
    setIgnoreServer(false);
    setCleared({});
    setClientErrors({});
  }

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="partner-profile-form partner-fleet-form"
      onSubmit={handleSubmit}
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="locale" value={locale} />
      <VehicleFields
        locale={locale}
        copy={copy}
        values={values}
        errors={fieldErrors}
        onChange={(patch) => {
          setValues((current) => ({ ...current, ...patch }));
          const fields: PartnerVehicleField[] = [];
          if ("plate" in patch) fields.push("plate");
          if ("brandCode" in patch) fields.push("brand", "model");
          if ("modelCode" in patch) fields.push("model");
          if ("modelYear" in patch) fields.push("modelYear");
          if ("colorCode" in patch || "colorOther" in patch) fields.push("color");
          if ("passengerCapacity" in patch) fields.push("passengers");
          if ("luggageCapacity" in patch) fields.push("luggage");
          if ("vehicleClassCode" in patch) fields.push("vehicleClass");
          if ("featureCodes" in patch || "featureOther" in patch) fields.push("features");
          setCleared((current) => {
            const next = { ...current };
            for (const field of fields) {
              next[field] = true;
            }
            return next;
          });
        }}
      />
      <UetdsCompanySelect
        value={uetdsCompanyId}
        activeCompanies={activeUetdsCompanies}
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
      {state.error && !partnerVehicleErrorField(state.error) ? (
        <p className="ops-form-error" role="alert">
          {copy[ERROR_COPY[state.error]]}
        </p>
      ) : null}
      <div className="partner-profile-actions">
        <button type="submit" className="ops-btn-primary" disabled={pending}>
          {pending ? copy.savingProfile : copy.vehicleSave}
        </button>
        <a className="ops-btn-secondary" href={localizedPath(locale, "/partner/vehicles")}>
          {copy.cancelEdit}
        </a>
      </div>
    </form>
  );
}
