"use client";

import { SearchableSelect } from "@/components/partner/searchable-select";
import {
  buildUetdsCompanySelectOptions,
} from "@/lib/ops/uetds-company-options-view";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";

type UetdsCompanySelectProps = {
  name?: string;
  value: string;
  activeCompanies: readonly UetdsCompanyRef[];
  currentCompany?: UetdsCompanyRef | null;
  fieldLabel: string;
  noneLabel: string;
  searchPlaceholder: string;
  emptyLabel: string;
  disabled?: boolean;
  hideLabel?: boolean;
  onChange: (value: string) => void;
};

export function UetdsCompanySelect({
  name = "uetdsCompanyId",
  value,
  activeCompanies,
  currentCompany = null,
  fieldLabel,
  noneLabel,
  searchPlaceholder,
  emptyLabel,
  disabled = false,
  hideLabel = false,
  onChange,
}: UetdsCompanySelectProps) {
  const options = buildUetdsCompanySelectOptions(activeCompanies, currentCompany, noneLabel);
  return (
    <div className="ops-field">
      {hideLabel ? null : <span>{fieldLabel}</span>}
      <SearchableSelect
        name={name}
        value={value}
        options={options}
        placeholder={searchPlaceholder}
        emptyLabel={emptyLabel}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  );
}
