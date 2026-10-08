"use client";

import { queueGpsRebootAction } from "@/lib/gps/actions";

export function GpsRebootControl({
  locale,
  deviceId,
  surface,
  label,
  confirm,
}: {
  locale: string;
  deviceId: string;
  surface: "ops" | "partner";
  label: string;
  confirm: string;
}) {
  return (
    <form
      action={queueGpsRebootAction}
      onSubmit={(event) => {
        if (!window.confirm(confirm)) event.preventDefault();
      }}
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="deviceId" value={deviceId} />
      <input type="hidden" name="surface" value={surface} />
      <button type="submit" className="ops-btn-ghost">{label}</button>
    </form>
  );
}
