"use client";

import { useState } from "react";
import { OpsRefreshButton } from "@/components/ops/refresh-button";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  RESERVATION_DATE_PRESETS,
  hasActiveReservationFilters,
  type ReservationDatePreset,
  type ReservationListFilters,
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

type ReservationFiltersProps = {
  locale: Locale;
  copy: OpsCopy;
  filters: ReservationListFilters;
};

export function ReservationFilters({ locale, copy, filters }: ReservationFiltersProps) {
  const [preset, setPreset] = useState<ReservationDatePreset | "">(filters.date);
  const [presetSource, setPresetSource] = useState(filters.date);
  const showRange = preset === "range";

  if (presetSource !== filters.date) {
    setPresetSource(filters.date);
    setPreset(filters.date);
  }

  return (
    <form className="ops-filters ops-filters-wrap ops-reservation-filters" method="get">
      {filters.sort ? <input type="hidden" name="sort" value={filters.sort} /> : null}
      {filters.sort && filters.dir ? (
        <input type="hidden" name="dir" value={filters.dir} />
      ) : null}
      <div className="ops-reservation-search">
        <input
          type="search"
          name="q"
          className="ops-reservation-search-input"
          defaultValue={filters.query}
          placeholder={`${copy.reservationCode}, ${copy.email}, ${copy.phone}, ${copy.pickup}`}
        />
        <button type="submit" className="ops-btn-secondary" name="date" value={preset}>
          {copy.filter}
        </button>
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
              <button
                key={id}
                type="submit"
                name="date"
                value={id}
                className={`ops-date-chip${preset === id ? " is-active" : ""}`}
                aria-pressed={preset === id}
                onClick={() => setPreset(id)}
              >
                {dateChipLabel(copy, id)}
              </button>
            ),
          )}
        </div>
        {showRange ? (
          <div className="ops-date-range">
            <label className="ops-field">
              <span>{copy.dateFrom}</span>
              <input type="date" name="from" defaultValue={filters.from} />
            </label>
            <label className="ops-field">
              <span>{copy.dateTo}</span>
              <input type="date" name="to" defaultValue={filters.to} />
            </label>
            <button type="submit" className="ops-btn-secondary" name="date" value="range">
              {copy.filter}
            </button>
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
    </form>
  );
}
