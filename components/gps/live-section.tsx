"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GpsLiveMap, type GpsFleetMapPin } from "@/components/gps/live-map";
import { gpsFleetHistoryReady, gpsFleetPoint, readGpsFleet, type GpsFleetVehicle } from "@/lib/gps/fleet";
import { googleMapsUrl, gpsClock, gpsPopupClock, gpsPopupSpeed, gpsSpeed, yandexMapsUrl } from "@/lib/gps/format";
import { GPS_LIVE_POLL_MS, readGpsLiveSnapshot, type GpsLiveSnapshot } from "@/lib/gps/live";
import {
  GPS_POPUP_DEFAULTS,
  gpsPresenceMarker,
  gpsResolveMotion,
  gpsPopupStorageKey,
  readGpsPopupPrefs,
  type GpsMotionMemory,
  type GpsPopupPrefs,
} from "@/lib/gps/map-popup";
import { gpsPresence } from "@/lib/gps/presence";
import { type GpsCopy } from "@/lib/gps/copy";
import { GpsSectionToggle } from "@/components/gps/section-toggle";
import { GpsWifiShareSwitch } from "@/components/gps/wifi-share-switch";

export function GpsLiveSection({
  copy,
  listPath,
  plate,
  deviceCode,
  deviceId,
  surface,
  initial,
  imei,
  status,
  company,
  partnerLabel,
  wifiMode,
  canToggleWifi,
  showDeviceList,
  viewerId,
  historyQuery,
  gps,
  wifi,
  camera,
  awaitingPick = false,
  historyBlocked,
  fleetVehicles,
  selectedVehicleId = null,
  onVehicleSelect,
  rangeSearch = "",
}: {
  copy: GpsCopy;
  listPath: string;
  plate: string | null;
  deviceCode: string;
  deviceId: string;
  surface: "ops" | "partner";
  initial: GpsLiveSnapshot;
  imei: string | null;
  status: "active" | "disabled";
  company: string | null;
  partnerLabel: string | null;
  wifiMode: "on" | "off" | "auto";
  canToggleWifi: boolean;
  showDeviceList: boolean;
  viewerId: string;
  historyQuery: string;
  gps: ReactNode;
  wifi: ReactNode;
  camera: ReactNode;
  awaitingPick?: boolean;
  historyBlocked?: string;
  fleetVehicles?: GpsFleetVehicle[];
  selectedVehicleId?: string | null;
  onVehicleSelect?: (id: string) => void;
  rangeSearch?: string;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const [pins, setPins] = useState<GpsFleetMapPin[] | undefined>(() => fleetPinsFrom(fleetVehicles, copy.unassigned));
  const pinSeed = fleetVehicles?.map((vehicle) => `${vehicle.id}:${vehicle.latitude}:${vehicle.longitude}`).join("|") ?? "";
  const [seenDevice, setSeenDevice] = useState(deviceId);
  const [pendingVehicleId, setPendingVehicleId] = useState<string | null>(null);
  const liveDeviceRef = useRef(deviceId);
  liveDeviceRef.current = deviceId;
  if (deviceId !== seenDevice) {
    setSeenDevice(deviceId);
    setSnapshot(initial);
  }
  const [clock, setClock] = useState(() => Date.now());
  const [tab, setTab] = useState<"gps" | "wifi" | "camera">("gps");
  const [prefs, setPrefs] = useState<GpsPopupPrefs>(GPS_POPUP_DEFAULTS);
  const motionMemory = useRef(new Map<string, GpsMotionMemory>());
  const presence = gpsPresence(snapshot.lastHeartbeatAt, new Date(clock));
  const live = snapshot.latitude !== null && snapshot.longitude !== null
    ? { latitude: snapshot.latitude, longitude: snapshot.longitude }
    : null;
  function resolveMotion(id: string, speedMps: number | null, sampledAt: string | null, now = clock) {
    const parsed = sampledAt ? Date.parse(sampledAt) : Number.NaN;
    const resolved = gpsResolveMotion({
      speedMps,
      sampledAt: Number.isFinite(parsed) ? parsed : null,
      memory: id ? motionMemory.current.get(id) ?? null : null,
      now,
    });
    if (id) {
      if (resolved.memory) motionMemory.current.set(id, resolved.memory);
      else motionMemory.current.delete(id);
    }
    return resolved.motion;
  }
  const resolveMotionRef = useRef(resolveMotion);
  resolveMotionRef.current = resolveMotion;
  const markerState = gpsPresenceMarker(presence, resolveMotion(deviceId, snapshot.speedMps, snapshot.recordedAt));

  useEffect(() => {
    if (!viewerId) {
      return;
    }
    setPrefs(readGpsPopupPrefs(window.localStorage.getItem(gpsPopupStorageKey(viewerId))));
  }, [viewerId]);

  function changePrefs(next: GpsPopupPrefs) {
    setPrefs(next);
    if (viewerId) {
      window.localStorage.setItem(gpsPopupStorageKey(viewerId), JSON.stringify(next));
    }
  }

  useEffect(() => {
    if (!deviceId) {
      return;
    }
    let stopped = false;
    let running = false;
    let timer = 0;
    let etag = "";
    let controller: AbortController | null = null;

    async function pull() {
      if (stopped || document.hidden || running) {
        return;
      }
      running = true;
      controller = new AbortController();
      try {
        const response = await fetch(`/api/gps/live/${deviceId}?surface=${surface}`, {
          cache: "no-store",
          headers: etag ? { "If-None-Match": etag } : {},
          signal: controller.signal,
        });
        if (stopped) {
          return;
        }
        if (response.status === 401 || response.status === 404) {
          stopped = true;
          return;
        }
        setClock(Date.now());
        if (response.status === 200) {
          const nextEtag = response.headers.get("ETag");
          if (nextEtag) {
            etag = nextEtag;
          }
          const body = readGpsLiveSnapshot(await response.json());
          if (stopped || liveDeviceRef.current !== deviceId) {
            return;
          }
          if (body) {
            setSnapshot(body);
          }
        }
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          return;
        }
      } finally {
        running = false;
        controller = null;
        if (!stopped && !document.hidden) {
          timer = window.setTimeout(() => {
            void pull();
          }, GPS_LIVE_POLL_MS);
        }
      }
    }

    function onVisibility() {
      window.clearTimeout(timer);
      if (document.hidden) {
        controller?.abort();
        return;
      }
      void pull();
    }

    document.addEventListener("visibilitychange", onVisibility);
    timer = window.setTimeout(() => {
      void pull();
    }, 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [deviceId, surface]);

  useEffect(() => {
    setPins(fleetPinsFrom(fleetVehicles, copy.unassigned, (vehicle) => resolveMotionRef.current(vehicle.id, vehicle.speedMps, vehicle.recordedAt)));
  }, [copy.unassigned, pinSeed]);

  useEffect(() => {
    if (!deviceId || snapshot.latitude === null || snapshot.longitude === null) return;
    const latitude = snapshot.latitude;
    const longitude = snapshot.longitude;
    setPins((current) => current?.map((pin) => {
      if (pin.id !== deviceId) return pin;
      const presenceNow = gpsPresence(snapshot.lastHeartbeatAt, new Date(clock));
      const motion = resolveMotionRef.current(deviceId, snapshot.speedMps, snapshot.recordedAt, clock);
      return {
        ...pin,
        latitude,
        longitude,
        marker: {
          ...pin.marker,
          latitude,
          longitude,
          plate: plate ?? copy.unassigned,
          speed: gpsPopupSpeed(snapshot.speedMps),
          clock: gpsPopupClock(snapshot.recordedAt),
          coordinates: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          headingDeg: snapshot.headingDeg,
          state: gpsPresenceMarker(presenceNow, motion),
        },
      };
    }));
  }, [clock, copy.unassigned, deviceId, plate, snapshot]);

  useEffect(() => {
    if (!fleetVehicles || fleetVehicles.length < 2) return;
    let stopped = false;
    let running = false;
    let timer = 0;
    let controller: AbortController | null = null;
    async function pull() {
      if (stopped || document.hidden || running) return;
      running = true;
      controller = new AbortController();
      try {
        const response = await fetch("/api/gps/fleet", { cache: "no-store", signal: controller.signal });
        if (stopped || response.status === 401) {
          if (response.status === 401) stopped = true;
          return;
        }
        if (!response.ok) return;
        const next = readGpsFleet(await response.json());
        if (!next) return;
        setClock(Date.now());
        setPins((current) => {
          const fresh = fleetPinsFrom(next, copy.unassigned, (vehicle) => resolveMotionRef.current(vehicle.id, vehicle.speedMps, vehicle.recordedAt, Date.now())) ?? [];
          if (!deviceId) return fresh;
          return fresh.map((pin) => current?.find((item) => item.id === pin.id && item.id === deviceId) ?? pin);
        });
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) return;
      } finally {
        running = false;
        controller = null;
        if (!stopped && !document.hidden) {
          timer = window.setTimeout(() => void pull(), GPS_LIVE_POLL_MS);
        }
      }
    }
    function onVisibility() {
      window.clearTimeout(timer);
      if (document.hidden) {
        controller?.abort();
        return;
      }
      void pull();
    }
    document.addEventListener("visibilitychange", onVisibility);
    timer = window.setTimeout(() => void pull(), GPS_LIVE_POLL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [copy.unassigned, deviceId, fleetVehicles]);

  function chooseVehicle(id: string) {
    onVehicleSelect?.(id);
    if (!fleetVehicles || fleetVehicles.length <= 1 || !listPath || id === selectedVehicleId) return;
    setPendingVehicleId(id);
    const params = new URLSearchParams(rangeSearch);
    params.set("vehicle", id);
    router.replace(`${listPath}?${params.toString()}`, { scroll: false });
  }

  const picking = awaitingPick || Boolean(fleetVehicles && fleetVehicles.length > 1 && !selectedVehicleId);
  const deviceLoading = Boolean(pendingVehicleId && pendingVehicleId !== deviceId);
  const historyNotice = fleetVehicles && !gpsFleetHistoryReady(fleetVehicles.length, selectedVehicleId)
    ? copy.historyPick
    : historyBlocked;

  return (
    <>
      {showDeviceList ? (
        <header className="gps-head">
          <a href={listPath}>{copy.back}</a>
        </header>
      ) : null}
      <div className="gps-tabs" role="tablist" aria-label={copy.title}>
        <button type="button" role="tab" aria-selected={tab === "gps"} onClick={() => setTab("gps")}>{copy.tabGps}</button>
        <button type="button" role="tab" aria-selected={tab === "wifi"} onClick={() => setTab("wifi")}>{copy.tabWifi}</button>
        <button type="button" role="tab" aria-selected={tab === "camera"} onClick={() => setTab("camera")}>{copy.tabCamera}</button>
      </div>
      <div className="gps-stack" hidden={tab !== "gps"}>
      <section className="gps-section">
        <h2>{copy.live}</h2>
        <fieldset className="gps-map-settings">
          <legend>{copy.mapSettings}</legend>
          <label><input type="checkbox" checked disabled /> {copy.plate}</label>
          <label>
            <input type="checkbox" checked={prefs.speed} onChange={(event) => changePrefs({ ...prefs, speed: event.target.checked })} />
            {copy.speed}
          </label>
          <label>
            <input type="checkbox" checked={prefs.clock} onChange={(event) => changePrefs({ ...prefs, clock: event.target.checked })} />
            {copy.popupClock}
          </label>
          <label>
            <input type="checkbox" checked={prefs.coordinates} onChange={(event) => changePrefs({ ...prefs, coordinates: event.target.checked })} />
            {copy.popupCoordinates}
          </label>
          <label>
            <input type="checkbox" checked={prefs.address} onChange={(event) => changePrefs({ ...prefs, address: event.target.checked })} />
            {copy.popupAddress}
          </label>
        </fieldset>
        <GpsLiveMap
          vehicleId={deviceId}
          live={fleetVehicles ? null : live}
          track={[]}
          active={tab === "gps"}
          prefs={prefs}
          addressPending={copy.addressPending}
          pins={pins}
          selectedVehicleId={selectedVehicleId}
          onVehicleSelect={fleetVehicles ? chooseVehicle : onVehicleSelect}
          marker={live ? {
            latitude: live.latitude,
            longitude: live.longitude,
            plate: plate ?? copy.unassigned,
            speed: gpsPopupSpeed(snapshot.speedMps),
            clock: gpsPopupClock(snapshot.recordedAt),
            coordinates: `${live.latitude.toFixed(6)}, ${live.longitude.toFixed(6)}`,
            headingDeg: snapshot.headingDeg,
            state: markerState,
          } : null}
        />
        {!picking && live && googleMapsUrl(live.latitude, live.longitude) && yandexMapsUrl(live.latitude, live.longitude) ? (
          <div className="gps-nav-links">
            <a href={googleMapsUrl(live.latitude, live.longitude) ?? undefined} target="_blank" rel="noreferrer">{copy.google}</a>
            <a href={yandexMapsUrl(live.latitude, live.longitude) ?? undefined} target="_blank" rel="noreferrer">{copy.yandex}</a>
          </div>
        ) : picking ? null : <p>{copy.noFix}</p>}
        <dl className="gps-facts">
          <div className={picking ? "gps-fleet-pick" : undefined}><dt>{copy.plate}</dt><dd>{picking ? copy.fleetPick : (plate ?? copy.unassigned)}</dd></div>
          <div><dt>{copy.gnssTime}</dt><dd>{picking ? "—" : gpsClock(snapshot.recordedAt)}</dd></div>
          <div><dt>{copy.speed}</dt><dd>{picking ? "—" : gpsSpeed(snapshot.speedMps)}</dd></div>
          <div><dt>{copy.gpsFix}</dt><dd>{picking ? "—" : snapshot.gnssFix ? copy.fixYes : copy.fixNo}</dd></div>
          <div><dt>{copy.satellites}</dt><dd>{picking ? "—" : snapshot.satellites ?? copy.unavailable}</dd></div>
          <div><dt>{copy.live}</dt><dd>{picking ? "—" : live ? `${live.latitude.toFixed(6)}, ${live.longitude.toFixed(6)}` : copy.unavailable}</dd></div>
        </dl>
      </section>
      <GpsSectionToggle key={selectedVehicleId ?? "fleet"} showLabel={copy.showHistory} hideLabel={copy.hideHistory} rememberKey={deviceId && !picking ? `gps-history:${deviceId}` : undefined} historyQuery={historyQuery} blockedMessage={historyNotice}>
        {gps}
      </GpsSectionToggle>
      <GpsSectionToggle showLabel={copy.showDevice} hideLabel={copy.hideDevice} blockedMessage={picking ? copy.devicePick : undefined}>
        <div className="gps-device-head">
          <h2>{copy.deviceInfo}</h2>
          <span className="gps-device-battery">
            <span className="gps-device-sep" aria-hidden="true">·</span>
            {deviceLoading ? <span>{copy.deviceLoading}</span> : snapshot.batteryPercent === null ? (
              <span aria-label={copy.batteryLevel}>—</span>
            ) : (
              <span className={snapshot.batteryPercent < 20 ? "gps-battery is-low" : "gps-battery"} aria-label={`${copy.batteryLevel} %${snapshot.batteryPercent}`}>
                <BatteryIcon />
                {` %${snapshot.batteryPercent}`}
              </span>
            )}
          </span>
        </div>
        {deviceLoading ? <p className="gps-inline-note">{copy.deviceLoading}</p> : (
          <dl className="gps-facts">
            <div><dt>{copy.deviceId}</dt><dd>{deviceCode}</dd></div>
            <div><dt>{copy.imei}</dt><dd>{imei ?? copy.unavailable}</dd></div>
            <div><dt>{copy.firmware}</dt><dd>{snapshot.firmware ?? copy.unavailable}</dd></div>
            <div><dt>{copy.operator}</dt><dd>{snapshot.operatorName ?? copy.unavailable}</dd></div>
            <div><dt>{copy.signal}</dt><dd>{snapshot.rssi === null ? copy.unavailable : `${snapshot.rssi} dBm`}</dd></div>
            <div><dt>{copy.seen}</dt><dd>{gpsClock(snapshot.lastHeartbeatAt)}</dd></div>
            <div><dt>{copy.status}</dt><dd>{status === "active" ? copy.active : copy.disabled}</dd></div>
            <div><dt>{copy.gpsFix}</dt><dd>{snapshot.gnssFix ? copy.fixYes : copy.fixNo}</dd></div>
            <div><dt>{copy.company}</dt><dd>{company ?? "—"}</dd></div>
            {surface === "ops" && partnerLabel ? <div><dt>{copy.partner}</dt><dd>{partnerLabel}</dd></div> : null}
          </dl>
        )}
      </GpsSectionToggle>
      {surface === "ops" ? (
        <section className="gps-section">
          <h2>{copy.technical}</h2>
          <dl className="gps-facts">
            <Tech copy={copy} label={copy.heartbeat} value={gpsClock(snapshot.lastHeartbeatAt)} />
            <Tech copy={copy} label={copy.uptime} value={snapshot.uptimeSeconds === null ? null : `${snapshot.uptimeSeconds}s`} />
            <Tech copy={copy} label={copy.firmware} value={snapshot.firmware} />
            <Tech copy={copy} label={copy.sim} value={snapshot.simStatus} />
            <Tech copy={copy} label={copy.lteReg} value={snapshot.lteRegistration} />
            <Tech copy={copy} label="RSSI" value={snapshot.rssi === null ? null : `${snapshot.rssi} dBm`} />
            <Tech copy={copy} label={copy.operator} value={snapshot.operatorName} />
            <Tech copy={copy} label={copy.ppp} value={snapshot.pppStatus} />
            <Tech copy={copy} label={copy.napt} value={snapshot.naptStatus} />
            <Tech copy={copy} label={copy.ip} value={snapshot.ipAddress} />
            <Tech copy={copy} label={copy.gnssResponse} value={snapshot.gnssResponse} />
            <Tech copy={copy} label={copy.gpsFix} value={snapshot.gnssFix === null ? null : snapshot.gnssFix ? copy.fixYes : copy.fixNo} />
            <Tech copy={copy} label={copy.satellites} value={snapshot.satellites === null ? null : String(snapshot.satellites)} />
            <Tech copy={copy} label="latitude" value={live ? String(live.latitude) : null} />
            <Tech copy={copy} label="longitude" value={live ? String(live.longitude) : null} />
            <Tech copy={copy} label={copy.wifiPolicy} value={snapshot.wifiPolicy ?? wifiMode} />
            <Tech copy={copy} label={copy.apStatus} value={snapshot.apStatus} />
            <Tech copy={copy} label={copy.clients} value={snapshot.wifiClients === null ? null : String(snapshot.wifiClients)} />
            <Tech copy={copy} label={copy.maxClients} value={snapshot.reportedMaxClients === null ? null : String(snapshot.reportedMaxClients)} />
            <Tech copy={copy} label={copy.recovery} value={snapshot.lastRecoveryReason} />
            <Tech copy={copy} label={copy.modemRecovery} value={snapshot.lastModemRecoveryAt ? gpsClock(snapshot.lastModemRecoveryAt) : null} />
            <Tech copy={copy} label={copy.gnssRecovery} value={snapshot.lastGnssRecoveryAt ? gpsClock(snapshot.lastGnssRecoveryAt) : null} />
            <Tech copy={copy} label={copy.resetReason} value={snapshot.resetReason} />
            <Tech copy={copy} label={copy.powerSource} value={snapshot.powerSource} />
            <Tech copy={copy} label={copy.battery} value={snapshot.vehicleBatteryVoltage === null ? null : String(snapshot.vehicleBatteryVoltage)} />
            <Tech copy={copy} label={copy.acc} value={snapshot.accState} />
            <Tech copy={copy} label={copy.powerMode} value={snapshot.powerMode} />
          </dl>
        </section>
      ) : null}
      </div>
      <div hidden={tab !== "wifi"}>
        <section className="gps-section">
          <div className="gps-wifi-head">
            <h2>{copy.wifi}</h2>
            {canToggleWifi ? (
              <GpsWifiShareSwitch
                copy={copy}
                deviceId={deviceId}
                surface={surface}
                enabled={snapshot.wifiEnabled}
                batteryPercent={snapshot.batteryPercent}
                lowBatteryState={snapshot.lowBatteryState}
                shareCommand={snapshot.wifiShareCommand}
              />
            ) : null}
          </div>
          {wifi}
        </section>
      </div>
      <div hidden={tab !== "camera"}>{camera}</div>
    </>
  );
}

function fleetPinsFrom(
  vehicles: GpsFleetVehicle[] | undefined,
  unassigned: string,
  motionFor?: (vehicle: GpsFleetVehicle) => ReturnType<typeof gpsResolveMotion>["motion"],
) {
  if (!vehicles) return undefined;
  const now = new Date();
  const pins: GpsFleetMapPin[] = [];
  for (const vehicle of vehicles) {
    const pin = fleetPin(vehicle, unassigned, now, motionFor?.(vehicle));
    if (pin) pins.push(pin);
  }
  return pins;
}

function fleetPin(
  vehicle: GpsFleetVehicle,
  unassigned: string,
  now: Date,
  motion?: ReturnType<typeof gpsResolveMotion>["motion"],
): GpsFleetMapPin | null {
  const point = gpsFleetPoint(vehicle.latitude, vehicle.longitude);
  if (!point) return null;
  const presence = gpsPresence(vehicle.lastHeartbeatAt, now);
  const sampledAt = vehicle.recordedAt ? Date.parse(vehicle.recordedAt) : Number.NaN;
  const resolved = motion ?? gpsResolveMotion({
    speedMps: vehicle.speedMps,
    sampledAt: Number.isFinite(sampledAt) ? sampledAt : null,
    memory: null,
    now: now.getTime(),
  }).motion;
  return {
    id: vehicle.id,
    latitude: point.latitude,
    longitude: point.longitude,
    marker: {
      latitude: point.latitude,
      longitude: point.longitude,
      plate: vehicle.plate ?? unassigned,
      speed: gpsPopupSpeed(vehicle.speedMps),
      clock: gpsPopupClock(vehicle.recordedAt),
      coordinates: `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`,
      headingDeg: vehicle.headingDeg,
      state: gpsPresenceMarker(presence, resolved),
    },
  };
}

function BatteryIcon() {
  return (
    <svg className="gps-battery-icon" viewBox="0 0 24 14" aria-hidden="true">
      <rect x="0.8" y="0.8" width="19.2" height="12.4" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="21" y="4.2" width="2.2" height="5.6" rx="0.6" fill="currentColor" />
      <rect x="3" y="3" width="14.6" height="8" rx="1" fill="currentColor" />
    </svg>
  );
}

function Tech({ copy, label, value }: { copy: GpsCopy; label: string; value: string | null }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value && value.length > 0 ? value : copy.unavailable}</dd>
    </div>
  );
}
