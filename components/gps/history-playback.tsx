"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { vehicleIcon } from "@/components/gps/live-map";
import { gpsPlaybackClock, gpsSpeed } from "@/lib/gps/format";
import { type GpsCopy } from "@/lib/gps/copy";
import { gpsPlaybackMarkerState } from "@/lib/gps/map-popup";
import {
  GPS_PLAYBACK_RATES,
  advancePlaybackCursor,
  nextPlaybackAt,
  playbackFixes,
  playbackFrame,
  playbackGapLimit,
  playbackShownSample,
  playbackGapMinutes,
  playbackSegments,
  previousPlaybackAt,
  type GpsPlaybackFix,
  type GpsPlaybackPoint,
  type GpsPlaybackRate,
} from "@/lib/gps/playback";

const PLAYBACK_PANE = "gpsPlayback";

type PlaybackReadout = {
  time: string;
  date: string;
  speed: string;
  coord: string;
  gap: string;
};

function playbackReadout(fixes: GpsPlaybackFix[], at: number, gapLimit: number, gapTemplate: string): PlaybackReadout {
  const sample = playbackShownSample(fixes, at, gapLimit);
  const clock = gpsPlaybackClock(sample.latitude === null ? at : sample.at);
  const minutes = playbackGapMinutes(sample.gapMs);
  return {
    time: clock?.time ?? "",
    date: clock?.date ?? "",
    speed: sample.speedMps === null ? "" : gpsSpeed(sample.speedMps),
    coord: sample.latitude === null || sample.longitude === null
      ? ""
      : `${sample.latitude.toFixed(6)}, ${sample.longitude.toFixed(6)}`,
    gap: minutes === null ? "" : gapTemplate.replace("{n}", String(minutes)),
  };
}

export function GpsHistoryPlayback({
  deviceId,
  plate,
  points,
  fromIso,
  toIso,
  copy,
}: {
  deviceId: string;
  plate: string;
  points: GpsPlaybackPoint[];
  fromIso: string;
  toIso: string;
  copy: GpsCopy;
}) {
  const fixes = useMemo(() => playbackFixes(points), [points]);
  const gapLimit = useMemo(() => playbackGapLimit(fixes), [fixes]);
  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toIso);
  const start = Number.isFinite(fromMs) ? fromMs : fixes[0]?.at ?? 0;
  const end = Number.isFinite(toMs) && toMs > start ? toMs : fixes.at(-1)?.at ?? start;
  const [readout, setReadout] = useState(() => playbackReadout(fixes, start, gapLimit, copy.playbackGap));
  const readoutKeyRef = useRef("");
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const pointsRef = useRef<LayerGroup | null>(null);
  const leafletRef = useRef<typeof import("leaflet") | null>(null);
  const cursorRef = useRef(start);
  const playingRef = useRef(false);
  const rateRef = useRef<GpsPlaybackRate>(1);
  const seekingRef = useRef(false);
  const rafRef = useRef(0);
  const lastRef = useRef(0);
  const iconKeyRef = useRef("");
  const movingRef = useRef(false);
  const rangeRef = useRef<HTMLInputElement>(null);
  const paintRef = useRef<(at: number) => void>(() => {});
  const tickRef = useRef<(now: number) => void>(() => {});
  const [playing, setPlaying] = useState(false);
  const [rate, setRate] = useState<GpsPlaybackRate>(1);
  const [showPoints, setShowPoints] = useState(true);
  const [mapEpoch, setMapEpoch] = useState(0);
  const showPointsRef = useRef(true);
  const trackKey = useMemo(
    () => JSON.stringify(points.map((point) => [point.recordedAt, point.latitude, point.longitude])),
    [points],
  );
  rateRef.current = rate;
  showPointsRef.current = showPoints;

  paintRef.current = (at: number) => {
    const frame = playbackFrame(fixes, at, gapLimit);
    const nextReadout = playbackReadout(fixes, at, gapLimit, copy.playbackGap);
    const readoutKey = `${nextReadout.date}|${nextReadout.time}|${nextReadout.speed}|${nextReadout.coord}|${nextReadout.gap}`;
    if (readoutKeyRef.current !== readoutKey) {
      readoutKeyRef.current = readoutKey;
      setReadout(nextReadout);
    }
    if (rangeRef.current && !seekingRef.current) rangeRef.current.value = String(Math.round(at));
    const leaflet = leafletRef.current;
    const map = mapRef.current;
    if (!leaflet || !map || !map.getPane(PLAYBACK_PANE)) return;
    if (frame.latitude === null || frame.longitude === null) {
      markerRef.current?.setOpacity(0);
      return;
    }
    const gap = frame.gapMs !== null;
    const state = gpsPlaybackMarkerState(frame.speedMps, gap, movingRef.current);
    movingRef.current = !gap && state === "moving";
    const iconKey = state;
    let marker = markerRef.current;
    if (!marker) {
      marker = leaflet.marker([frame.latitude, frame.longitude], {
        pane: PLAYBACK_PANE,
        icon: vehicleIcon(leaflet, state, "gps-playback-vehicle"),
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(map);
      markerRef.current = marker;
      iconKeyRef.current = iconKey;
      return;
    }
    marker.setOpacity(1);
    marker.setLatLng([frame.latitude, frame.longitude]);
    if (iconKeyRef.current !== iconKey) {
      marker.setIcon(vehicleIcon(leaflet, state, "gps-playback-vehicle"));
      iconKeyRef.current = iconKey;
    }
    marker.setZIndexOffset(1000);
  };

  tickRef.current = (now: number) => {
    if (!playingRef.current) return;
    const elapsed = now - lastRef.current;
    lastRef.current = now;
    const next = advancePlaybackCursor(cursorRef.current, elapsed, rateRef.current, end);
    cursorRef.current = next;
    paintRef.current(next);
    if (next >= end) {
      playingRef.current = false;
      setPlaying(false);
      return;
    }
    rafRef.current = window.requestAnimationFrame((time) => tickRef.current(time));
  };

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let cancelled = false;
    void (async () => {
      const leaflet = await import("leaflet");
      const L = leaflet.default ?? leaflet;
      if (cancelled || !host.current) return;
      leafletRef.current = L;
      const map = L.map(node, { zoomControl: true });
      const playbackPane = map.createPane(PLAYBACK_PANE);
      playbackPane.classList.add("gps-playback-pane");
      playbackPane.style.zIndex = "650";
      mapRef.current = map;
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);
      const track = playbackFixes(JSON.parse(trackKey).map((row: [string, number, number]) => ({
        recordedAt: row[0],
        latitude: row[1],
        longitude: row[2],
        speedMps: null,
        headingDeg: null,
      })));
      const bounds: [number, number][] = [];
      playbackSegments(track, playbackGapLimit(track)).forEach((segment) => {
        if (segment.length > 1) {
          L.polyline(segment.map((point) => [point.latitude, point.longitude] as [number, number]), {
            color: "#1d4ed8",
            weight: 4,
          }).addTo(map);
        }
      });
      const dots = L.layerGroup();
      track.forEach((point, index) => {
        const role = index === 0 ? "start" : index === track.length - 1 ? "end" : "point";
        const color = role === "start" ? "#15803d" : role === "end" ? "#b91c1c" : "#64748b";
        L.circleMarker([point.latitude, point.longitude], {
          radius: role === "point" ? 3 : 7,
          color,
          fillColor: color,
          fillOpacity: 0.9,
          weight: 1,
        }).addTo(dots);
        bounds.push([point.latitude, point.longitude]);
      });
      pointsRef.current = dots;
      if (showPointsRef.current) dots.addTo(map);
      if (bounds.length === 0) map.setView([41.015, 28.979], 10);
      else if (bounds.length === 1) map.setView(bounds[0], 15);
      else map.fitBounds(bounds, { padding: [24, 24] });
      window.setTimeout(() => map.invalidateSize(), 0);
      window.requestAnimationFrame(() => map.invalidateSize());
      if (!cancelled) setMapEpoch((value) => value + 1);
    })();
    return () => {
      cancelled = true;
      playingRef.current = false;
      window.cancelAnimationFrame(rafRef.current);
      markerRef.current = null;
      pointsRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      leafletRef.current = null;
    };
  }, [trackKey]);

  useEffect(() => {
    const map = mapRef.current;
    const dots = pointsRef.current;
    if (!map || !dots) return;
    if (showPoints) dots.addTo(map);
    else dots.remove();
  }, [showPoints, mapEpoch]);

  useEffect(() => {
    cursorRef.current = start;
    playingRef.current = false;
    iconKeyRef.current = "";
    paintRef.current(start);
    return () => {
      playingRef.current = false;
      window.cancelAnimationFrame(rafRef.current);
    };
  }, [deviceId, start, end]);

  useEffect(() => {
    paintRef.current(cursorRef.current);
  }, [mapEpoch]);

  function togglePlay() {
    if (playingRef.current) {
      playingRef.current = false;
      window.cancelAnimationFrame(rafRef.current);
      setPlaying(false);
      return;
    }
    if (cursorRef.current >= end - 500) {
      cursorRef.current = start;
      paintRef.current(start);
    }
    playingRef.current = true;
    lastRef.current = performance.now();
    setPlaying(true);
    window.cancelAnimationFrame(rafRef.current);
    rafRef.current = window.requestAnimationFrame((time) => tickRef.current(time));
  }

  function moveTo(at: number) {
    cursorRef.current = Math.min(end, Math.max(start, at));
    paintRef.current(cursorRef.current);
  }

  return (
    <div data-gps-playback={deviceId}>
      <div ref={host} className="gps-map" />
      <div className="gps-playback">
        <div className="gps-playback-readout">
          <strong className="gps-playback-plate">{plate}</strong>
          <span className="gps-playback-time">{readout.date && readout.time ? `${readout.date} ${readout.time}` : readout.time}</span>
          <span className="gps-playback-speed">{readout.speed}</span>
          <span className="gps-playback-coord">{readout.coord}</span>
        </div>
        <p className="gps-playback-gap">{readout.gap}</p>
        <input
          ref={rangeRef}
          className="gps-playback-range"
          type="range"
          min={start}
          max={end}
          step={1000}
          defaultValue={start}
          aria-label={copy.route}
          onPointerDown={() => {
            seekingRef.current = true;
          }}
          onPointerUp={() => {
            seekingRef.current = false;
          }}
          onInput={(event) => moveTo(Number(event.currentTarget.value))}
        />
        <div className="gps-playback-controls">
          <button type="button" aria-label={copy.playbackStart} onClick={() => moveTo(start)}>⏮</button>
          <button type="button" aria-label={copy.playbackPrev} onClick={() => {
            const at = previousPlaybackAt(fixes, cursorRef.current);
            if (at !== null) moveTo(at);
          }}>⏪</button>
          <button type="button" aria-label={playing ? copy.pause : copy.play} aria-pressed={playing} onClick={togglePlay}>
            {playing ? "⏸" : "▶"}
          </button>
          <button type="button" aria-label={copy.playbackNext} onClick={() => {
            const at = nextPlaybackAt(fixes, cursorRef.current);
            if (at !== null) moveTo(at);
          }}>⏩</button>
          <label className="gps-playback-rate">
            <select aria-label={`${rate}×`} value={rate} onChange={(event) => setRate(Number(event.target.value) as GpsPlaybackRate)}>
              {GPS_PLAYBACK_RATES.map((value) => (
                <option key={value} value={value}>{value}×</option>
              ))}
            </select>
          </label>
        </div>
        <label className="gps-playback-points">
          <input type="checkbox" checked={showPoints} onChange={(event) => setShowPoints(event.target.checked)} />
          {copy.playbackPoints}
        </label>
      </div>
    </div>
  );
}
