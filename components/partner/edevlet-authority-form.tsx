"use client";

import { useActionState, useState } from "react";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type UetdsCompanyRef } from "@/lib/ops/uetds-company-fields";
import {
  createPartnerEdevletAuthorityAction,
  updatePartnerEdevletAuthorityAction,
} from "@/lib/uetds/partner-authority-actions";
import {
  type PartnerEdevletAuthorityState,
  type PartnerEdevletAuthoritySummary,
} from "@/lib/uetds/partner-authority-fields";

type EdevletAuthorityFormProps = {
  locale: Locale;
  copy: PartnerCopy;
  companies: readonly UetdsCompanyRef[];
  mode: "create" | "edit";
  authority?: PartnerEdevletAuthoritySummary;
  updateAction?: typeof updatePartnerEdevletAuthorityAction;
  onSaved?: (authority: PartnerEdevletAuthoritySummary) => void;
  onCancel?: () => void;
};

const INITIAL: PartnerEdevletAuthorityState = { ok: false, error: null };

export function EdevletAuthorityForm({
  locale,
  copy,
  companies,
  mode,
  authority,
  updateAction,
  onSaved,
  onCancel,
}: EdevletAuthorityFormProps) {
  const [firstName, setFirstName] = useState(authority?.firstName ?? "");
  const [lastName, setLastName] = useState(authority?.lastName ?? "");
  const [identity, setIdentity] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState(authority?.status ?? "active");
  const [companyIds, setCompanyIds] = useState<string[]>(
    authority?.companies.map((company) => company.id) ?? [],
  );
  const action = mode === "create"
    ? createPartnerEdevletAuthorityAction
    : (updateAction ?? updatePartnerEdevletAuthorityAction);
  const [state, formAction, pending] = useActionState<PartnerEdevletAuthorityState, FormData>(
    async (previous, form) => {
      const result = await action(previous, form);
      setPassword("");
      setIdentity("");
      if (result.ok && result.authority) {
        setFirstName(result.authority.firstName);
        setLastName(result.authority.lastName);
        setCompanyIds(result.authority.companies.map((company) => company.id));
        onSaved?.(result.authority);
      }
      return result;
    },
    INITIAL,
  );

  function toggleCompany(id: string) {
    setCompanyIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  const errorText =
    state.error === "invalid"
      ? copy.edevletAuthorityInvalid
      : state.error
        ? copy.edevletAuthoritySaveFailed
        : null;

  return (
    <form action={formAction} className="partner-profile-form" autoComplete="off">
      <input type="hidden" name="locale" value={locale} />
      {authority ? <input type="hidden" name="id" value={authority.id} /> : null}
      <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0 }}>
        <label className="ops-field">
          <span>{copy.edevletAuthorityFirstName}</span>
          <input
            name="firstName"
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            maxLength={80}
            required
          />
        </label>
        <label className="ops-field">
          <span>{copy.edevletAuthorityLastName}</span>
          <input
            name="lastName"
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            maxLength={80}
            required
          />
        </label>
        <label className="ops-field">
          <span>{copy.driverNationalId}</span>
          <input
            name="identity"
            value={identity}
            onChange={(event) => setIdentity(event.target.value)}
            inputMode="numeric"
            pattern="[1-9][0-9]{10}"
            maxLength={11}
            required={mode === "create"}
            placeholder={authority?.maskedIdentity}
            autoComplete="off"
          />
        </label>
        {mode === "edit" ? <p className="uetds-field-hint">{copy.edevletAuthorityIdentityKeep}</p> : null}
        <label className="ops-field">
          <span>{copy.edevletAuthorityPassword}</span>
          <input
            name="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            maxLength={1024}
            required={mode === "create"}
            autoComplete="new-password"
          />
        </label>
        {mode === "edit" ? <p className="uetds-field-hint">{copy.edevletAuthorityPasswordKeep}</p> : null}
        {mode === "create" ? (
          <label className="ops-field">
            <span>{copy.driverStatus}</span>
            <select name="status" value={status} onChange={(event) => setStatus(event.target.value as "active" | "inactive")}>
              <option value="active">{copy.driverActive}</option>
              <option value="inactive">{copy.driverInactive}</option>
            </select>
          </label>
        ) : null}
        <fieldset className="ops-field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend>{copy.edevletAuthorityCompanies}</legend>
          {companies.length === 0 && (authority?.companies.length ?? 0) === 0 ? (
            <p className="uetds-field-hint">{copy.uetdsCompanyEmpty}</p>
          ) : (
            <div className="edevlet-company-options">
              {companies.map((company) => (
                <label key={company.id} className="ops-check">
                  <input
                    type="checkbox"
                    name="companyId"
                    value={company.id}
                    checked={companyIds.includes(company.id)}
                    onChange={() => toggleCompany(company.id)}
                  />
                  <span>{company.shortName}</span>
                </label>
              ))}
              {authority?.companies
                .filter((company) => !companies.some((active) => active.id === company.id))
                .map((company) => (
                  <label key={company.id} className="ops-check">
                    <input type="hidden" name="companyId" value={company.id} />
                    <input type="checkbox" checked disabled />
                    <span>{company.shortName}</span>
                  </label>
                ))}
            </div>
          )}
        </fieldset>
        {errorText ? (
          <p className="ops-form-error" role="alert">
            {errorText}
          </p>
        ) : null}
        <div className="partner-profile-actions">
          <button className="ops-btn-primary" type="submit" disabled={pending}>
            {pending ? copy.savingProfile : copy.driverSave}
          </button>
          {mode === "edit" && onCancel ? (
            <button
              className="ops-btn-secondary"
              type="button"
              onClick={() => {
                setFirstName(authority?.firstName ?? "");
                setLastName(authority?.lastName ?? "");
                setIdentity("");
                setPassword("");
                setCompanyIds(authority?.companies.map((company) => company.id) ?? []);
                onCancel();
              }}
            >
              {copy.cancelEdit}
            </button>
          ) : (
            <a className="ops-btn-secondary" href={localizedPath(locale, "/partner/edevlet-authorities")}>
              {copy.closeDriver}
            </a>
          )}
        </div>
      </fieldset>
    </form>
  );
}
