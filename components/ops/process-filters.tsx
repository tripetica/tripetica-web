"use client";

import { useState } from "react";
import { OpsRefreshButton } from "@/components/ops/refresh-button";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type OpsCopy } from "@/lib/ops/copy";
import {
  PROCESS_DATE_PRESETS,
  hasActiveProcessFilters,
  type ProcessDatePreset,
  type ProcessListFilters,
} from "@/lib/ops/process-filters";

function dateChipLabel(copy: OpsCopy, id: ProcessDatePreset) {
  switch (id) {
    case "today":
      return copy.dateToday;
    case "yesterday":
      return copy.dateYesterday;
    case "7d":
      return copy.dateLast7;
    case "month":
      return copy.dateMonth;
    case "past":
      return copy.datePast;
    case "range":
      return copy.dateRange;
  }
}

type ProcessFiltersProps = {
  locale: Locale;
  copy: OpsCopy;
  filters: ProcessListFilters;
};

export function ProcessFilters({ locale, copy, filters }: ProcessFiltersProps) {
  const [preset, setPreset] = useState<ProcessDatePreset | "">(filters.date);
  const [presetSource, setPresetSource] = useState(filters.date);
  const showRange = preset === "range";

  if (presetSource !== filters.date) {
    setPresetSource(filters.date);
    setPreset(filters.date);
  }

  return (
    <form className="ops-filters ops-filters-wrap ops-process-filters" method="get">
      <div className="ops-filters-row">
        <input
          type="search"
          name="q"
          defaultValue={filters.query}
          placeholder={`${copy.email}, ${copy.phone}`}
        />
        <select name="status" defaultValue={filters.status}>
          <option value="">
            {copy.status}: {copy.all}
          </option>
          <option value="draft">draft</option>
          <option value="completed">completed</option>
          <option value="expired">expired</option>
        </select>
        <select name="conversion" defaultValue={filters.conversion}>
          <option value="">
            {copy.conversion}: {copy.all}
          </option>
          <option value="converted">{copy.convertedProcesses}</option>
          <option value="open">{copy.openProcesses}</option>
        </select>
        <button type="submit" className="ops-btn-secondary" name="date" value={preset}>
          {copy.filter}
        </button>
        <OpsRefreshButton label={copy.refresh} busyLabel={copy.refreshing} />
      </div>
      <div className="ops-date-filter">
        <p className="ops-date-filter-label">{copy.createdDateFilter}</p>
        <div className="ops-date-chips" role="group" aria-label={copy.createdDateFilter}>
          {PROCESS_DATE_PRESETS.map((id) =>
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
          className={`ops-clear-filters${hasActiveProcessFilters(filters) ? "" : " is-muted"}`}
          href={localizedPath(locale, "/ops/processes")}
        >
          {copy.clearFilters}
        </a>
      </p>
    </form>
  );
}
