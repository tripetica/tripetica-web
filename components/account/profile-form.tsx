"use client";

import { useActionState, useState } from "react";
import { CountryPicker } from "@/components/booking/country-picker";
import { PhoneField } from "@/components/booking/phone-field";
import {
  accountProfileAction,
  type AccountFormState,
} from "@/lib/account/actions";
import { accountCopy, accountErrorMessage } from "@/lib/account/copy";
import { fromStoredPhone } from "@/lib/booking/phone";
import { defaultCountryIso2ForLocale } from "@/lib/geo/locale-defaults";
import { type Locale } from "@/lib/i18n/config";

type Props = {
  locale: Locale;
  firstName: string;
  lastName: string;
  email: string;
  pendingEmail: string | null;
  phone: string | null;
  phoneCountryCode: string | null;
  nationalityCode: string | null;
};

export function AccountProfileForm({
  locale,
  firstName,
  lastName,
  email,
  pendingEmail,
  phone,
  phoneCountryCode,
  nationalityCode,
}: Props) {
  const copy = accountCopy[locale];
  const initial = fromStoredPhone(phoneCountryCode, phone);
  const [phoneCountry, setPhoneCountry] = useState<string | null>(initial.iso2);
  const [phoneNational, setPhoneNational] = useState(initial.national);
  const [countryCode, setCountryCode] = useState(
    nationalityCode ?? defaultCountryIso2ForLocale(locale),
  );
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    accountProfileAction,
    {},
  );
  const error = accountErrorMessage(copy, state.error);
  const info =
    state.info === "saved"
      ? copy.saved
      : state.info === "email_pending"
        ? copy.emailPending
        : null;

  return (
    <form action={action} className="account-form account-form-wide">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="phoneCountry" value={phoneCountry ?? ""} />
      <input type="hidden" name="phoneNational" value={phoneNational} />
      <input type="hidden" name="countryCode" value={countryCode} />
      <div className="account-form-grid">
        <label className="account-field">
          <span>{copy.firstName}</span>
          <input name="firstName" defaultValue={firstName} required />
        </label>
        <label className="account-field">
          <span>{copy.lastName}</span>
          <input name="lastName" defaultValue={lastName} required />
        </label>
      </div>
      <label className="account-field">
        <span>{copy.email}</span>
        <input type="email" name="email" defaultValue={email} required />
      </label>
      {pendingEmail ? (
        <p className="account-form-info">
          {copy.pendingEmailLabel}: {pendingEmail}
        </p>
      ) : null}
      <PhoneField
        locale={locale}
        countryCode={phoneCountry}
        nationalNumber={phoneNational}
        onCountryChange={setPhoneCountry}
        onNationalChange={setPhoneNational}
      />
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
      {error ? <p className="account-form-error">{error}</p> : null}
      {info ? <p className="account-form-info">{info}</p> : null}
      <button type="submit" className="account-btn-primary" disabled={pending}>
        {copy.submitSave}
      </button>
    </form>
  );
}
