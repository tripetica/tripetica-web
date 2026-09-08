"use client";

import { useActionState } from "react";
import { type Locale } from "@/lib/i18n/config";
import {
  createOpsUserAction,
  updateOpsUserAction,
  type OpsUserFormState,
} from "@/lib/ops/actions";
import { type OpsCopy } from "@/lib/ops/copy";
import { OPS_PERMISSIONS, type OpsPermission, type OpsRole } from "@/lib/ops/permissions";
import { OPS_MIN_PASSWORD_LENGTH } from "@/lib/ops/constants";
import { type OpsUserDetail } from "@/lib/ops/users";
import { OpsPasswordField } from "@/components/ops/password-field";

type OpsUserFormProps = {
  locale: Locale;
  copy: OpsCopy;
  user?: OpsUserDetail;
};

export function OpsUserForm({ locale, copy, user }: OpsUserFormProps) {
  const action = user ? updateOpsUserAction : createOpsUserAction;
  const [state, formAction, pending] = useActionState<OpsUserFormState, FormData>(
    action,
    { error: null, ok: false },
  );
  const role: OpsRole = user?.role ?? "employee";
  const selected = new Set<OpsPermission>(user?.permissions ?? []);

  return (
    <form action={formAction} className="ops-user-form">
      <input type="hidden" name="locale" value={locale} />
      {user ? <input type="hidden" name="id" value={user.id} /> : null}
      <label className="ops-field">
        <span>{copy.firstName}</span>
        <input name="firstName" required defaultValue={user?.firstName ?? ""} />
      </label>
      <label className="ops-field">
        <span>{copy.lastName}</span>
        <input name="lastName" required defaultValue={user?.lastName ?? ""} />
      </label>
      <label className="ops-field">
        <span>{copy.email}</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="off"
          defaultValue={user?.email ?? ""}
        />
      </label>
      <OpsPasswordField
        label={user ? copy.passwordOptional : copy.password}
        name="password"
        autoComplete="new-password"
        required={!user}
        minLength={user ? undefined : OPS_MIN_PASSWORD_LENGTH}
        showPasswordLabel={copy.showPassword}
        hidePasswordLabel={copy.hidePassword}
      />
      <label className="ops-field">
        <span>{copy.role}</span>
        <select name="role" defaultValue={role}>
          <option value="employee">{copy.employee}</option>
          <option value="owner">{copy.owner}</option>
        </select>
      </label>
      <label className="ops-field">
        <span>{copy.status}</span>
        <select name="isActive" defaultValue={user?.isActive === false ? "false" : "true"}>
          <option value="true">{copy.active}</option>
          <option value="false">{copy.inactive}</option>
        </select>
      </label>
      <fieldset className="ops-fieldset">
        <legend>{copy.permissions}</legend>
        {OPS_PERMISSIONS.map((key) => (
          <label key={key} className="ops-check">
            <input
              type="checkbox"
              name="permission"
              value={key}
              defaultChecked={selected.has(key) || role === "owner"}
            />
            {copy.permissionLabels[key]}
          </label>
        ))}
      </fieldset>
      {state.error === "email" ? <p className="ops-form-error">{copy.emailTaken}</p> : null}
      {state.error === "last-owner" ? <p className="ops-form-error">{copy.lastOwner}</p> : null}
      {state.error === "forbidden" ? <p className="ops-form-error">{copy.forbidden}</p> : null}
      {state.error === "invalid" || state.error === "failed" ? (
        <p className="ops-form-error">{copy.forbidden}</p>
      ) : null}
      {state.ok ? <p className="ops-form-ok">{copy.saved}</p> : null}
      <button type="submit" className="ops-btn-primary" disabled={pending}>
        {pending ? copy.saving : copy.save}
      </button>
    </form>
  );
}
