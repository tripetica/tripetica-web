"use client";

import { useActionState, useState } from "react";
import { CountryPicker } from "@/components/booking/country-picker";
import { PhoneField } from "@/components/booking/phone-field";
import {
  accountForgotPasswordAction,
  accountLoginAction,
  accountRegisterAction,
  accountResetPasswordAction,
  type AccountFormState,
} from "@/lib/account/actions";
import { ACCOUNT_MIN_PASSWORD_LENGTH } from "@/lib/account/constants";
import { accountCopy, accountErrorMessage } from "@/lib/account/copy";
import { defaultCountryIso2ForLocale } from "@/lib/geo/locale-defaults";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

export function AccountLoginForm({
  locale,
  nextPath,
}: {
  locale: Locale;
  nextPath?: string | null;
}) {
  const copy = accountCopy[locale];
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    accountLoginAction,
    {},
  );
  const error = accountErrorMessage(copy, state.error);

  return (
    <form action={action} className="account-form">
      <input type="hidden" name="locale" value={locale} />
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <label className="account-field">
        <span>{copy.email}</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <label className="account-field">
        <span>{copy.password}</span>
        <input type="password" name="password" autoComplete="current-password" required />
      </label>
      {error ? <p className="account-form-error">{error}</p> : null}
      <button type="submit" className="account-btn-primary" disabled={pending}>
        {copy.submitLogin}
      </button>
      <p className="account-form-links">
        <a href={localizedPath(locale, "/account/forgot-password")}>{copy.forgotLink}</a>
        <a href={localizedPath(locale, "/account/register")}>
          {copy.needAccount} {copy.registerLink}
        </a>
      </p>
    </form>
  );
}

export function AccountRegisterForm({ locale }: { locale: Locale }) {
  const copy = accountCopy[locale];
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    accountRegisterAction,
    {},
  );
  const [phoneCountry, setPhoneCountry] = useState<string | null>(() =>
    defaultCountryIso2ForLocale(locale),
  );
  const [phoneNational, setPhoneNational] = useState("");
  const [countryCode, setCountryCode] = useState(() =>
    defaultCountryIso2ForLocale(locale),
  );
  const error = accountErrorMessage(copy, state.error);

  return (
    <form action={action} className="account-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="phoneCountry" value={phoneCountry ?? ""} />
      <input type="hidden" name="phoneNational" value={phoneNational} />
      <input type="hidden" name="countryCode" value={countryCode} />
      <label className="account-field">
        <span>{copy.firstName}</span>
        <input name="firstName" autoComplete="given-name" required />
      </label>
      <label className="account-field">
        <span>{copy.lastName}</span>
        <input name="lastName" autoComplete="family-name" required />
      </label>
      <label className="account-field">
        <span>{copy.email}</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      <PhoneField
        locale={locale}
        countryCode={phoneCountry}
        nationalNumber={phoneNational}
        pickerLayout="anchored"
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
      <label className="account-field">
        <span>{copy.password}</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={ACCOUNT_MIN_PASSWORD_LENGTH}
          required
        />
      </label>
      <label className="account-field">
        <span>{copy.passwordConfirm}</span>
        <input
          type="password"
          name="passwordConfirm"
          autoComplete="new-password"
          minLength={ACCOUNT_MIN_PASSWORD_LENGTH}
          required
        />
      </label>
      {error ? <p className="account-form-error">{error}</p> : null}
      <button type="submit" className="account-btn-primary" disabled={pending}>
        {copy.submitRegister}
      </button>
      <p className="account-form-links">
        <a href={localizedPath(locale, "/account/login")}>
          {copy.haveAccount} {copy.loginLink}
        </a>
      </p>
    </form>
  );
}

export function AccountForgotPasswordForm({ locale }: { locale: Locale }) {
  const copy = accountCopy[locale];
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    accountForgotPasswordAction,
    {},
  );
  return (
    <form action={action} className="account-form">
      <input type="hidden" name="locale" value={locale} />
      <label className="account-field">
        <span>{copy.email}</span>
        <input type="email" name="email" autoComplete="email" required />
      </label>
      {state.info === "reset_sent" ? (
        <p className="account-form-info">{copy.resetSent}</p>
      ) : null}
      <button type="submit" className="account-btn-primary" disabled={pending}>
        {copy.submitForgot}
      </button>
      <p className="account-form-links">
        <a href={localizedPath(locale, "/account/login")}>{copy.backToLogin}</a>
      </p>
    </form>
  );
}

export function AccountResetPasswordForm({
  locale,
  token,
}: {
  locale: Locale;
  token: string;
}) {
  const copy = accountCopy[locale];
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    accountResetPasswordAction,
    {},
  );
  const error = accountErrorMessage(copy, state.error);
  return (
    <form action={action} className="account-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      <label className="account-field">
        <span>{copy.password}</span>
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={ACCOUNT_MIN_PASSWORD_LENGTH}
          required
        />
      </label>
      <label className="account-field">
        <span>{copy.passwordConfirm}</span>
        <input
          type="password"
          name="passwordConfirm"
          autoComplete="new-password"
          minLength={ACCOUNT_MIN_PASSWORD_LENGTH}
          required
        />
      </label>
      {error ? <p className="account-form-error">{error}</p> : null}
      <button type="submit" className="account-btn-primary" disabled={pending}>
        {copy.submitReset}
      </button>
    </form>
  );
}
