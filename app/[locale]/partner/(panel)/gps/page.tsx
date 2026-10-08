import { notFound } from "next/navigation";
import { GpsDeviceWorkspace } from "@/components/gps/device-workspace";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { isPartnerCommand } from "@/lib/gps/commands";
import { gpsCopy } from "@/lib/gps/copy";
import { type GpsFleetVehicle } from "@/lib/gps/fleet";
import { listGpsCommands, listGpsDevices, listGpsRoute, type GpsRoutePoint } from "@/lib/gps/queries";
import { readGpsRange } from "@/lib/gps/range";
import { requirePartnerPage } from "@/lib/partner/auth";

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
  const devices = await listGpsDevices(actor.partnerId);
  const copy = gpsCopy[asPanelLocale(locale)];
  if (devices.length === 0) {
    return (
      <div className="gps-screen">
        <header className="gps-head">
          <h1>{copy.title}</h1>
        </header>
        <p className="gps-empty">{copy.empty}</p>
      </div>
    );
  }

  const query = await searchParams;
  const requested = one(query.vehicle);
  const selected = devices.length === 1
    ? devices[0]
    : devices.find((device) => device.id === requested) ?? null;
  const range = readGpsRange(one(query.from), one(query.to));
  const route = selected?.partnerId && selected.vehicleId && !("error" in range)
    ? await listGpsRoute({
      deviceId: selected.id,
      partnerId: selected.partnerId,
      vehicleId: selected.vehicleId,
      from: range.from,
      to: range.to,
    })
    : { total: 0, step: 1, points: [] as GpsRoutePoint[] };
  const commands = selected?.partnerId
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
      fleetVehicles={devices.map(fleetVehicle)}
      historyPath={localizedPath(locale, "/partner/gps")}
      rangeSearch={rangeParams.toString()}
    />
  );
}

function fleetVehicle(device: Awaited<ReturnType<typeof listGpsDevices>>[number]): GpsFleetVehicle {
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
    gnssFix: device.gnssFix,
    satellites: device.satellites,
  };
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
