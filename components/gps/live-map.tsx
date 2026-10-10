"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { gpsAddressCell } from "@/lib/gps/address-format";
import { GPS_FLEET_FOLLOW_ZOOM, GPS_FLEET_GLIDE_MS, gpsFleetFrame, gpsFleetIdsChanged, gpsFleetMarkerClick, gpsFleetPadding, gpsFleetStoredMarker } from "@/lib/gps/fleet";
import { gpsApplyVehicleFix, gpsSelectVehicle, type GpsFollowView } from "@/lib/gps/follow";
import { gpsPopupRows, type GpsMarkerState, type GpsPopupPrefs } from "@/lib/gps/map-popup";

type GpsMapPoint = { latitude: number; longitude: number };

const GLIDE_MS = 800;

export type GpsVehicleMarker = GpsMapPoint & {
  plate: string;
  speed: string | null;
  clock: string | null;
  coordinates: string | null;
  headingDeg: number | null;
  state: GpsMarkerState;
};

export type GpsFleetMapPin = {
  id: string;
  markerKey?: string;
  latitude: number;
  longitude: number;
  marker: GpsVehicleMarker;
};

export function GpsLiveMap({
  vehicleId,
  live,
  track,
  marker,
  prefs,
  addressPending = "Adres aranıyor…",
  active = true,
  pins,
  selectedVehicleId = null,
  onVehicleSelect,
}: {
  vehicleId: string;
  live: GpsMapPoint | null;
  track: GpsMapPoint[];
  marker?: GpsVehicleMarker | null;
  prefs?: GpsPopupPrefs;
  addressPending?: string;
  active?: boolean;
  pins?: GpsFleetMapPin[];
  selectedVehicleId?: string | null;
  onVehicleSelect?: (id: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const popupNode = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(0);
  const framedRef = useRef(false);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const addressAbort = useRef<AbortController | null>(null);
  const addressLine = useRef("");
  const requestedCell = useRef("");
  const resolvedCell = useRef("");
  const loadAddressRef = useRef<() => void>(() => {});
  const pendingText = useRef(addressPending);
  pendingText.current = addressPending;
  const modelRef = useRef({ marker, prefs });
  const pinsRef = useRef(pins);
  const onSelectRef = useRef(onVehicleSelect);
  const selectedFleetRef = useRef<string | null>(selectedVehicleId);
  const followHeldRef = useRef(false);
  const movingMapRef = useRef(false);
  const fleetMarkers = useRef(new Map<string, LeafletMarker>());
  const fleetPopups = useRef(new Map<string, HTMLDivElement>());
  const fleetFrames = useRef(new Map<string, number>());
  const fleetPlaced = useRef(new Map<string, string>());
  const fittedIds = useRef<string[] | null>(null);
  const addressPin = useRef("");
  pinsRef.current = pins;
  onSelectRef.current = onVehicleSelect;
  const selectedIdRef = useRef<string | null>(null);
  const vehiclePropRef = useRef(vehicleId);
  if (vehiclePropRef.current !== vehicleId) {
    vehiclePropRef.current = vehicleId;
    selectedIdRef.current = vehicleId;
  } else if (selectedIdRef.current === null) {
    selectedIdRef.current = vehicleId;
  }
  const [mapEpoch, setMapEpoch] = useState(0);
  const trackKey = JSON.stringify(track);
  const selectedPin = pins?.find((pin) => pin.id === selectedVehicleId) ?? null;
  const liveLatitude = live?.latitude ?? selectedPin?.latitude ?? null;
  const liveLongitude = live?.longitude ?? selectedPin?.longitude ?? null;
  const addressCell = liveLatitude !== null && liveLongitude !== null
    ? gpsAddressCell(liveLatitude, liveLongitude)
    : "";
  modelRef.current = { marker, prefs };

  function paint() {
    const pin = markerRef.current;
    const leaflet = leafletRef.current;
    const current = modelRef.current.marker;
    const currentPrefs = modelRef.current.prefs;
    const node = popupNode.current;
    if (!pin || !leaflet || !current || !currentPrefs || !node) {
      return;
    }
    pin.setIcon(vehicleIcon(leaflet, current.state));
    fillPopup(node, current, currentPrefs, addressLine.current);
  }

  loadAddressRef.current = () => {
    const currentPrefs = modelRef.current.prefs;
    const pin = markerRef.current;
    if (!currentPrefs?.address || !pin || !pin.isPopupOpen()) {
      return;
    }
    const here = pin.getLatLng();
    const cell = gpsAddressCell(here.lat, here.lng);
    if (resolvedCell.current === cell || requestedCell.current === cell) {
      return;
    }
    requestedCell.current = cell;
    addressAbort.current?.abort();
    const controller = new AbortController();
    addressAbort.current = controller;
    addressLine.current = pendingText.current;
    paint();
    void (async () => {
      try {
        const response = await fetch(
          `/api/gps/address?lat=${encodeURIComponent(here.lat)}&lon=${encodeURIComponent(here.lng)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = response.ok ? await response.json() as { address?: unknown } : null;
        const resolved = body && typeof body.address === "string" ? body.address.trim() : "";
        if (controller.signal.aborted) {
          return;
        }
        addressLine.current = resolved;
        if (resolved) {
          resolvedCell.current = cell;
        } else {
          requestedCell.current = "";
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        requestedCell.current = "";
        addressLine.current = "";
      }
      paint();
    })();
  };

  useEffect(() => {
    const node = host.current;
    if (!node) {
      return;
    }
    let cancelled = false;
    framedRef.current = false;
    void (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default ?? leaflet;
      if (cancelled) {
        return;
      }
      leafletRef.current = L;
      const created = L.map(node, { zoomControl: true });
      mapRef.current = created;
      created.on("dragstart", () => {
        followHeldRef.current = true;
      });
      created.on("zoomstart", () => {
        if (!movingMapRef.current) followHeldRef.current = true;
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(created);
      const points = JSON.parse(trackKey) as GpsMapPoint[];
      const bounds: [number, number][] = [];
      if (points.length > 1) {
        L.polyline(points.map((point) => [point.latitude, point.longitude] as [number, number]), {
          color: "#1d4ed8",
          weight: 4,
        }).addTo(created);
      }
      points.forEach((point, index) => {
        const role = index === 0 ? "start" : index === points.length - 1 ? "end" : "point";
        const color = role === "start" ? "#15803d" : role === "end" ? "#b91c1c" : "#64748b";
        L.circleMarker([point.latitude, point.longitude], {
          radius: role === "point" ? 4 : 8,
          color,
          fillColor: color,
          fillOpacity: 0.95,
          weight: 2,
        }).addTo(created);
        bounds.push([point.latitude, point.longitude]);
      });
      holdMapMove(() => {
        if (bounds.length === 0) {
          if (!pinsRef.current?.length) created.setView([41.015, 28.979], 10);
        } else if (bounds.length === 1) {
          created.setView(bounds[0], 15);
        } else {
          created.fitBounds(bounds, { padding: [24, 24] });
        }
      });
      window.setTimeout(() => {
        if (cancelled || mapRef.current !== created) return;
        holdMapMove(() => created.invalidateSize());
      }, 0);
      if (!cancelled) {
        setMapEpoch((value) => value + 1);
      }
    })();
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frameRef.current);
      for (const frame of fleetFrames.current.values()) window.cancelAnimationFrame(frame);
      addressAbort.current?.abort();
      markerRef.current?.remove();
      markerRef.current = null;
      popupNode.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, [trackKey]);

  useEffect(() => {
    selectedFleetRef.current = selectedVehicleId;
  }, [selectedVehicleId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || pinsRef.current || liveLatitude === null || liveLongitude === null) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const imported = await import("leaflet");
      const leaflet = leafletRef.current ?? imported.default ?? imported;
      if (cancelled || mapRef.current !== map) {
        return;
      }
      leafletRef.current = leaflet;
      const next: [number, number] = [liveLatitude, liveLongitude];
      const existing = markerRef.current;
      if (!existing) {
        const pin = leaflet.marker(next, {
          icon: vehicleIcon(leaflet, modelRef.current.marker?.state ?? "idle"),
          autoPanOnFocus: false,
        }).addTo(map);
        const node = document.createElement("div");
        node.className = "gps-popup";
        popupNode.current = node;
        pin.bindPopup(node, { autoPan: false, keepInView: false });
        pin.on("popupopen", () => loadAddressRef.current());
        pin.on("popupclose", () => addressAbort.current?.abort());
        pin.on("click", () => {
          const here = pin.getLatLng();
          const next = gpsSelectVehicle({
            id: vehicleId,
            latitude: here.lat,
            longitude: here.lng,
          }, map.getZoom());
          selectedIdRef.current = next.selectedId;
          followHeldRef.current = false;
          centerOn(map, next);
        });
        markerRef.current = pin;
        paint();
        if (!framedRef.current && trackKey === "[]") {
          holdMapMove(() => map.setView(next, 15));
        }
        framedRef.current = true;
        centerOn(map, gpsApplyVehicleFix(currentView(map, selectedIdRef.current), {
          id: vehicleId,
          latitude: next[0],
          longitude: next[1],
        }));
        return;
      }
      glide(existing, next, frameRef, (latitude, longitude) => {
        const current = currentView(map, selectedIdRef.current);
        const nextView = gpsApplyVehicleFix(current, {
          id: vehicleId,
          latitude,
          longitude,
        });
        if (nextView !== current) {
          centerOn(map, nextView);
        }
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [liveLatitude, liveLongitude, mapEpoch, trackKey, vehicleId]);

  useEffect(() => {
    paint();
  }, [
    marker?.state,
    marker?.headingDeg,
    marker?.plate,
    marker?.speed,
    marker?.clock,
    marker?.coordinates,
    prefs?.speed,
    prefs?.clock,
    prefs?.coordinates,
    prefs?.address,
    mapEpoch,
  ]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    holdMapMove(() => map.invalidateSize());
  }, [active, mapEpoch]);

  useEffect(() => {
    if (!prefs?.address) {
      addressAbort.current?.abort();
      addressLine.current = "";
      requestedCell.current = "";
      resolvedCell.current = "";
      paint();
      return;
    }
    if (pinsRef.current && selectedFleetRef.current) {
      loadFleetAddress(selectedFleetRef.current);
      return;
    }
    loadAddressRef.current();
  }, [prefs?.address, addressCell]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !pins) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const imported = await import("leaflet");
      const leaflet = leafletRef.current ?? imported.default ?? imported;
      if (cancelled || mapRef.current !== map) {
        return;
      }
      leafletRef.current = leaflet;
      const alive = new Set(pins.map((pin) => pin.markerKey ?? pin.id));
      for (const [id, pin] of fleetMarkers.current) {
        if (alive.has(id)) continue;
        window.cancelAnimationFrame(fleetFrames.current.get(id) ?? 0);
        fleetFrames.current.delete(id);
        fleetPlaced.current.delete(id);
        pin.remove();
        fleetMarkers.current.delete(id);
        fleetPopups.current.delete(id);
      }
      for (const pin of pins) {
        const currentPrefs = modelRef.current.prefs;
        const markerKey = pin.markerKey ?? pin.id;
        let marker = fleetMarkers.current.get(markerKey);
        if (!marker) {
          marker = leaflet.marker([pin.latitude, pin.longitude], {
            icon: vehicleIcon(leaflet, pin.marker.state),
            autoPanOnFocus: false,
            zIndexOffset: pin.id === selectedFleetRef.current ? 1000 : 0,
          }).addTo(map);
          const node = document.createElement("div");
          node.className = "gps-popup";
          fleetPopups.current.set(pin.id, node);
          marker.bindPopup(node, { autoPan: false, keepInView: false });
          marker.off("click");
          marker.on("popupopen", () => {
            if (pin.id !== selectedFleetRef.current) return;
            loadAddressRef.current = () => loadFleetAddress(pin.id);
            loadFleetAddress(pin.id);
          });
          marker.on("click", (event) => {
            if (event.originalEvent) leaflet.DomEvent.stop(event.originalEvent);
            const previous = selectedFleetRef.current;
            const decision = gpsFleetMarkerClick({
              selectedId: previous,
              popupId: marker!.isPopupOpen() ? pin.id : null,
            }, pin.id);
            selectedFleetRef.current = decision.selectedId;
            for (const [id, other] of fleetMarkers.current) {
              if (id !== pin.id && other.isPopupOpen()) other.closePopup();
            }
            if (decision.popupId === pin.id) marker!.openPopup();
            else marker!.closePopup();
            const here = marker!.getLatLng();
            const next = gpsSelectVehicle({
              id: pin.id,
              latitude: here.lat,
              longitude: here.lng,
            }, previous === pin.id ? map.getZoom() : GPS_FLEET_FOLLOW_ZOOM);
            if (previous !== pin.id) onSelectRef.current?.(pin.id);
            followHeldRef.current = false;
            centerOn(map, next);
          });
          fleetMarkers.current.set(markerKey, marker);
          fleetPlaced.current.set(markerKey, fleetPlaceKey(pin));
          if (pin.id === selectedFleetRef.current) {
            holdMapMove(() => map.setView([pin.latitude, pin.longitude], GPS_FLEET_FOLLOW_ZOOM, { animate: false }));
          }
        } else {
          marker.setIcon(vehicleIcon(leaflet, pin.marker.state));
          marker.setZIndexOffset(pin.id === selectedFleetRef.current ? 1000 : 0);
          const nextKey = fleetPlaceKey(pin);
          if (fleetPlaced.current.get(markerKey) !== nextKey) {
            fleetPlaced.current.set(markerKey, nextKey);
            if (pin.id === selectedFleetRef.current) {
              glideFleet(marker, [pin.latitude, pin.longitude], pin.id, (latitude, longitude) => {
                const current = currentView(map, selectedFleetRef.current);
                const nextView = gpsApplyVehicleFix(current, { id: pin.id, latitude, longitude });
                if (nextView !== current) centerOn(map, nextView);
              });
            } else {
              window.cancelAnimationFrame(fleetFrames.current.get(pin.id) ?? 0);
              marker.setLatLng([pin.latitude, pin.longitude]);
            }
          }
        }
        const node = fleetPopups.current.get(pin.id);
        if (node && currentPrefs) fillPopup(node, pin.marker, currentPrefs, pin.id === addressPin.current ? addressLine.current : "");
      }
      const ids = pins.map((pin) => pin.id);
      if (!selectedFleetRef.current && (fittedIds.current === null || gpsFleetIdsChanged(fittedIds.current, ids))) {
        holdMapMove(() => fitFleet(map, pins));
        fittedIds.current = ids;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mapEpoch, pins, prefs, selectedVehicleId]);

  return <div ref={host} className="gps-map" />;

  function centerOn(map: LeafletMap, view: GpsFollowView) {
    if (followHeldRef.current) return;
    holdMapMove(() => focusSelected(map, view));
  }

  function holdMapMove(run: () => void) {
    movingMapRef.current = true;
    run();
    window.requestAnimationFrame(() => {
      movingMapRef.current = false;
    });
  }

  function loadFleetAddress(pinId: string) {
    const currentPrefs = modelRef.current.prefs;
    const model = pinsRef.current?.find((item) => item.id === pinId);
    const pin = gpsFleetStoredMarker(fleetMarkers.current, pinId, model?.markerKey);
    if (!currentPrefs?.address || !pin || !pin.isPopupOpen()) return;
    const here = pin.getLatLng();
    const cell = gpsAddressCell(here.lat, here.lng);
    if (resolvedCell.current === cell || requestedCell.current === cell) return;
    requestedCell.current = cell;
    addressPin.current = pinId;
    addressAbort.current?.abort();
    const controller = new AbortController();
    addressAbort.current = controller;
    addressLine.current = pendingText.current;
    const node = fleetPopups.current.get(pinId);
    const source = pinsRef.current?.find((item) => item.id === pinId)?.marker;
    if (node && source) fillPopup(node, source, currentPrefs, addressLine.current);
    void (async () => {
      try {
        const response = await fetch(
          `/api/gps/address?lat=${encodeURIComponent(here.lat)}&lon=${encodeURIComponent(here.lng)}`,
          { cache: "no-store", signal: controller.signal },
        );
        const body = response.ok ? await response.json() as { address?: unknown } : null;
        const resolved = body && typeof body.address === "string" ? body.address.trim() : "";
        if (controller.signal.aborted) return;
        addressLine.current = resolved;
        if (resolved) resolvedCell.current = cell;
        else requestedCell.current = "";
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          if (requestedCell.current === cell) requestedCell.current = "";
          return;
        }
        requestedCell.current = "";
        addressLine.current = "";
      }
      const fresh = pinsRef.current?.find((item) => item.id === pinId)?.marker;
      const popup = fleetPopups.current.get(pinId);
      if (popup && fresh && modelRef.current.prefs) fillPopup(popup, fresh, modelRef.current.prefs, addressLine.current);
    })();
  }

  function glideFleet(
    marker: LeafletMarker,
    next: [number, number],
    id: string,
    onFrame: (latitude: number, longitude: number) => void,
  ) {
    const from = marker.getLatLng();
    const started = performance.now();
    window.cancelAnimationFrame(fleetFrames.current.get(id) ?? 0);
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / GPS_FLEET_GLIDE_MS);
      const eased = t * t * (3 - 2 * t);
      const latitude = from.lat + (next[0] - from.lat) * eased;
      const longitude = from.lng + (next[1] - from.lng) * eased;
      marker.setLatLng([latitude, longitude]);
      onFrame(latitude, longitude);
      if (t < 1) fleetFrames.current.set(id, window.requestAnimationFrame(step));
    };
    fleetFrames.current.set(id, window.requestAnimationFrame(step));
  }
}

function fleetPlaceKey(pin: GpsFleetMapPin) {
  return `${pin.latitude.toFixed(6)},${pin.longitude.toFixed(6)}`;
}

function fitFleet(map: LeafletMap, pins: readonly GpsFleetMapPin[]) {
  const frame = gpsFleetFrame(pins);
  if (frame.kind === "empty") return;
  if (frame.kind === "single") {
    map.setView([frame.point.latitude, frame.point.longitude], frame.zoom, { animate: false });
    return;
  }
  map.fitBounds(frame.points.map((point) => [point.latitude, point.longitude] as [number, number]), {
    padding: gpsFleetPadding(window.innerWidth),
    animate: false,
  });
}

export function vehicleIcon(
  leaflet: typeof import("leaflet"),
  state: GpsMarkerState,
  extraClass = "",
) {
  return leaflet.divIcon({
    className: extraClass ? `gps-status-wrap ${extraClass}` : "gps-status-wrap",
    html: `<div class="gps-status is-${state}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -26],
  });
}

function fillPopup(
  node: HTMLDivElement,
  marker: GpsVehicleMarker,
  prefs: GpsPopupPrefs,
  address: string,
) {
  node.replaceChildren();
  const rows = gpsPopupRows(prefs, {
    plate: marker.plate,
    speed: marker.speed,
    clock: marker.clock,
    coordinates: marker.coordinates,
    address,
  });
  rows.forEach((row, index) => {
    const line = document.createElement(index === 0 ? "strong" : "div");
    line.textContent = row;
    node.append(line);
  });
}

function currentView(map: LeafletMap, selectedId: string | null): GpsFollowView {
  const center = map.getCenter();
  return {
    selectedId,
    center: { id: selectedId ?? "", latitude: center.lat, longitude: center.lng },
    zoom: map.getZoom(),
  };
}

function focusSelected(map: LeafletMap, view: GpsFollowView) {
  if (!view.center || view.selectedId === null) {
    return;
  }
  map.setView([view.center.latitude, view.center.longitude], view.zoom, { animate: false });
}

function glide(
  marker: LeafletMarker,
  next: [number, number],
  frameRef: { current: number },
  onFrame: (latitude: number, longitude: number) => void,
) {
  const from = marker.getLatLng();
  const started = performance.now();
  window.cancelAnimationFrame(frameRef.current);
  const step = (now: number) => {
    const t = Math.min(1, (now - started) / GLIDE_MS);
    const eased = t * t * (3 - 2 * t);
    const latitude = from.lat + (next[0] - from.lat) * eased;
    const longitude = from.lng + (next[1] - from.lng) * eased;
    marker.setLatLng([latitude, longitude]);
    onFrame(latitude, longitude);
    if (t < 1) {
      frameRef.current = window.requestAnimationFrame(step);
    }
  };
  frameRef.current = window.requestAnimationFrame(step);
}
