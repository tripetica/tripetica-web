"use client";

import { useActionState, useState } from "react";
import { CountryPicker } from "@/components/booking/country-picker";
import {
  accountCompanyDeleteAction,
  accountCompanySaveAction,
  type AccountFormState,
} from "@/lib/account/actions";
import { accountCopy, accountErrorMessage } from "@/lib/account/copy";
import { type CustomerCompany } from "@/lib/account/companies";
import { type Locale } from "@/lib/i18n/config";

type Props = {
  locale: Locale;
  company?: CustomerCompany | null;
};

export function AccountCompanyForm({ locale, company }: Props) {
  const copy = accountCopy[locale];
  const [countryCode, setCountryCode] = useState(company?.countryCode ?? "TR");
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    accountCompanySaveAction,
    {},
  );
  const error = accountErrorMessage(copy, state.error);
  const isTr = countryCode === "TR";

  return (
    <form action={action} className="account-form account-form-wide">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="companyId" value={company?.id ?? ""} />
      <input type="hidden" name="countryCode" value={countryCode} />
      <label className="account-field">
        <span>{copy.companyName}</span>
        <input name="companyName" defaultValue={company?.companyName ?? ""} required />
      </label>
      <div className="account-field">
        <span>{copy.country}</span>
        <CountryPicker
          locale={locale}
          variant="nationality"
          value={countryCode}
          ariaLabel={copy.country}
          layout="anchored"
          onChange={setCountryCode}
        />
      </div>
      <label className="account-field">
        <span>{copy.address}</span>
        <input name="addressLine" defaultValue={company?.addressLine ?? ""} required />
      </label>
      <div className="account-form-grid">
        <label className="account-field">
          <span>{copy.city}</span>
          <input name="city" defaultValue={company?.city ?? ""} required />
        </label>
        <label className="account-field">
          <span>{copy.postalCode}</span>
          <input name="postalCode" defaultValue={company?.postalCode ?? ""} />
        </label>
      </div>
      <label className="account-field">
        <span>{copy.taxId}</span>
        <input name="taxId" defaultValue={company?.taxId ?? ""} required={isTr} />
      </label>
      {isTr ? (
        <label className="account-field">
          <span>{copy.taxOffice}</span>
          <input name="taxOffice" defaultValue={company?.taxOffice ?? ""} required />
        </label>
      ) : (
        <input type="hidden" name="taxOffice" value="" />
      )}
      <label className="account-field">
        <span>{copy.invoiceEmail}</span>
        <input
          type="email"
          name="invoiceEmail"
          defaultValue={company?.invoiceEmail ?? ""}
          required
        />
      </label>
      <label className="account-field">
        <span>{copy.companyPhone}</span>
        <input name="companyPhone" defaultValue={company?.phone ?? ""} />
      </label>
      <label className="account-check">
        <input
          type="checkbox"
          name="isDefault"
          value="1"
          defaultChecked={company?.isDefault ?? false}
        />
        <span>{copy.isDefault}</span>
      </label>
      {error ? <p className="account-form-error">{error}</p> : null}
      <button type="submit" className="account-btn-primary" disabled={pending}>
        {copy.submitSave}
      </button>
    </form>
  );
}

export function AccountCompanyDeleteButton({
  locale,
  companyId,
}: {
  locale: Locale;
  companyId: string;
}) {
  const copy = accountCopy[locale];
  return (
    <form action={accountCompanyDeleteAction}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="companyId" value={companyId} />
      <button type="submit" className="account-btn-ghost">
        {copy.deleteCompany}
      </button>
    </form>
  );
}
