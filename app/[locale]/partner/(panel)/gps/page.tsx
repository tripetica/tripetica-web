import { notFound } from "next/navigation";
import { GpsDeviceWorkspace } from "@/components/gps/device-workspace";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { isPartnerCommand } from "@/lib/gps/commands";
import { gpsCopy } from "@/lib/gps/copy";
import { type GpsFleetVehicle } from "@/lib/gps/fleet";
import { gpsIsLiveMapSource } from "@/lib/gps/registration";
import { listFleetDefaultDrivers, listGpsCommands, listGpsDevices, listGpsRoute, type GpsRoutePoint } from "@/lib/gps/queries";
import { readGpsRange } from "@/lib/gps/range";
import { requirePartnerPage } from "@/lib/partner/auth";
import { partnerCopy } from "@/lib/partner/copy";
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
  const [mobileVehicles, assignedDrivers] = await Promise.all([
    listMobileFleet(actor.partnerId),
    listFleetDefaultDrivers(actor.partnerId),
  ]);
  const panel = asPanelLocale(locale);
  const copy = deviceControls ? gpsCopy[panel] : { ...gpsCopy[panel], title: partnerCopy[panel].gpsOnly };
  const query = await searchParams;
  const requested = one(query.vehicle);
  const selected = devices.find((device) => device.id === requested)
    ?? (devices.length === 1 && !mobileVehicles.some((vehicle) => vehicle.id === requested) ? devices[0] : null);
  const mobileFocus = mobileVehicles.find((vehicle) => vehicle.id === requested) ?? (devices.length === 0 ? mobileVehicles[0] ?? null : null);
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
      fleetVehicles={[...devices.map((device) => fleetVehicle(device, assignedDrivers)), ...mobileVehicles]}
      mobileFocus={selected ? null : mobileFocus}
      shareEvents={shareEvents}
      sharePreset={eventsPreset}
      shareFromLocal={"error" in shareWindow ? "" : shareWindow.fromLocal}
      shareToLocal={"error" in shareWindow ? "" : shareWindow.toLocal}
      mobileRoute={{ total: mobileRoute.length, step: 1, points: mobileRoute }}
      historyPath={localizedPath(locale, "/partner/gps")}
      rangeSearch={rangeParams.toString()}
      deviceControls={deviceControls}
    />
  );
}

function fleetVehicle(
  device: Awaited<ReturnType<typeof listGpsDevices>>[number],
  drivers: Map<string, string>,
): GpsFleetVehicle {
  return {
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
    driverName: device.vehicleId ? drivers.get(device.vehicleId) ?? null : null,
  };
}

function sharePreset(value: string | undefined): ShareHistoryPreset {
  if (value === "today" || value === "yesterday" || value === "3d" || value === "range") return value;
  return "week";
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
