import { notFound } from "next/navigation";
import { GpsDeviceWorkspace } from "@/components/gps/device-workspace";
import { isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { isPartnerCommand } from "@/lib/gps/commands";
import { gpsCopyFor } from "@/lib/gps/copy";
import { analyzeDriveTrack, type DriveTrackPoint } from "@/lib/gps/drive";
import { listPartnerVehicleIdentity, listPhysicalDrivePoints, listVehicleGreenDriving, readDriveVehicle } from "@/lib/gps/drive-store";
import { type DriveGreenView } from "@/lib/teltonika/green-driving";
import { partnerGpsFocus, type GpsFleetVehicle } from "@/lib/gps/fleet";
import { gpsIsLiveMapSource } from "@/lib/gps/registration";
import { listFleetDefaultDrivers, listGpsCommands, listGpsDevices, listGpsRoute, type GpsRoutePoint } from "@/lib/gps/queries";
import { readGpsRange } from "@/lib/gps/range";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopyFor } from "@/lib/partner/copy";
import { partnerHasGpsDeviceControls } from "@/lib/partner/gps-access";
import { listMobileFleet, listMobileRoute, listMobileSessionEvents } from "@/lib/gps/mobile-store";
import { shareHistoryWindow, type ShareHistoryPreset } from "@/lib/gps/share-history";

export const dynamic = "force-dynamic";

export default async function PartnerGpsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/partner/gps">) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  const actor = await requirePartnerPage(locale);
  const deviceControls = partnerHasGpsDeviceControls(actor.isPrimaryPartner);
  const devices = (await listGpsDevices(actor.partnerId)).filter(gpsIsLiveMapSource);
  const [mobileVehicles, assignedDrivers, vehicleIdentity] = await Promise.all([
    listMobileFleet(actor.partnerId),
    listFleetDefaultDrivers(actor.partnerId),
    listPartnerVehicleIdentity(actor.partnerId),
  ]);
  const gps = gpsCopyFor(locale);
  const copy = deviceControls ? gps : { ...gps, title: partnerCopyFor(locale).gpsOnly };
  const query = await searchParams;
  const requested = one(query.vehicle);
  const focus = partnerGpsFocus({
    devices: devices.map((device) => ({ id: device.id, vehicleId: device.vehicleId })),
    mobile: mobileVehicles.map((vehicle) => ({ id: vehicle.id, vehicleId: vehicle.vehicleId ?? null })),
    requestedId: requested ?? null,
  });
  const selected = devices.find((device) => device.id === focus.deviceId) ?? null;
  const mobileFocus = mobileVehicles.find((vehicle) => vehicle.id === focus.mobileId) ?? null;
  const range = readGpsRange(one(query.from), one(query.to));
  const mobileRoute = mobileFocus && !("error" in range)
    ? await listMobileRoute({ sessionId: mobileFocus.id, partnerId: actor.partnerId, from: range.from, to: range.to })
    : [];
  const eventsPreset = sharePreset(one(query.events));
  const shareWindow = shareHistoryWindow({
    preset: eventsPreset,
    fromRaw: one(query.eventFrom),
    toRaw: one(query.eventTo),
  });
  const shareEvents = mobileFocus && !("error" in shareWindow)
    ? await listMobileSessionEvents(mobileFocus.id, actor.partnerId, shareWindow)
    : [];
  const route = selected?.partnerId && selected.vehicleId && !("error" in range)
    ? await listGpsRoute({
      deviceId: selected.id,
      partnerId: selected.partnerId,
      vehicleId: selected.vehicleId,
      from: range.from,
      to: range.to,
    })
    : { total: 0, step: 1, points: [] as GpsRoutePoint[] };
  const commands = selected?.partnerId && deviceControls
    ? (await listGpsCommands(selected.id, selected.partnerId)).filter((command) => isPartnerCommand(command.kind) || command.kind === "wifi.configure" || command.kind === "wifi.disable")
    : [];
  const drive = !("error" in range) && selected?.vehicleId
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
    : !("error" in range) && mobileFocus
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
  const greenReading = !("error" in range) && selected?.manufacturer === "teltonika" && selected.vehicleId
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
  const driveVehicle = {
    plate: selected?.plate ?? mobileFocus?.plate ?? null,
    brand: driveProfile?.brand ?? null,
    model: driveProfile?.model ?? null,
    driverName: selected?.vehicleId
      ? assignedDrivers.get(selected.vehicleId) ?? null
      : mobileFocus?.driverName ?? null,
  };
  const fromQuery = one(query.from) ?? "";
  const toQuery = one(query.to) ?? "";
  const rangeParams = new URLSearchParams();
  if (fromQuery && toQuery && !("error" in range)) {
    rangeParams.set("from", fromQuery);
    rangeParams.set("to", toQuery);
  }

  return (
    <GpsDeviceWorkspace
      locale={locale}
      copy={copy}
      surface="partner"
      device={selected ?? null}
      vehicles={[]}
      route={route}
      commands={commands}
      fromLocal={"error" in range ? "" : range.fromLocal}
      toLocal={"error" in range ? "" : range.toLocal}
      fromIso={"error" in range ? "" : range.from.toISOString()}
      toIso={"error" in range ? "" : range.to.toISOString()}
      error={"error" in range ? range.error : one(query.error)}
      canManage
      showDeviceList={false}
      viewerId={actor.userId}
      fleetVehicles={[
        ...devices.map((device) => fleetVehicle(device, assignedDrivers, vehicleIdentity)),
        ...mobileVehicles.map((vehicle) => withVehicleIdentity(vehicle, vehicleIdentity)),
      ]}
      mobileFocus={selected ? null : mobileFocus}
      shareEvents={shareEvents}
      sharePreset={eventsPreset}
      shareFromLocal={"error" in shareWindow ? "" : shareWindow.fromLocal}
      shareToLocal={"error" in shareWindow ? "" : shareWindow.toLocal}
      mobileRoute={{ total: mobileRoute.length, step: 1, points: mobileRoute }}
      historyPath={localizedPath(locale, "/partner/gps")}
      rangeSearch={rangeParams.toString()}
      deviceControls={deviceControls}
      drive={drive}
      driveVehicle={driveVehicle}
      green={green}
    />
  );
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
