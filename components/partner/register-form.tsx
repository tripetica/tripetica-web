"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { PhoneField } from "@/components/booking/phone-field";
import { PartnerBusinessTypeField } from "@/components/partner/business-type-field";
import { PartnerPasswordField } from "@/components/partner/password-field";
import {
  partnerInvalidateEmailChallengeAction,
  partnerRegisterAction,
  partnerSendRegisterCodeAction,
  partnerVerifyRegisterCodeAction,
  type PartnerEmailCodeState,
  type PartnerRegisterState,
} from "@/lib/partner/actions";
import {
  parsePartnerApplicationInput,
  partnerRegisterErrorField,
  partnerRegisterTaxIdMaxLength,
  normalizePartnerTaxIdDigits,
  type PartnerApplicationError,
  type PartnerRegisterField,
} from "@/lib/partner/application-fields";
import { partnerContactNamesFromForm } from "@/lib/partner/contact-name";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type PartnerBusinessType, PARTNER_DEFAULT_COUNTRY_CODE, PARTNER_MIN_PASSWORD_LENGTH } from "@/lib/partner/constants";
import { countryFlagEmoji, countryName } from "@/lib/geo/countries";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { partnerRegisterUiPhase } from "@/lib/partner/register-gate";

type PartnerRegisterFormProps = {
  locale: Locale;
  copy: PartnerCopy;
};

const ERROR_COPY: Record<
  Exclude<PartnerRegisterState["error"], null>,
  keyof PartnerCopy
> = {
  "invalid-email": "invalidEmail",
  "invalid-phone": "invalidPhone",
  "invalid-name": "invalidName",
  "invalid-contact": "invalidContact",
  "invalid-business-type": "invalidBusinessType",
  "invalid-address": "invalidAddress",
  "invalid-country": "invalidCountry",
  "invalid-tax-office": "invalidTaxOffice",
  "invalid-tax-number": "invalidTaxNumber",
  "invalid-national-id": "invalidRegisterNationalId",
  "password-short": "passwordTooShort",
  "password-mismatch": "passwordMismatch",
  duplicate: "duplicateApplication",
  "unverified-email": "unverifiedEmail",
  failed: "registerFailed",
};

const CODE_ERROR_COPY: Record<
  Exclude<PartnerEmailCodeState["error"], null>,
  keyof PartnerCopy
> = {
  "invalid-email": "invalidEmail",
  invalid: "verificationInvalid",
  expired: "verificationExpired",
  used: "verificationUsed",
  locked: "verificationLocked",
  "email-mismatch": "unverifiedEmail",
  throttled: "verificationThrottled",
  "mail-failed": "verificationMailFailed",
  duplicate: "emailTaken",
  "current-invalid": "currentPasswordInvalid",
  mismatch: "emailConfirmMismatch",
  "same-email": "emailUnchanged",
  failed: "verificationFailed",
};

type FieldErrors = Partial<Record<PartnerRegisterField, string>>;

function errorsForCode(
  error: Exclude<PartnerRegisterState["error"], null>,
  copy: PartnerCopy,
): FieldErrors {
  const message = copy[ERROR_COPY[error]];
  const field = partnerRegisterErrorField(error);
  if (!field) {
    return {};
  }
  if (error === "password-mismatch") {
    return { password: message, confirmPassword: message };
  }
  return { [field]: message };
}

export function PartnerRegisterForm({ locale, copy }: PartnerRegisterFormProps) {
  const [state, action, pending] = useActionState<PartnerRegisterState, FormData>(
    partnerRegisterAction,
    { error: null, ok: false },
  );
  const [sendState, sendCode, sending] = useActionState<PartnerEmailCodeState, FormData>(
    partnerSendRegisterCodeAction,
    { error: null, ok: false },
  );
  const [verifyState, verifyCode, verifying] = useActionState<PartnerEmailCodeState, FormData>(
    partnerVerifyRegisterCodeAction,
    { error: null, ok: false },
  );
  const [, startInvalidate] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const emailRef = useRef("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifiedEmail, setVerifiedEmail] = useState("");
  const [challengeEmail, setChallengeEmail] = useState("");
  const [businessType, setBusinessType] = useState<PartnerBusinessType | "">("");
  const [phoneCountry, setPhoneCountry] = useState(PARTNER_DEFAULT_COUNTRY_CODE);
  const [phoneNational, setPhoneNational] = useState("");
  const [contactName, setContactName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [taxOffice, setTaxOffice] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [clearedFields, setClearedFields] = useState<Partial<Record<PartnerRegisterField, true>>>(
    {},
  );
  const [ignoreServerError, setIgnoreServerError] = useState(false);
  const countryLabel = countryName(PARTNER_DEFAULT_COUNTRY_CODE, locale);
  const countryFlag = countryFlagEmoji(PARTNER_DEFAULT_COUNTRY_CODE);
  const taxIdMaxLength = partnerRegisterTaxIdMaxLength(businessType);
  const taxIdLabel =
    businessType === "individual" ? copy.registerNationalId : copy.registerTaxNumber;
  const phase = partnerRegisterUiPhase({
    currentEmail: email,
    verifiedEmail,
    challengeEmail,
    codeSent: Boolean(sendState.sent),
  });

  useEffect(() => {
    if (sendState.sent) {
      setChallengeEmail(emailRef.current.trim().toLowerCase());
    }
  }, [sendState]);

  useEffect(() => {
    if (verifyState.ok && verifyState.verified) {
      setVerifiedEmail(emailRef.current.trim().toLowerCase());
      setCode("");
    }
  }, [verifyState]);

  const fieldErrors: FieldErrors = {
    ...(!ignoreServerError && state.error ? errorsForCode(state.error, copy) : {}),
    ...clientErrors,
  };
  for (const field of Object.keys(clearedFields) as PartnerRegisterField[]) {
    delete fieldErrors[field];
  }

  useEffect(() => {
    if (!state.error || ignoreServerError) {
      return;
    }
    const field = partnerRegisterErrorField(state.error);
    queueMicrotask(() => focusRegisterField(field));
  }, [state, ignoreServerError]);

  function focusRegisterField(field: PartnerRegisterField | null) {
    if (!field || !formRef.current) {
      return;
    }
    const root = formRef.current.querySelector<HTMLElement>(`[data-register-field="${field}"]`);
    const target =
      root?.matches("input, textarea, button")
        ? root
        : root?.querySelector<HTMLElement>("input:not([type='hidden']), textarea, button");
    target?.focus();
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }

  function clearFieldError(field: PartnerRegisterField) {
    setClientErrors((current) => {
      if (!current[field]) {
        return current;
      }
      const next = { ...current };
      delete next[field];
      return next;
    });
    setClearedFields((current) =>
      current[field] ? current : { ...current, [field]: true },
    );
  }

  function handleEmailChange(next: string) {
    const previous = email;
    emailRef.current = next;
    setEmail(next);
    clearFieldError("email");
    if (next.trim().toLowerCase() === previous.trim().toLowerCase()) {
      return;
    }
    setCode("");
    if (verifiedEmail || challengeEmail || sendState.sent || verifyState.verified) {
      setVerifiedEmail("");
      startInvalidate(() => {
        void partnerInvalidateEmailChallengeAction();
      });
    }
  }

  function handleBusinessTypeChange(next: PartnerBusinessType) {
    setBusinessType(next);
    setTaxNumber((current) =>
      normalizePartnerTaxIdDigits(current).slice(0, partnerRegisterTaxIdMaxLength(next)),
    );
    clearFieldError("businessType");
    clearFieldError("taxNumber");
  }

  function parseCurrentApplication() {
    const contactData = new FormData();
    contactData.set("contactName", contactName);
    const contact = partnerContactNamesFromForm(contactData);
    return parsePartnerApplicationInput({
      email,
      phoneCountryCode: phoneCountry,
      phoneNational,
      contactFirstName: contact.contactFirstName,
      contactLastName: contact.contactLastName,
      businessType,
      name: legalName,
      addressLine,
      countryCode: PARTNER_DEFAULT_COUNTRY_CODE,
      taxOffice,
      taxNumber,
      password,
      confirmPassword,
      lockCountryToDefault: true,
      strictRegisterTaxId: true,
    });
  }

  function applyClientError(error: PartnerApplicationError) {
    setIgnoreServerError(true);
    setClearedFields({});
    setClientErrors(errorsForCode(error, copy));
    queueMicrotask(() => focusRegisterField(partnerRegisterErrorField(error)));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const isApplicationSubmit =
      phase.showForm &&
      submitter instanceof HTMLButtonElement &&
      submitter.dataset.registerSubmit === "application";
    if (!isApplicationSubmit) {
      return;
    }
    const parsed = parseCurrentApplication();
    if (!parsed.ok) {
      event.preventDefault();
      applyClientError(parsed.error);
      return;
    }
    setIgnoreServerError(false);
    setClearedFields({});
    setClientErrors({});
  }

  if (state.ok) {
    return (
      <div className="partner-register-success">
        <p className="ops-form-ok" role="status">
          {copy.registerSuccess}
        </p>
        <a className="ops-btn-secondary" href={localizedPath(locale, "/partner/login")}>
          {copy.backToLogin}
        </a>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      noValidate
      className="ops-login-form partner-register-form"
      onSubmit={handleSubmit}
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="countryCode" value={PARTNER_DEFAULT_COUNTRY_CODE} />
      <input type="hidden" name="phoneCountryCode" value={phoneCountry} />
      <input type="hidden" name="phoneNational" value={phoneNational} />
      <label className="ops-field">
        <span className="partner-register-email-head">
          <span>{copy.email}</span>
          {phase.emailVerified ? (
            <span className="partner-register-verified">{copy.emailVerifiedBadge}</span>
          ) : null}
        </span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          className={fieldErrors.email ? "is-invalid" : undefined}
          aria-invalid={fieldErrors.email ? true : undefined}
          data-register-field="email"
          onChange={(event) => handleEmailChange(event.target.value)}
        />
        {fieldErrors.email ? (
          <span className="ops-field-error" role="alert">
            {fieldErrors.email}
          </span>
        ) : null}
      </label>
      {phase.showSend ? (
        <div className="partner-profile-actions">
          <button
            type="submit"
            className="ops-btn-secondary"
            formAction={sendCode}
            formNoValidate
            disabled={sending || verifying || pending || !email}
          >
            {sending ? copy.sendingCode : copy.sendVerificationCode}
          </button>
        </div>
      ) : null}
      {phase.showCode && sendState.sent ? (
        <p className="ops-form-ok" role="status">
          {copy.verificationCodeSent}
        </p>
      ) : null}
      {phase.showCode ? (
        <>
          <label className="ops-field">
            <span>{copy.verificationCode}</span>
            <input
              className="partner-code-input"
              name="verificationCode"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              maxLength={6}
              pattern="\d{6}"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            />
          </label>
          <div className="partner-profile-actions">
            <button
              type="submit"
              className="ops-btn-secondary"
              formAction={verifyCode}
              formNoValidate
              disabled={sending || verifying || pending || code.length !== 6}
            >
              {verifying ? copy.verifyingCode : copy.verifyCode}
            </button>
          </div>
        </>
      ) : null}
      {sendState.error && !phase.emailVerified ? (
        <p className="ops-form-error" role="alert">
          {copy[CODE_ERROR_COPY[sendState.error]]}
        </p>
      ) : null}
      {verifyState.error && phase.showCode ? (
        <p className="ops-form-error" role="alert">
          {copy[CODE_ERROR_COPY[verifyState.error]]}
        </p>
      ) : null}
      {phase.showForm ? (
        <>
          <div data-register-field="phone">
            <PhoneField
              locale={locale}
              countryCode={phoneCountry}
              nationalNumber={phoneNational}
              pickerLayout="anchored"
              error={fieldErrors.phone ?? null}
              onCountryChange={(value) => {
                setPhoneCountry(value);
                clearFieldError("phone");
              }}
              onNationalChange={(value) => {
                setPhoneNational(value);
                clearFieldError("phone");
              }}
            />
          </div>
          <label className="ops-field">
            <span>{copy.contactFullName}</span>
            <input
              name="contactName"
              autoComplete="name"
              required
              value={contactName}
              className={fieldErrors.contactName ? "is-invalid" : undefined}
              aria-invalid={fieldErrors.contactName ? true : undefined}
              data-register-field="contactName"
              onChange={(event) => {
                setContactName(event.target.value);
                clearFieldError("contactName");
              }}
            />
            {fieldErrors.contactName ? (
              <span className="ops-field-error" role="alert">
                {fieldErrors.contactName}
              </span>
            ) : null}
          </label>
          <PartnerBusinessTypeField
            legend={copy.businessType}
            value={businessType}
            individualLabel={copy.businessIndividual}
            companyLabel={copy.businessCompany}
            onChange={handleBusinessTypeChange}
            required
            error={fieldErrors.businessType ?? null}
          />
          <label className="ops-field">
            <span>
              {businessType === "individual"
                ? copy.legalNameIndividual
                : copy.legalNameCompany}
            </span>
            <input
              name="name"
              required
              value={legalName}
              className={fieldErrors.name ? "is-invalid" : undefined}
              aria-invalid={fieldErrors.name ? true : undefined}
              data-register-field="name"
              onChange={(event) => {
                setLegalName(event.target.value);
                clearFieldError("name");
              }}
            />
            {fieldErrors.name ? (
              <span className="ops-field-error" role="alert">
                {fieldErrors.name}
              </span>
            ) : null}
          </label>
          <label className="ops-field">
            <span>{copy.address}</span>
            <textarea
              name="addressLine"
              rows={3}
              required
              value={addressLine}
              className={fieldErrors.addressLine ? "is-invalid" : undefined}
              aria-invalid={fieldErrors.addressLine ? true : undefined}
              data-register-field="addressLine"
              onChange={(event) => {
                setAddressLine(event.target.value);
                clearFieldError("addressLine");
              }}
            />
            {fieldErrors.addressLine ? (
              <span className="ops-field-error" role="alert">
                {fieldErrors.addressLine}
              </span>
            ) : null}
          </label>
          <label className="ops-field">
            <span>{copy.country}</span>
            <div className="partner-country-locked" aria-readonly="true">
              <span aria-hidden="true">{countryFlag}</span>
              <span>{countryLabel}</span>
            </div>
            <p className="partner-field-hint">{copy.countryLockedHint}</p>
          </label>
          <label className="ops-field">
            <span>{copy.taxOffice}</span>
            <input
              name="taxOffice"
              required
              value={taxOffice}
              className={fieldErrors.taxOffice ? "is-invalid" : undefined}
              aria-invalid={fieldErrors.taxOffice ? true : undefined}
              data-register-field="taxOffice"
              onChange={(event) => {
                setTaxOffice(event.target.value);
                clearFieldError("taxOffice");
              }}
            />
            {fieldErrors.taxOffice ? (
              <span className="ops-field-error" role="alert">
                {fieldErrors.taxOffice}
              </span>
            ) : null}
          </label>
          <label className="ops-field">
            <span>{taxIdLabel}</span>
            <input
              name="taxNumber"
              inputMode="numeric"
              autoComplete="off"
              required
              maxLength={taxIdMaxLength}
              pattern={`\\d{${taxIdMaxLength}}`}
              value={taxNumber}
              className={fieldErrors.taxNumber ? "is-invalid" : undefined}
              aria-invalid={fieldErrors.taxNumber ? true : undefined}
              data-register-field="taxNumber"
              onChange={(event) => {
                setTaxNumber(
                  normalizePartnerTaxIdDigits(event.target.value).slice(0, taxIdMaxLength),
                );
                clearFieldError("taxNumber");
              }}
            />
            {fieldErrors.taxNumber ? (
              <span className="ops-field-error" role="alert">
                {fieldErrors.taxNumber}
              </span>
            ) : null}
          </label>
          <PartnerPasswordField
            label={copy.password}
            name="password"
            autoComplete="new-password"
            required
            minLength={PARTNER_MIN_PASSWORD_LENGTH}
            value={password}
            error={fieldErrors.password ?? null}
            showPasswordLabel={copy.showPassword}
            hidePasswordLabel={copy.hidePassword}
            onChange={(value) => {
              setPassword(value);
              clearFieldError("password");
            }}
          />
          <PartnerPasswordField
            label={copy.confirmPasswordPlain}
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={PARTNER_MIN_PASSWORD_LENGTH}
            value={confirmPassword}
            error={fieldErrors.confirmPassword ?? null}
            showPasswordLabel={copy.showPassword}
            hidePasswordLabel={copy.hidePassword}
            onChange={(value) => {
              setConfirmPassword(value);
              clearFieldError("confirmPassword");
            }}
          />
          {state.error && !partnerRegisterErrorField(state.error) ? (
            <p className="ops-form-error" role="alert">
              {copy[ERROR_COPY[state.error]]}
            </p>
          ) : null}
          <button
            type="submit"
            className="ops-btn-primary"
            data-register-submit="application"
            disabled={pending || !phase.emailVerified}
          >
            {pending ? copy.registering : copy.registerSubmit}
          </button>
        </>
      ) : null}
      <p className="partner-apply-prompt">
        <a href={localizedPath(locale, "/partner/login")}>{copy.backToLogin}</a>
      </p>
    </form>
  );
}
