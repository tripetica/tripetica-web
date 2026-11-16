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
      accessPartnerId: null,
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
          showDeviceList={false}
          viewerId={actor.id}
          historyQuery={`${"error" in range ? "" : range.from.toISOString()}|${"error" in range ? "" : range.to.toISOString()}`}
          awaitingPick={!device && !mobile}
          fleetVehicles={fleet}
          selectedVehicleId={device?.id ?? mobile?.id ?? null}
          rangeSearch={rangeParams.toString()}
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
        />
      )}
      devices={(
        <OpsDeviceTabs
          initial={deviceTab === "faults" || deviceTab === "history" ? deviceTab : "devices"}
          devicesLabel={faultCopy.devices}
          faultsLabel={faultCopy.faults}
          historyLabel={faultCopy.history}
          devices={(
            <>
              {one(query.deleted) === "1" ? (
                <p className="ops-form-success" role="status">{copy.deleteSuccess}</p>
              ) : null}
              <GpsDeviceBoard
                locale={locale}
                copy={copy}
                surface="ops"
                devices={devices}
                canManage={actorCan(actor, "gps.manage")}
                partners={partners}
                vehicles={vehicles}
              />
            </>
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
    accState: device.accState,
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
    accState: null,
    din1State: null,
    manufacturer: "teltonika",
  };
}

function sharePreset(value: string | undefined): ShareHistoryPreset {
  if (value === "today" || value === "yesterday" || value === "3d" || value === "range") return value;
  return "week";
}

function one(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
