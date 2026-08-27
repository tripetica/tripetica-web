"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceKm, type BookingDraftView } from "@/lib/booking/draft-view";
import { buildOsmMapView, type MapLatLng } from "@/lib/booking/osm-map-view";
import { bookingPageCopy } from "@/lib/booking/page-copy";
import { routeFingerprint } from "@/lib/booking/route-fingerprint";
import { type Locale } from "@/lib/i18n/config";

type BookingRouteMapProps = {
  locale: Locale;
  draft: BookingDraftView | null;
};

function hasCoords(value: { lat: number | null; lng: number | null } | undefined) {
  return (
    typeof value?.lat === "number" &&
    Number.isFinite(value.lat) &&
    typeof value?.lng === "number" &&
    Number.isFinite(value.lng)
  );
}

function OsmMarkerMap({
  origin,
  destination,
}: {
  origin: MapLatLng;
  destination: MapLatLng;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) {
      return;
    }

    const readWidth = (target: HTMLElement) => {
      const next = Math.round(target.getBoundingClientRect().width);
      if (next > 0) {
        setWidth(next);
      }
    };

    readWidth(frame);
    const observer = new ResizeObserver(() => readWidth(frame));
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const view = useMemo(
    () =>
      buildOsmMapView({
        origin,
        destination,
        width,
        height: 200,
      }),
    [destination, origin, width],
  );

  return (
    <div ref={frameRef} className="booking-route-map-osm">
      {view.tiles.map((tile) => (
        // OSM raster tiles; dynamic map overlay, not a static import.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={tile.key}
          className="booking-route-map-tile"
          src={tile.url}
          alt=""
          width={256}
          height={256}
          style={{ left: tile.left, top: tile.top }}
          draggable={false}
        />
      ))}
      <svg
        className="booking-route-map-svg"
        viewBox={`0 0 ${view.width} ${view.height}`}
        aria-hidden="true"
      >
        <g className="booking-route-map-marker">
          <circle cx={view.originPx.x} cy={view.originPx.y} r="11" fill="#2563eb" />
          <text
            x={view.originPx.x}
            y={view.originPx.y + 4}
            textAnchor="middle"
            fill="#ffffff"
            fontSize="11"
            fontWeight="700"
          >
            A
          </text>
        </g>
        <g className="booking-route-map-marker">
          <circle
            cx={view.destinationPx.x}
            cy={view.destinationPx.y}
            r="11"
            fill="#111827"
          />
          <text
            x={view.destinationPx.x}
            y={view.destinationPx.y + 4}
            textAnchor="middle"
            fill="#ffffff"
            fontSize="11"
            fontWeight="700"
          >
            B
          </text>
        </g>
      </svg>
      <a
        className="booking-route-map-attr"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        © OpenStreetMap contributors
      </a>
    </div>
  );
}

export function BookingRouteMap({ locale, draft }: BookingRouteMapProps) {
  const copy = bookingPageCopy[locale];
  const pickup = draft?.applied.pickup;
  const dropoff = draft?.applied.dropoff;
  const canShow =
    draft?.serviceType === "transfer" && hasCoords(pickup) && hasCoords(dropoff);
  const fingerprint =
    canShow && pickup && dropoff
      ? routeFingerprint(
          { lat: pickup.lat as number, lng: pickup.lng as number },
          { lat: dropoff.lat as number, lng: dropoff.lng as number },
        )
      : null;
  const distanceKm = draft?.applied.distanceKm;
  const meta =
    typeof distanceKm === "number" ? `${formatDistanceKm(distanceKm, locale)} km` : "";

  return (
    <section
      className="booking-route-card glass-surface"
      aria-label={copy.routeTitle}
      hidden={!canShow}
    >
      <div className="booking-route-card-copy">
        <h2 className="booking-route-card-title">{copy.routeTitle}</h2>
        {meta ? <p className="booking-route-card-meta">{meta}</p> : null}
      </div>
      <div className="booking-route-map-frame">
        {canShow && fingerprint && pickup && dropoff ? (
          <OsmMarkerMap
            key={fingerprint}
            origin={{ lat: pickup.lat as number, lng: pickup.lng as number }}
            destination={{ lat: dropoff.lat as number, lng: dropoff.lng as number }}
          />
        ) : (
          <div className="booking-route-map-skeleton" aria-hidden="true" />
        )}
      </div>
    </section>
  );
}
