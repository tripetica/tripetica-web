"use client";

import { useActionState, useMemo, useState } from "react";
import {
  saveOpsVehiclePartnerAccessAction,
  type VehicleAccessFormState,
} from "@/lib/ops/vehicle-access-actions";
import {
  type VehiclePartnerAccess,
  type VehiclePartnerOption,
} from "@/lib/partner/vehicle-access";
import { type Locale } from "@/lib/i18n/config";

type Props = {
  locale: Locale;
  vehicleId: string;
  options: readonly VehiclePartnerOption[];
  initialAccess: readonly VehiclePartnerAccess[];
  canManage: boolean;
  labels: {
    title: string;
    search: string;
    empty: string;
    save: string;
    saving: string;
    saved: string;
    failed: string;
    requiresPartner: string;
  };
};

const INITIAL_STATE: VehicleAccessFormState = { ok: false, error: null };

export function VehiclePartnerAccessField({
  locale,
  vehicleId,
  options,
  initialAccess,
  canManage,
  labels,
}: Props) {
  const initialIds = initialAccess.map((access) => access.id);
  const [selectedIds, setSelectedIds] = useState(initialIds);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveOpsVehiclePartnerAccessAction, INITIAL_STATE);
  const selected = useMemo(
    () => selectedIds.flatMap((id) => {
      const option = options.find((candidate) => candidate.id === id);
      return option ? [option] : [];
    }),
    [options, selectedIds],
  );
  const available = useMemo(() => {
    const search = query.trim().toLocaleLowerCase(locale === "tr" ? "tr" : undefined);
    return options.filter((option) => {
      if (selectedIds.includes(option.id)) return false;
      return `${option.name} ${option.code}`.toLocaleLowerCase(locale === "tr" ? "tr" : undefined).includes(search);
    });
  }, [locale, options, query, selectedIds]);
  const dirty = [...selectedIds].sort().join(",") !== [...initialIds].sort().join(",");

  return (
    <form action={action} className="ops-user-form ops-partner-entity-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="vehicleId" value={vehicleId} />
      <input type="hidden" name="partnerIds" value={selectedIds.join(",")} />
      <label className="partner-field">
        <span>{labels.title}</span>
        <div className="partner-language-select">
          {selected.length > 0 ? (
            <div className="partner-language-chips" aria-label={labels.title}>
              {selected.map((partner) => (
                <button
                  key={partner.id}
                  type="button"
                  className="partner-language-chip"
                  disabled={!canManage}
                  onClick={() => setSelectedIds((ids) => ids.filter((id) => id !== partner.id))}
                >
                  {partner.name} · {partner.code}
                  <span aria-hidden="true">×</span>
                </button>
              ))}
            </div>
          ) : null}
          <input
            className="partner-language-search"
            value={query}
            placeholder={labels.search}
            autoComplete="off"
            disabled={!canManage}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          />
          {open && canManage ? (
            <ul className="partner-language-menu" role="listbox">
              {available.length === 0 ? (
                <li className="partner-language-empty">{labels.empty}</li>
              ) : (
                available.map((partner) => (
                  <li key={partner.id}>
                    <button
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        setSelectedIds((ids) => [...ids, partner.id]);
                        setQuery("");
                      }}
                    >
                      {partner.name} · {partner.code}
                    </button>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </div>
      </label>
      {state.ok && !dirty ? <p className="ops-form-ok">{labels.saved}</p> : null}
      {state.error ? (
        <p className="ops-form-error" role="alert">
          {state.error === "requires-partner" ? labels.requiresPartner : labels.failed}
        </p>
      ) : null}
      {canManage ? (
        <button className="ops-btn-primary" type="submit" disabled={!dirty || pending}>
          {pending ? labels.saving : labels.save}
        </button>
      ) : null}
    </form>
  );
}
