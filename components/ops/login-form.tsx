"use client";

import { useActionState } from "react";
import { OpsPasswordField } from "@/components/ops/password-field";
import { opsLoginAction, type OpsLoginState } from "@/lib/ops/actions";
import { type OpsCopy } from "@/lib/ops/copy";
import { type Locale } from "@/lib/i18n/config";

type OpsLoginFormProps = {
  locale: Locale;
  copy: OpsCopy;
};

export function OpsLoginForm({ locale, copy }: OpsLoginFormProps) {
  const [state, action, pending] = useActionState<OpsLoginState, FormData>(
    opsLoginAction,
    { error: null },
  );

  return (
    <form action={action} className="ops-login-form">
      <input type="hidden" name="locale" value={locale} />
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
      <OpsPasswordField
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
      ) : state.error ? (
        <p className="ops-form-error" role="alert">
          {copy.invalidLogin}
        </p>
      ) : null}
      <button type="submit" className="ops-btn-primary" disabled={pending}>
        {pending ? copy.signingIn : copy.signIn}
      </button>
    </form>
  );
}
