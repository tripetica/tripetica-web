"use client";

import { SearchableSelect } from "@/components/partner/searchable-select";
import { type Locale } from "@/lib/i18n/config";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type OpsCopy } from "@/lib/ops/copy";
import { PARTNER_VEHICLE_CATALOG, partnerVehicleBrandByCode } from "@/lib/partner/vehicle-catalog";
import { partnerVehicleClassOptions } from "@/lib/partner/vehicle-class";
import {
  vehicleColorOptions,
  vehicleFeatureOptions,
  type VehicleChoiceCopy,
} from "@/lib/partner/vehicle-labels";
import {
  PARTNER_VEHICLE_LUGGAGE_MAX,
  PARTNER_VEHICLE_PASSENGER_MAX,
  partnerVehicleYearOptions,
  type PartnerVehicleField,
} from "@/lib/partner/vehicle-policy";

export type VehicleDraft = {
  plate: string;
  brandCode: string;
  modelCode: string;
  modelYear: string;
  colorCode: string;
  colorOther: string;
  passengerCapacity: string;
  luggageCapacity: string;
  vehicleClassCode: string;
  featureCodes: string[];
  featureOther: string;
};

type VehicleFieldsCopy = (PartnerCopy | OpsCopy) & VehicleChoiceCopy;

type VehicleFieldsProps = {
  locale: Locale;
  copy: VehicleFieldsCopy;
  values: VehicleDraft;
  errors?: Partial<Record<PartnerVehicleField, string>>;
  disabled?: boolean;
  onChange: (patch: Partial<VehicleDraft>) => void;
};

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }
  return (
    <span className="ops-field-error" role="alert">
      {message}
    </span>
  );
}

export function emptyVehicleDraft(): VehicleDraft {
  return {
    plate: "",
    brandCode: "",
    modelCode: "",
    modelYear: "",
    colorCode: "",
    colorOther: "",
    passengerCapacity: "",
    luggageCapacity: "",
    vehicleClassCode: "",
    featureCodes: [],
    featureOther: "",
  };
}

export function VehicleFields({
  locale,
  copy,
  values,
  errors = {},
  disabled = false,
  onChange,
}: VehicleFieldsProps) {
  const brand = partnerVehicleBrandByCode(values.brandCode);
  const yearOptions = partnerVehicleYearOptions().map((year) => ({
    value: String(year),
    label: String(year),
  }));
  const classOptions = partnerVehicleClassOptions(locale).map((item) => ({
    value: item.code,
    label: item.label,
  }));
  const colors = vehicleColorOptions(copy);
  const features = vehicleFeatureOptions(copy);

  function toggleFeature(code: string) {
    const selected = values.featureCodes.includes(code)
      ? values.featureCodes.filter((item) => item !== code)
      : [...values.featureCodes, code];
    onChange({
      featureCodes: selected,
      featureOther: selected.includes("other") ? values.featureOther : "",
    });
  }

  return (
    <>
      <label className="ops-field">
        <span>{copy.vehiclePlate}</span>
        <input
          name="plate"
          value={values.plate}
          className={errors.plate ? "is-invalid" : undefined}
          aria-invalid={errors.plate ? true : undefined}
          data-vehicle-field="plate"
          disabled={disabled}
          autoComplete="off"
          onChange={(event) => onChange({ plate: event.target.value })}
        />
        <FieldError message={errors.plate} />
      </label>
      <label className="ops-field">
        <span>{copy.vehicleBrand}</span>
        <SearchableSelect
          name="brandCode"
          value={values.brandCode}
          options={PARTNER_VEHICLE_CATALOG.map((item) => ({
            value: item.code,
            label: item.name,
          }))}
          placeholder={copy.searchBrand}
          emptyLabel={copy.noBrandResults}
          disabled={disabled}
          error={errors.brand}
          fieldId="vehicle-brand"
          onChange={(brandCode) => onChange({ brandCode, modelCode: "" })}
        />
        <FieldError message={errors.brand} />
      </label>
      <label className="ops-field">
        <span>{copy.vehicleModel}</span>
        <SearchableSelect
          name="modelCode"
          value={values.modelCode}
          options={(brand?.models ?? []).map((item) => ({
            value: item.code,
            label: item.name,
          }))}
          placeholder={copy.searchModel}
          emptyLabel={copy.noModelResults}
          disabled={disabled || !values.brandCode}
          error={errors.model}
          fieldId="vehicle-model"
          onChange={(modelCode) => onChange({ modelCode })}
        />
        <FieldError message={errors.model} />
      </label>
      <label className="ops-field">
        <span>{copy.vehicleModelYear}</span>
        <select
          name="modelYear"
          value={values.modelYear}
          className={errors.modelYear ? "is-invalid" : undefined}
          aria-invalid={errors.modelYear ? true : undefined}
          data-vehicle-field="modelYear"
          disabled={disabled}
          onChange={(event) => onChange({ modelYear: event.target.value })}
        >
          <option value="" />
          {yearOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError message={errors.modelYear} />
      </label>
      <label className="ops-field">
        <span>{copy.vehicleColor}</span>
        <select
          name="colorCode"
          value={values.colorCode}
          className={errors.color ? "is-invalid" : undefined}
          aria-invalid={errors.color ? true : undefined}
          data-vehicle-field="color"
          disabled={disabled}
          onChange={(event) =>
            onChange({
              colorCode: event.target.value,
              colorOther: event.target.value === "other" ? values.colorOther : "",
            })
          }
        >
          <option value="" />
          {colors.map((option) => (
            <option key={option.code} value={option.code}>
              {option.label}
            </option>
          ))}
        </select>
        <FieldError message={errors.color} />
      </label>
      {values.colorCode === "other" ? (
        <label className="ops-field">
          <span>{copy.colorOther}</span>
          <input
            name="colorOther"
            value={values.colorOther}
            className={errors.color ? "is-invalid" : undefined}
            disabled={disabled}
            onChange={(event) => onChange({ colorOther: event.target.value })}
          />
        </label>
      ) : (
        <input type="hidden" name="colorOther" value="" />
      )}
      <label className="ops-field">
        <span>{copy.vehiclePassengers}</span>
        <select
          name="passengerCapacity"
          value={values.passengerCapacity}
          className={errors.passengers ? "is-invalid" : undefined}
          aria-invalid={errors.passengers ? true : undefined}
          data-vehicle-field="passengers"
          disabled={disabled}
          onChange={(event) => onChange({ passengerCapacity: event.target.value })}
        >
          <option value="" />
          {Array.from({ length: PARTNER_VEHICLE_PASSENGER_MAX }, (_, index) => index + 1).map(
            (value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ),
          )}
        </select>
        <FieldError message={errors.passengers} />
      </label>
      <label className="ops-field">
        <span>{copy.vehicleLuggage}</span>
        <select
          name="luggageCapacity"
          value={values.luggageCapacity}
          className={errors.luggage ? "is-invalid" : undefined}
          aria-invalid={errors.luggage ? true : undefined}
          data-vehicle-field="luggage"
          disabled={disabled}
          onChange={(event) => onChange({ luggageCapacity: event.target.value })}
        >
          <option value="" />
          {Array.from({ length: PARTNER_VEHICLE_LUGGAGE_MAX + 1 }, (_, index) => index).map(
            (value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ),
          )}
        </select>
        <FieldError message={errors.luggage} />
      </label>
      <label className="ops-field">
        <span>{copy.vehicleClass}</span>
        <select
          name="vehicleClassCode"
          value={values.vehicleClassCode}
          className={errors.vehicleClass ? "is-invalid" : undefined}
          aria-invalid={errors.vehicleClass ? true : undefined}
          data-vehicle-field="vehicleClass"
          disabled={disabled}
          onChange={(event) => onChange({ vehicleClassCode: event.target.value })}
        >
          <option value="" />
          {classOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="partner-field-hint">{copy.vehicleClassHint}</p>
        <FieldError message={errors.vehicleClass} />
      </label>
      <div className="ops-field">
        <span>{copy.vehicleFeatures}</span>
        <input type="hidden" name="featureCodes" value={values.featureCodes.join(",")} />
        <div className="partner-language-chips" aria-label={copy.featureSelected}>
          {features.map((item) => {
            const selected = values.featureCodes.includes(item.code);
            return (
              <button
                key={item.code}
                type="button"
                className={selected ? "partner-language-chip is-selected" : "partner-language-chip"}
                disabled={disabled}
                onClick={() => toggleFeature(item.code)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <FieldError message={errors.features} />
      </div>
      {values.featureCodes.includes("other") ? (
        <label className="ops-field">
          <span>{copy.featureOther}</span>
          <input
            name="featureOther"
            value={values.featureOther}
            className={errors.features ? "is-invalid" : undefined}
            disabled={disabled}
            onChange={(event) => onChange({ featureOther: event.target.value })}
          />
        </label>
      ) : (
        <input type="hidden" name="featureOther" value="" />
      )}
    </>
  );
}
