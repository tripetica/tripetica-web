"use client";

import { useState } from "react";
import Form from "next/form";
import { GpsHistoryPlayback } from "@/components/gps/history-playback";
import { type GpsCopy } from "@/lib/gps/copy";
import {
  formatDriveClock,
  formatDriveDay,
  formatDriveDuration,
  formatDriveKilometers,
  type DriveLocale,
  type DriveReport,
  type DriveTrip,
  type DriveVehicleInfo,
} from "@/lib/gps/drive";
import { gpsSpeed } from "@/lib/gps/format";
import { GpsVehicleIdentity } from "@/components/gps/vehicle-identity";
import { formatGreenDrivingValue, type DriveGreenView, type GreenDrivingKind } from "@/lib/teltonika/green-driving";

export function GpsDriveReport({
  copy,
  locale,
  report,
  historyPath,
  vehicleId,
  fromLocal,
  toLocal,
  includeVehicle,
  formatSpeed = gpsSpeed,
  vehicle,
  green = null,
}: {
  copy: GpsCopy;
  locale: DriveLocale;
  report: DriveReport;
  historyPath: string;
  vehicleId: string;
  fromLocal: string;
  toLocal: string;
  includeVehicle: boolean;
  formatSpeed?: (mps: number | null) => string;
  vehicle: DriveVehicleInfo;
  green?: DriveGreenView | null;
}) {
  const average = report.movingMs > 0 ? report.meters / (report.movingMs / 1000) : null;
  const notes = [
    report.gap ? copy.rangeGap : "",
    report.truncated ? copy.rangeTruncated : "",
    report.countedUnknownIgnition ? copy.rangeIgnitionUnknown : "",
  ].filter(Boolean);
  const groups: { day: string; trips: DriveTrip[] }[] = [];
  for (const trip of report.trips) {
    const day = formatDriveDay(trip.startedAt, locale);
    const last = groups.at(-1);
    if (last && last.day === day) last.trips.push(trip);
    else groups.push({ day, trips: [trip] });
  }
  return (
    <div className="gps-drive">
      <h2>{copy.driveTitle}</h2>
      <GpsVehicleIdentity plate={vehicle.plate} brand={vehicle.brand} model={vehicle.model} />
      <Form className="gps-range" action={historyPath} scroll={false}>
        {includeVehicle ? <input type="hidden" name="vehicle" value={vehicleId} /> : null}
        <div className="gps-range-fields">
          <label>
            <span>{copy.from}</span>
            <span className="gps-range-picker">
              <input type="datetime-local" name="from" defaultValue={fromLocal} required />
              <span className="gps-range-chevron" aria-hidden="true" />
            </span>
          </label>
          <label>
            <span>{copy.to}</span>
            <span className="gps-range-picker">
              <input type="datetime-local" name="to" defaultValue={toLocal} required />
              <span className="gps-range-chevron" aria-hidden="true" />
            </span>
          </label>
        </div>
        <button type="submit" className="gps-range-submit">{copy.showRoute}</button>
      </Form>
      <h3>{copy.driveOverview}</h3>
      {report.hasFix ? (
        <dl className="gps-drive-cards">
          <div><dt>{copy.driveDistance}</dt><dd>{formatDriveKilometers(report.meters, locale)}</dd></div>
          <div><dt>{copy.driveTotal}</dt><dd>{formatDriveDuration(report.totalMs, locale)}</dd></div>
          <div><dt>{copy.driveMoving}</dt><dd>{formatDriveDuration(report.movingMs, locale)}</dd></div>
          <div><dt>{copy.driveStop}</dt><dd>{formatDriveDuration(report.stoppedMs, locale)}</dd></div>
          <div><dt>{copy.driveTripCount}</dt><dd>{report.trips.length}</dd></div>
          <div><dt>{copy.driveAvgSpeed}</dt><dd>{average === null ? "—" : formatSpeed(average)}</dd></div>
          <div><dt>{copy.driveMaxSpeed}</dt><dd>{report.maxSpeedMps === null ? "—" : formatSpeed(report.maxSpeedMps)}</dd></div>
        </dl>
      ) : <p>{copy.routeEmpty}</p>}
      {notes.map((note) => <p key={note} className="gps-playback-gap">{note}</p>)}
      <h3>{copy.drivePerformance}</h3>
      <DrivePerformance copy={copy} locale={locale} green={green} />
      <h3>{copy.driveTrips}</h3>
      {report.trips.length === 0 ? <p>{copy.driveNoTrips}</p> : groups.map((group) => (
        <section key={group.day} className="gps-drive-day">
          <h4>{group.day}</h4>
          {group.trips.map((trip) => (
            <DriveTripCard
              key={`${trip.startedAt}:${trip.endedAt}:${trip.startLatitude}`}
              copy={copy}
              locale={locale}
              trip={trip}
              vehicle={vehicle}
              vehicleId={vehicleId}
              formatSpeed={formatSpeed}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

function DrivePerformance({
  copy,
  locale,
  green,
}: {
  copy: GpsCopy;
  locale: DriveLocale;
  green: DriveGreenView | null;
}) {
  if (!green) return <p className="gps-drive-note">{copy.driveBehaviorPending}</p>;
  if (green.status === "unsupported") return <p className="gps-drive-note">{copy.driveGreenUnsupported}</p>;
  if (green.status === "inactive") return <p className="gps-drive-note">{copy.driveGreenInactive}</p>;
  if (green.status === "empty" || green.events.length === 0) return <p className="gps-drive-note">{copy.driveGreenEmpty}</p>;
  const counts = { acceleration: 0, braking: 0, cornering: 0 };
  for (const event of green.events) counts[event.kind] += 1;
  return (
    <div>
      <dl className="gps-drive-cards">
        <div><dt>{copy.driveHarshAccel}</dt><dd>{counts.acceleration}</dd></div>
        <div><dt>{copy.driveHarshBrake}</dt><dd>{counts.braking}</dd></div>
        <div><dt>{copy.driveHarshCorner}</dt><dd>{counts.cornering}</dd></div>
      </dl>
      <ul className="gps-drive-events">
        {green.events.map((event) => {
          const value = formatGreenDrivingValue(event.kind, event.rawValue, locale);
          return (
            <li key={`${event.at}:${event.kind}`}>
              {formatDriveDay(event.at, locale)} {formatDriveClock(event.at)} · {greenLabel(copy, event.kind)}{value ? ` · ${value}` : ""}
            </li>
          );
        })}
      </ul>
      <p className="gps-drive-note">{copy.driveGreenNote}</p>
    </div>
  );
}

function greenLabel(copy: GpsCopy, kind: GreenDrivingKind) {
  if (kind === "acceleration") return copy.driveHarshAccel;
  if (kind === "braking") return copy.driveHarshBrake;
  return copy.driveHarshCorner;
}

function DriveTripCard({
  copy,
  locale,
  trip,
  vehicle,
  vehicleId,
  formatSpeed,
}: {
  copy: GpsCopy;
  locale: DriveLocale;
  trip: DriveTrip;
  vehicle: DriveVehicleInfo;
  vehicleId: string;
  formatSpeed: (mps: number | null) => string;
}) {
  const [details, setDetails] = useState(false);
  const [map, setMap] = useState(false);
  const [technical, setTechnical] = useState(false);
  const model = [vehicle.brand, vehicle.model].filter(Boolean).join(" ");
  const movingAverage = trip.movingMs > 0 ? trip.meters / (trip.movingMs / 1000) : null;
  return (
    <article className="gps-drive-trip">
      <p className="gps-drive-when">{formatDriveClock(trip.startedAt)} → {formatDriveClock(trip.endedAt)}</p>
      <p>{copy.driveCardDistance}: {formatDriveKilometers(trip.meters, locale)}</p>
      <p>{copy.driveCardTotal}: {formatDriveDuration(Math.max(0, trip.endedAt - trip.startedAt), locale)}</p>
      <button type="button" className="gps-drive-toggle" aria-expanded={details} onClick={() => setDetails((open) => !open)}>
        {details ? copy.driveHideDetails : copy.driveShowDetails}
      </button>
      {details ? (
        <div className="gps-drive-detail">
          <section>
            <h5>{copy.driveVehicleDriver}</h5>
            <dl className="gps-facts">
              <div><dt>{copy.plate}</dt><dd>{vehicle.plate || "—"}</dd></div>
              <div><dt>{copy.driveMakeModel}</dt><dd>{model || "—"}</dd></div>
              <div><dt>{copy.driveAssignedDriver}</dt><dd>{vehicle.driverName || "—"}</dd></div>
            </dl>
          </section>
          <section>
            <h5>{copy.driveInfo}</h5>
            <dl className="gps-facts">
              <div><dt>{copy.from}</dt><dd>{`${formatDriveDay(trip.startedAt, locale)} ${formatDriveClock(trip.startedAt)}`}</dd></div>
              <div><dt>{copy.to}</dt><dd>{`${formatDriveDay(trip.endedAt, locale)} ${formatDriveClock(trip.endedAt)}`}</dd></div>
              <div><dt>{copy.driveCardDistance}</dt><dd>{formatDriveKilometers(trip.meters, locale)}</dd></div>
              <div><dt>{copy.driveCardTotal}</dt><dd>{formatDriveDuration(Math.max(0, trip.endedAt - trip.startedAt), locale)}</dd></div>
              <div><dt>{copy.driveMoving}</dt><dd>{formatDriveDuration(trip.movingMs, locale)}</dd></div>
              <div><dt>{copy.driveStop}</dt><dd>{formatDriveDuration(trip.stoppedMs, locale)}</dd></div>
              <div><dt>{copy.driveAvgSpeed}</dt><dd>{movingAverage === null ? "—" : formatSpeed(movingAverage)}</dd></div>
              <div><dt>{copy.driveMaxSpeed}</dt><dd>{trip.maxSpeedMps === null ? "—" : formatSpeed(trip.maxSpeedMps)}</dd></div>
            </dl>
          </section>
          <section>
            <h5>{copy.driveLocations}</h5>
            <dl className="gps-facts">
              <div><dt>{copy.driveStartGps}</dt><dd>{coord(trip.startLatitude, trip.startLongitude)}</dd></div>
              <div><dt>{copy.driveEndGps}</dt><dd>{coord(trip.endLatitude, trip.endLongitude)}</dd></div>
            </dl>
          </section>
          <section>
            <button type="button" className="gps-drive-toggle" aria-expanded={map} onClick={() => setMap((open) => !open)}>
              {map ? copy.driveHideMap : copy.driveShowMap}
            </button>
            {map ? (
              <div className="gps-drive-map">
                <GpsHistoryPlayback
                  deviceId={`${vehicleId}:${trip.startedAt}`}
                  plate={vehicle.plate ?? ""}
                  points={trip.route.map((point) => ({
                    recordedAt: new Date(point.at).toISOString(),
                    latitude: point.latitude,
                    longitude: point.longitude,
                    speedMps: point.speedMps,
                    headingDeg: null,
                  }))}
                  fromIso={new Date(trip.startedAt).toISOString()}
                  toIso={new Date(Math.max(trip.endedAt, trip.startedAt + 1)).toISOString()}
                  copy={copy}
                  formatSpeed={formatSpeed}
                />
              </div>
            ) : null}
          </section>
          <section>
            <button type="button" className="gps-drive-toggle" aria-expanded={technical} onClick={() => setTechnical((open) => !open)}>
              {technical ? copy.driveHideTechnical : copy.driveShowTechnical}
            </button>
            {technical ? (
              <dl className="gps-facts">
                <div><dt>{copy.drivePointCount}</dt><dd>{trip.route.length}</dd></div>
                {trip.hasExplicitIgnition ? (
                  <>
                    <div><dt>{copy.driveIgnitionOn}</dt><dd>{formatDriveDuration(trip.ignitionOnMs, locale)}</dd></div>
                    <div><dt>{copy.driveIgnitionOff}</dt><dd>{formatDriveDuration(trip.ignitionOffMs, locale)}</dd></div>
                    <div><dt>{copy.driveIgnitionUnknown}</dt><dd>{formatDriveDuration(trip.ignitionUnknownMs, locale)}</dd></div>
                  </>
                ) : <div><dt>{copy.driveIgnitionOn}</dt><dd>{copy.driveIgnitionMissing}</dd></div>}
                {trip.closedBy === "gap" ? <div><dt>{copy.rangeGap}</dt><dd>{copy.driveGapEnd}</dd></div> : null}
                <div><dt>{copy.driveMethod}</dt><dd>{copy.driveMethodText}</dd></div>
              </dl>
            ) : null}
          </section>
        </div>
      ) : null}
    </article>
  );
}

function coord(latitude: number, longitude: number) {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
