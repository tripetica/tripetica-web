"use client";

import { type AtsMinistrySource } from "@/lib/gps/ats-source";

export type AtsSourceLabels = {
  title: string;
  description: string;
  physical: string;
  mobile: string;
  none: string;
  statusPhysical: string;
  statusMobile: string;
  statusNone: string;
  physicalBlocked: string;
  mobileBlocked: string;
};

export function AtsMinistrySourceField({
  source,
  gpsAtsEnabled,
  mobileEnabled,
  disabled,
  readOnly,
  labels,
  onChange,
}: {
  source: AtsMinistrySource;
  gpsAtsEnabled: boolean;
  mobileEnabled: boolean;
  disabled?: boolean;
  readOnly?: boolean;
  labels: AtsSourceLabels;
  onChange: (source: AtsMinistrySource) => void;
}) {
  const status = source === "physical"
    ? labels.statusPhysical
    : source === "mobile"
      ? labels.statusMobile
      : labels.statusNone;
  return (
    <section className="uetds-driver-subscription ats-ministry-source" aria-label={labels.title}>
      <h2 className="uetds-driver-subscription-title">{labels.title}</h2>
      <p className="partner-billing-label">{labels.description}</p>
      <p className="ats-ministry-source-status">{status}</p>
      {readOnly ? null : (
        <div className="ats-ministry-source-options" role="radiogroup" aria-label={labels.title}>
          <SourceOption
            value="physical"
            checked={source === "physical"}
            blocked={!gpsAtsEnabled}
            blockedText={labels.physicalBlocked}
            label={labels.physical}
            disabled={disabled}
            onChange={onChange}
          />
          <SourceOption
            value="mobile"
            checked={source === "mobile"}
            blocked={!mobileEnabled}
            blockedText={labels.mobileBlocked}
            label={labels.mobile}
            disabled={disabled}
            onChange={onChange}
          />
          <SourceOption
            value="none"
            checked={source === "none"}
            blocked={false}
            blockedText=""
            label={labels.none}
            disabled={disabled}
            onChange={onChange}
          />
        </div>
      )}
    </section>
  );
}

function SourceOption({
  value,
  checked,
  blocked,
  blockedText,
  label,
  disabled,
  onChange,
}: {
  value: AtsMinistrySource;
  checked: boolean;
  blocked: boolean;
  blockedText: string;
  label: string;
  disabled?: boolean;
  onChange: (source: AtsMinistrySource) => void;
}) {
  return (
    <div className="ats-ministry-source-option">
      <label className="uetds-driver-subscription-check">
        <input
          type="radio"
          name="atsMinistrySourceChoice"
          value={value}
          checked={checked}
          disabled={disabled || blocked}
          onChange={() => onChange(value)}
        />
        <span>{label}</span>
      </label>
      {blocked ? <p className="ats-ministry-source-warning">{blockedText}</p> : null}
    </div>
  );
}
