"use client";

import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { checkoutCopy } from "@/lib/booking/checkout-copy";
import { panelBelowField } from "@/lib/booking/panel-position";
import { phoneFieldCopy } from "@/lib/geo/copy";
import {
  countryByIso2,
  countryFlagEmoji,
  formatDialCode,
  searchCountries,
  type CountryRecord,
} from "@/lib/geo/countries";
import { type Locale } from "@/lib/i18n/config";
import { BOOKING_WIDE_QUERY, useMediaQuery } from "@/lib/ui/use-media-query";

type CountryPickerVariant = "phone" | "nationality";

type CountryPickerProps = {
  locale: Locale;
  variant: CountryPickerVariant;
  value: string | null;
  labelledBy?: string;
  ariaLabel: string;
  active?: boolean;
  invalid?: boolean;
  /** Measure this element for panel width/position (e.g. full phone control). */
  anchorRef?: RefObject<HTMLElement | null>;
  /**
   * `anchored` = always panel below the field (no mobile bottom sheet).
   * Use inside modals so the list opens under the control, not at the screen bottom.
   */
  layout?: "auto" | "anchored";
  onChange: (iso2: string) => void;
  onEmptyBlur?: () => void;
};

export function CountryPicker({
  locale,
  variant,
  value,
  labelledBy,
  ariaLabel,
  active = true,
  invalid = false,
  anchorRef,
  layout = "auto",
  onChange,
  onEmptyBlur,
}: CountryPickerProps) {
  const copy = checkoutCopy[locale];
  const phone = phoneFieldCopy[locale];
  const desktop = useMediaQuery(BOOKING_WIDE_QUERY);
  const anchored = layout === "anchored" || desktop;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuBox, setMenuBox] = useState<DOMRect | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const resultsListRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const searchId = useId();
  const results = useMemo(() => searchCountries(query, locale), [query, locale]);
  const selected = countryByIso2(value);
  const openRef = useRef(false);
  const phoneWidthOpts =
    variant === "phone" && !anchorRef
      ? { minWidth: 340, maxWidth: 380 }
      : {};
  const menuStyle = anchored
    ? panelBelowField(menuBox, {
        maxHeight: 360,
        gutter: 8,
        zIndex: 260,
        ...phoneWidthOpts,
      })
    : undefined;

  const resultsRef = useRef(results);
  const activeIndexRef = useRef(0);

  useEffect(() => {
    resultsRef.current = results;
    activeIndexRef.current = activeIndex;
    openRef.current = open;
  }, [activeIndex, open, results]);

  if (!active && open) {
    setOpen(false);
  }

  useEffect(() => {
    if (!open || !active) {
      queueMicrotask(() => setQuery(""));
      return;
    }
    const selectedIndex = Math.max(
      0,
      resultsRef.current.findIndex((country) => country.iso2 === value),
    );
    queueMicrotask(() => setActiveIndex(selectedIndex));
    activeIndexRef.current = selectedIndex;

    function measure() {
      const anchor = anchorRef?.current ?? triggerRef.current;
      if (anchor) {
        setMenuBox(anchor.getBoundingClientRect());
      }
    }
    measure();
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);

    function onKey(event: KeyboardEvent) {
      const list = resultsRef.current;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => {
          const next = Math.min(list.length - 1, index + 1);
          activeIndexRef.current = next;
          return next;
        });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        event.stopPropagation();
        setActiveIndex((index) => {
          const next = Math.max(0, index - 1);
          activeIndexRef.current = next;
          return next;
        });
        return;
      }
      if (event.key === "Enter") {
        const country = list[activeIndexRef.current] ?? list[0];
        if (country) {
          event.preventDefault();
          event.stopPropagation();
          onChange(country.iso2);
          setOpen(false);
          triggerRef.current?.focus();
        }
      }
    }

    function onOutside(event: PointerEvent) {
      const target = event.target as Node | null;
      if (triggerRef.current?.contains(target) || listRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onOutside);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onOutside);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, anchorRef, onChange, open, value]);

  useEffect(() => {
    if (!open) {
      return;
    }
    resultsListRef.current?.scrollTo({ top: 0 });
  }, [open, query]);

  useEffect(() => {
    if (!open || query) {
      return;
    }
    const list = resultsListRef.current;
    const active = list?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (!list || !active) {
      return;
    }
    const listBox = list.getBoundingClientRect();
    const itemBox = active.getBoundingClientRect();
    if (itemBox.top < listBox.top) {
      list.scrollTop -= listBox.top - itemBox.top;
    } else if (itemBox.bottom > listBox.bottom) {
      list.scrollTop += itemBox.bottom - listBox.bottom;
    }
  }, [activeIndex, open, query]);

  const triggerFace = selected
    ? variant === "phone"
      ? `${countryFlagEmoji(selected.iso2)} ${formatDialCode(selected.iso2)}`
      : `${countryFlagEmoji(selected.iso2)} ${selected.names[locale]}`
    : variant === "phone"
      ? `🌐 ${phone.selectCode}`
      : copy.nationalityPlaceholder;

  const panel = (
    <div
      ref={listRef}
      id={listId}
      className={`country-picker-panel${anchored ? " is-desktop" : " is-mobile"} is-${variant}`}
      style={anchored ? menuStyle : undefined}
      role="listbox"
      aria-labelledby={labelledBy}
      aria-activedescendant={results[activeIndex] ? `${listId}-${results[activeIndex].iso2}` : undefined}
    >
      {!anchored ? (
        <div className="country-picker-sheet-head">
          <p className="country-picker-sheet-title">{ariaLabel}</p>
          <button
            type="button"
            className="country-picker-close"
            onClick={() => {
              setOpen(false);
              triggerRef.current?.focus();
            }}
          >
            {copy.closeSelector}
          </button>
        </div>
      ) : null}
      <label className="country-picker-search-wrap" htmlFor={searchId}>
        <span className="sr-only">{copy.nationalitySearch}</span>
        <input
          ref={searchRef}
          id={searchId}
          className="country-picker-search"
          type="search"
          value={query}
          placeholder={copy.nationalitySearch}
          autoComplete="off"
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
        />
      </label>
      <div className="country-picker-list" ref={resultsListRef}>
        {results.length === 0 ? (
          <p className="country-picker-empty">{copy.countryNoResults}</p>
        ) : (
          results.map((country, index) => (
            <CountryRow
              key={country.iso2}
              id={`${listId}-${country.iso2}`}
              country={country}
              locale={locale}
              variant={variant}
              selected={country.iso2 === value}
              active={index === activeIndex}
              index={index}
              onHover={() => setActiveIndex(index)}
              onSelect={() => {
                onChange(country.iso2);
                setOpen(false);
                triggerRef.current?.focus();
              }}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className={`country-picker is-${variant}`}>
      <button
        ref={triggerRef}
        type="button"
        className={`country-picker-trigger${selected ? " has-value" : ""}${invalid ? " is-invalid" : ""}`}
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={invalid ? true : undefined}
        aria-controls={open ? listId : undefined}
        onClick={() => setOpen((current) => !current)}
        onBlur={() => {
          window.setTimeout(() => {
            if (openRef.current || selected) {
              return;
            }
            onEmptyBlur?.();
          }, 0);
        }}
      >
        <span className="country-picker-trigger-face">{triggerFace}</span>
      </button>
      {active && open && typeof document !== "undefined" && (!anchored || menuBox)
        ? createPortal(
            anchored ? (
              panel
            ) : (
              <div className="country-picker-sheet">
                <button
                  type="button"
                  className="country-picker-backdrop"
                  tabIndex={-1}
                  aria-label={copy.closeSelector}
                  onClick={() => setOpen(false)}
                />
                {panel}
              </div>
            ),
            document.body,
          )
        : null}
    </div>
  );
}

function CountryRow({
  id,
  country,
  locale,
  variant,
  selected,
  active,
  index,
  onHover,
  onSelect,
}: {
  id: string;
  country: CountryRecord;
  locale: Locale;
  variant: CountryPickerVariant;
  selected: boolean;
  active: boolean;
  index: number;
  onHover: () => void;
  onSelect: () => void;
}) {
  const flag = countryFlagEmoji(country.iso2);
  const name = country.names[locale];
  const dial = formatDialCode(country.iso2);
  const label =
    variant === "phone" ? `${name}, ${dial}` : `${name}, ${country.iso2}`;
  return (
    <button
      id={id}
      type="button"
      role="option"
      data-index={index}
      aria-selected={selected}
      aria-label={label}
      className={`country-picker-row${selected ? " is-selected" : ""}${active ? " is-active" : ""}`}
      onMouseEnter={onHover}
      onClick={onSelect}
    >
      <span className="country-picker-flag" aria-hidden="true">
        {flag}
      </span>
      <span className="country-picker-name">{name}</span>
      {variant === "phone" ? (
        <span className="country-picker-dial">{dial}</span>
      ) : null}
    </button>
  );
}
