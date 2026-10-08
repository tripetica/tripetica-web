export function GpsCompanyLock({
  label,
  value,
  missing,
}: {
  label: string;
  value: string | null;
  missing: string;
}) {
  return (
    <p className={`gps-company-lock${value ? "" : " is-missing"}`}>
      <span>{label}</span>
      <strong>{value || missing}</strong>
    </p>
  );
}
