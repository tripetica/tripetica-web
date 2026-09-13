"use client";

import { useState } from "react";
import { PartnerRefreshButton } from "@/components/partner/refresh-button";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { RESERVATION_DATE_PRESETS, type ReservationDatePreset } from "@/lib/ops/reservation-filters";
import {
  hasActivePartnerAcceptedJobFilters,
  partnerAcceptedJobQueryRecord,
  type PartnerAcceptedJobFilters,
} from "@/lib/partner/accepted-job-filters";
import { type PartnerCopy } from "@/lib/partner/copy";

function dateChipLabel(copy: PartnerCopy, id: ReservationDatePreset) {
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

type AcceptedJobFiltersProps = {
  locale: Locale;
  copy: PartnerCopy;
  filters: PartnerAcceptedJobFilters;
};

export function AcceptedJobFilters({ locale, copy, filters }: AcceptedJobFiltersProps) {
  const [preset, setPreset] = useState<ReservationDatePreset | "">(filters.date);
  const [presetSource, setPresetSource] = useState(filters.date);
  const showRange = preset === "range";

  if (presetSource !== filters.date) {
    setPresetSource(filters.date);
    setPreset(filters.date);
  }

  return (
    <form className="ops-filters ops-filters-wrap partner-accepted-filters" method="get">
      {filters.operation === "completed" ? (
        <input type="hidden" name="operation" value="completed" />
      ) : null}
      <div className="ops-date-filter">
        <p className="ops-date-filter-label">{copy.jobDateFilter}</p>
        <div className="ops-date-chips" role="group" aria-label={copy.jobDateFilter}>
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
        <div className="ops-date-filter">
          <p className="ops-date-filter-label">{copy.jobOperationStatus}</p>
          <div className="ops-date-chips" role="group" aria-label={copy.jobOperationStatus}>
            <a
              className={`ops-date-chip${filters.operation === "completed" ? " is-active" : ""}`}
              href={`${localizedPath(locale, "/partner/accepted")}?${new URLSearchParams(
                Object.entries(
                  partnerAcceptedJobQueryRecord({
                    ...filters,
                    operation: filters.operation === "completed" ? "" : "completed",
                  }),
                ).filter(([, value]) => value.length > 0),
              ).toString()}`}
              aria-pressed={filters.operation === "completed"}
            >
              {copy.jobOperationCompleted}
            </a>
          </div>
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
              {copy.jobFilter}
            </button>
          </div>
        ) : null}
      </div>
      <p className="ops-filter-actions partner-accepted-filter-actions">
        <PartnerRefreshButton
          label={copy.jobRefresh}
          busyLabel={copy.jobRefreshing}
          className="partner-jobs-refresh"
        />
        <a
          className={`ops-clear-filters${hasActivePartnerAcceptedJobFilters(filters) ? "" : " is-muted"}`}
          href={localizedPath(locale, "/partner/accepted")}
        >
          {copy.jobClearFilters}
        </a>
      </p>
    </form>
  );
}
