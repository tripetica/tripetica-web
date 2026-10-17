"use client";

import { useMemo, useState } from "react";
import { faultDeadlines, formatFaultClock, formatRemainingTr, type AtsFaultKind } from "@/lib/gps/ats-fault";
import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import { createGpsAtsFaultAction } from "@/lib/gps/ats-fault-actions";
import { atsFaultCopy } from "@/lib/gps/ats-fault-copy";
import { type Locale } from "@/lib/i18n/config";

export function AtsFaultForm({
  locale,
  deviceId,
  plate,
  deviceCode,
  imei,
  company,
  driver,
  phone,
  next,
  windowEndMs,
  firstAcceptedAtMs,
  count,
}: {
  locale: Locale;
  deviceId: string;
  plate: string;
  deviceCode: string;
  imei: string | null;
  company: string | null;
  driver: string | null;
  phone: string | null;
  next: "first" | "second" | "blocked";
  windowEndMs: number | null;
  firstAcceptedAtMs: number | null;
  count: number;
}) {
  const copy = atsFaultCopy(locale);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const started = date && time ? istanbulLocalToUtcMs(`${date}T${time}`) : Number.NaN;
  const deadlines = Number.isFinite(started) ? faultDeadlines(started) : null;
  const kinds = useMemo(() => Object.entries(copy.kinds) as [AtsFaultKind, string][], [copy.kinds]);
  return (
    <form action={createGpsAtsFaultAction} className="gps-stack" onFocus={() => setNow(Date.now())}>
      <h3>{copy.report}</h3>
      <dl className="gps-facts">
        <div><dt>{copy.vehicle}</dt><dd>{plate}</dd></div>
        <div><dt>{copy.plate}</dt><dd>{plate}</dd></div>
        <div><dt>{copy.device}</dt><dd>{deviceCode}</dd></div>
        <div><dt>{copy.imei}</dt><dd>{imei ?? copy.missing}</dd></div>
        <div><dt>{copy.company}</dt><dd>{company ?? copy.missing}</dd></div>
        <div><dt>{copy.driver}</dt><dd>{driver ?? copy.missing}</dd></div>
        <div><dt>{copy.driverPhone}</dt><dd>{phone ?? copy.missing}</dd></div>
        {deadlines ? (
          <>
            <div><dt>{copy.notifyDeadline}</dt><dd>{formatFaultClock(deadlines.notifyDeadlineMs)}</dd></div>
            <div><dt>{copy.repairDeadline}</dt><dd>{formatFaultClock(deadlines.repairDeadlineMs)}</dd></div>
          </>
        ) : null}
      </dl>
      {next === "second" && windowEndMs && firstAcceptedAtMs ? (
        <div className="gps-fault-warn">
          <strong>{copy.secondTitle}</strong>
          <p>{copy.secondBody}</p>
          <p>{copy.plate}: {plate}</p>
          <p>{copy.firstAt}: {formatFaultClock(firstAcceptedAtMs)}</p>
          <p>{copy.count}: 2/2</p>
          <p>{copy.periodEnd}: {formatFaultClock(windowEndMs)}</p>
          <p>{copy.remaining}: {formatRemainingTr(now, windowEndMs)}</p>
          <label><input type="checkbox" name="confirmSecond" value="yes" /> {copy.confirmSecond}</label>
        </div>
      ) : null}
      {next === "blocked" && windowEndMs && firstAcceptedAtMs ? (
        <div className="gps-fault-warn">
          <strong>{copy.blockedTitle}</strong>
          <p>{copy.blockedBody}</p>
          <p>{copy.count}: {count}/2</p>
          <p>{copy.firstAt}: {formatFaultClock(firstAcceptedAtMs)}</p>
          <p>{copy.periodEnd}: {formatFaultClock(windowEndMs)}</p>
          <p>{copy.remaining}: {formatRemainingTr(now, windowEndMs)}</p>
        </div>
      ) : null}
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="deviceId" value={deviceId} />
      <label><span>{copy.startDate}</span><input type="date" name="startDate" required value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label><span>{copy.startTime}</span><input type="time" name="startTime" required value={time} onChange={(event) => setTime(event.target.value)} /></label>
      <label>
        <span>{copy.kind}</span>
        <select name="kind" required defaultValue="gnss">
          {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label><span>{copy.description}</span><textarea name="description" required maxLength={500} rows={3} /></label>
      <button type="submit" className="ops-btn" name="intent" value="local">{copy.submitLocal}</button>
      {next === "blocked" ? null : <button type="submit" className="ops-btn" name="intent" value="ministry">{copy.submitMinistry}</button>}
    </form>
  );
}
