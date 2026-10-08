"use client";

import { type Locale } from "@/lib/i18n/config";
import { isDestructiveCommand } from "@/lib/gps/commands";
import { queueGpsOpsCommandAction } from "@/lib/gps/actions";
import { GPS_TELEMETRY_INTERVALS } from "@/lib/gps/contract";
import { type GpsCopy } from "@/lib/gps/copy";

const REMOTE = [
  ["gnss_restart", "GNSS restart"],
  ["ppp_reconnect", "PPP reconnect"],
  ["modem_reset", "Modem reset"],
  ["reboot", "Reboot"],
  ["status", "Status"],
] as const;

export function GpsRemoteCommands({
  locale,
  copy,
  deviceId,
}: {
  locale: Locale;
  copy: GpsCopy;
  deviceId: string;
}) {
  return (
    <div className="gps-remote">
      <form
        action={queueGpsOpsCommandAction}
        onSubmit={(event) => {
          const submitter = (event.nativeEvent as SubmitEvent).submitter;
          const kind = submitter instanceof HTMLButtonElement ? submitter.value : "";
          if (isDestructiveCommand(kind) && !window.confirm(copy.confirmRemote)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="deviceId" value={deviceId} />
        <div className="gps-remote-row">
          {REMOTE.map(([kind, label]) => (
            <button key={kind} type="submit" name="kind" value={kind} className={isDestructiveCommand(kind) ? "ops-btn-ghost" : "ops-btn"}>
              {label}
            </button>
          ))}
        </div>
      </form>
      <form action={queueGpsOpsCommandAction} className="gps-inline">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="deviceId" value={deviceId} />
        <input type="hidden" name="kind" value="set_telemetry" />
        <label>
          <span>{copy.telemetryInterval}</span>
          <select name="interval" defaultValue="10">
            {GPS_TELEMETRY_INTERVALS.map((seconds) => (
              <option key={seconds} value={seconds}>{seconds}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="ops-btn">{copy.sendCommand}</button>
      </form>
    </div>
  );
}
