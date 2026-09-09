"use client";

import { useActionState, useState, type ReactNode } from "react";
import { OpsPasswordField } from "@/components/ops/password-field";
import { type Locale } from "@/lib/i18n/config";
import {
  changeOpsAccountPasswordAction,
  updateOpsAccountProfileAction,
  type OpsAccountPasswordState,
  type OpsAccountProfileState,
} from "@/lib/ops/account-actions";
import { OPS_MIN_PASSWORD_LENGTH } from "@/lib/ops/constants";
import { type OpsCopy } from "@/lib/ops/copy";

type OpsAccountFormProps = {
  locale: Locale;
  copy: OpsCopy;
  firstName: string;
  lastName: string;
  email: string;
};

function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none">
      <path
        d="M4 16.5V20h3.5L18.8 8.7a1 1 0 0 0 0-1.4l-2.1-2.1a1 1 0 0 0-1.4 0L4 16.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M14.2 6.3 17.7 9.8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function AccountRow({
  label,
  editLabel,
  editable,
  editing,
  onEdit,
  children,
}: {
  label: string;
  editLabel?: string;
  editable?: boolean;
  editing?: boolean;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="partner-profile-row">
      <div className="partner-profile-row-head">
        <p className="partner-billing-label">{label}</p>
        {editable ? (
          <button
            type="button"
            className="partner-edit-btn"
            aria-label={editLabel}
            aria-pressed={editing}
            onClick={onEdit}
          >
            <PencilIcon />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function profileError(copy: OpsCopy, error: OpsAccountProfileState["error"]) {
  if (error === "invalid-name") {
    return copy.invalidName;
  }
  if (error === "invalid-email") {
    return copy.invalidEmail;
  }
  if (error === "email-taken") {
    return copy.emailTaken;
  }
  if (error === "failed") {
    return copy.forbidden;
  }
  return null;
}

function passwordError(copy: OpsCopy, error: OpsAccountPasswordState["error"]) {
  if (error === "short") {
    return copy.passwordTooShort;
  }
  if (error === "mismatch") {
    return copy.passwordMismatch;
  }
  if (error === "current-invalid") {
    return copy.currentPasswordInvalid;
  }
  if (error === "failed") {
    return copy.passwordChangeFailed;
  }
  return null;
}

export function OpsAccountForm({
  locale,
  copy,
  firstName,
  lastName,
  email,
}: OpsAccountFormProps) {
  const [nameOpen, setNameOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [profileState, saveProfile, savingProfile] = useActionState<
    OpsAccountProfileState,
    FormData
  >(async (prev, formData) => {
    const result = await updateOpsAccountProfileAction(prev, formData);
    if (result.ok) {
      setNameOpen(false);
      setEmailOpen(false);
    }
    return result;
  }, { error: null, ok: false });
  const [passwordState, savePassword, savingPassword] = useActionState<
    OpsAccountPasswordState,
    FormData
  >(async (prev, formData) => {
    const result = await changeOpsAccountPasswordAction(prev, formData);
    if (result.ok) {
      setPasswordOpen(false);
    }
    return result;
  }, { error: null, ok: false });

  const fullName = `${firstName} ${lastName}`.trim();

  return (
    <section
      className="partner-billing-card partner-profile-card"
      aria-labelledby="ops-account-title"
    >
      <form action={saveProfile} className="partner-profile-form">
        <input type="hidden" name="locale" value={locale} />
        {!nameOpen ? (
          <>
            <input type="hidden" name="firstName" value={firstName} />
            <input type="hidden" name="lastName" value={lastName} />
          </>
        ) : null}
        {!emailOpen ? <input type="hidden" name="email" value={email} /> : null}

        <AccountRow
          label={copy.fullName}
          editable
          editing={nameOpen}
          editLabel={`${copy.editField}: ${copy.fullName}`}
          onEdit={() => setNameOpen((current) => !current)}
        >
          {nameOpen ? (
            <div className="ops-account-name-grid">
              <label className="ops-field">
                <span>{copy.firstName}</span>
                <input
                  name="firstName"
                  autoComplete="given-name"
                  required
                  defaultValue={firstName}
                />
              </label>
              <label className="ops-field">
                <span>{copy.lastName}</span>
                <input
                  name="lastName"
                  autoComplete="family-name"
                  required
                  defaultValue={lastName}
                />
              </label>
            </div>
          ) : (
            <p className="partner-billing-value">{fullName || "—"}</p>
          )}
        </AccountRow>

        <AccountRow
          label={copy.email}
          editable
          editing={emailOpen}
          editLabel={`${copy.editField}: ${copy.email}`}
          onEdit={() => setEmailOpen((current) => !current)}
        >
          {emailOpen ? (
            <label className="ops-field">
              <input
                type="email"
                name="email"
                autoComplete="email"
                required
                defaultValue={email}
              />
            </label>
          ) : (
            <p className="partner-billing-value">{email}</p>
          )}
        </AccountRow>

        {profileState.ok ? (
          <p className="ops-form-ok" role="status">
            {copy.profileSaved}
          </p>
        ) : null}
        {profileState.error ? (
          <p className="ops-form-error" role="alert">
            {profileError(copy, profileState.error)}
          </p>
        ) : null}
        {nameOpen || emailOpen ? (
          <div className="partner-profile-actions">
            <button type="submit" className="ops-btn-primary" disabled={savingProfile}>
              {savingProfile ? copy.saving : copy.save}
            </button>
            <button
              type="button"
              className="ops-btn-ghost"
              onClick={() => {
                setNameOpen(false);
                setEmailOpen(false);
              }}
            >
              {copy.cancelEdit}
            </button>
          </div>
        ) : null}
      </form>

      <div className="partner-profile-account">
        <AccountRow label={copy.password}>
          <p className="partner-billing-value">••••••••</p>
        </AccountRow>
        {passwordState.ok && !passwordOpen ? (
          <p className="ops-form-ok" role="status">
            {copy.passwordChanged}
          </p>
        ) : null}
        {passwordOpen ? (
          <div className="partner-password-panel partner-profile-panel">
            <form action={savePassword} className="ops-login-form">
              <input type="hidden" name="locale" value={locale} />
              <OpsPasswordField
                label={copy.currentPassword}
                name="currentPassword"
                autoComplete="current-password"
                required
                showPasswordLabel={copy.showPassword}
                hidePasswordLabel={copy.hidePassword}
              />
              <OpsPasswordField
                label={copy.newPassword}
                name="newPassword"
                autoComplete="new-password"
                required
                minLength={OPS_MIN_PASSWORD_LENGTH}
                showPasswordLabel={copy.showPassword}
                hidePasswordLabel={copy.hidePassword}
              />
              <OpsPasswordField
                label={copy.confirmPassword}
                name="confirmPassword"
                autoComplete="new-password"
                required
                minLength={OPS_MIN_PASSWORD_LENGTH}
                showPasswordLabel={copy.showPassword}
                hidePasswordLabel={copy.hidePassword}
              />
              {passwordState.error ? (
                <p className="ops-form-error" role="alert">
                  {passwordError(copy, passwordState.error)}
                </p>
              ) : null}
              <div className="partner-profile-actions">
                <button type="submit" className="ops-btn-primary" disabled={savingPassword}>
                  {savingPassword ? copy.savingPassword : copy.savePassword}
                </button>
                <button
                  type="button"
                  className="ops-btn-ghost"
                  onClick={() => setPasswordOpen(false)}
                >
                  {copy.cancelEdit}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="partner-password-trigger">
            <button
              type="button"
              className="ops-btn-secondary"
              onClick={() => setPasswordOpen(true)}
            >
              {copy.changePassword}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
