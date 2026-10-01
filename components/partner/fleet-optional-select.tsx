import { type FleetChoice } from "@/lib/partner/fleet-pairing-rules";

type FleetOptionalSelectProps = {
  name: string;
  label?: string;
  value: string;
  emptyLabel: string;
  options: readonly FleetChoice[];
  onChange: (value: string) => void;
};

export function FleetOptionalSelect({
  name,
  label,
  value,
  emptyLabel,
  options,
  onChange,
}: FleetOptionalSelectProps) {
  const select = (
    <select name={name} value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
  if (!label) {
    return <div className="ops-field">{select}</div>;
  }
  return (
    <label className="ops-field">
      <span>{label}</span>
      {select}
    </label>
  );
}
