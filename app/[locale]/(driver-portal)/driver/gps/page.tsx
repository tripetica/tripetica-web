import { notFound, redirect } from "next/navigation";
import { DriverPortalHeader } from "@/components/driver-portal/driver-portal-header";
import { GpsDeviceWorkspace } from "@/components/gps/device-workspace";
import { query } from "@/lib/db/postgres";
import { driverPortalCopyFor } from "@/lib/driver-portal/copy";
import { assignedGpsItems } from "@/lib/driver-portal/gps-filter";
import { driverHasGpsAccess } from "@/lib/driver-portal/permissions";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { analyzeDriveTrack, type DriveTrackPoint } from "@/lib/gps/drive";
import { listPartnerVehicleIdentity, listPhysicalDrivePoints, listVehicleGreenDriving, readDriveVehicle } from "@/lib/gps/drive-store";
import { type DriveGreenView } from "@/lib/teltonika/green-driving";
import { partnerGpsFocus, type GpsFleetVehicle } from "@/lib/gps/fleet";
import { gpsCopyFor } from "@/lib/gps/copy";
import { gpsIsLiveMapSource } from "@/lib/gps/registration";
import { listFleetDefaultDrivers, listGpsDevices, listGpsRoute, type GpsRoutePoint } from "@/lib/gps/queries";
import { readGpsRange } from "@/lib/gps/range";
import { listMobileFleet, listMobileRoute, listMobileSessionEvents } from "@/lib/gps/mobile-store";
import { shareHistoryWindow, type ShareHistoryPreset } from "@/lib/gps/share-history";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { driverAuthorizedVehicleIds } from "@/lib/uetds/driver-access";

export const dynamic = "force-dynamic";

export default async function DriverGpsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await getDriverPortalActor();
  if (!actor || !driverHasGpsAccess(actor.permissions)) redirect(localizedPath(locale, "/driver"));
  const copy = driverPortalCopyFor(locale);
  const vehicleIds = await driverAuthorizedVehicleIds(actor.partnerId, actor.driverId);
  const [devices, mobileVehicles, assignedDrivers, vehicleIdentity] = await Promise.all([
    listGpsDevices(actor.partnerId).then((rows) => assignedGpsItems(rows.filter(gpsIsLiveMapSource), vehicleIds)),
    listMobileFleet(actor.partnerId).then((rows) => assignedGpsItems(rows, vehicleIds)),
    listFleetDefaultDrivers(actor.partnerId),
    listPartnerVehicleIdentity(actor.partnerId),
  ]);
  const portalCopy = copy;
  const gps = gpsCopyFor(locale);
  const queryParams = await searchParams;
  const requested = one(queryParams.vehicle);
  const focus = partnerGpsFocus({
    devices: devices.map((device) => ({ id: device.id, vehicleId: device.vehicleId })),
    mobile: mobileVehicles.map((vehicle) => ({ id: vehicle.id, vehicleId: vehicle.vehicleId ?? null })),
    requestedId: requested ?? null,
  });
  const selected = devices.find((device) => device.id === focus.deviceId) ?? null;
  const mobileFocus = mobileVehicles.find((vehicle) => vehicle.id === focus.mobileId) ?? null;
  const range = readGpsRange(one(queryParams.from), one(queryParams.to));
  const permissions = actor.permissions;
  const ranged = !("error" in range);
  const mobileRoute = mobileFocus && ranged && (permissions.gpsHistory || permissions.gpsDrive)
    ? await listMobileRoute({ sessionId: mobileFocus.id, partnerId: actor.partnerId, from: range.from, to: range.to })
    : [];
  const eventsPreset = sharePreset(one(queryParams.events));
  const shareWindow = shareHistoryWindow({
    preset: eventsPreset,
    fromRaw: one(queryParams.eventFrom),
    toRaw: one(queryParams.eventTo),
  });
  const shareEvents = permissions.gpsHistory && mobileFocus && !("error" in shareWindow)
    ? await listMobileSessionEvents(mobileFocus.id, actor.partnerId, shareWindow)
    : [];
  const route = permissions.gpsHistory && selected?.partnerId && selected.vehicleId && ranged
    ? await listGpsRoute({
      deviceId: selected.id,
      partnerId: selected.partnerId,
      vehicleId: selected.vehicleId,
      from: range.from,
      to: range.to,
    })
    : { total: 0, step: 1, points: [] as GpsRoutePoint[] };
  const drive = permissions.gpsDrive && ranged && selected?.vehicleId
    ? analyzeDriveTrack({
      ...(await listPhysicalDrivePoints({
        partnerId: actor.partnerId,
        vehicleId: selected.vehicleId,
        from: range.from,
        to: range.to,
      })),
      nowMs: Date.now(),
      useIgnition: selected.manufacturer === "teltonika",
    })
    : permissions.gpsDrive && ranged && mobileFocus
      ? analyzeDriveTrack({
        points: mobileRoute.map((point): DriveTrackPoint => ({
          id: point.id,
          at: Date.parse(point.recordedAt),
          latitude: point.latitude,
          longitude: point.longitude,
          speedMps: point.speedMps,
        })),
        nowMs: Date.now(),
        useIgnition: false,
      })
      : null;
  const driveVehicleId = selected?.vehicleId ?? mobileFocus?.vehicleId ?? null;
  const driveProfile = drive && driveVehicleId ? await readDriveVehicle(actor.partnerId, driveVehicleId) : null;
  const greenReading = permissions.gpsDrive && ranged && selected?.manufacturer === "teltonika" && selected.vehicleId
    ? await listVehicleGreenDriving({
      partnerId: actor.partnerId,
      vehicleId: selected.vehicleId,
      from: range.from,
      to: range.to,
    })
    : null;
  const green: DriveGreenView = greenReading
    ? {
      status: greenReading.events.length > 0 ? "recorded" : greenReading.parserReady ? "empty" : "inactive",
      events: greenReading.events.map((event) => ({ at: event.at, kind: event.kind, rawValue: event.rawValue })),
    }
    : { status: "unsupported", events: [] };
  const fromQuery = one(queryParams.from) ?? "";
  const toQuery = one(queryParams.to) ?? "";
  const rangeParams = new URLSearchParams();
  if (fromQuery && toQuery && ranged) {
    rangeParams.set("from", fromQuery);
    rangeParams.set("to", toQuery);
  }
  const historyPath = localizedPath(locale, "/driver/gps");
  const revealPosition = permissions.gpsLive;
  const fleet = [
    ...devices.map((device) => presentFleet(fleetVehicle(device, assignedDrivers, vehicleIdentity), revealPosition)),
    ...mobileVehicles.map((vehicle) => presentFleet(withVehicleIdentity(vehicle, vehicleIdentity), revealPosition)),
  ];
  const sections = {
    live: permissions.gpsLive,
    history: permissions.gpsHistory,
    maintenance: permissions.gpsMaintenance,
    drive: permissions.gpsDrive,
    device: permissions.gpsDevice,
  };

  return (
    <section className="driver-portal ops-app">
      <DriverPortalHeader locale={locale} title={portalCopy.gps} />
      {devices.length === 0 && mobileVehicles.length === 0 ? (
        <DriverGpsEmpty locale={locale} partnerId={actor.partnerId} vehicleIds={vehicleIds} />
      ) : (
        <GpsDeviceWorkspace
          locale={locale}
          copy={gps}
          surface="partner"
          device={selected}
          vehicles={[]}
          route={route}
          commands={[]}
          fromLocal={ranged ? range.fromLocal : ""}
          toLocal={ranged ? range.toLocal : ""}
          fromIso={ranged ? range.from.toISOString() : ""}
          toIso={ranged ? range.to.toISOString() : ""}
          error={"error" in range ? range.error : one(queryParams.error)}
          canManage={false}
          showDeviceList={false}
          viewerId={actor.driverId}
          fleetVehicles={fleet}
          mobileFocus={selected ? null : mobileFocus}
          shareEvents={shareEvents}
          sharePreset={eventsPreset}
          shareFromLocal={"error" in shareWindow ? "" : shareWindow.fromLocal}
          shareToLocal={"error" in shareWindow ? "" : shareWindow.toLocal}
          mobileRoute={{ total: mobileRoute.length, step: 1, points: permissions.gpsHistory ? mobileRoute : [] }}
          historyPath={historyPath}
          rangeSearch={rangeParams.toString()}
          deviceControls={false}
          drive={drive}
          driveVehicle={drive ? {
            plate: selected?.plate ?? mobileFocus?.plate ?? null,
            brand: driveProfile?.brand ?? null,
            model: driveProfile?.model ?? null,
            driverName: selected?.vehicleId
              ? assignedDrivers.get(selected.vehicleId) ?? null
              : mobileFocus?.driverName ?? null,
          } : null}
          green={permissions.gpsDrive ? green : null}
          portalPath="/driver/gps"
          sections={sections}
          liveUrl={selected && (permissions.gpsLive || permissions.gpsDevice) ? `/api/driver/gps/live/${selected.id}` : undefined}
          maintenanceBase={permissions.gpsMaintenance ? "/api/driver/gps/maintenance" : undefined}
          fleetUrl="/api/driver/gps/fleet"
          loadImmobilizer={permissions.gpsDevice}
        />
      )}
    </section>
  );
}

async function DriverGpsEmpty({
  locale,
  partnerId,
  vehicleIds,
}: {
  locale: Parameters<typeof driverPortalCopyFor>[0];
  partnerId: string;
  vehicleIds: string[];
}) {
  const copy = driverPortalCopyFor(locale);
  if (vehicleIds.length === 0) return <p className="driver-gps-note">{copy.noAssignedVehicle}</p>;
  const plates = await query<{ plate: string }>(
    `SELECT plate
       FROM partner_vehicles
      WHERE partner_id = $1
        AND id = ANY($2::uuid[])
        AND deleted_at IS NULL
      ORDER BY plate`,
    [partnerId, vehicleIds],
  );
  return (
    <p className="driver-gps-note">
      {plates.rows.map((row) => <span className="ltr-isolate" dir="ltr" key={row.plate}>{row.plate}</span>)}
      {copy.noGpsDevice}
    </p>
  );
}

function presentFleet(vehicle: GpsFleetVehicle, reveal: boolean): GpsFleetVehicle {
  if (reveal) return vehicle;
  return { ...vehicle, latitude: null, longitude: null, speedMps: null, headingDeg: null, recent: [] };
}

function fleetVehicle(
  device: Awaited<ReturnType<typeof listGpsDevices>>[number],
  drivers: Map<string, string>,
  identities: Map<string, { brand: string | null; model: string | null }>,
): GpsFleetVehicle {
  return withVehicleIdentity({
    id: device.id,
    plate: device.plate,
    deviceCode: device.deviceCode,
    latitude: device.latitude,
    longitude: device.longitude,
    speedMps: device.speedMps,
    headingDeg: device.headingDeg,
    recordedAt: device.recordedAt,
    lastHeartbeatAt: device.lastHeartbeatAt,
    receivedAt: device.lastHeartbeatAt,
    gnssFix: device.gnssFix,
    satellites: device.satellites,
    source: "device",
    vehicleId: device.vehicleId,
    manufacturer: device.manufacturer,
    din1State: device.din1State,
    driverName: device.vehicleId ? drivers.get(device.vehicleId) ?? null : null,
  }, identities);
}

function withVehicleIdentity<T extends { vehicleId?: string | null }>(
  vehicle: T,
  identities: Map<string, { brand: string | null; model: string | null }>,
) {
  const identity = vehicle.vehicleId ? identities.get(vehicle.vehicleId) : undefined;
  return { ...vehicle, brand: identity?.brand ?? null, model: identity?.model ?? null };
}

function sharePreset(value: string | undefined): ShareHistoryPreset {
  if (value === "today" || value === "yesterday" || value === "3d" || value === "range") return value;
  return "week";
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
