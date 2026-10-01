"use client";

import { useEffect, useId, useRef, useState } from "react";
import { fetchPlaceDetails, fetchPlaceSuggestions } from "@/lib/booking/places-client";
import { type PlaceSuggestion } from "@/lib/booking/places-parse";
import { type Locale } from "@/lib/i18n/config";
import { type UetdsFormCopy } from "@/lib/uetds/copy";
import {
  emptyUetdsLocation,
  isOfficialUetdsLocationReady,
  uetdsLocationOfficialLabel,
  uetdsLocationOperationalSecondary,
  type UetdsLocation,
} from "@/lib/uetds/location";
import { applyUetdsPlaceDetails } from "@/lib/uetds/resolve-location";

type UetdsLocationFieldProps = {
  locale: Locale;
  copy: UetdsFormCopy;
  label: string;
  fieldId: string;
  value: UetdsLocation;
  invalid?: boolean;
  suggestOnMount?: boolean;
  onChange: (value: UetdsLocation) => void;
};

export function UetdsLocationField({
  locale,
  copy,
  label,
  fieldId,
  value,
  invalid,
  suggestOnMount = false,
  onChange,
}: UetdsLocationFieldProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<string | null>(null);
  const selectionVersion = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const ignoreFocusRef = useRef(false);
  const [query, setQuery] = useState(value.placeName);
  const [open, setOpen] = useState(() =>
    suggestOnMount && Boolean(value.placeName.trim()) && !isOfficialUetdsLocationReady(value),
  );
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const officialReady = isOfficialUetdsLocationReady(value);
  const showUnresolved = !officialReady && Boolean(value.placeName.trim()) && !open;
  const secondary = uetdsLocationOperationalSecondary(value);
  const officialLabel = uetdsLocationOfficialLabel(value);

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || !trimmed) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      if (!sessionRef.current) {
        sessionRef.current = crypto.randomUUID();
      }
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
  }, [locale, open, query]);

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    const version = ++selectionVersion.current;
    ignoreFocusRef.current = true;
    setOpen(false);
    setQuery(suggestion.primaryText);
    if (!sessionRef.current) {
      sessionRef.current = crypto.randomUUID();
    }
    const details = await fetchPlaceDetails({
      placeId: suggestion.placeId,
      locale,
      sessionToken: sessionRef.current,
    });
    if (version !== selectionVersion.current) return;
    const next = applyUetdsPlaceDetails({
      details: details
        ? {
            ...details,
            placeId: details.placeId ?? suggestion.placeId,
            name: details.name ?? suggestion.primaryText,
            formattedAddress: details.formattedAddress ?? suggestion.secondaryText,
          }
        : {
            name: suggestion.primaryText,
            formattedAddress: suggestion.secondaryText,
            placeId: suggestion.placeId,
            types: suggestion.types,
          },
      primaryText: suggestion.primaryText,
      secondaryText: suggestion.secondaryText,
      suggestionTypes: suggestion.types,
    });
    onChange(next);
    sessionRef.current = crypto.randomUUID();
  }

  return (
    <div
      className={open ? "uetds-location-field is-open" : "uetds-location-field"}
      ref={rootRef}
      data-uetds-field={fieldId.endsWith("origin") ? "origin" : "destination"}
    >
      <span>{label}</span>
      <div className="uetds-location-search">
        <input
          ref={inputRef}
          id={fieldId}
          className={invalid || showUnresolved ? "is-invalid" : undefined}
          value={open ? query : value.placeName || query}
          placeholder={copy.placesSearch}
          autoComplete="off"
          aria-invalid={invalid || showUnresolved || undefined}
          aria-controls={listId}
          aria-expanded={open}
          onFocus={() => {
            if (ignoreFocusRef.current) {
              ignoreFocusRef.current = false;
              return;
            }
            setQuery(value.placeName);
            setOpen(true);
          }}
          onChange={(event) => {
            selectionVersion.current++;
            setQuery(event.target.value);
            setOpen(true);
            onChange({
              ...value,
              placeName: event.target.value,
              review: true,
              googlePlaceId: "",
              provinceCode: "",
              provinceName: "",
              districtOrAirportCode: "",
              districtOrAirportName: "",
              formattedAddress: "",
            });
          }}
        />
        {value.placeName || query ? (
          <button
            type="button"
            className="uetds-location-clear"
            aria-label={`${label}: ${locale === "tr" ? "Temizle" : locale === "ru" ? "Очистить" : "Clear"}`}
            onClick={() => {
              selectionVersion.current++;
              setQuery("");
              setOpen(false);
              setSuggestions([]);
              setPlacesError(null);
              setLoading(false);
              sessionRef.current = crypto.randomUUID();
              onChange(emptyUetdsLocation());
              ignoreFocusRef.current = true;
              inputRef.current?.focus();
              ignoreFocusRef.current = false;
            }}
          >
            ×
          </button>
        ) : null}
        {open ? (
          <div id={listId} className="uetds-location-menu" role="listbox">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                type="button"
                className="uetds-location-option"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void selectSuggestion(suggestion);
                }}
              >
                <strong>{suggestion.primaryText}</strong>
                {suggestion.secondaryText ? <span>{suggestion.secondaryText}</span> : null}
              </button>
            ))}
            {placesError ? <p className="uetds-field-hint">{copy.placesError}</p> : null}
            {!loading && !placesError && query.trim() && suggestions.length === 0 ? (
              <p className="uetds-field-hint">{copy.noPlaceResults}</p>
            ) : null}
          </div>
        ) : null}
      </div>
      {!open && secondary ? <p className="uetds-field-hint">{secondary}</p> : null}
      {officialReady ? (
        <p className="uetds-official-line" role="status">
          {copy.officialConfirmed.replace("{label}", officialLabel)}
        </p>
      ) : showUnresolved ? (
        <p className="uetds-field-hint" role="status">
          {copy.locationUnresolved}
        </p>
      ) : null}
    </div>
  );
}
