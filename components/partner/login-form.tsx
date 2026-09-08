"use client";

import { useActionState } from "react";
import { PartnerPasswordField } from "@/components/partner/password-field";
import { partnerLoginAction, type PartnerLoginState } from "@/lib/partner/actions";
import { type PartnerCopy } from "@/lib/partner/copy";
import { contactLinks } from "@/lib/contact/links";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

type PartnerLoginFormProps = {
  locale: Locale;
  copy: PartnerCopy;
  nextPath?: string | null;
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

export function PartnerLoginForm({ locale, copy, nextPath }: PartnerLoginFormProps) {
  const [state, action, pending] = useActionState<PartnerLoginState, FormData>(
    partnerLoginAction,
    { error: null },
  );
  const supportError = state.error === "pending" || state.error === "inactive";

  return (
    <form action={action} className="ops-login-form">
      <input type="hidden" name="locale" value={locale} />
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <label className="ops-field">
        <span>{copy.email}</span>
        <input
          type="email"
          name="email"
          autoComplete="username"
          required
          autoFocus
        />
      </label>
      <PartnerPasswordField
        label={copy.password}
        name="password"
        autoComplete="current-password"
        required
        showPasswordLabel={copy.showPassword}
        hidePasswordLabel={copy.hidePassword}
      />
      {state.error === "throttled" ? (
        <p className="ops-form-error" role="alert">
          {copy.throttledLogin}
        </p>
      ) : supportError ? (
        <div className="partner-login-support" role="alert">
          <p className="ops-form-error">
            {state.error === "pending" ? copy.pendingLogin : copy.inactiveLogin}
          </p>
          <WhatsAppSupport label={copy.whatsappSupport} />
        </div>
      ) : state.error ? (
        <p className="ops-form-error" role="alert">
          {copy.invalidLogin}
        </p>
      ) : null}
      <button type="submit" className="ops-btn-primary" disabled={pending}>
        {pending ? copy.signingIn : copy.signIn}
      </button>
      <p className="partner-apply-prompt">
        {copy.applyPrompt}{" "}
        <a href={localizedPath(locale, "/partner/register")}>{copy.applyCta}</a>
      </p>
    </form>
  );
}
