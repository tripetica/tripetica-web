"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { GpsLiveMap, type GpsFleetMapPin } from "@/components/gps/live-map";
import { gpsFleetHistoryReady, gpsFleetItemKey, gpsFleetPoint, gpsMarkerIdentity, mergeGpsFleetIdentity, readGpsFleet, type GpsFleetVehicle } from "@/lib/gps/fleet";
import { adoptFleetSelection, opsFleetChoices } from "@/lib/gps/ops-fleet-filter";
import { OpsFleetFilter } from "@/components/gps/ops-fleet-filter";
import { useOpsGpsPanelVisible } from "@/components/gps/ops-gps-tabs";
import { googleMapsUrl, gpsClock, gpsPopupClock, gpsPopupSpeed, gpsSpeed, yandexMapsUrl } from "@/lib/gps/format";
import { GPS_LIVE_POLL_MS, readGpsLiveSnapshot, type GpsLiveSnapshot, type GpsRecentFix } from "@/lib/gps/live";
import {
  GPS_MAP_LABEL_DEFAULTS,
  gpsMapLabelStorageKey,
  readGpsMapLabelPrefs,
  type GpsMapLabelPrefs,
} from "@/lib/gps/map-labels";
import {
  GPS_POPUP_DEFAULTS,
  gpsMapMarkerState,
  teltonikaMarkerState,
  gpsPopupStorageKey,
  readGpsPopupPrefs,
  type GpsPopupPrefs,
} from "@/lib/gps/map-popup";
import { gpsSpeedKmSa, mobileDisplaySpeedMps } from "@/lib/gps/mobile-speed";
import { gpsMotionView, type GpsMotionFix } from "@/lib/gps/motion";
import { gpsPresence } from "@/lib/gps/presence";
import { type GpsCopy } from "@/lib/gps/copy";
import { GpsAtsPanel } from "@/components/gps/ats-panel";
import { type GpsAtsPanel as GpsAtsPanelState } from "@/lib/gps/ats-panel-state";
import { GpsMaintenancePanel } from "@/components/gps/maintenance-section";
import { GpsSectionToggle } from "@/components/gps/section-toggle";
import { type PanelLocale } from "@/lib/i18n/config";
import { GpsWifiShareSwitch } from "@/components/gps/wifi-share-switch";
import { GpsImmobilizerSwitch } from "@/components/gps/immobilizer-switch";
import { GpsDriveReport } from "@/components/gps/drive-report";
import { type DriveReport, type DriveVehicleInfo } from "@/lib/gps/drive";
import { GpsPositionHistory, type GpsHistoryModel } from "@/components/gps/position-history";
import { GpsVehicleIdentity } from "@/components/gps/vehicle-identity";
import { GpsShareHistory } from "@/components/gps/share-history";
import { GpsWifiPanel, type GpsWifiPanelDevice } from "@/components/gps/wifi-panel";
import { GpsCameraLive } from "@/components/gps/camera-live";
import { cameraIdlePhase } from "@/lib/gps/camera";
import { type ShareHistoryPreset } from "@/lib/gps/share-history";
import { type ImmobilizerPanel } from "@/lib/teltonika/immobilizer";
import { type DriveGreenView } from "@/lib/teltonika/green-driving";

export type GpsSectionVisibility = {
  live: boolean;
  history: boolean;
  maintenance: boolean;
  drive: boolean;
  device: boolean;
};

const allGpsSections: GpsSectionVisibility = {
  live: true,
  history: true,
  maintenance: true,
  drive: true,
  device: true,
};

export function GpsLiveSection({
  copy,
  listPath,
  plate,
  deviceCode,
  deviceId,
  surface,
  initial,
  imei,
  simOperator,
  status,
  company,
  partnerLabel,
  wifiMode,
  canToggleWifi,
  showDeviceList,
  viewerId,
  historyQuery,
  history = null,
  drive = null,
  driveVehicle = null,
  green = null,
  wifi,
  camera,
  awaitingPick = false,
  historyBlocked,
  fleetVehicles,
  selectedVehicleId = null,
  onVehicleSelect,
  rangeSearch = "",
  ats = null,
  canControlAts = false,
  deviceControls = true,
  immobilizer = null,
  shareEvents = [],
  sharePreset = "week",
  shareFromLocal = "",
  shareToLocal = "",
  wifiDevice = null,
  cameraDevice = null,
  fleetUrl = "/api/gps/fleet",
  liveUrl,
  maintenanceUrl,
  sections = allGpsSections,
  opsFilter = false,
  locale = "tr",
}: {
  copy: GpsCopy;
  listPath: string;
  plate: string | null;
  deviceCode: string;
  deviceId: string;
  surface: "ops" | "partner";
  initial: GpsLiveSnapshot;
  imei: string | null;
  simOperator: string | null;
  status: "active" | "disabled";
  company: string | null;
  partnerLabel: string | null;
  wifiMode: "on" | "off" | "auto";
  canToggleWifi: boolean;
  showDeviceList: boolean;
  viewerId: string;
  historyQuery: string;
  history?: GpsHistoryModel | null;
  drive?: DriveReport | null;
  driveVehicle?: DriveVehicleInfo | null;
  green?: DriveGreenView | null;
  wifi: ReactNode;
  camera: ReactNode;
  awaitingPick?: boolean;
  historyBlocked?: string;
  fleetVehicles?: GpsFleetVehicle[];
  selectedVehicleId?: string | null;
  onVehicleSelect?: (id: string) => void;
  rangeSearch?: string;
  ats?: GpsAtsPanelState | null;
  canControlAts?: boolean;
  deviceControls?: boolean;
  immobilizer?: ImmobilizerPanel | null;
  shareEvents?: { id: string; kind: string; createdAt: string }[];
  sharePreset?: ShareHistoryPreset;
  shareFromLocal?: string;
  shareToLocal?: string;
  wifiDevice?: GpsWifiPanelDevice | null;
  cameraDevice?: {
    deviceId: string;
    surface: "ops" | "partner";
    lowBatteryState: GpsLiveSnapshot["lowBatteryState"];
    batteryPercent: number | null;
    lastHeartbeatAt: string | null;
    cameraAvailable: boolean | null;
    cameraReady: boolean | null;
  } | null;
  fleetUrl?: string;
  liveUrl?: string;
  maintenanceUrl?: string;
  sections?: GpsSectionVisibility;
  opsFilter?: boolean;
  locale?: PanelLocale;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const [pins, setPins] = useState<GpsFleetMapPin[] | undefined>(() => fleetPinsFrom(fleetVehicles, copy.unassigned));
  const pinSeed = fleetVehicles?.map((vehicle) => `${vehicle.id}:${vehicle.source ?? "device"}:${vehicle.plate ?? ""}:${vehicle.driverName ?? ""}:${vehicle.latitude}:${vehicle.longitude}:${vehicle.recordedAt ?? ""}`).join("|") ?? "";
  const [seenDevice, setSeenDevice] = useState(deviceId);
  const [pendingVehicleId, setPendingVehicleId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(selectedVehicleId);
  const [seenSelection, setSeenSelection] = useState(selectedVehicleId);
  const [fleet, setFleet] = useState(fleetVehicles);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set((fleetVehicles ?? []).map((vehicle) => vehicle.id)));
  const seenFleetIds = useRef<Set<string>>(new Set((fleetVehicles ?? []).map((vehicle) => vehicle.id)));
  const panelVisible = useOpsGpsPanelVisible();
  if (selectedVehicleId !== seenSelection) {
    setSeenSelection(selectedVehicleId);
    setActiveId(selectedVehicleId);
    setPendingVehicleId(null);
  }
  const liveDeviceRef = useRef(deviceId);
  liveDeviceRef.current = deviceId;
  if (deviceId !== seenDevice) {
    setSeenDevice(deviceId);
    setSnapshot(initial);
  }
  const [clock, setClock] = useState(() => Date.now());
  const [tab, setTab] = useState<"gps" | "wifi" | "camera">("gps");
  const visibleTab = deviceControls ? tab : "gps";
  const [prefs, setPrefs] = useState<GpsPopupPrefs>(GPS_POPUP_DEFAULTS);
  const [labels, setLabels] = useState<GpsMapLabelPrefs>(GPS_MAP_LABEL_DEFAULTS);
  const presence = gpsPresence(snapshot.lastHeartbeatAt, new Date(clock));
  const motionView = gpsMotionView(motionFixes(snapshot.recent, snapshot), clock);
  const raw = snapshot.latitude !== null && snapshot.longitude !== null
    ? { latitude: snapshot.latitude, longitude: snapshot.longitude }
    : null;
  const live = motionView
    ? { latitude: motionView.latitude, longitude: motionView.longitude }
    : raw;
  const markerState = mapMarkerState({
    manufacturer: snapshot.manufacturer,
    receivedAt: snapshot.lastHeartbeatAt,
    nowMs: clock,
    motion: motionView?.kind ?? "unknown",
    din1: snapshot.din1State,
    speedMps: snapshot.speedMps,
  });
  const signalCurrent = markerCurrent(markerState, presence);
  const liveSpeed = motionView?.liveSpeedMps ?? null;
  const mobileSpeed = mobileDisplaySpeedMps({
    motion: motionView?.kind ?? "unknown",
    speedMps: snapshot.speedMps,
  });

  useEffect(() => {
    if (!viewerId) {
      return;
    }
    setPrefs(readGpsPopupPrefs(window.localStorage.getItem(gpsPopupStorageKey(viewerId))));
    setLabels(readGpsMapLabelPrefs(window.localStorage.getItem(gpsMapLabelStorageKey(viewerId))));
  }, [viewerId]);

  function changePrefs(next: GpsPopupPrefs) {
    setPrefs(next);
    if (viewerId) {
      window.localStorage.setItem(gpsPopupStorageKey(viewerId), JSON.stringify(next));
    }
  }

  function changeLabels(next: GpsMapLabelPrefs) {
    setLabels(next);
    if (viewerId) {
      window.localStorage.setItem(gpsMapLabelStorageKey(viewerId), JSON.stringify(next));
    }
  }

  const devicePollId = fleetVehicles?.some((vehicle) => vehicle.id === deviceId && vehicle.source === "mobile") ? "" : deviceId;
  const pollLive = sections.live || sections.device;
  useEffect(() => {
    if (!devicePollId || !pollLive) {
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
        const response = await fetch(liveUrl ?? `/api/gps/live/${deviceId}?surface=${surface}`, {
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
  }, [devicePollId, liveUrl, pollLive, surface]);

  function adoptVisibleFleet(next: GpsFleetVehicle[]) {
    if (!opsFilter) return;
    const seen = seenFleetIds.current;
    const ids = next.map((vehicle) => vehicle.id);
    seenFleetIds.current = new Set(ids);
    setSelectedIds((previous) => {
      const next = adoptFleetSelection(previous, seen, ids).selected;
      if (next.size === previous.size && [...next].every((id) => previous.has(id))) return previous;
      return next;
    });
  }

  useEffect(() => {
    setFleet(fleetVehicles);
    if (fleetVehicles) adoptVisibleFleet(fleetVehicles);
  }, [opsFilter, pinSeed, fleetVehicles]);

  useEffect(() => {
    if (!deviceId || snapshot.latitude === null || snapshot.longitude === null) return;
    const latitude = snapshot.latitude;
    const longitude = snapshot.longitude;
    setPins((current) => current?.map((pin) => {
      if (pin.id !== deviceId) return pin;
      const presenceNow = gpsPresence(snapshot.lastHeartbeatAt, new Date(clock));
      const view = gpsMotionView(motionFixes(snapshot.recent, snapshot), clock);
      const latitudeNow = view?.latitude ?? latitude;
      const longitudeNow = view?.longitude ?? longitude;
      const selected = fleetVehicles?.find((item) => item.id === deviceId);
      const speedMps = selected?.source === "mobile"
        ? mobileDisplaySpeedMps({ motion: view?.kind ?? "unknown", speedMps: snapshot.speedMps })
        : view?.liveSpeedMps ?? null;
      return {
        ...pin,
        latitude: latitudeNow,
        longitude: longitudeNow,
        marker: {
          ...pin.marker,
          latitude: latitudeNow,
          longitude: longitudeNow,
          plate: gpsMarkerIdentity({ plate, deviceCode, source: selected?.source, fallback: copy.unassigned }),
          driver: selected?.driverName ?? null,
          speed: gpsPopupSpeed(speedMps),
          clock: gpsPopupClock(snapshot.recordedAt),
          coordinates: `${latitudeNow.toFixed(6)}, ${longitudeNow.toFixed(6)}`,
          headingDeg: snapshot.headingDeg,
          state: mapMarkerState({
            manufacturer: snapshot.manufacturer,
            receivedAt: snapshot.lastHeartbeatAt,
            nowMs: clock,
            motion: view?.kind ?? "unknown",
            din1: snapshot.din1State,
            speedMps: snapshot.speedMps,
          }),
        },
      };
    }));
  }, [clock, copy.unassigned, deviceId, fleetVehicles, plate, snapshot]);

  useEffect(() => {
    const shown = opsFilter && fleet ? fleet.filter((vehicle) => selectedIds.has(vehicle.id)) : fleet;
    setPins((current) => {
      const fresh = fleetPinsFrom(shown, copy.unassigned);
      if (!fresh || !deviceId) return fresh;
      return fresh.map((pin) => current?.find((item) => item.id === pin.id && item.id === deviceId) ?? pin);
    });
  }, [copy.unassigned, deviceId, fleet, opsFilter, selectedIds]);

  useEffect(() => {
    if (!sections.live || !fleetVehicles || fleetVehicles.length < 2) return;
    let stopped = false;
    let running = false;
    let timer = 0;
    let controller: AbortController | null = null;
    async function pull() {
      if (stopped || document.hidden || running) return;
      running = true;
      controller = new AbortController();
      try {
        const response = await fetch(fleetUrl, { cache: "no-store", signal: controller.signal });
        if (stopped || response.status === 401) {
          if (response.status === 401) stopped = true;
          return;
        }
        if (!response.ok) return;
        const next = readGpsFleet(await response.json());
        if (!next) return;
        setClock(Date.now());
        setFleet((current) => mergeGpsFleetIdentity(current ?? fleetVehicles, next));
        adoptVisibleFleet(next);
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
  }, [copy.unassigned, deviceId, fleetUrl, fleetVehicles, opsFilter, sections.live]);

  function chooseVehicle(id: string) {
    onVehicleSelect?.(id);
    setActiveId(id);
    if (!fleet || fleet.length <= 1 || !listPath || id === selectedVehicleId) return;
    setPendingVehicleId(id);
    const params = new URLSearchParams(rangeSearch);
    params.set("vehicle", id);
    router.replace(`${listPath}?${params.toString()}`, { scroll: false });
  }

  const rawSelected = fleet?.find((vehicle) => vehicle.id === (activeId || selectedVehicleId || deviceId)) ?? null;
  const selectionHidden = Boolean(opsFilter && rawSelected && !selectedIds.has(rawSelected.id));
  const selectedFleet = selectionHidden ? null : rawSelected;
  const picking = selectionHidden || awaitingPick || Boolean(fleet && fleet.length > 1 && !(activeId || selectedVehicleId));
  const shownMotion = selectedFleet
    ? gpsMotionView(motionFixes(selectedFleet.recent, selectedFleet), clock)
    : null;
  const shownPoint = selectedFleet
    ? (shownMotion
      ? { latitude: shownMotion.latitude, longitude: shownMotion.longitude }
      : (selectedFleet.latitude !== null && selectedFleet.longitude !== null
        ? { latitude: selectedFleet.latitude, longitude: selectedFleet.longitude }
        : null))
    : live;
  const shownPlate = selectedFleet ? selectedFleet.plate : plate;
  const shownTime = selectedFleet?.recordedAt ?? snapshot.recordedAt;
  const shownSpeed = selectedFleet?.source === "mobile"
    ? mobileDisplaySpeedMps({ motion: shownMotion?.kind ?? "unknown", speedMps: selectedFleet.speedMps })
    : selectedFleet
      ? (shownMotion?.liveSpeedMps ?? selectedFleet.speedMps)
      : liveSpeed;
  const shownReceived = selectedFleet?.receivedAt ?? selectedFleet?.lastHeartbeatAt ?? snapshot.lastHeartbeatAt;
  const shownMarker = selectedFleet
    ? mapMarkerState({
      manufacturer: selectedFleet.manufacturer,
      source: selectedFleet.source,
      receivedAt: shownReceived,
      nowMs: clock,
      motion: shownMotion?.kind ?? "unknown",
      din1: selectedFleet.din1State,
      speedMps: selectedFleet.speedMps,
    })
    : markerState;
  const shownSignal = markerCurrent(shownMarker, selectedFleet ? gpsPresence(shownReceived, new Date(clock)) : presence);
  const historyVehicleId = history?.mode === "mobile" ? history.vehicleId : history?.deviceId ?? null;
  const historyStale = !selectionHidden && Boolean(selectedFleet && history && historyVehicleId !== selectedFleet.id);
  const deviceLoading = Boolean(pendingVehicleId && pendingVehicleId !== deviceId);
  const historyNotice = selectionHidden || (fleetVehicles && !gpsFleetHistoryReady(fleetVehicles.length, selectedVehicleId))
    ? copy.historyPick
    : historyBlocked;

  return (
    <>
      {showDeviceList ? (
        <header className="gps-head">
          <a href={listPath}>{copy.back}</a>
        </header>
      ) : null}
      {deviceControls ? (
        <div className="gps-tabs" role="tablist" aria-label={copy.title}>
          <button type="button" role="tab" aria-selected={visibleTab === "gps"} onClick={() => setTab("gps")}>{copy.tabGps}</button>
          <button type="button" role="tab" aria-selected={visibleTab === "wifi"} onClick={() => setTab("wifi")}>{copy.tabWifi}</button>
          <button type="button" role="tab" aria-selected={visibleTab === "camera"} onClick={() => setTab("camera")}>{copy.tabCamera}</button>
        </div>
      ) : null}
      <div className="gps-stack" hidden={visibleTab !== "gps"}>
      {opsFilter ? (
        <OpsFleetFilter
          copy={copy}
          vehicles={opsFleetChoices(fleet ?? [], copy.stock)}
          selected={selectedIds}
          onChange={setSelectedIds}
        />
      ) : null}
      {sections.live ? <section className="gps-section">
        <h2>{copy.live}</h2>
        {surface === "partner" ? (
          <GpsVehicleIdentity
            plate={picking ? null : selectedFleet?.plate ?? null}
            brand={picking ? null : selectedFleet?.brand}
            model={picking ? null : selectedFleet?.model}
            empty={picking ? copy.mapPick : null}
          />
        ) : null}
        <fieldset className="gps-map-settings">
          <legend>{copy.mapSettings}</legend>
          <label><input type="checkbox" checked disabled /> {copy.plate}</label>
          <label>
            <input type="checkbox" checked={prefs.driver} onChange={(event) => changePrefs({ ...prefs, driver: event.target.checked })} />
            {copy.driverName}
          </label>
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
        <fieldset className="gps-map-settings">
          <legend>{copy.mapOverlay}</legend>
          <label>
            <input type="checkbox" checked={labels.plate} onChange={(event) => changeLabels({ ...labels, plate: event.target.checked })} />
            {copy.plate}
          </label>
          <label>
            <input type="checkbox" checked={labels.driver} onChange={(event) => changeLabels({ ...labels, driver: event.target.checked })} />
            {copy.driverName}
          </label>
        </fieldset>
        <GpsLiveMap
          vehicleId={deviceId}
          live={fleetVehicles ? null : live}
          track={[]}
          active={visibleTab === "gps" && panelVisible}
          prefs={prefs}
          labels={labels}
          addressPending={copy.addressPending}
          pins={pins}
          selectedVehicleId={selectionHidden ? null : (activeId ?? selectedVehicleId)}
          onVehicleSelect={fleet ? chooseVehicle : onVehicleSelect}
          marker={live ? {
            latitude: live.latitude,
            longitude: live.longitude,
            plate: gpsMarkerIdentity({ plate, deviceCode, source: selectedFleet?.source, fallback: copy.unassigned }),
            driver: selectedFleet?.driverName ?? null,
            speed: gpsPopupSpeed(selectedFleet?.source === "mobile" ? mobileSpeed : liveSpeed),
            clock: gpsPopupClock(snapshot.recordedAt),
            coordinates: `${live.latitude.toFixed(6)}, ${live.longitude.toFixed(6)}`,
            headingDeg: snapshot.headingDeg,
            state: markerState,
          } : null}
        />
        {!picking && shownPoint && googleMapsUrl(shownPoint.latitude, shownPoint.longitude) && yandexMapsUrl(shownPoint.latitude, shownPoint.longitude) ? (
          <div className="gps-nav-links">
            <a href={googleMapsUrl(shownPoint.latitude, shownPoint.longitude) ?? undefined} target="_blank" rel="noreferrer">{copy.google}</a>
            <a href={yandexMapsUrl(shownPoint.latitude, shownPoint.longitude) ?? undefined} target="_blank" rel="noreferrer">{copy.yandex}</a>
          </div>
        ) : picking ? null : <p>{copy.noFix}</p>}
        <dl className="gps-facts">
          {!picking && selectedFleet?.source !== "mobile" ? <div><dt>{copy.partner}</dt><dd>{selectedFleet?.partnerName || "—"}</dd></div> : selectedFleet?.partnerName ? <div><dt>{copy.partner}</dt><dd>{selectedFleet.partnerName}</dd></div> : null}
          <div><dt>{copy.positionSource}</dt><dd>{picking ? "—" : selectedFleet?.source === "mobile" ? copy.sourceMobile : copy.sourceTracker}</dd></div>
          <div><dt>{copy.driverName}</dt><dd>{picking ? "—" : selectedFleet?.driverName || "—"}</dd></div>
          <div className={picking ? "gps-fleet-pick" : undefined}><dt>{copy.plate}</dt><dd>{picking ? copy.fleetPick : (shownPlate?.trim() || "—")}</dd></div>
          {!picking && !shownPlate?.trim() ? <div><dt>{copy.deviceId}</dt><dd>{selectedFleet?.deviceCode || deviceCode || "—"}</dd></div> : null}
          <div><dt>{selectedFleet?.source === "mobile" ? copy.mobileClock : copy.gnssTime}</dt><dd>{picking ? "—" : gpsClock(shownTime)}</dd></div>
          {selectedFleet?.source === "mobile" ? <div><dt>{copy.accuracy}</dt><dd>{selectedFleet.accuracyM == null ? "—" : `${Math.round(selectedFleet.accuracyM)} m`}</dd></div> : null}
          <div><dt>{copy.speed}</dt><dd>{picking ? "—" : selectedFleet?.source === "mobile" ? gpsSpeedKmSa(shownSpeed) : gpsSpeed(shownSpeed)}</dd></div>
          {selectedFleet?.source === "mobile" ? (
            <div><dt>{copy.mobileConnection}</dt><dd>{picking ? "—" : shownSignal ? copy.mobileConnected : copy.signalLost}</dd></div>
          ) : (
            <div><dt>{copy.gpsFix}</dt><dd>{picking ? "—" : shownSignal ? ((selectedFleet?.id === deviceId ? snapshot.gnssFix : selectedFleet?.gnssFix) ? copy.fixYes : copy.fixNo) : copy.signalLost}</dd></div>
          )}
          {selectedFleet?.source === "mobile" ? null : <div><dt>{copy.satellites}</dt><dd>{picking ? "—" : (selectedFleet?.id === deviceId ? snapshot.satellites : selectedFleet?.satellites) ?? copy.unavailable}</dd></div>}
          <div><dt>{shownSignal ? copy.live : copy.fleetLastKnown}</dt><dd>{picking ? "—" : shownPoint ? `${shownPoint.latitude.toFixed(6)}, ${shownPoint.longitude.toFixed(6)}` : copy.unavailable}</dd></div>
        </dl>
      </section> : null}
      {sections.history ? <GpsSectionToggle key={activeId ?? selectedVehicleId ?? "fleet"} showLabel={copy.showHistory} hideLabel={copy.hideHistory} rememberKey={deviceId && !picking ? `gps-history:${activeId ?? deviceId}` : undefined} historyQuery={historyQuery} blockedMessage={historyStale ? copy.deviceLoading : historyNotice}>
        {history && !historyStale && !selectionHidden ? (
          <GpsPositionHistory
            copy={copy}
            history={history}
            locale={locale}
            drive={drive}
            identity={surface === "partner" && !picking && selectedFleet ? { plate: selectedFleet.plate, brand: selectedFleet.brand ?? null, model: selectedFleet.model ?? null } : null}
          />
        ) : null}
      </GpsSectionToggle> : null}
      {sections.history && selectedFleet?.source === "mobile" && activeId && !historyStale ? (
        <GpsShareHistory
          copy={copy}
          action={listPath}
          vehicleId={activeId}
          events={shareEvents}
          preset={sharePreset}
          fromLocal={shareFromLocal}
          toLocal={shareToLocal}
        />
      ) : null}
      {sections.maintenance && surface === "partner" && (picking || selectedFleet?.vehicleId) ? (
        <GpsSectionToggle showLabel={copy.showMaintenance} hideLabel={copy.hideMaintenance} blockedMessage={picking || !selectedFleet?.vehicleId ? copy.maintenancePick : undefined}>
          {selectedFleet?.vehicleId && !picking ? (
            <>
              <h2>{copy.maintenanceTitle}</h2>
              <GpsVehicleIdentity plate={selectedFleet.plate} brand={selectedFleet.brand} model={selectedFleet.model} />
              <GpsMaintenancePanel key={selectedFleet.vehicleId} vehicleId={selectedFleet.vehicleId} copy={copy} locale={locale} maintenanceUrl={maintenanceUrl} portalActor={maintenanceUrl ? "driver" : "partner"} />
            </>
          ) : null}
        </GpsSectionToggle>
      ) : null}
      {sections.drive && surface === "partner" && (picking || selectedFleet?.vehicleId) ? (
        <GpsSectionToggle showLabel={copy.showDrive} hideLabel={copy.hideDrive} rememberKey={!picking && selectedFleet?.vehicleId ? `gps-drive:${selectedFleet.vehicleId}` : undefined} historyQuery={historyQuery} blockedMessage={picking || !selectedFleet?.vehicleId ? copy.drivePick : undefined}>
          {historyStale ? <p>{copy.deviceLoading}</p> : drive && driveVehicle && selectedFleet?.vehicleId && !picking && history ? (
            <GpsDriveReport
              key={`${selectedFleet.vehicleId}:${history.fromIso}:${history.toIso}`}
              copy={copy}
              locale={locale}
              report={drive}
              historyPath={history.historyPath}
              vehicleId={history.mode === "mobile" ? history.vehicleId : history.deviceId}
              fromLocal={history.fromLocal}
              toLocal={history.toLocal}
              includeVehicle={history.mode === "device" ? history.includeVehicle : Boolean(fleet && fleet.length > 1)}
              formatSpeed={history.mode === "mobile" ? gpsSpeedKmSa : gpsSpeed}
              vehicle={driveVehicle}
              green={green}
            />
          ) : null}
        </GpsSectionToggle>
      ) : null}
      {sections.device && selectedFleet?.source !== "mobile" ? (
      <GpsSectionToggle showLabel={copy.showDevice} hideLabel={copy.hideDevice} blockedMessage={picking ? copy.devicePick : undefined}>
        <div className="gps-device-head">
          <h2>{copy.deviceInfo}</h2>
          {surface === "partner" ? null : (
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
          )}
        </div>
        {surface === "partner" && !picking && selectedFleet ? <GpsVehicleIdentity plate={selectedFleet.plate} brand={selectedFleet.brand} model={selectedFleet.model} /> : null}
        {surface === "partner" ? (
          <dl className="gps-facts gps-partner-device-facts">
            <div><dt>{copy.partnerDeviceId}</dt><dd>{deviceLoading ? "—" : deviceCode}</dd></div>
            <div><dt>{copy.partnerSimOperator}</dt><dd>{deviceLoading ? "—" : (simOperator ?? "—")}</dd></div>
            <div><dt>{copy.partnerMinistryCompany}</dt><dd>{deviceLoading ? "—" : (company ?? "—")}</dd></div>
            <div><dt>{copy.partnerDeviceStatus}</dt><dd>{deviceLoading ? "—" : (status === "active" ? copy.active : copy.partnerStatusPassive)}</dd></div>
            <div><dt>{copy.partnerLastConnection}</dt><dd>{deviceLoading ? "—" : gpsClock(snapshot.lastHeartbeatAt)}</dd></div>
          </dl>
        ) : deviceLoading ? <p className="gps-inline-note">{copy.deviceLoading}</p> : (
          <dl className="gps-facts">
            <div><dt>{copy.deviceId}</dt><dd>{deviceCode}</dd></div>
            {selectedFleet?.id === deviceId && selectedFleet.manufacturer ? <div><dt>{copy.manufacturer}</dt><dd>{selectedFleet.manufacturer === "teltonika" ? copy.receiverTeltonika : copy.receiverEsp32}</dd></div> : null}
            {selectedFleet?.id === deviceId && selectedFleet.trackerModel ? <div><dt>{copy.trackerModel}</dt><dd>{selectedFleet.trackerModel.toUpperCase()}</dd></div> : null}
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
        {!deviceLoading && immobilizer ? (
          <GpsImmobilizerSwitch
            copy={copy}
            deviceId={immobilizer.deviceId}
            surface={surface}
            request={immobilizer.request}
            output={immobilizer.output}
            phase={immobilizer.phase}
            commandAt={immobilizer.commandAt}
            lastHeartbeatAt={immobilizer.lastHeartbeatAt}
            readiness={immobilizer.readiness}
            starterCircuitVerified={immobilizer.starterCircuitVerified}
          />
        ) : null}
        {!deviceLoading && ats ? <GpsAtsPanel copy={copy} panel={ats} canControl={canControlAts} /> : null}
      </GpsSectionToggle>
      ) : null}
      {surface === "ops" && !picking && !selectionHidden && (!fleet || (selectedFleet?.source !== "mobile" && selectedFleet?.id === deviceId)) ? (
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
            {deviceControls ? (
              <>
                <Tech copy={copy} label={copy.wifiPolicy} value={snapshot.wifiPolicy ?? wifiMode} />
                <Tech copy={copy} label={copy.apStatus} value={snapshot.apStatus} />
                <Tech copy={copy} label={copy.clients} value={snapshot.wifiClients === null ? null : String(snapshot.wifiClients)} />
                <Tech copy={copy} label={copy.maxClients} value={snapshot.reportedMaxClients === null ? null : String(snapshot.reportedMaxClients)} />
              </>
            ) : null}
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
      {deviceControls && visibleTab === "wifi" ? <div>
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
          {wifiDevice ? <GpsWifiPanel copy={copy} device={wifiDevice} /> : wifi}
        </section>
      </div> : null}
      {deviceControls && visibleTab === "camera" ? (
        <div>
          {cameraDevice ? (
            <GpsCameraLive
              copy={copy}
              deviceId={cameraDevice.deviceId}
              surface={cameraDevice.surface}
              initialLowBatteryState={cameraDevice.lowBatteryState}
              initialBatteryPercent={cameraDevice.batteryPercent}
              initialPhase={cameraIdlePhase({
                presence: gpsPresence(cameraDevice.lastHeartbeatAt, new Date(clock)),
                cameraAvailable: cameraDevice.cameraAvailable,
                cameraReady: cameraDevice.cameraReady,
              })}
            />
          ) : camera}
        </div>
      ) : null}
    </>
  );
}

function motionFixes(
  recent: GpsRecentFix[] | undefined,
  fallback: { recordedAt: string | null; latitude: number | null; longitude: number | null; speedMps: number | null },
): GpsMotionFix[] {
  if (recent && recent.length > 0) {
    return recent.map((fix) => ({
      at: fix.at,
      latitude: fix.latitude,
      longitude: fix.longitude,
      speedMps: fix.speedMps,
    }));
  }
  const at = fallback.recordedAt ? Date.parse(fallback.recordedAt) : Number.NaN;
  if (!Number.isFinite(at) || fallback.latitude === null || fallback.longitude === null) return [];
  return [{
    at,
    latitude: fallback.latitude,
    longitude: fallback.longitude,
    speedMps: fallback.speedMps,
  }];
}

function markerCurrent(state: string, presence: string) {
  return state === "moving"
    || state === "stopped"
    || state === "unknown"
    || state === "din-moving"
    || state === "din-stopped"
    || state === "din-off"
    || state === "din-pending"
    || (state === "still" && presence === "online");
}

function mapMarkerState(input: {
  manufacturer?: "esp32" | "teltonika" | null;
  source?: "device" | "mobile";
  receivedAt: string | null;
  nowMs: number;
  motion: "moving" | "stopped" | "still" | "unknown";
  din1?: "on" | "off" | null;
  speedMps?: number | null;
}) {
  if (input.manufacturer === "teltonika" && input.source !== "mobile") {
    return teltonikaMarkerState({
      receivedAt: input.receivedAt,
      nowMs: input.nowMs,
      din1: input.din1 ?? null,
      speedMps: input.speedMps ?? null,
    });
  }
  return gpsMapMarkerState({
    receivedAt: input.receivedAt,
    nowMs: input.nowMs,
    motion: input.motion,
  });
}

function fleetPinsFrom(vehicles: GpsFleetVehicle[] | undefined, unassigned: string) {
  if (!vehicles) return undefined;
  const now = new Date();
  const pins: GpsFleetMapPin[] = [];
  for (const vehicle of vehicles) {
    const pin = fleetPin(vehicle, unassigned, now);
    if (pin) pins.push(pin);
  }
  return pins;
}

function fleetPin(vehicle: GpsFleetVehicle, unassigned: string, now: Date): GpsFleetMapPin | null {
  const view = gpsMotionView(motionFixes(vehicle.recent, vehicle), now.getTime());
  const stored = gpsFleetPoint(vehicle.latitude, vehicle.longitude);
  const point = view
    ? { latitude: view.latitude, longitude: view.longitude }
    : stored;
  if (!point) return null;
  const presence = gpsPresence(vehicle.lastHeartbeatAt, now);
  return {
    id: vehicle.id,
    markerKey: gpsFleetItemKey(vehicle),
    latitude: point.latitude,
    longitude: point.longitude,
    marker: {
      latitude: point.latitude,
      longitude: point.longitude,
      plate: gpsMarkerIdentity({
        plate: vehicle.plate,
        deviceCode: vehicle.deviceCode,
        source: vehicle.source,
        fallback: unassigned,
      }),
      driver: vehicle.driverName,
      speed: gpsPopupSpeed(vehicle.source === "mobile"
        ? mobileDisplaySpeedMps({ motion: view?.kind ?? "unknown", speedMps: vehicle.speedMps })
        : view?.liveSpeedMps ?? null),
      clock: gpsPopupClock(vehicle.recordedAt),
      coordinates: `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`,
      headingDeg: vehicle.headingDeg,
      state: mapMarkerState({
        manufacturer: vehicle.manufacturer,
        source: vehicle.source,
        receivedAt: vehicle.receivedAt ?? vehicle.lastHeartbeatAt,
        nowMs: now.getTime(),
        motion: view?.kind ?? "unknown",
        din1: vehicle.din1State,
        speedMps: vehicle.speedMps,
      }),
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
