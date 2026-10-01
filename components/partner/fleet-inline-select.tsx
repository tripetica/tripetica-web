"use client";

import { useState, useTransition } from "react";
import { type FleetChoice } from "@/lib/partner/fleet-pairing-rules";

type FleetInlineSelectProps = {
  value: string;
  options: readonly FleetChoice[];
  emptyLabel: string;
  label: string;
  saveFailedLabel: string;
  onSave: (next: string) => Promise<boolean>;
};

export function FleetInlineSelect({
  value,
  options,
  emptyLabel,
  label,
  saveFailedLabel,
  onSave,
}: FleetInlineSelectProps) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [seen, setSeen] = useState(value);
  if (seen !== value) {
    setSeen(value);
    setDraft(value);
    setError(null);
  }
  const known = options.some((option) => option.id === draft);

  return (
    <>
      <select
        className="fleet-inline-select"
        aria-label={label}
        value={known || draft === "" ? draft : ""}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value;
          if (next === value) {
            return;
          }
          setDraft(next);
          startTransition(async () => {
            const ok = await onSave(next);
            if (!ok) {
              setDraft(value);
              setError(saveFailedLabel);
              return;
            }
            setError(null);
          });
        }}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <span className="ops-driver-sub-error" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
