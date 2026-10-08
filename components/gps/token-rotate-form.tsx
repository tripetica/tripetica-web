"use client";

import { useActionState } from "react";
import { rotateGpsDeviceTokenAction, type GpsActionState } from "@/lib/gps/actions";
import { gpsErrorText, type GpsCopy } from "@/lib/gps/copy";
import { type Locale } from "@/lib/i18n/config";

export function GpsTokenRotateForm({
  locale,
  copy,
  deviceId,
}: {
  locale: Locale;
  copy: GpsCopy;
  deviceId: string;
}) {
  const [state, action, pending] = useActionState(
    rotateGpsDeviceTokenAction,
    null as GpsActionState | null,
  );
  return (
    <form action={action}>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="deviceId" value={deviceId} />
      <button type="submit" className="ops-btn-ghost" disabled={pending}>
        {copy.rotate}
      </button>
      {state?.error ? <p className="ops-form-error">{gpsErrorText(copy, state.error)}</p> : null}
      {state?.token ? (
        <div className="ops-note">
          <p>{copy.tokenOnce}</p>
          <p><code>{state.token}</code></p>
        </div>
      ) : null}
    </form>
  );
}
