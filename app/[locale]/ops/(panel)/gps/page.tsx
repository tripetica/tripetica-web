import { notFound } from "next/navigation";
import { AtsFaultLists } from "@/components/gps/ats-fault-lists";
import { GpsDeviceBoard } from "@/components/gps/device-board";
import { OpsDeviceTabs } from "@/components/gps/ops-device-tabs";
import { GpsLiveSection } from "@/components/gps/live-section";
import { OpsGpsTabs } from "@/components/gps/ops-gps-tabs";
import { asPanelLocale, isLocale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { atsFaultCopy } from "@/lib/gps/ats-fault-copy";
import { gpsCopy, gpsErrorText } from "@/lib/gps/copy";
import { type GpsFleetVehicle } from "@/lib/gps/fleet";
import { type GpsLiveSnapshot } from "@/lib/gps/live";
import { loadOpsMapFleet, loadOpsMobileHistory } from "@/lib/gps/ops-fleet";
import { gpsIsLiveMapSource } from "@/lib/gps/registration";
import { listGpsDevices, listGpsPartners, listGpsRoute, listGpsVehicles, type GpsDeviceListItem, type GpsRoutePoint } from "@/lib/gps/queries";
import { readGpsRange } from "@/lib/gps/range";
import { shareHistoryWindow, type ShareHistoryPreset } from "@/lib/gps/share-history";
import { requireOpsPage } from "@/lib/ops/auth";
import { actorCan } from "@/lib/ops/session";

export const dynamic = "force-dynamic";

export default async function OpsGpsPage({
  params,
  searchParams,
}: PageProps<"/[locale]/ops/gps">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const actor = await requireOpsPage(locale, "gps.view");
  const [devices, partners, vehicles] = await Promise.all([
    listGpsDevices(null),
    listGpsPartners(),
    listGpsVehicles(),
  ]);
  const fleet = await loadOpsMapFleet(devices);
  const query = await searchParams;
  const copy = gpsCopy[asPanelLocale(locale)];
  const faultCopy = atsFaultCopy(locale);
  const deviceTab = one(query.devices) === "faults" || one(query.devices) === "history" ? one(query.devices) : "devices";
  const requested = one(query.vehicle);
  const device = devices.find((item) => item.id === requested && gpsIsLiveMapSource(item)) ?? null;
  const mobile = device ? null : fleet.find((item) => item.id === requested && item.source === "mobile") ?? null;
  const range = readGpsRange(one(query.from), one(query.to));
  const eventsPreset = sharePreset(one(query.events));
  const shareWindow = shareHistoryWindow({
    preset: eventsPreset,
    fromRaw: one(query.eventFrom),
    toRaw: one(query.eventTo),
  });
  const mobileHistory = mobile
    ? await loadOpsMobileHistory({
      sessionId: mobile.id,
      route: "error" in range ? null : { from: range.from, to: range.to },
      events: "error" in shareWindow ? null : { from: shareWindow.from, to: shareWindow.to },
    })
    : { route: [], events: [] };
  const route = device && !("error" in range)
    ? await listGpsRoute({
      deviceId: device.id,
      partnerId: device.partnerId,
      vehicleId: device.vehicleId,
      from: range.from,
      to: range.to,
    })
    : { total: 0, step: 1, points: [] as GpsRoutePoint[] };
  const listPath = localizedPath(locale, "/ops/gps");
  const fromQuery = one(query.from) ?? "";
  const toQuery = one(query.to) ?? "";
  const rangeParams = new URLSearchParams();
  if (fromQuery && toQuery && !("error" in range)) {
    rangeParams.set("from", fromQuery);
    rangeParams.set("to", toQuery);
  }
  const focus = fleet.find((item) => item.id === (device?.id ?? mobile?.id));
  const initial = device
    ? deviceSnapshot(device, focus?.recent ?? [])
    : mobileSnapshot(mobile);

  return (
    <OpsGpsTabs
      initialTab={one(query.tab) === "devices" ? "devices" : "gps"}
      gpsLabel={copy.tabGps}
      devicesLabel={copy.tabDevices}
      gps={(
        <GpsLiveSection
          copy={copy}
          listPath={listPath}
          plate={device?.plate ?? mobile?.plate ?? null}
          deviceCode={device?.deviceCode ?? mobile?.driverName ?? ""}
          deviceId={device?.id ?? mobile?.id ?? ""}
          surface="ops"
          initial={initial}
          imei={device?.imei ?? null}
          simOperator={device?.simOperator ?? null}
          status={device?.status ?? "active"}
          company={device?.uetdsCompany ?? null}
          partnerLabel={device ? (device.partnerCode ? `${device.partnerCode} · ${device.partnerName}` : null) : (mobile?.partnerName ?? null)}
          wifiMode="off"
          canToggleWifi={false}
          showDeviceList={false}
          viewerId={actor.id}
          historyQuery={`${"error" in range ? "" : range.from.toISOString()}|${"error" in range ? "" : range.to.toISOString()}`}
          awaitingPick={!device && !mobile}
          fleetVehicles={fleet}
          selectedVehicleId={device?.id ?? mobile?.id ?? null}
          rangeSearch={rangeParams.toString()}
          deviceControls={false}
          fleetUrl="/api/ops/gps/fleet"
          opsFilter
          shareEvents={mobileHistory.events}
          sharePreset={eventsPreset}
          shareFromLocal={"error" in shareWindow ? "" : shareWindow.fromLocal}
          shareToLocal={"error" in shareWindow ? "" : shareWindow.toLocal}
          history={device ? {
            mode: "device",
            locale,
            surface: "ops",
            deviceId: device.id,
            plate: device.plate,
            points: route.points,
            total: route.total,
            step: route.step,
            fromLocal: "error" in range ? "" : range.fromLocal,
            toLocal: "error" in range ? "" : range.toLocal,
            fromIso: "error" in range ? "" : range.from.toISOString(),
            toIso: "error" in range ? "" : range.to.toISOString(),
            errorText: "error" in range ? gpsErrorText(copy, range.error) : one(query.error),
            historyPath: listPath,
            includeVehicle: fleet.length > 1,
          } : mobile ? {
            mode: "mobile",
            plate: mobile.plate,
            vehicleId: mobile.id,
            points: mobileHistory.route,
            fromLocal: "error" in range ? "" : range.fromLocal,
            toLocal: "error" in range ? "" : range.toLocal,
            fromIso: "error" in range ? "" : range.from.toISOString(),
            toIso: "error" in range ? "" : range.to.toISOString(),
            historyPath: listPath,
          } : null}
          wifi={null}
          camera={null}
        />
      )}
      devices={(
        <OpsDeviceTabs
          initial={deviceTab === "faults" || deviceTab === "history" ? deviceTab : "devices"}
          devicesLabel={faultCopy.devices}
          faultsLabel={faultCopy.faults}
          historyLabel={faultCopy.history}
          devices={(
            <GpsDeviceBoard
              locale={locale}
              copy={copy}
              surface="ops"
              devices={devices}
              canManage={actorCan(actor, "gps.manage")}
              partners={partners}
              vehicles={vehicles}
            />
          )}
          faults={<AtsFaultLists locale={locale} mode="faults" />}
          history={<AtsFaultLists locale={locale} mode="history" />}
        />
      )}
    />
  );
}

function deviceSnapshot(device: GpsDeviceListItem, recent: GpsLiveSnapshot["recent"]): GpsLiveSnapshot {
  return {
    ...emptySnapshot(),
    seq: device.ackedThrough,
    recordedAt: device.recordedAt,
    latitude: device.latitude,
    longitude: device.longitude,
    speedMps: device.speedMps,
    headingDeg: device.headingDeg,
    satellites: device.satellites,
    gnssFix: device.gnssFix,
    lastHeartbeatAt: device.lastHeartbeatAt,
    firmware: device.firmware,
    rssi: device.rssi,
    operatorName: device.operatorName,
    network: device.network,
    uptimeSeconds: device.uptimeSeconds,
    simStatus: device.simStatus,
    lteRegistration: device.lteRegistration,
    pppStatus: device.pppStatus,
    naptStatus: device.naptStatus,
    ipAddress: device.ipAddress,
    gnssResponse: device.gnssResponse,
    wifiPolicy: device.wifiPolicy,
    apStatus: device.apStatus,
    wifiClients: device.wifiClients,
    reportedMaxClients: device.reportedMaxClients,
    lastRecoveryReason: device.lastRecoveryReason,
    lastModemRecoveryAt: device.lastModemRecoveryAt,
    lastGnssRecoveryAt: device.lastGnssRecoveryAt,
    resetReason: device.resetReason,
    powerSource: device.powerSource,
    vehicleBatteryVoltage: device.vehicleBatteryVoltage,
    accState: device.accState,
    powerMode: device.powerMode,
    batteryPercent: device.batteryPercent,
    wifiEnabled: device.reportedWifiEnabled,
    lowBatteryState: device.lowBatteryState,
    lowBatteryGraceRemainingSeconds: device.lowBatteryGraceRemainingSeconds,
    recent,
  };
}

function mobileSnapshot(vehicle: GpsFleetVehicle | null): GpsLiveSnapshot {
  return {
    ...emptySnapshot(),
    recordedAt: vehicle?.recordedAt ?? null,
    latitude: vehicle?.latitude ?? null,
    longitude: vehicle?.longitude ?? null,
    speedMps: vehicle?.speedMps ?? null,
    headingDeg: vehicle?.headingDeg ?? null,
    gnssFix: vehicle ? true : null,
    lastHeartbeatAt: vehicle?.lastHeartbeatAt ?? null,
    recent: vehicle?.recent ?? [],
  };
}

function emptySnapshot(): GpsLiveSnapshot {
  return {
    seq: 0,
    recordedAt: null,
    latitude: null,
    longitude: null,
    speedMps: null,
    headingDeg: null,
    satellites: null,
    gnssFix: null,
    lastHeartbeatAt: null,
    firmware: null,
    rssi: null,
    operatorName: null,
    network: null,
    uptimeSeconds: null,
    simStatus: null,
    lteRegistration: null,
    pppStatus: null,
    naptStatus: null,
    ipAddress: null,
    gnssResponse: null,
    wifiPolicy: null,
    apStatus: null,
    wifiClients: null,
    reportedMaxClients: null,
    lastRecoveryReason: null,
    lastModemRecoveryAt: null,
    lastGnssRecoveryAt: null,
    resetReason: null,
    powerSource: null,
    vehicleBatteryVoltage: null,
    accState: null,
    din1State: null,
    manufacturer: "esp32",
    powerMode: null,
    batteryPercent: null,
    wifiEnabled: null,
    wifiShareCommand: null,
    lowBatteryState: null,
    lowBatteryGraceRemainingSeconds: null,
  };
}

function sharePreset(value: string | undefined): ShareHistoryPreset {
  if (value === "today" || value === "yesterday" || value === "3d" || value === "range") return value;
  return "week";
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
