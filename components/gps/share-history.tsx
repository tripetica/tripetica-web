"use client";

import Form from "next/form";
import { useState } from "react";
import { formatShareEventTime, shareEventPresentation, shareHistoryWindow, type ShareHistoryPreset } from "@/lib/gps/share-history";
import { type GpsCopy } from "@/lib/gps/copy";

export function GpsShareHistory({
  copy,
  action,
  vehicleId,
  events,
  preset,
  fromLocal,
  toLocal,
}: {
  copy: GpsCopy;
  action: string;
  vehicleId: string;
  events: { id: string; kind: string; createdAt: string }[];
  preset: ShareHistoryPreset;
  fromLocal: string;
  toLocal: string;
}) {
  const [rangeOpen, setRangeOpen] = useState(preset === "range");
  const window = shareHistoryWindow({ preset: preset === "range" ? "range" : preset, fromRaw: fromLocal, toRaw: toLocal });
  const visible = "error" in window
    ? events
    : events.filter((event) => {
      const at = Date.parse(event.createdAt);
      return at >= window.from.getTime() && at < window.to.getTime();
    });
  return (
    <details className="gps-section gps-share-history">
      <summary>{copy.shareHistory}</summary>
      <h2>{copy.shareHistoryTitle}</h2>
      <div className="gps-share-filters">
        {(["today", "yesterday", "3d", "week"] as const).map((item) => (
          <a key={item} href={`${action}?vehicle=${encodeURIComponent(vehicleId)}&events=${item}`} aria-current={preset === item ? "true" : undefined}>{presetLabel(copy, item)}</a>
        ))}
        <button type="button" aria-current={rangeOpen ? "true" : undefined} onClick={() => setRangeOpen(true)}>{copy.sharePresetRange}</button>
      </div>
      {rangeOpen ? (
        <Form className="gps-range" action={action} scroll={false}>
          <input type="hidden" name="vehicle" value={vehicleId} />
          <input type="hidden" name="events" value="range" />
          <div className="gps-range-fields">
            <label>
              <span>{copy.from}</span>
              <span className="gps-range-picker">
                <input type="datetime-local" name="eventFrom" defaultValue={fromLocal} required />
                <span className="gps-range-chevron" aria-hidden="true" />
              </span>
            </label>
            <label>
              <span>{copy.to}</span>
              <span className="gps-range-picker">
                <input type="datetime-local" name="eventTo" defaultValue={toLocal} required />
                <span className="gps-range-chevron" aria-hidden="true" />
              </span>
            </label>
          </div>
          <button type="submit" className="gps-range-submit">{copy.showRoute}</button>
        </Form>
      ) : null}
      {visible.length === 0 ? <p>{copy.shareHistoryEmpty}</p> : (
        <ul className="gps-share-events">
          {visible.map((event) => {
            const view = shareEventPresentation(event.kind);
            if (!view) return null;
            return (
              <li key={event.id} className="gps-share-event">
                <span aria-hidden="true">{view.icon}</span>
                <time dateTime={event.createdAt}>{formatShareEventTime(event.createdAt)}</time>
                <span>{view.label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </details>
  );
}

function presetLabel(copy: GpsCopy, preset: "today" | "yesterday" | "3d" | "week") {
  if (preset === "today") return copy.sharePresetToday;
  if (preset === "yesterday") return copy.sharePresetYesterday;
  if (preset === "3d") return copy.sharePresetDays;
  return copy.sharePresetWeek;
}
