"use client";

import Form from "next/form";
import { GpsHistoryPlayback } from "@/components/gps/history-playback";
import { MobilePositionList } from "@/components/gps/mobile-position-list";
import { type GpsCopy } from "@/lib/gps/copy";
import { formatDriveKilometers, type DriveLocale, type DriveReport } from "@/lib/gps/drive";
import { gpsSpeedKmSa } from "@/lib/gps/mobile-speed";
import { type GpsPlaybackPoint } from "@/lib/gps/playback";
import { GpsVehicleIdentity } from "@/components/gps/vehicle-identity";

export type GpsHistoryModel =
  | {
      mode: "mobile";
      plate: string | null;
      vehicleId: string;
      points: (GpsPlaybackPoint & { id: string })[];
      fromLocal: string;
      toLocal: string;
      fromIso: string;
      toIso: string;
      historyPath: string;
    }
  | {
      mode: "device";
      locale: string;
      surface: "ops" | "partner";
      deviceId: string;
      plate: string | null;
      points: GpsPlaybackPoint[];
      total: number;
      step: number;
      fromLocal: string;
      toLocal: string;
      fromIso: string;
      toIso: string;
      errorText?: string;
      historyPath: string;
      includeVehicle: boolean;
    };

export function GpsPositionHistory({
  copy,
  history,
  locale = "tr",
  drive = null,
  identity = null,
}: {
  copy: GpsCopy;
  history: GpsHistoryModel;
  locale?: DriveLocale;
  drive?: DriveReport | null;
  identity?: { plate: string | null; brand: string | null; model: string | null } | null;
}) {
  const distance = historyDistance(copy, locale, drive);
  if (history.mode === "mobile") {
    return <MobileRouteHistory copy={copy} history={history} distance={distance} identity={identity} />;
  }
  return (
    <div>
      {history.errorText ? <p className="ops-form-error">{history.errorText}</p> : null}
      <h2>{copy.route}</h2>
      {identity ? <GpsVehicleIdentity plate={identity.plate} brand={identity.brand} model={identity.model} /> : null}
      <Form className="gps-range" action={history.historyPath} scroll={false}>
        {history.includeVehicle ? <input type="hidden" name="vehicle" value={history.deviceId} /> : null}
        <div className="gps-range-fields">
          <label>
            <span>{copy.from}</span>
            <span className="gps-range-picker">
              <input type="datetime-local" name="from" defaultValue={history.fromLocal} required />
              <span className="gps-range-chevron" aria-hidden="true" />
            </span>
          </label>
          <label>
            <span>{copy.to}</span>
            <span className="gps-range-picker">
              <input type="datetime-local" name="to" defaultValue={history.toLocal} required />
              <span className="gps-range-chevron" aria-hidden="true" />
            </span>
          </label>
        </div>
        <button type="submit" className="gps-range-submit">{copy.showRoute}</button>
      </Form>
      {history.total === 0 ? <p>{copy.routeEmpty}</p> : (
        <div>
          {history.surface === "ops" && history.step > 1 ? <p>{copy.routeSampled} ({history.points.length}/{history.total})</p> : null}
          <GpsHistoryPlayback
            key={`${history.deviceId}:${history.fromIso}:${history.toIso}`}
            deviceId={history.deviceId}
            plate={history.plate ?? ""}
            points={history.points}
            fromIso={history.fromIso}
            toIso={history.toIso}
            copy={copy}
            rangeDistance={distance?.value}
            rangeNotes={distance?.notes}
          />
        </div>
      )}
    </div>
  );
}

function historyDistance(copy: GpsCopy, locale: DriveLocale, drive: DriveReport | null) {
  if (!drive?.hasFix) return null;
  const notes = [
    drive.gap ? copy.rangeGap : "",
    drive.truncated ? copy.rangeTruncated : "",
    drive.countedUnknownIgnition ? copy.rangeIgnitionUnknown : "",
  ].filter(Boolean);
  return { value: `${copy.rangeDistance}: ${formatDriveKilometers(drive.meters, locale)}`, notes };
}

function MobileRouteHistory({
  copy,
  history,
  distance,
  identity,
}: {
  copy: GpsCopy;
  history: Extract<GpsHistoryModel, { mode: "mobile" }>;
  distance: { value: string; notes: string[] } | null;
  identity: { plate: string | null; brand: string | null; model: string | null } | null;
}) {
  return (
    <div>
      <h2>{copy.route}</h2>
      {identity ? <GpsVehicleIdentity plate={identity.plate} brand={identity.brand} model={identity.model} /> : null}
      <Form className="gps-range" action={history.historyPath} scroll={false}>
        <input type="hidden" name="vehicle" value={history.vehicleId} />
        <div className="gps-range-fields">
          <label>
            <span>{copy.from}</span>
            <span className="gps-range-picker">
              <input type="datetime-local" name="from" defaultValue={history.fromLocal} required />
              <span className="gps-range-chevron" aria-hidden="true" />
            </span>
          </label>
          <label>
            <span>{copy.to}</span>
            <span className="gps-range-picker">
              <input type="datetime-local" name="to" defaultValue={history.toLocal} required />
              <span className="gps-range-chevron" aria-hidden="true" />
            </span>
          </label>
        </div>
        <button type="submit" className="gps-range-submit">{copy.showRoute}</button>
      </Form>
      {history.points.length === 0 ? <p>{copy.routeEmpty}</p> : (
        <GpsHistoryPlayback
          key={`${history.vehicleId}:${history.fromIso}:${history.toIso}`}
          deviceId={history.vehicleId}
          plate={history.plate ?? ""}
          points={history.points}
          fromIso={history.fromIso}
          toIso={history.toIso}
          copy={copy}
          formatSpeed={gpsSpeedKmSa}
          rangeDistance={distance?.value}
          rangeNotes={distance?.notes}
        />
      )}
      {history.points.length > 0 ? (
        <details className="gps-section">
          <summary>{copy.rawRecords}</summary>
          <MobilePositionList points={history.points} />
        </details>
      ) : null}
    </div>
  );
}
