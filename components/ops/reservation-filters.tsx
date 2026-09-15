"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OpsRefreshButton } from "@/components/ops/refresh-button";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  RESERVATION_DATE_PRESETS,
  RESERVATION_LIST_VIEWS,
  RESERVATION_SEARCH_DEBOUNCE_MS,
  hasActiveReservationFilters,
  normalizeReservationListView,
  reservationQueryRecord,
  type ReservationDatePreset,
  type ReservationListFilters,
  type ReservationListView,
} from "@/lib/ops/reservation-filters";

function dateChipLabel(copy: OpsCopy, id: ReservationDatePreset) {
  switch (id) {
    case "today":
      return copy.dateToday;
    case "yesterday":
      return copy.dateYesterday;
    case "tomorrow":
      return copy.dateTomorrow;
    case "7d":
      return copy.dateNext7;
    case "month":
      return copy.dateMonth;
    case "next_month":
      return copy.dateNextMonth;
    case "past_month":
      return copy.datePastMonth;
    case "upcoming":
      return copy.dateUpcoming;
    case "past":
      return copy.datePast;
    case "range":
      return copy.dateRange;
  }
}

function operationChipLabel(copy: OpsCopy, view: ReservationListView) {
  switch (view) {
    case "active":
      return copy.operationActive;
    case "completed":
      return copy.operationCompleted;
    case "cancelled":
      return copy.operationCancelled;
    case "all":
      return copy.operationAll;
  }
}

function listHref(locale: Locale, filters: ReservationListFilters) {
  const params = new URLSearchParams(
    Object.entries(reservationQueryRecord(filters)).filter(([, value]) => value.length > 0),
  );
  const query = params.toString();
  return `${localizedPath(locale, "/ops/reservations")}${query ? `?${query}` : ""}`;
}

type ReservationFiltersProps = {
  locale: Locale;
  copy: OpsCopy;
  filters: ReservationListFilters;
};

export function ReservationFilters({ locale, copy, filters }: ReservationFiltersProps) {
  const router = useRouter();
  const view = normalizeReservationListView(filters.operation);
  const [preset, setPreset] = useState<ReservationDatePreset | "">(filters.date);
  const [presetSource, setPresetSource] = useState(filters.date);
  const [query, setQuery] = useState(filters.query);
  const [querySource, setQuerySource] = useState(filters.query);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const skipSearchNav = useRef(true);
  const skipRangeNav = useRef(true);
  const showRange = preset === "range";

  if (presetSource !== filters.date) {
    setPresetSource(filters.date);
    setPreset(filters.date);
  }
  if (querySource !== filters.query) {
    setQuerySource(filters.query);
    setQuery(filters.query);
  }

  useEffect(() => {
    skipRangeNav.current = true;
    setFrom(filters.from);
    setTo(filters.to);
  }, [filters.from, filters.to, filters.date]);

  useEffect(() => {
    if (skipSearchNav.current) {
      skipSearchNav.current = false;
      return;
    }
    const nextQuery = query.trim();
    if (nextQuery === filters.query) {
      return;
    }
    const handle = window.setTimeout(() => {
      router.replace(
        listHref(locale, {
          ...filters,
          query: nextQuery,
        }),
      );
    }, RESERVATION_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [filters, locale, query, router]);

  useEffect(() => {
    if (!showRange) {
      return;
    }
    if (skipRangeNav.current) {
      skipRangeNav.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      router.replace(
        listHref(locale, {
          ...filters,
          query: query.trim(),
          date: "range",
          from,
          to,
        }),
      );
    }, RESERVATION_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [filters, from, locale, query, router, showRange, to]);

  function filtersWithQuery(next: ReservationListFilters): ReservationListFilters {
    return { ...next, query: query.trim() };
  }

  return (
    <div className="ops-filters ops-filters-wrap ops-reservation-filters">
      <div className="ops-reservation-search">
        <input
          type="search"
          name="q"
          className="ops-reservation-search-input"
          value={query}
          placeholder={`${copy.reservationCode}, ${copy.email}, ${copy.phone}, ${copy.pickup}`}
          aria-label={`${copy.reservationCode}, ${copy.email}, ${copy.phone}, ${copy.pickup}`}
          onChange={(event) => {
            skipSearchNav.current = false;
            setQuery(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") {
              return;
            }
            event.preventDefault();
            router.replace(
              listHref(locale, filtersWithQuery({ ...filters, query: query.trim() })),
            );
          }}
        />
        <OpsRefreshButton label={copy.refresh} busyLabel={copy.refreshing} />
      </div>
      <div className="ops-date-filter">
        <p className="ops-date-filter-label">{copy.transferDateFilter}</p>
        <div className="ops-date-chips" role="group" aria-label={copy.transferDateFilter}>
          {RESERVATION_DATE_PRESETS.map((id) =>
            id === "range" ? (
              <button
                key={id}
                type="button"
                className={`ops-date-chip${preset === id ? " is-active" : ""}`}
                aria-pressed={preset === id}
                onClick={() => setPreset("range")}
              >
                {dateChipLabel(copy, id)}
              </button>
            ) : (
              <a
                key={id}
                className={`ops-date-chip${preset === id ? " is-active" : ""}`}
                href={listHref(
                  locale,
                  filtersWithQuery({
                    ...filters,
                    date: id,
                    from: "",
                    to: "",
                  }),
                )}
                aria-pressed={preset === id}
                onClick={() => setPreset(id)}
              >
                {dateChipLabel(copy, id)}
              </a>
            ),
          )}
        </div>
        <div className="ops-date-filter">
          <p className="ops-date-filter-label">{copy.operationStatus}</p>
          <div className="ops-date-chips" role="group" aria-label={copy.operationStatus}>
            {RESERVATION_LIST_VIEWS.map((id) => (
              <a
                key={id}
                className={`ops-date-chip${view === id ? " is-active" : ""}`}
                href={listHref(
                  locale,
                  filtersWithQuery({
                    ...filters,
                    operation: id,
                  }),
                )}
                aria-pressed={view === id}
              >
                {operationChipLabel(copy, id)}
              </a>
            ))}
          </div>
        </div>
        {showRange ? (
          <div className="ops-date-range">
            <label className="ops-field">
              <span>{copy.dateFrom}</span>
              <input
                type="date"
                name="from"
                value={from}
                onChange={(event) => {
                  skipRangeNav.current = false;
                  setFrom(event.target.value);
                }}
              />
            </label>
            <label className="ops-field">
              <span>{copy.dateTo}</span>
              <input
                type="date"
                name="to"
                value={to}
                onChange={(event) => {
                  skipRangeNav.current = false;
                  setTo(event.target.value);
                }}
              />
            </label>
          </div>
        ) : null}
      </div>
      <p className="ops-filter-actions">
        <a
          className={`ops-clear-filters${hasActiveReservationFilters(filters) ? "" : " is-muted"}`}
          href={localizedPath(locale, "/ops/reservations")}
        >
          {copy.clearFilters}
        </a>
      </p>
    </div>
  );
}
