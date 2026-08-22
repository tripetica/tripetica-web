"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { LocationGlyph, locationIconKind } from "@/components/booking/place-icons";
import { airportPresets } from "@/lib/booking/catalog";
import { type BookingCopy } from "@/lib/booking/copy";
import { panelAboveField } from "@/lib/booking/panel-position";
import {
  fetchPlaceDetails,
  fetchPlaceSuggestions,
} from "@/lib/booking/places-client";
import { type PlaceSuggestion } from "@/lib/booking/places-parse";
import {
  emptyLocation,
  isLocationFilled,
  type AirportCode,
  type AirportPreset,
  type LocationValue,
} from "@/lib/booking/types";
import { type Locale } from "@/lib/i18n/config";
import {
  BOOKING_DESKTOP_QUERY,
  useMediaQuery,
} from "@/lib/ui/use-media-query";

type LocationRole = "pickup" | "dropoff";

type LocationFieldProps = {
  id: string;
  role: LocationRole;
  locale: Locale;
  label: string;
  title: string;
  placeholder: string;
  copy: Pick<
    BookingCopy,
    | "clearLocation"
    | "airportsLabel"
    | "airports"
    | "noPlaceResults"
    | "placesError"
    | "suggestionsLabel"
    | "closeSelector"
  >;
  value: LocationValue;
  onChange: (value: LocationValue) => void;
};

export function LocationField({
  id,
  role,
  locale,
  label,
  title,
  placeholder,
  copy,
  value,
  onChange,
}: LocationFieldProps) {
  const desktop = useMediaQuery(BOOKING_DESKTOP_QUERY);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuBox, setMenuBox] = useState<DOMRect | null>(null);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const skipSearchRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const sessionRef = useRef(createSessionToken());
  const menuId = useId();
  const filled = isLocationFilled(value);
  const visibleName = locationLabel(value, copy.airports);
  const compactPresets = !desktop && query.trim().length > 0;
  const fieldKind = locationIconKind(
    value.placeTypes,
    role,
    value.type === "airport" || Boolean(value.airportCode),
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    function measure() {
      const root = rootRef.current;
      if (root) {
        setMenuBox(root.getBoundingClientRect());
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function onOutside(event: Event) {
      if (!desktop) {
        return;
      }
      const root = rootRef.current;
      const menu = document.getElementById(menuId);
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (root?.contains(target) || menu?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    document.addEventListener("keydown", onKeyDown);

    let previousOverflow = "";
    if (!desktop) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onOutside);
    }, 0);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onOutside);
      if (!desktop) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [open, menuId, desktop]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const trimmed = query.trim();
    if (!trimmed || skipSearchRef.current) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await fetchPlaceSuggestions({
        query: trimmed,
        locale,
        sessionToken: sessionRef.current,
      });
      if (cancelled) {
        return;
      }
      setSuggestions(result.suggestions);
      setPlacesError(result.error);
      setLoading(false);
    }, 280);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, query, locale]);

  function openSelector() {
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuBox(rect);
    }
    const currentLabel = locationLabel(value, copy.airports);
    setQuery(currentLabel);
    setSuggestions([]);
    setPlacesError(null);
    setLoading(false);
    skipSearchRef.current = currentLabel.trim().length > 0;
    sessionRef.current = createSessionToken();
    setOpen(true);
  }

  function selectPreset(preset: AirportPreset) {
    onChange({
      source: "preset",
      name: copy.airports[preset.id],
      formattedAddress: preset.formattedAddress,
      placeId: preset.placeId,
      lat: preset.lat,
      lng: preset.lng,
      city: preset.city,
      district: preset.district,
      region: preset.region,
      country: preset.country,
      airportCode: preset.airportCode,
      type: "airport",
      placeTypes: ["airport"],
    });
    setOpen(false);
  }

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    const details = await fetchPlaceDetails({
      placeId: suggestion.placeId,
      locale,
      sessionToken: sessionRef.current,
    });
    const types = details?.types ?? suggestion.types;
    onChange({
      source: "google",
      name: details?.name ?? suggestion.primaryText,
      formattedAddress: details?.formattedAddress ?? suggestion.secondaryText,
      placeId: details?.placeId ?? suggestion.placeId,
      lat: details?.lat ?? null,
      lng: details?.lng ?? null,
      city: details?.city ?? null,
      district: details?.district ?? null,
      region: details?.region ?? null,
      country: details?.country ?? null,
      airportCode: null,
      type: types.includes("airport") ? "airport" : "place",
      placeTypes: types,
    });
    setOpen(false);
  }

  const panel = open ? (
    <LocationSelectorPanel
      desktop={desktop}
      menuId={menuId}
      title={title}
      placeholder={placeholder}
      copy={copy}
      role={role}
      query={query}
      compactPresets={compactPresets}
      suggestions={suggestions}
      loading={loading}
      placesError={placesError}
      inputRef={inputRef}
      style={desktop ? panelAboveField(menuBox) : undefined}
      onQueryChange={(next) => {
        skipSearchRef.current = false;
        setQuery(next);
        if (next.trim()) {
          setLoading(true);
          setPlacesError(null);
        } else {
          setLoading(false);
          setSuggestions([]);
          setPlacesError(null);
        }
      }}
      onClose={() => setOpen(false)}
      onSelectPreset={selectPreset}
      onSelectSuggestion={(suggestion) => {
        void selectSuggestion(suggestion);
      }}
    />
  ) : null;

  return (
    <div ref={rootRef} className={`booking-field booking-entry-field min-w-0 flex-1 ${filled ? "is-filled" : ""}`}>
      <span className="booking-field-label booking-field-label-out" id={`${id}-label`}>
        {label}
      </span>
      <div className="booking-input-wrap">
        <button
          type="button"
          id={id}
          className={`booking-field-button ${filled ? "is-filled" : ""}`}
          aria-labelledby={`${id}-label`}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={openSelector}
        >
          <span className="booking-field-label booking-field-label-in" aria-hidden="true">
            {label}
          </span>
          {filled ? (
            <LocationGlyph kind={fieldKind} className="location-icon location-icon-field" />
          ) : null}
          <span className="min-w-0 truncate">
            {filled ? visibleName : placeholder}
          </span>
        </button>
        {filled ? (
          <button
            type="button"
            className="booking-clear"
            aria-label={copy.clearLocation}
            onClick={(event) => {
              event.stopPropagation();
              onChange(emptyLocation());
              setQuery("");
            }}
          >
            ×
          </button>
        ) : null}
      </div>
      {open && typeof document !== "undefined"
        ? createPortal(panel, document.body)
        : null}
    </div>
  );
}

function locationLabel(
  value: LocationValue,
  airports: Record<AirportCode, string>,
) {
  if (value.source === "preset" && value.airportCode) {
    const code = value.airportCode as AirportCode;
    return airports[code] ?? value.name;
  }
  return value.name;
}

type PanelProps = {
  desktop: boolean;
  menuId: string;
  title: string;
  placeholder: string;
  copy: LocationFieldProps["copy"];
  role: LocationRole;
  query: string;
  compactPresets: boolean;
  suggestions: PlaceSuggestion[];
  loading: boolean;
  placesError: string | null;
  inputRef: RefObject<HTMLInputElement | null>;
  style?: CSSProperties;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  onSelectPreset: (preset: AirportPreset) => void;
  onSelectSuggestion: (suggestion: PlaceSuggestion) => void;
};

function LocationSelectorPanel({
  desktop,
  menuId,
  title,
  placeholder,
  copy,
  role,
  query,
  compactPresets,
  suggestions,
  loading,
  placesError,
  inputRef,
  style,
  onQueryChange,
  onClose,
  onSelectPreset,
  onSelectSuggestion,
}: PanelProps) {
  const trimmed = query.trim();

  return (
    <div
      id={menuId}
      className={desktop ? "booking-menu location-float" : "location-sheet"}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {desktop ? null : (
        <div className="location-sheet-bar">
          <button
            type="button"
            className="location-back"
            aria-label={copy.closeSelector}
            onClick={onClose}
          >
            ←
          </button>
          <h2 className="location-sheet-title">{title}</h2>
        </div>
      )}
      <div className="location-search">
        <div className="location-search-wrap">
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            placeholder={placeholder}
            className={`booking-field-input ${trimmed ? "is-filled" : ""}`}
            onChange={(event) => onQueryChange(event.target.value)}
          />
          {trimmed ? (
            <button
              type="button"
              className="booking-clear"
              aria-label={copy.clearLocation}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onQueryChange("");
                inputRef.current?.focus();
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      </div>
      <div className="location-sheet-body">
        <p className="location-panel-label">{copy.airportsLabel}</p>
        <ul className="location-panel-list">
          {airportPresets.map((preset) => (
            <li key={preset.id}>
              <button
                type="button"
                className={`booking-menu-item location-item ${compactPresets ? "is-compact" : ""}`}
                onClick={() => onSelectPreset(preset)}
              >
                <LocationGlyph kind="airport" />
                <span className="location-item-copy">
                  <span className="location-item-primary">
                    {copy.airports[preset.id]}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {trimmed ? (
          <>
            <p className="location-panel-label">{copy.suggestionsLabel}</p>
            <ul className="location-panel-list location-panel-results">
              {suggestions.map((suggestion) => (
                <li key={suggestion.placeId}>
                  <button
                    type="button"
                    className="booking-menu-item location-item"
                    onClick={() => onSelectSuggestion(suggestion)}
                  >
                    <LocationGlyph
                      kind={locationIconKind(
                        suggestion.types,
                        role,
                        suggestion.types.includes("airport"),
                      )}
                    />
                    <span className="location-item-copy">
                      <span className="location-item-primary">
                        {suggestion.primaryText}
                      </span>
                      {suggestion.secondaryText ? (
                        <span className="location-item-secondary">
                          {suggestion.secondaryText}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
              {placesError ? (
                <li className="location-empty">{copy.placesError}</li>
              ) : null}
              {!loading && !placesError && suggestions.length === 0 ? (
                <li className="location-empty">{copy.noPlaceResults}</li>
              ) : null}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

function createSessionToken() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "00000000-0000-4000-8000-000000000000";
}
