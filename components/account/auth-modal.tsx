"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { CountryPicker } from "@/components/booking/country-picker";
import { PhoneField } from "@/components/booking/phone-field";
import {
  accountLoginAction,
  accountRegisterAction,
  type AccountFormState,
} from "@/lib/account/actions";
import { accountCopy, accountErrorMessage } from "@/lib/account/copy";
import { defaultCountryIso2ForLocale } from "@/lib/geo/locale-defaults";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

type AuthModalMode = "login" | "register" | "registered" | "unverified";

type AccountAuthModalProps = {
  locale: Locale;
  pathWithoutLocale: string;
  open: boolean;
  onClose: () => void;
  initialMode?: "login" | "register";
};

export function AccountAuthModal({
  locale,
  pathWithoutLocale,
  open,
  onClose,
  initialMode = "login",
}: AccountAuthModalProps) {
  const copy = accountCopy[locale];
  const titleId = useId();
  const [mode, setMode] = useState<AuthModalMode>(initialMode);
  const [modeSource, setModeSource] = useState({ open, initialMode });
  const panelRef = useRef<HTMLDivElement>(null);

  if (modeSource.open !== open || modeSource.initialMode !== initialMode) {
    setModeSource({ open, initialMode });
    if (open) {
      setMode(initialMode);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") {
    return null;
  }

  const title =
    mode === "register" || mode === "registered"
      ? copy.registerTitle
      : copy.loginTitle;

  return createPortal(
    <div className="account-auth-modal-root" role="presentation">
      <button
        type="button"
        className="account-auth-modal-backdrop"
        aria-label={copy.closeModal}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        className="account-auth-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="account-auth-modal-head">
          <h2 id={titleId}>{title}</h2>
          <button
            type="button"
            className="account-auth-modal-close"
            aria-label={copy.closeModal}
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5">
              <path
                d="M6 6l12 12M18 6l-12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div className="account-auth-modal-body">
          {mode === "login" ? (
            <ModalLoginForm
              locale={locale}
              pathWithoutLocale={pathWithoutLocale}
              onRegisteredSwitch={() => setMode("register")}
              onLoggedIn={onClose}
              onUnverified={() => setMode("unverified")}
            />
          ) : null}
          {mode === "register" ? (
            <ModalRegisterForm
              locale={locale}
              onLoginSwitch={() => setMode("login")}
              onRegistered={() => setMode("registered")}
            />
          ) : null}
          {mode === "registered" ? (
            <div className="account-auth-success">
              <p className="account-auth-success-title">{copy.registerSuccessTitle}</p>
              <p className="account-auth-success-body">{copy.registerSuccessBody}</p>
              <button type="button" className="account-btn-primary" onClick={onClose}>
                {copy.closeModal}
              </button>
            </div>
          ) : null}
          {mode === "unverified" ? (
            <div className="account-auth-success">
              <p className="account-auth-success-body">{copy.verifyPending}</p>
              <a className="account-btn-primary" href={localizedPath(locale, "/account/verify")}>
                {copy.verifyTitle}
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function ModalLoginForm({
  locale,
  pathWithoutLocale,
  onRegisteredSwitch,
  onLoggedIn,
  onUnverified,
}: {
  locale: Locale;
  pathWithoutLocale: string;
  onRegisteredSwitch: () => void;
  onLoggedIn: () => void;
  onUnverified: () => void;
}) {
  const copy = accountCopy[locale];
  const router = useRouter();
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    accountLoginAction,
    {},
  );
  const error = accountErrorMessage(copy, state.error);

  useEffect(() => {
    if (state.ok && state.info === "logged_in") {
      onLoggedIn();
      router.refresh();
    }
    if (state.ok && state.info === "unverified") {
      onUnverified();
      router.refresh();
    }
  }, [state, onLoggedIn, onUnverified, router]);

  return (
    <form action={action} className="account-form account-form-modal">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="modal" value="1" />
      <input type="hidden" name="next" value={pathWithoutLocale || "/"} />
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
        <button type="button" className="account-text-link" onClick={onRegisteredSwitch}>
          {copy.needAccount} {copy.registerLink}
        </button>
      </p>
    </form>
  );
}

function ModalRegisterForm({
  locale,
  onLoginSwitch,
  onRegistered,
}: {
  locale: Locale;
  onLoginSwitch: () => void;
  onRegistered: () => void;
}) {
  const copy = accountCopy[locale];
  const router = useRouter();
  const [phoneCountry, setPhoneCountry] = useState<string | null>(() =>
    defaultCountryIso2ForLocale(locale),
  );
  const [phoneNational, setPhoneNational] = useState("");
  const [countryCode, setCountryCode] = useState(() =>
    defaultCountryIso2ForLocale(locale),
  );
  const [state, action, pending] = useActionState<AccountFormState, FormData>(
    accountRegisterAction,
    {},
  );
  const error = accountErrorMessage(copy, state.error);

  useEffect(() => {
    if (state.ok && state.info === "registered") {
      onRegistered();
      router.refresh();
    }
  }, [state, onRegistered, router]);

  return (
    <form action={action} className="account-form account-form-modal">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="modal" value="1" />
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
          minLength={8}
          required
        />
      </label>
      <label className="account-field">
        <span>{copy.passwordConfirm}</span>
        <input
          type="password"
          name="passwordConfirm"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      {error ? <p className="account-form-error">{error}</p> : null}
      <button type="submit" className="account-btn-primary" disabled={pending}>
        {copy.submitRegister}
      </button>
      <p className="account-form-links">
        <button type="button" className="account-text-link" onClick={onLoginSwitch}>
          {copy.haveAccount} {copy.loginLink}
        </button>
      </p>
    </form>
  );
}
