"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { formatIstanbulLocalDisplay } from "@/lib/booking/istanbul-time";
import { panelAboveField } from "@/lib/booking/panel-position";
import { type Locale } from "@/lib/i18n/config";
import {
  DATETIME_DESKTOP_QUERY,
  useMediaQuery,
} from "@/lib/ui/use-media-query";

const DESKTOP_PICKER_QUERY = DATETIME_DESKTOP_QUERY;

function isIosDateTimePicker() {
  if (typeof navigator === "undefined") {
    return false;
  }
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

type DateTimeFieldProps = {
  id: string;
  locale: Locale;
  label: string;
  placeholder: string;
  applyLabel: string;
  hourLabel: string;
  minuteLabel: string;
  value: string;
  min: string | null;
  error: string | null;
  todayDate?: string | null;
  onChange: (value: string) => void;
  onPickerOpen: () => void;
};

export function DateTimeField({
  id,
  locale,
  label,
  placeholder,
  applyLabel,
  hourLabel,
  minuteLabel,
  value,
  min,
  error,
  todayDate = null,
  onChange,
  onPickerOpen,
}: DateTimeFieldProps) {
  const desktop = useMediaQuery(DESKTOP_PICKER_QUERY);
  const filled = value.length > 0;

  if (desktop) {
    return (
      <DesktopDateTimeField
        id={id}
        locale={locale}
        label={label}
        placeholder={placeholder}
        applyLabel={applyLabel}
        hourLabel={hourLabel}
        minuteLabel={minuteLabel}
        value={value}
        min={min}
        error={error}
        todayDate={todayDate}
        filled={filled}
        onChange={onChange}
        onPickerOpen={onPickerOpen}
      />
    );
  }

  return (
    <MobileDateTimeField
      id={id}
      locale={locale}
      label={label}
      placeholder={placeholder}
      value={value}
      min={min}
      error={error}
      filled={filled}
      onChange={onChange}
      onPickerOpen={onPickerOpen}
    />
  );
}

function MobileDateTimeField({
  id,
  locale,
  label,
  placeholder,
  value,
  min,
  error,
  filled,
  onChange,
  onPickerOpen,
}: Pick<
  DateTimeFieldProps,
  | "id"
  | "locale"
  | "label"
  | "placeholder"
  | "value"
  | "min"
  | "error"
  | "onChange"
  | "onPickerOpen"
> & { filled: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const minRef = useRef(min);
  const onChangeRef = useRef(onChange);
  const confirmedRef = useRef(false);

  valueRef.current = value;
  minRef.current = min;
  onChangeRef.current = onChange;

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    if (value) {
      input.value = value;
      return;
    }
    if (document.activeElement !== input) {
      input.value = "";
    }
  }, [value]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    function commitFromInput() {
      if (isIosDateTimePicker()) {
        return;
      }
      const raw = input.value;
      if (!raw) {
        return;
      }
      const floor = minRef.current;
      const next = floor && raw < floor ? floor : raw;
      confirmedRef.current = true;
      if (next !== valueRef.current) {
        onChangeRef.current(next);
      }
      input.blur();
    }

    input.addEventListener("change", commitFromInput);
    return () => input.removeEventListener("change", commitFromInput);
  }, []);

  function showPickerDefault(input: HTMLInputElement) {
    confirmedRef.current = false;
    if (isIosDateTimePicker()) {
      if (!valueRef.current && minRef.current) {
        input.value = minRef.current;
      }
      return;
    }
    onPickerOpen();
  }

  return (
    <label htmlFor={id} className={`booking-field booking-entry-field min-w-0 flex-1 ${filled ? "is-filled" : ""}`}>
      <span className="booking-field-label booking-field-label-out">{label}</span>
      <span className="relative block">
        <span
          className={`booking-field-button pointer-events-none ${filled ? "is-filled" : ""}`}
          aria-hidden="true"
        >
          <span className="booking-field-label booking-field-label-in">{label}</span>
          {filled ? <CalendarGlyph /> : null}
          <span className="min-w-0 truncate">
            {filled ? formatIstanbulLocalDisplay(value, locale) : placeholder}
          </span>
          <Chevron />
        </span>
        <input
          ref={inputRef}
          id={id}
          type="datetime-local"
          step={60}
          min={min ?? undefined}
          defaultValue=""
          onPointerDown={(event) => {
            if (!isIosDateTimePicker()) {
              return;
            }
            const input = event.currentTarget;
            if (!valueRef.current && minRef.current) {
              input.value = minRef.current;
            }
          }}
          onFocus={(event) => showPickerDefault(event.currentTarget)}
          onClick={(event) => {
            if (isIosDateTimePicker()) {
              return;
            }
            showPickerDefault(event.currentTarget);
          }}
          onBlur={(event) => {
            if (confirmedRef.current) {
              confirmedRef.current = false;
              return;
            }
            const input = event.currentTarget;
            if (isIosDateTimePicker()) {
              const raw = input.value;
              if (!raw) {
                input.value = valueRef.current;
                return;
              }
              if (raw !== valueRef.current) {
                onChangeRef.current(raw);
              }
              return;
            }
            if (input.value) {
              const raw = input.value;
              const floor = minRef.current;
              const next = floor && raw < floor ? floor : raw;
              if (next !== valueRef.current) {
                onChangeRef.current(next);
              }
              return;
            }
            input.value = valueRef.current;
          }}
          className="booking-datetime-native"
        />
      </span>
      {error ? <span className="booking-field-error">{error}</span> : null}
    </label>
  );
}

function DesktopDateTimeField({
  id,
  locale,
  label,
  placeholder,
  applyLabel,
  hourLabel,
  minuteLabel,
  value,
  min,
  error,
  todayDate = null,
  filled,
  onChange,
  onPickerOpen,
}: DateTimeFieldProps & { filled: boolean }) {
  const parts = splitLocal(value);
  const minParts = splitLocal(min ?? "");
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [draftHour, setDraftHour] = useState("");
  const [draftMinute, setDraftMinute] = useState("");
  const [menuBox, setMenuBox] = useState<DOMRect | null>(null);
  const [viewMonth, setViewMonth] = useState(monthKey(minParts.date || parts.date));
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function measure() {
      const button = buttonRef.current;
      if (button) {
        setMenuBox(button.getBoundingClientRect());
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function onOutside(event: Event) {
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
    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onOutside);
    }, 0);

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [open, menuId]);

  function apply() {
    if (!draftDate || !draftHour || !draftMinute) {
      return;
    }
    const local = `${draftDate}T${draftHour}:${draftMinute}`;
    if (min && local < min) {
      return;
    }
    onChange(local);
    setOpen(false);
  }

  const draftLocal =
    draftDate && draftHour && draftMinute
      ? `${draftDate}T${draftHour}:${draftMinute}`
      : "";
  const canApply = Boolean(draftLocal && (!min || draftLocal >= min));
  const style = panelAboveField(menuBox, {
    minWidth: 428,
    maxWidth: 520,
    maxHeight: 420,
  });
  const intlLocale =
    locale === "ru" ? "ru-RU" : locale === "tr" ? "tr-TR" : "en-GB";

  return (
    <div ref={rootRef} className={`booking-field booking-entry-field min-w-0 flex-1 ${filled ? "is-filled" : ""}`}>
      <span className="booking-field-label" id={`${id}-label`}>
        {label}
      </span>
      <button
        ref={buttonRef}
        type="button"
        className={`booking-field-button ${filled ? "is-filled" : ""}`}
        aria-labelledby={`${id}-label`}
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => {
          onPickerOpen();
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) {
            setMenuBox(rect);
          }
          if (parts.date && parts.time) {
            setDraftDate(parts.date);
            setDraftHour(parts.time.slice(0, 2));
            setDraftMinute(parts.time.slice(3, 5));
            setViewMonth(monthKey(parts.date));
          } else {
            setDraftDate("");
            setDraftHour("");
            setDraftMinute("");
            setViewMonth(monthKey(minParts.date));
          }
          setOpen((current) => !current);
        }}
      >
        {filled ? <CalendarGlyph /> : null}
        <span className="min-w-0 truncate">
          {filled ? formatIstanbulLocalDisplay(value, locale) : placeholder}
        </span>
        <Chevron />
      </button>
      {error ? <span className="booking-field-error">{error}</span> : null}
      {open && style && typeof document !== "undefined"
        ? createPortal(
            <div id={menuId} className="booking-menu location-float datetime-panel" style={style}>
              <div className="datetime-panel-body">
                <DesktopCalendar
                  locale={intlLocale}
                  viewMonth={viewMonth}
                  selectedDate={draftDate}
                  minDate={minParts.date}
                  todayDate={todayDate ?? ""}
                  onViewMonthChange={setViewMonth}
                  onSelectDate={(next) => {
                    setDraftDate(next);
                  }}
                />
                <div className="datetime-panel-side">
                  <div
                    className={`datetime-wheels-wrap${draftDate ? "" : " is-locked"}`}
                  >
                    {draftDate ? null : (
                      <span className="datetime-wheels-hint" role="tooltip">
                        {locale === "ru"
                          ? "«Сначала выберите дату»"
                          : locale === "tr"
                            ? "Önce tarihi seçin"
                            : "Select a date first"}
                      </span>
                    )}
                    <div className="datetime-wheels">
                      <TimeWheel
                        label={hourLabel}
                        items={hoursList()}
                        value={draftHour}
                        locked={!draftDate}
                        isDisabled={(item) => isHourDisabled(draftDate, item, min)}
                        onChange={setDraftHour}
                      />
                      <TimeWheel
                        label={minuteLabel}
                        items={minutesList()}
                        value={draftMinute}
                        locked={!draftDate}
                        isDisabled={(item) =>
                          draftDate && draftHour
                            ? isMinuteDisabled(draftDate, Number(draftHour), item, min)
                            : false
                        }
                        onChange={setDraftMinute}
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    className="booking-cta datetime-apply"
                    disabled={!canApply}
                    onClick={apply}
                  >
                    {applyLabel}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function splitLocal(value: string) {
  const [date = "", time = ""] = value.split("T");
  return { date, time: time.slice(0, 5) };
}

function monthKey(date: string) {
  if (!date) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }
  return date.slice(0, 7);
}

function hoursList() {
  return Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
}

function minutesList() {
  return Array.from({ length: 12 }, (_, index) =>
    String(index * 5).padStart(2, "0"),
  );
}

function isHourDisabled(date: string, hour: string, min: string | null) {
  if (!min || !date) {
    return false;
  }
  return `${date}T${hour}:55` < min;
}

function isMinuteDisabled(
  date: string,
  hour: number,
  minute: string,
  min: string | null,
) {
  if (!min || !date) {
    return false;
  }
  return `${date}T${String(hour).padStart(2, "0")}:${minute}` < min;
}

function TimeWheel({
  label,
  items,
  value,
  locked = false,
  isDisabled,
  onChange,
}: {
  label: string;
  items: string[];
  value: string;
  locked?: boolean;
  isDisabled: (item: string) => boolean;
  onChange: (item: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const skipScrollSync = useRef(false);
  const scrollTimerRef = useRef(0);

  function alignSelectedToBand() {
    if (!value) {
      return;
    }
    const list = listRef.current;
    const selected = list?.querySelector("[data-selected='true']");
    if (!(list instanceof HTMLElement) || !(selected instanceof HTMLElement)) {
      return;
    }
    const bandHost = list.closest(".datetime-wheels");
    const bandRect =
      bandHost instanceof HTMLElement
        ? bandHost.getBoundingClientRect()
        : list.getBoundingClientRect();
    const itemRect = selected.getBoundingClientRect();
    const delta =
      itemRect.top + itemRect.height / 2 - (bandRect.top + bandRect.height / 2);
    if (Math.abs(delta) < 0.5) {
      return;
    }
    skipScrollSync.current = true;
    list.scrollTop += delta;
    window.requestAnimationFrame(() => {
      skipScrollSync.current = false;
    });
  }

  useLayoutEffect(() => {
    alignSelectedToBand();
  }, [value]);

  useEffect(() => {
    return () => window.clearTimeout(scrollTimerRef.current);
  }, []);

  function selectValueInBand() {
    if (skipScrollSync.current) {
      skipScrollSync.current = false;
      return;
    }
    const list = listRef.current;
    if (!(list instanceof HTMLElement)) {
      return;
    }
    const bandHost = list.closest(".datetime-wheels");
    const bandRect =
      bandHost instanceof HTMLElement
        ? bandHost.getBoundingClientRect()
        : list.getBoundingClientRect();
    const center = bandRect.top + bandRect.height / 2;
    let nearestEnabled: HTMLButtonElement | null = null;
    let nearestEnabledDistance = Infinity;

    for (const node of list.querySelectorAll("button")) {
      if (!(node instanceof HTMLButtonElement) || node.disabled) {
        continue;
      }
      const rect = node.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - center);
      if (distance < nearestEnabledDistance) {
        nearestEnabledDistance = distance;
        nearestEnabled = node;
      }
    }

    const next = nearestEnabled?.textContent?.trim();
    if (next && next !== value) {
      onChange(next);
      return;
    }
    alignSelectedToBand();
  }

  return (
    <div className="datetime-wheel">
      <div
        ref={listRef}
        className="datetime-wheel-list"
        role="listbox"
        aria-label={label}
        aria-activedescendant={value ? `${label}-${value}` : undefined}
        onScroll={() => {
          if (locked) {
            return;
          }
          window.clearTimeout(scrollTimerRef.current);
          scrollTimerRef.current = window.setTimeout(selectValueInBand, 70);
        }}
      >
        {items.map((item) => {
          const selected = Boolean(value) && item === value;
          return (
            <button
              key={item}
              id={`${label}-${item}`}
              type="button"
              role="option"
              data-selected={selected ? "true" : undefined}
              aria-selected={selected}
              disabled={locked || isDisabled(item)}
              className={`datetime-wheel-item ${selected ? "is-selected" : ""}`}
              onClick={() => {
                if (!locked) {
                  onChange(item);
                }
              }}
            >
              <span className="datetime-wheel-value">{item}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DesktopCalendar({
  locale,
  viewMonth,
  selectedDate,
  minDate,
  todayDate,
  onViewMonthChange,
  onSelectDate,
}: {
  locale: string;
  viewMonth: string;
  selectedDate: string;
  minDate: string;
  todayDate: string;
  onViewMonthChange: (value: string) => void;
  onSelectDate: (value: string) => void;
}) {
  const [year, month] = viewMonth.split("-").map(Number);
  const title = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
  const weekdays = weekdayLabels(locale);
  const cells = monthCells(year, month - 1);

  function shift(delta: number) {
    const next = new Date(year, month - 1 + delta, 1);
    onViewMonthChange(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
    );
  }

  return (
    <div className="datetime-cal">
      <div className="datetime-cal-head">
        <button type="button" className="datetime-cal-nav" onClick={() => shift(-1)}>
          ‹
        </button>
        <span className="datetime-cal-title">{title}</span>
        <button type="button" className="datetime-cal-nav" onClick={() => shift(1)}>
          ›
        </button>
      </div>
      <div className="datetime-cal-week">
        {weekdays.map((day) => (
          <span key={day} className="datetime-cal-weekday">
            {day}
          </span>
        ))}
      </div>
      <div className="datetime-cal-grid">
        {cells.map((day, index) => {
          if (!day) {
            return <span key={`e-${index}`} />;
          }
          const value = `${viewMonth}-${String(day).padStart(2, "0")}`;
          const disabled = Boolean(minDate && value < minDate);
          const selected = Boolean(selectedDate) && value === selectedDate;
          const today = Boolean(todayDate) && value === todayDate;
          return (
            <button
              key={value}
              type="button"
              disabled={disabled}
              className={`datetime-cal-day ${selected ? "is-selected" : ""} ${
                today && !selected && !disabled ? "is-today" : ""
              }`}
              onClick={() => onSelectDate(value)}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function weekdayLabels(locale: string) {
  const formatter = new Intl.DateTimeFormat(locale, { weekday: "short" });
  return Array.from({ length: 7 }, (_, index) =>
    formatter.format(new Date(Date.UTC(2024, 0, 1 + index, 12))),
  );
}

function monthCells(year: number, monthIndex: number) {
  const first = new Date(year, monthIndex, 1);
  const offset = (first.getDay() + 6) % 7;
  const days = new Date(year, monthIndex + 1, 0).getDate();
  return [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: days }, (_, index) => index + 1),
  ];
}

function CalendarGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="location-icon location-icon-field"
      fill="currentColor"
    >
      <path d="M7 3.2h1.8v1.6H15V3.2h1.8v1.6H19c1.1 0 2 .9 2 2V19c0 1.1-.9 2-2 2H5c-1.1 0-2-.9-2-2V6.8c0-1.1.9-2 2-2h2V3.2ZM5 9.4v9.6h14V9.4H5Zm2.4 2.2h3.2V15H7.4v-3.4Zm4.6 0h3.2V15h-3.2v-3.4Z" />
    </svg>
  );
}

function Chevron() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-white/80"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
    >
      <path d="M3.5 6.25 8 10.75l4.5-4.5" />
    </svg>
  );
}
