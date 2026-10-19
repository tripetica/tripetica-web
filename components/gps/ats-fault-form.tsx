"use client";

import { useMemo, useState } from "react";
import { type AtsFaultKind } from "@/lib/gps/ats-fault";
import { createGpsAtsFaultAction, sendGpsAtsFaultAction } from "@/lib/gps/ats-fault-actions";
import { atsFaultCopy } from "@/lib/gps/ats-fault-copy";
import { type Locale } from "@/lib/i18n/config";

export function AtsFaultForm({
  locale,
  deviceId,
  faultId,
  initialDate,
  initialTime,
  initialKind,
  initialDescription,
  next,
  unknown,
  socketOpen,
  accepted = false,
}: {
  locale: Locale;
  deviceId: string;
  faultId: string | null;
  initialDate: string;
  initialTime: string;
  initialKind: AtsFaultKind | "";
  initialDescription: string;
  next: "first" | "second" | "blocked";
  unknown: boolean;
  socketOpen: boolean;
  accepted?: boolean;
}) {
  const copy = atsFaultCopy(locale);
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [description, setDescription] = useState(initialDescription);
  const kinds = useMemo(() => Object.entries(copy.kinds) as [AtsFaultKind, string][], [copy.kinds]);
  const ministryDate = useMemo(() => {
    const [year, month, day] = date.split("-");
    return year && month && day && time ? `${day}/${month}/${year} ${time}` : copy.missing;
  }, [copy.missing, date, time]);
  const action = faultId ? sendGpsAtsFaultAction : createGpsAtsFaultAction;
  return (
    <form action={action} className="gps-fault-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="deviceId" value={deviceId} />
      {faultId ? <input type="hidden" name="faultId" value={faultId} /> : <input type="hidden" name="intent" value="ministry" />}
      <div className="gps-fault-datetime">
      <label className="gps-fault-date">
        <span>{copy.startDate}</span>
        <input type="date" name="startDate" required disabled={accepted} value={date} onChange={(event) => setDate(event.target.value)} />
      </label>
      <label className="gps-fault-time">
        <span>{copy.startTime}</span>
        <input type="time" name="startTime" required disabled={accepted} value={time} onChange={(event) => setTime(event.target.value)} />
      </label>
      </div>
      <label className="gps-fault-kind">
        <span>{copy.kind}</span>
        <select name="kind" required disabled={accepted} defaultValue={initialKind}>
          <option value="" disabled>{copy.kindPlaceholder}</option>
          {kinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="gps-fault-description">
        <span>{copy.description}</span>
        <textarea name="description" required disabled={accepted} maxLength={500} rows={3} value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>
      {!accepted && ministryDate !== copy.missing ? <p className="gps-fault-format">{copy.ministryDatePreview}: <strong>{ministryDate}</strong></p> : null}
      {!accepted && next === "second" ? <label className="gps-fault-check"><input type="checkbox" name="confirmSecond" value="yes" /> {copy.confirmSecond}</label> : null}
      {!accepted && unknown ? (
        <>
          <p className="gps-fault-warn">{copy.duplicateRisk}</p>
          <label className="gps-fault-check"><input type="checkbox" name="confirmUnknown" value="yes" /> {copy.confirmUnknown}</label>
        </>
      ) : null}
      {accepted
        ? null
        : next === "blocked" || !socketOpen
          ? <p className="gps-inline-note">{next === "blocked" ? copy.blockedBody : copy.ministryDisabled}</p>
          : <button type="submit" className="ops-btn-primary gps-fault-submit">{copy.submitMinistry}</button>}
    </form>
  );
}
