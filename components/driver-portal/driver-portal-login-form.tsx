"use client";

import { useActionState, useState } from "react";
import {
  sendDriverPortalCodeAction,
  verifyDriverPortalCodeAction,
  type DriverPortalSendState,
  type DriverPortalVerifyState,
} from "@/lib/driver-portal/actions";
import { driverPortalCopy } from "@/lib/driver-portal/copy";
import { type Locale } from "@/lib/i18n/config";

const SEND_ERROR: Record<
  Exclude<DriverPortalSendState["error"], null>,
  string
> = {
  "invalid-email": driverPortalCopy.invalidEmail,
  "not-found": driverPortalCopy.notFound,
  throttled: driverPortalCopy.throttled,
  "mail-failed": driverPortalCopy.mailFailed,
  failed: driverPortalCopy.sendFailed,
};

const VERIFY_ERROR: Record<
  Exclude<DriverPortalVerifyState["error"], null>,
  string
> = {
  invalid: driverPortalCopy.invalidCode,
  expired: driverPortalCopy.expiredCode,
  used: driverPortalCopy.usedCode,
  locked: driverPortalCopy.lockedCode,
  failed: driverPortalCopy.verifyFailed,
};

export function DriverPortalLoginForm({ locale }: { locale: Locale }) {
  const [email, setEmail] = useState("");
  const [sendState, sendAction, sending] = useActionState<DriverPortalSendState, FormData>(
    sendDriverPortalCodeAction,
    { error: null, ok: false, email: "" },
  );
  const [verifyState, verifyAction, verifying] = useActionState<
    DriverPortalVerifyState,
    FormData
  >(verifyDriverPortalCodeAction, { error: null, ok: false });
  const resolvedEmail = sendState.email || email;
  const showCode = sendState.ok;

  return (
    <div className="driver-portal-card">
      <form
        action={sendAction}
        className="driver-portal-form"
        onSubmit={(event) => {
          if (sending) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="locale" value={locale} />
        <label className="driver-portal-field">
          <span>{driverPortalCopy.email}</span>
          <input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            value={resolvedEmail}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={showCode}
          />
        </label>
        {sendState.error ? (
          <p className="driver-portal-error" role="alert">
            {SEND_ERROR[sendState.error]}
          </p>
        ) : null}
        {!showCode ? (
          <button type="submit" className="driver-task-action" disabled={sending}>
            {sending ? driverPortalCopy.sendingCode : driverPortalCopy.sendCode}
          </button>
        ) : null}
      </form>

      {showCode ? (
        <form action={verifyAction} className="driver-portal-form">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="email" value={resolvedEmail} />
          <label className="driver-portal-field">
            <span>{driverPortalCopy.code}</span>
            <input
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
            />
          </label>
          {verifyState.error ? (
            <p className="driver-portal-error" role="alert">
              {VERIFY_ERROR[verifyState.error]}
            </p>
          ) : null}
          <button type="submit" className="driver-task-action" disabled={verifying}>
            {verifying ? driverPortalCopy.signingIn : driverPortalCopy.signIn}
          </button>
        </form>
      ) : null}
    </div>
  );
}
