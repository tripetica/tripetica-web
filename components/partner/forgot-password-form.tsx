"use client";

import { useActionState, useEffect, useState } from "react";
import { PartnerPasswordField } from "@/components/partner/password-field";
import {
  partnerCompletePasswordResetAction,
  partnerRequestPasswordResetAction,
  partnerVerifyPasswordResetCodeAction,
  type PartnerEmailCodeState,
  type PartnerPasswordResetCompleteState,
} from "@/lib/partner/actions";
import { type PartnerCopy } from "@/lib/partner/copy";
import { PARTNER_MIN_PASSWORD_LENGTH } from "@/lib/partner/constants";
import { maskPartnerEmail } from "@/lib/partner/mask-email";
import { contactLinks } from "@/lib/contact/links";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

type PartnerForgotPasswordFormProps = {
  locale: Locale;
  copy: PartnerCopy;
  initialEmail?: string;
};

type Step = "email" | "code" | "password";

const CODE_ERROR_COPY: Record<
  Exclude<PartnerEmailCodeState["error"], null>,
  keyof PartnerCopy
> = {
  "invalid-email": "invalidEmail",
  invalid: "verificationInvalid",
  expired: "verificationExpired",
  used: "verificationUsed",
  locked: "verificationLocked",
  "email-mismatch": "verificationInvalid",
  throttled: "verificationThrottled",
  "mail-failed": "verificationMailFailed",
  duplicate: "emailTaken",
  "current-invalid": "currentPasswordInvalid",
  mismatch: "emailConfirmMismatch",
  "same-email": "emailUnchanged",
  "not-found": "passwordResetNotFound",
  pending: "pendingLogin",
  inactive: "inactiveLogin",
  failed: "verificationFailed",
};

const COMPLETE_ERROR_COPY: Record<
  Exclude<PartnerPasswordResetCompleteState["error"], null>,
  keyof PartnerCopy
> = {
  unverified: "unverifiedEmail",
  short: "passwordTooShort",
  mismatch: "passwordMismatch",
  "same-as-old": "passwordSameAsOld",
  failed: "passwordResetFailed",
};

function WhatsAppSupport({ label }: { label: string }) {
  return (
    <a
      className="partner-login-whatsapp"
      href={contactLinks.whatsapp}
      target="_blank"
      rel="noreferrer"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path
          fill="currentColor"
          d="M20.5 3.5A11 11 0 0 0 3.2 17.3L2 22l4.8-1.2A11 11 0 0 0 20.5 3.5Zm-8.5 17a9 9 0 0 1-4.6-1.3l-.3-.2-2.8.7.8-2.7-.2-.3A9 9 0 1 1 12 20.5Zm5-6.7c-.3-.1-1.6-.8-1.8-.9s-.4-.1-.6.1-.7.9-.8 1-.3.2-.6.1a7.4 7.4 0 0 1-2.2-1.4 8 8 0 0 1-1.5-1.9c-.2-.3 0-.4.1-.6l.4-.5.1-.3c0-.1 0-.3 0-.4s-.6-1.4-.8-1.9-.4-.4-.6-.4h-.5c-.2 0-.4.1-.6.3s-.8.8-.8 2 .8 2.3.9 2.5 1.6 2.5 3.9 3.5 2.2.8 3 .7 1.6-.6 1.8-1.2.2-1.1.1-1.2-.3-.2-.6-.3Z"
        />
      </svg>
      <span>{label}</span>
    </a>
  );
}

export function PartnerForgotPasswordForm({
  locale,
  copy,
  initialEmail = "",
}: PartnerForgotPasswordFormProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [requestState, requestAction, requesting] = useActionState<
    PartnerEmailCodeState,
    FormData
  >(partnerRequestPasswordResetAction, { error: null, ok: false });
  const [verifyState, verifyAction, verifying] = useActionState<
    PartnerEmailCodeState,
    FormData
  >(partnerVerifyPasswordResetCodeAction, { error: null, ok: false });
  const [completeState, completeAction, completing] = useActionState<
    PartnerPasswordResetCompleteState,
    FormData
  >(partnerCompletePasswordResetAction, { error: null, ok: false });

  useEffect(() => {
    if (requestState.ok && requestState.sent) {
      setStep("code");
    }
  }, [requestState]);

  useEffect(() => {
    if (verifyState.ok && verifyState.verified) {
      setStep("password");
    }
  }, [verifyState]);

  const supportError =
    requestState.error === "pending" || requestState.error === "inactive";
  const registerHref = `${localizedPath(locale, "/partner/register")}${
    email.trim() ? `?email=${encodeURIComponent(email.trim())}` : ""
  }`;

  const title =
    step === "code"
      ? copy.passwordResetCodeTitle
      : step === "password"
        ? copy.setNewPassword
        : copy.forgotPasswordTitle;
  const lead =
    step === "code" || step === "password"
      ? null
      : copy.forgotPasswordLead;

  const head = (
    <div className="ops-login-head">
      <p className="ops-login-brand">{copy.brand}</p>
      <h1>{title}</h1>
      {lead ? <p className="ops-login-lead">{lead}</p> : null}
    </div>
  );

  if (step === "password") {
    return (
      <>
        {head}
        <form action={completeAction} className="ops-login-form">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="email" value={email} />
          <p className="ops-login-lead partner-reset-masked">
            {copy.passwordResetCodeLead}{" "}
            <strong>{maskPartnerEmail(email)}</strong>
          </p>
          <PartnerPasswordField
            label={copy.newPassword}
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={PARTNER_MIN_PASSWORD_LENGTH}
            showPasswordLabel={copy.showPassword}
            hidePasswordLabel={copy.hidePassword}
            autoFocus
          />
          <PartnerPasswordField
            label={copy.confirmPassword}
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={PARTNER_MIN_PASSWORD_LENGTH}
            showPasswordLabel={copy.showPassword}
            hidePasswordLabel={copy.hidePassword}
          />
          {completeState.error ? (
            <p className="ops-form-error" role="alert">
              {copy[COMPLETE_ERROR_COPY[completeState.error]]}
            </p>
          ) : null}
          <button type="submit" className="ops-btn-primary" disabled={completing}>
            {completing ? copy.savingPassword : copy.saveNewPassword}
          </button>
          <p className="partner-apply-prompt">
            <a href={localizedPath(locale, "/partner/login")}>{copy.backToLogin}</a>
          </p>
        </form>
      </>
    );
  }

  if (step === "code") {
    return (
      <>
        {head}
        <div className="ops-login-form">
          <p className="ops-login-lead partner-reset-masked">
            {copy.passwordResetCodeLead}{" "}
            <strong>{maskPartnerEmail(email)}</strong>
          </p>
          <form action={verifyAction}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="email" value={email} />
            <label className="ops-field">
              <span>{copy.verificationCode}</span>
              <input
                type="text"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                required
                autoFocus
              />
            </label>
            {verifyState.error ? (
              <p className="ops-form-error" role="alert">
                {copy[CODE_ERROR_COPY[verifyState.error]]}
              </p>
            ) : null}
            <button type="submit" className="ops-btn-primary" disabled={verifying}>
              {verifying ? copy.verifyingCode : copy.verifyCode}
            </button>
          </form>
          <form action={requestAction} className="partner-reset-resend">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="email" value={email} />
            <button type="submit" className="ops-btn-ghost" disabled={requesting}>
              {requesting ? copy.resendingResetCode : copy.resendResetCode}
            </button>
            {requestState.error && step === "code" && !requestState.ok ? (
              <p className="ops-form-error" role="alert">
                {copy[CODE_ERROR_COPY[requestState.error]]}
              </p>
            ) : null}
          </form>
          <p className="partner-apply-prompt">
            <a href={localizedPath(locale, "/partner/login")}>{copy.backToLogin}</a>
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {head}
      <form action={requestAction} className="ops-login-form">
        <input type="hidden" name="locale" value={locale} />
        <label className="ops-field">
          <span>{copy.email}</span>
          <input
            type="email"
            name="email"
            autoComplete="username"
            required
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {requestState.error === "not-found" ? (
          <div className="partner-login-support" role="alert">
            <p className="ops-form-error">{copy.passwordResetNotFound}</p>
            <p className="partner-apply-prompt">
              <a href={registerHref}>{copy.applyCta}</a>
            </p>
          </div>
        ) : supportError ? (
          <div className="partner-login-support" role="alert">
            <p className="ops-form-error">
              {requestState.error === "pending" ? copy.pendingLogin : copy.inactiveLogin}
            </p>
            <WhatsAppSupport label={copy.whatsappSupport} />
          </div>
        ) : requestState.error ? (
          <p className="ops-form-error" role="alert">
            {copy[CODE_ERROR_COPY[requestState.error]]}
          </p>
        ) : null}
        <button type="submit" className="ops-btn-primary" disabled={requesting}>
          {requesting ? copy.sendingResetCode : copy.sendResetCode}
        </button>
        <p className="partner-apply-prompt">
          <a href={localizedPath(locale, "/partner/login")}>{copy.backToLogin}</a>
        </p>
      </form>
    </>
  );
}
