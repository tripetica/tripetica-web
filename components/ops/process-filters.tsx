"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OpsRefreshButton } from "@/components/ops/refresh-button";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { type OpsCopy } from "@/lib/ops/copy";
import { fillCopy } from "@/lib/ops/format";
import {
  PROCESS_DATE_PRESETS,
  PROCESS_SEARCH_DEBOUNCE_MS,
  PROCESS_STATUSES,
  hasActiveProcessFilters,
  normalizeProcessLanguageSelection,
  parseProcessLanguageCodes,
  parseProcessStatus,
  processLanguageDraftFromApplied,
  processLanguageFilterOptions,
  processLanguageLabel,
  processQueryRecord,
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

function listHref(locale: Locale, filters: ProcessListFilters) {
  const params = new URLSearchParams(
    Object.entries(processQueryRecord(filters)).filter(([, value]) => value.length > 0),
  );
  const query = params.toString();
  return `${localizedPath(locale, "/ops/processes")}${query ? `?${query}` : ""}`;
}

function languageSummary(
  copy: OpsCopy,
  locale: Locale,
  selected: readonly string[],
  publicCodes: readonly string[],
) {
  const applied = normalizeProcessLanguageSelection(selected, publicCodes);
  if (!applied) {
    return `${copy.language}: ${copy.all}`;
  }
  const codes = parseProcessLanguageCodes(applied);
  if (codes.length === 1) {
    return `${copy.language}: ${processLanguageLabel(codes[0], locale)}`;
  }
  return `${copy.language}: ${fillCopy(copy.languageSelectedCount, { n: codes.length })}`;
}

type ProcessFiltersProps = {
  locale: Locale;
  copy: OpsCopy;
  filters: ProcessListFilters;
  languageCodes: readonly string[];
};

export function ProcessFilters({
  locale,
  copy,
  filters,
  languageCodes,
}: ProcessFiltersProps) {
  const router = useRouter();
  const [preset, setPreset] = useState<ProcessDatePreset | "">(filters.date);
  const [presetSource, setPresetSource] = useState(filters.date);
  const [query, setQuery] = useState(filters.query);
  const [querySource, setQuerySource] = useState(filters.query);
  const [from, setFrom] = useState(filters.from);
  const [to, setTo] = useState(filters.to);
  const skipSearchNav = useRef(true);
  const skipRangeNav = useRef(true);
  const showRange = preset === "range";
  const selectedLanguages = parseProcessLanguageCodes(filters.locale);
  const languageOptions = useMemo(
    () => processLanguageFilterOptions(languageCodes),
    [languageCodes],
  );

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
    }, PROCESS_SEARCH_DEBOUNCE_MS);
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
    }, PROCESS_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [filters, from, locale, query, router, showRange, to]);

  function filtersWithQuery(next: ProcessListFilters): ProcessListFilters {
    return { ...next, query: query.trim() };
  }

  return (
    <div className="ops-filters ops-filters-wrap ops-process-filters">
      <div className="ops-filters-row">
        <input
          type="search"
          name="q"
          value={query}
          placeholder={`${copy.email}, ${copy.phone}`}
          aria-label={`${copy.email}, ${copy.phone}`}
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
        <div className="ops-filter-dropdown">
          <select
            name="status"
            value={filters.status}
            aria-label={copy.status}
            onToggle={(event) => {
              event.currentTarget.parentElement?.classList.toggle(
                "is-open",
                event.newState === "open",
              );
            }}
            onChange={(event) => {
              router.replace(
                listHref(
                  locale,
                  filtersWithQuery({
                    ...filters,
                    status: parseProcessStatus(event.target.value),
                  }),
                ),
              );
            }}
          >
            <option value="">
              {copy.status}: {copy.all}
            </option>
            {PROCESS_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <OpsFilterChevron />
        </div>
        <ProcessLanguageFilter
          locale={locale}
          copy={copy}
          options={languageOptions}
          selected={selectedLanguages}
          onApply={(codes) => {
            router.replace(
              listHref(
                locale,
                filtersWithQuery({
                  ...filters,
                  locale: normalizeProcessLanguageSelection(codes, languageOptions),
                }),
              ),
            );
          }}
        />
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
          className={`ops-clear-filters${hasActiveProcessFilters(filters) ? "" : " is-muted"}`}
          href={localizedPath(locale, "/ops/processes")}
        >
          {copy.clearFilters}
        </a>
      </p>
    </div>
  );
}

function OpsFilterChevron() {
  return <span className="ops-filter-chevron" aria-hidden="true" />;
}

type ProcessLanguageFilterProps = {
  locale: Locale;
  copy: OpsCopy;
  options: readonly string[];
  selected: readonly string[];
  onApply: (codes: readonly string[]) => void;
};

function ProcessLanguageFilter({
  locale,
  copy,
  options,
  selected,
  onApply,
}: ProcessLanguageFilterProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>([]);
  const appliedLabel = languageSummary(copy, locale, selected, options);
  const allDraftSelected =
    options.length > 0 && options.every((code) => draft.includes(code));

  function openMenu() {
    setDraft(processLanguageDraftFromApplied(selected, options));
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) {
        return;
      }
      closeMenu();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggleAll() {
    setDraft(allDraftSelected ? [] : [...options]);
  }

  function toggle(code: string) {
    setDraft((current) =>
      current.includes(code)
        ? current.filter((item) => item !== code)
        : [...current, code],
    );
  }

  function applyDraft() {
    onApply(draft);
    closeMenu();
  }

  return (
    <div className="ops-language-filter" ref={rootRef}>
      <button
        type="button"
        className="ops-language-filter-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={appliedLabel}
        onClick={() => {
          if (open) {
            closeMenu();
            return;
          }
          openMenu();
        }}
      >
        {appliedLabel}
        <OpsFilterChevron />
      </button>
      {open ? (
        <div className="ops-language-filter-menu">
          <div role="listbox" aria-multiselectable="true">
            <label className={`ops-language-option${allDraftSelected ? " is-selected" : ""}`}>
              <input
                type="checkbox"
                checked={allDraftSelected}
                onChange={toggleAll}
              />
              <span>{copy.all}</span>
            </label>
            {options.map((code) => {
              const checked = draft.includes(code);
              return (
                <label
                  key={code}
                  className={`ops-language-option${checked ? " is-selected" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(code)}
                  />
                  <span>{processLanguageLabel(code, locale)}</span>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            className="ops-btn-secondary ops-language-apply"
            onClick={applyDraft}
          >
            {copy.applyLanguageSelections}
          </button>
        </div>
      ) : null}
    </div>
  );
}
