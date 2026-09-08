"use client";

import { useActionState } from "react";
import { PartnerPasswordField } from "@/components/partner/password-field";
import {
  partnerForcedPasswordChangeAction,
  partnerPasswordChangeAction,
  type PartnerPasswordState,
} from "@/lib/partner/actions";
import { PARTNER_MIN_PASSWORD_LENGTH } from "@/lib/partner/constants";
import { type PartnerCopy } from "@/lib/partner/copy";
import { type Locale } from "@/lib/i18n/config";

type PartnerPasswordFormProps = {
  locale: Locale;
  copy: PartnerCopy;
  mode: "forced" | "optional";
};

function passwordError(copy: PartnerCopy, error: PartnerPasswordState["error"]) {
  if (error === "short") {
    return copy.passwordTooShort;
  }
  if (error === "mismatch") {
    return copy.passwordMismatch;
  }
  if (error === "same-as-old") {
    return copy.passwordSameAsOld;
  }
  if (error === "current-invalid") {
    return copy.currentPasswordInvalid;
  }
  if (error === "failed") {
    return copy.passwordChangeFailed;
  }
  return null;
}

export function PartnerPasswordForm({ locale, copy, mode }: PartnerPasswordFormProps) {
  const action =
    mode === "forced" ? partnerForcedPasswordChangeAction : partnerPasswordChangeAction;
  const [state, formAction, pending] = useActionState<PartnerPasswordState, FormData>(
    action,
    { error: null, ok: false },
  );

  return (
    <form action={formAction} className="ops-login-form">
      <input type="hidden" name="locale" value={locale} />
      {mode === "optional" ? (
        <PartnerPasswordField
          label={copy.currentPassword}
          name="currentPassword"
          autoComplete="current-password"
          required
          showPasswordLabel={copy.showPassword}
          hidePasswordLabel={copy.hidePassword}
        />
      ) : null}
      <PartnerPasswordField
        label={copy.newPassword}
        name="newPassword"
        autoComplete="new-password"
        required
        autoFocus={mode === "forced"}
        minLength={PARTNER_MIN_PASSWORD_LENGTH}
        showPasswordLabel={copy.showPassword}
        hidePasswordLabel={copy.hidePassword}
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
      {state.ok ? (
        <p className="ops-form-ok" role="status">
          {copy.passwordChanged}
        </p>
      ) : null}
      {state.error ? (
        <p className="ops-form-error" role="alert">
          {passwordError(copy, state.error)}
        </p>
      ) : null}
      <button type="submit" className="ops-btn-primary" disabled={pending}>
        {pending ? copy.savingPassword : copy.savePassword}
      </button>
    </form>
  );
}
