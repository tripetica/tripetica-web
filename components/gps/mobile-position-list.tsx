"use client";

import { gpsSpeedKmSa } from "@/lib/gps/mobile-speed";

export function MobilePositionList({
  points,
}: {
  points: { id: string; recordedAt: string; latitude: number; longitude: number; speedMps?: number | null }[];
}) {
  return (
    <ol>
      {points.map((point) => (
        <li key={point.id}>
          {new Intl.DateTimeFormat("tr-TR", { timeZone: "Europe/Istanbul", dateStyle: "short", timeStyle: "medium" }).format(new Date(point.recordedAt))}
          {" · "}{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}
          {point.speedMps == null ? "" : ` · ${gpsSpeedKmSa(point.speedMps)}`}
        </li>
      ))}
    </ol>
  );
}
