import {
  UETDS_NOTIFY_NONE_VALUE,
  type UetdsCompanyRef,
} from "@/lib/ops/uetds-company-fields";

export function buildUetdsCompanySelectOptions(
  active: readonly UetdsCompanyRef[],
  current: UetdsCompanyRef | null,
  noneLabel: string,
) {
  const options = [
    { value: UETDS_NOTIFY_NONE_VALUE, label: noneLabel },
    ...active.map((company) => ({ value: company.id, label: company.shortName })),
  ];
  if (current && !active.some((company) => company.id === current.id)) {
    options.push({ value: current.id, label: current.shortName });
  }
  return options;
}
