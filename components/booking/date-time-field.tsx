"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { EditGlyph } from "@/components/booking/edit-glyph";
import { formatIstanbulLocalDisplay } from "@/lib/booking/istanbul-time";
import {
  BOSPHORUS_SERVICE_PICKUP_WINDOW,
  bosphorusLocalDateTimeFromDate,
} from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import {
  correctMinuteForHour,
  dateHasBookingConstraint,
  effectiveBookingMin,
  firstValidHourItem,
  firstValidMinuteItem,
  hourWheelItems,
  isDraftDatetimeValid,
  isHourWheelItemDisabled,
  isMinuteWheelItemDisabled,
  minuteWheelItems,
  snapHourWheelItem,
  snapMinuteWheelItem,
  valueToWheelItem,
  wheelItemToValue,
  WHEEL_UNSET_VALUE,
} from "@/lib/booking/datetime-wheel-rules";
import { panelAboveField, positionAnchoredPanel } from "@/lib/booking/panel-position";
import { type Locale } from "@/lib/i18n/config";

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
  variant?: "field" | "icon";
  editLabel?: string;
  clearLabel?: string;
  invalid?: boolean;
  /** When true, only the calendar date is shown/edited; value is still full local datetime. */
  dateOnly?: boolean;
};

export type DateTimeFieldHandle = {
  openPicker: () => void;
};

type PickerHandle = {
  openPicker: () => void;
};

function FieldClearButton({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <button
      type="button"
      className="booking-clear"
      aria-label={label}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClear();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      ×
    </button>
  );
}

export const DateTimeField = forwardRef<DateTimeFieldHandle, DateTimeFieldProps>(
  function DateTimeField(
    {
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
      variant = "field",
      editLabel,
      clearLabel,
      invalid = false,
      dateOnly = false,
    },
    ref,
  ) {
    const filled = value.length > 0;
    const desktopRef = useRef<PickerHandle>(null);
    const mobileRef = useRef<PickerHandle>(null);
    const shared = {
      locale,
      label,
      placeholder,
      value,
      min,
      error,
      filled,
      variant,
      editLabel,
      clearLabel,
      invalid,
      dateOnly,
      onChange,
      onPickerOpen,
    };

    useImperativeHandle(ref, () => ({
      openPicker() {
        const fine =
          typeof window !== "undefined" &&
          window.matchMedia("(hover: hover) and (pointer: fine)").matches;
        if (fine) {
          desktopRef.current?.openPicker();
        } else {
          mobileRef.current?.openPicker();
        }
      },
    }));

    return (
      <>
        <div className="booking-pointer-fine">
          <DesktopDateTimeField
            {...shared}
            id={`${id}-fine`}
            applyLabel={applyLabel}
            hourLabel={hourLabel}
            minuteLabel={minuteLabel}
            todayDate={todayDate}
            pickerRef={desktopRef}
          />
        </div>
        <div className="booking-pointer-coarse">
          <MobileDateTimeField
            {...shared}
            id={`${id}-coarse`}
            pickerRef={mobileRef}
          />
        </div>
      </>
    );
  },
);

function MobileDateTimeField({
  id,
  locale,
  label,
  placeholder,
  value,
  min,
  error,
  filled,
  variant = "field",
  editLabel,
  clearLabel,
  invalid = false,
  dateOnly = false,
  onChange,
  onPickerOpen,
  pickerRef,
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
  | "variant"
  | "editLabel"
  | "clearLabel"
  | "invalid"
  | "dateOnly"
> & { filled: boolean; pickerRef: RefObject<PickerHandle | null> }) {
  return (
    <NativeDateTimeField
      id={id}
      locale={locale}
      label={label}
      placeholder={placeholder}
      value={value}
      min={min}
      error={error}
      filled={filled}
      variant={variant}
      editLabel={editLabel}
      clearLabel={clearLabel}
      invalid={invalid}
      dateOnly={dateOnly}
      onChange={onChange}
      onPickerOpen={onPickerOpen}
      pickerRef={pickerRef}
    />
  );
}

function NativeDateTimeField({
  id,
  locale,
  label,
  placeholder,
  value,
  min,
  error,
  filled,
  variant = "field",
  editLabel,
  clearLabel,
  invalid = false,
  dateOnly = false,
  onChange,
  onPickerOpen,
  pickerRef,
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
  | "variant"
  | "editLabel"
  | "clearLabel"
  | "invalid"
  | "dateOnly"
> & { filled: boolean; pickerRef: RefObject<PickerHandle | null> }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  const minRef = useRef(min);
  const onChangeRef = useRef(onChange);
  const dateOnlyRef = useRef(dateOnly);
  const confirmedRef = useRef(false);

  function toInputValue(local: string) {
    if (!local) {
      return "";
    }
    return dateOnlyRef.current ? local.slice(0, 10) : local;
  }

  function fromInputValue(raw: string) {
    if (!raw) {
      return "";
    }
    if (dateOnlyRef.current) {
      return bosphorusLocalDateTimeFromDate(raw.slice(0, 10));
    }
    return raw;
  }

  useEffect(() => {
    valueRef.current = value;
    minRef.current = min;
    onChangeRef.current = onChange;
    dateOnlyRef.current = dateOnly;
  });

  useImperativeHandle(pickerRef, () => ({
    openPicker() {
      const input = inputRef.current;
      if (!input) {
        return;
      }
      onPickerOpen();
      if (!valueRef.current && minRef.current) {
        input.value = toInputValue(minRef.current);
      }
      input.focus();
      const showPicker = (
        input as HTMLInputElement & { showPicker?: () => void }
      ).showPicker;
      if (typeof showPicker === "function") {
        try {
          showPicker.call(input);
        } catch {
          input.click();
        }
      } else {
        input.click();
      }
    },
  }));

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }
    if (value) {
      input.value = toInputValue(value);
      return;
    }
    if (document.activeElement !== input) {
      input.value = "";
    }
  }, [value, dateOnly]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    function commitFromInput() {
      if (isIosDateTimePicker()) {
        return;
      }
      if (!input) {
        return;
      }
      const raw = input.value;
      if (!raw) {
        return;
      }
      const nextRaw = fromInputValue(raw);
      const floor = minRef.current;
      const next = floor && nextRaw < floor ? floor : nextRaw;
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
        input.value = toInputValue(minRef.current);
      }
      return;
    }
    onPickerOpen();
  }

  const displayValue = filled
    ? formatIstanbulLocalDisplay(value, locale)
    : placeholder;

  return (
    <label
      htmlFor={id}
      className={
        variant === "icon"
          ? "booking-edit-anchor booking-edit-native-wrap"
          : `booking-field booking-entry-field min-w-0 flex-1 ${filled ? "is-filled" : ""}${invalid ? " is-invalid" : ""}`
      }
    >
      {variant === "icon" ? null : (
        <span className="booking-field-label booking-field-label-out">{label}</span>
      )}
      <span
        className={
          variant === "icon"
            ? "booking-edit-native-box"
            : `booking-input-wrap relative block${filled && clearLabel ? " is-clearable" : ""}`
        }
      >
        {variant === "icon" ? (
          <span className="booking-edit-btn pointer-events-none" aria-hidden="true">
            <EditGlyph />
          </span>
        ) : (
          <span
            className={`booking-field-button pointer-events-none ${filled ? "is-filled" : ""}`}
            aria-hidden="true"
          >
            <span className="booking-field-label booking-field-label-in">{label}</span>
            {filled ? <CalendarGlyph /> : null}
            <span className="min-w-0 truncate">{displayValue}</span>
            {filled ? null : <Chevron />}
          </span>
        )}
        <input
          ref={inputRef}
          id={id}
          type={dateOnly ? "date" : "datetime-local"}
          step={dateOnly ? undefined : 60}
          min={dateOnly ? (min?.slice(0, 10) ?? undefined) : (min ?? undefined)}
          defaultValue=""
          aria-label={variant === "icon" ? editLabel ?? label : undefined}
          aria-invalid={invalid || undefined}
          onPointerDown={(event) => {
            if (!isIosDateTimePicker()) {
              return;
            }
            const input = event.currentTarget;
            if (!valueRef.current && minRef.current) {
              input.value = toInputValue(minRef.current);
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
                input.value = toInputValue(valueRef.current);
                return;
              }
              const next = fromInputValue(raw);
              if (next !== valueRef.current) {
                onChangeRef.current(next);
              }
              return;
            }
            if (input.value) {
              const nextRaw = fromInputValue(input.value);
              const floor = minRef.current;
              const next = floor && nextRaw < floor ? floor : nextRaw;
              if (next !== valueRef.current) {
                onChangeRef.current(next);
              }
              return;
            }
            input.value = toInputValue(valueRef.current);
          }}
          className="booking-datetime-native"
        />
        {variant === "icon" || !filled || !clearLabel ? null : (
          <FieldClearButton
            label={clearLabel}
            onClear={() => {
              valueRef.current = "";
              const input = inputRef.current;
              if (input) {
                input.value = "";
              }
              onChange("");
            }}
          />
        )}
      </span>
      {variant === "icon" || !error ? null : (
        <span className="booking-field-error">{error}</span>
      )}
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
  variant = "field",
  editLabel,
  clearLabel,
  invalid = false,
  dateOnly = false,
  pickerRef,
}: DateTimeFieldProps & {
  filled: boolean;
  pickerRef: RefObject<PickerHandle | null>;
}) {
  const parts = splitLocal(value);
  const effectiveMin = effectiveBookingMin(min);
  const minParts = splitLocal(effectiveMin ?? "");
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState("");
  const [draftHour, setDraftHour] = useState("");
  const [draftMinute, setDraftMinute] = useState("");
  const [hourInteracted, setHourInteracted] = useState(false);
  const [minuteInteracted, setMinuteInteracted] = useState(false);
  const hourInteractedRef = useRef(false);
  const minuteInteractedRef = useRef(false);
  const [menuBox, setMenuBox] = useState<DOMRect | null>(null);
  const [viewMonth, setViewMonth] = useState(
    monthKey(minParts.date || parts.date || todayDate || ""),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  function syncDraftFromValue() {
    if (parts.date && parts.time) {
      setDraftDate(parts.date);
      setDraftHour(parts.time.slice(0, 2));
      setDraftMinute(parts.time.slice(3, 5));
      setViewMonth(monthKey(parts.date || todayDate || ""));
      setHourInteracted(true);
      setMinuteInteracted(true);
      hourInteractedRef.current = true;
      minuteInteractedRef.current = true;
      return;
    }
    setDraftDate("");
    setDraftHour("");
    setDraftMinute("");
    setViewMonth(monthKey(minParts.date || todayDate || ""));
    setHourInteracted(false);
    setMinuteInteracted(false);
    hourInteractedRef.current = false;
    minuteInteractedRef.current = false;
  }

  function openPanel() {
    onPickerOpen();
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuBox(rect);
    }
    syncDraftFromValue();
    setOpen(true);
  }

  useImperativeHandle(pickerRef, () => ({
    openPicker: openPanel,
  }));

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
      const menu = menuRef.current;
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
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onOutside);
    }, 0);

    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [open, menuId]);

  useEffect(() => {
    if (!open || !draftHour || !draftMinute) {
      return;
    }
    const fixed = correctMinuteForHour(
      draftHour,
      draftMinute,
      draftDate,
      effectiveMin,
      minuteInteracted,
    );
    if (fixed !== draftMinute) {
      queueMicrotask(() => {
        setDraftMinute(fixed);
        setMinuteInteracted(true);
      });
      minuteInteractedRef.current = true;
    }
  }, [draftHour, draftDate, draftMinute, effectiveMin, minuteInteracted, open]);

  function apply() {
    if (dateOnly) {
      if (!draftDate) {
        return;
      }
      const local = bosphorusLocalDateTimeFromDate(draftDate);
      if (effectiveMin && local < effectiveMin) {
        return;
      }
      onChange(local);
      setOpen(false);
      return;
    }
    if (!isDraftDatetimeValid(draftDate, draftHour, draftMinute, effectiveMin)) {
      return;
    }
    const local = `${draftDate}T${draftHour}:${draftMinute}`;
    onChange(local);
    setOpen(false);
  }

  const canApply = dateOnly
    ? Boolean(
        draftDate &&
          (!effectiveMin ||
            bosphorusLocalDateTimeFromDate(draftDate) >= effectiveMin),
      )
    : isDraftDatetimeValid(
        draftDate,
        draftHour,
        draftMinute,
        effectiveMin,
      );
  const style =
    variant === "icon"
      ? positionAnchoredPanel(menuBox, {
          minWidth: 428,
          maxWidth: 560,
          maxHeight: 560,
          prefer: "below",
        })
      : panelAboveField(menuBox, {
          minWidth: 428,
          maxWidth: 520,
          maxHeight: 420,
        });
  const intlLocale =
    locale === "ru"
      ? "ru-RU"
      : locale === "tr"
        ? "tr-TR"
        : locale === "ar"
          ? "ar-SA"
          : "en-GB";

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    openPanel();
  }

  function handleHourInteract() {
    hourInteractedRef.current = true;
    setHourInteracted(true);
    if (dateHasBookingConstraint(draftDate, effectiveMin) && !draftHour) {
      const first = firstValidHourItem(
        hourWheelItems(),
        draftDate,
        effectiveMin,
        true,
      );
      if (first) {
        setDraftHour(wheelItemToValue(first));
      }
    }
  }

  function handleMinuteInteract() {
    minuteInteractedRef.current = true;
    setMinuteInteracted(true);
    if (
      draftHour &&
      dateHasBookingConstraint(draftDate, effectiveMin) &&
      !draftMinute
    ) {
      const first = firstValidMinuteItem(
        minuteWheelItems(),
        draftHour,
        draftDate,
        effectiveMin,
        true,
      );
      if (first) {
        setDraftMinute(wheelItemToValue(first));
      }
    }
  }

  function handleSelectDate(next: string) {
    setDraftDate(next);
    if (dateOnly) {
      setDraftHour("19");
      setDraftMinute("00");
      setHourInteracted(true);
      setMinuteInteracted(true);
      hourInteractedRef.current = true;
      minuteInteractedRef.current = true;
      return;
    }
    setHourInteracted(false);
    setMinuteInteracted(false);
    hourInteractedRef.current = false;
    minuteInteractedRef.current = false;
    if (dateHasBookingConstraint(next, effectiveMin)) {
      setDraftHour("");
      setDraftMinute("");
    }
  }

  return (
    <div
      ref={rootRef}
      className={
        variant === "icon"
          ? "booking-edit-anchor"
          : `booking-field booking-entry-field min-w-0 flex-1 ${filled ? "is-filled" : ""}${invalid ? " is-invalid" : ""}`
      }
    >
      {variant === "icon" ? null : (
        <span className="booking-field-label" id={`${id}-label`}>
          {label}
        </span>
      )}
      {variant === "icon" ? (
        <button
          ref={buttonRef}
          type="button"
          className="booking-edit-btn"
          aria-label={editLabel ?? label}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={toggleOpen}
        >
          <EditGlyph />
        </button>
      ) : (
        <div className={`booking-input-wrap${filled && clearLabel ? " is-clearable" : ""}`}>
          <button
            ref={buttonRef}
            type="button"
            className={`booking-field-button ${filled ? "is-filled" : ""}`}
            aria-labelledby={`${id}-label`}
            aria-expanded={open}
            aria-controls={menuId}
            aria-invalid={invalid || undefined}
            onClick={toggleOpen}
          >
            {filled ? <CalendarGlyph /> : null}
            <span className="min-w-0 truncate">
              {filled
                ? formatIstanbulLocalDisplay(value, locale)
                : placeholder}
            </span>
            {filled ? null : <Chevron />}
          </button>
          {filled && clearLabel ? (
            <FieldClearButton
              label={clearLabel}
              onClear={() => {
                setOpen(false);
                onChange("");
              }}
            />
          ) : null}
        </div>
      )}
      {variant === "icon" || !error ? null : (
        <span className="booking-field-error">{error}</span>
      )}
      {open && style && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              id={menuId}
              className="booking-menu location-float datetime-panel"
              style={style}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="datetime-panel-body">
                <DesktopCalendar
                  locale={intlLocale}
                  viewMonth={viewMonth}
                  selectedDate={draftDate}
                  minDate={minParts.date}
                  todayDate={todayDate ?? ""}
                  onViewMonthChange={setViewMonth}
                  onSelectDate={handleSelectDate}
                />
                <div className="datetime-panel-side">
                  {dateOnly ? (
                    <>
                      <div
                        className="datetime-locked-time"
                        aria-readonly="true"
                      >
                        <span className="datetime-locked-time-label">
                          {hourLabel}
                        </span>
                        <span className="datetime-locked-time-value">
                          {BOSPHORUS_SERVICE_PICKUP_WINDOW}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="booking-cta datetime-apply"
                        disabled={!canApply}
                        onClick={apply}
                      >
                        {applyLabel}
                      </button>
                    </>
                  ) : (
                  <>
                  <div
                    className={`datetime-wheels-wrap${draftDate ? "" : " is-locked"}`}
                  >
                    {draftDate ? null : (
                      <span className="datetime-wheels-hint" role="tooltip">
                        {locale === "ru"
                          ? "«Сначала выберите дату»"
                          : locale === "tr"
                            ? "Önce tarihi seçin"
                            : locale === "ar"
                              ? "اختر التاريخ أولاً"
                              : "Select a date first"}
                      </span>
                    )}
                    <div className="datetime-wheels-grid">
                      <span className="datetime-wheel-label">{hourLabel}</span>
                      <span className="datetime-wheel-label">{minuteLabel}</span>
                      <div className="datetime-wheels">
                        <TimeWheel
                        label={hourLabel}
                        items={hourWheelItems()}
                        value={draftHour}
                        locked={!draftDate}
                        isDisabled={(item) =>
                          isHourWheelItemDisabled(
                            item,
                            draftDate,
                            effectiveMin,
                            hourInteracted,
                          )
                        }
                        snapSelection={(centerItem) =>
                          snapHourWheelItem(
                            centerItem,
                            hourWheelItems(),
                            draftDate,
                            effectiveMin,
                            hourInteractedRef.current || hourInteracted,
                          )
                        }
                        onInteract={handleHourInteract}
                        onChange={setDraftHour}
                      />
                      <TimeWheel
                        label={minuteLabel}
                        items={minuteWheelItems()}
                        value={draftMinute}
                        locked={!draftDate || !draftHour}
                        isDisabled={(item) =>
                          isMinuteWheelItemDisabled(
                            item,
                            draftHour,
                            draftDate,
                            effectiveMin,
                            minuteInteracted,
                          )
                        }
                        snapSelection={(centerItem) =>
                          snapMinuteWheelItem(
                            centerItem,
                            minuteWheelItems(),
                            draftHour,
                            draftDate,
                            effectiveMin,
                            minuteInteractedRef.current || minuteInteracted,
                          )
                        }
                        onInteract={handleMinuteInteract}
                        onChange={setDraftMinute}
                      />
                      </div>
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
                  </>
                  )}
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
    return "1970-01";
  }
  return date.slice(0, 7);
}

function TimeWheel({
  label,
  items,
  value,
  locked = false,
  isDisabled,
  snapSelection,
  onInteract,
  onChange,
}: {
  label: string;
  items: string[];
  value: string;
  locked?: boolean;
  isDisabled: (item: string) => boolean;
  snapSelection: (centerItem: string) => string;
  onInteract?: () => void;
  onChange: (item: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const skipScrollSync = useRef(false);
  const scrollTimerRef = useRef(0);

  const alignSelectedToBand = useCallback(() => {
    const list = listRef.current;
    const wheelValue = valueToWheelItem(value);
    const selected = list?.querySelector(`[data-wheel-value="${wheelValue}"]`);
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
  }, [value]);

  useLayoutEffect(() => {
    alignSelectedToBand();
  }, [alignSelectedToBand]);

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
    let nearest: HTMLButtonElement | null = null;
    let nearestDistance = Infinity;

    for (const node of list.querySelectorAll("button")) {
      if (!(node instanceof HTMLButtonElement)) {
        continue;
      }
      const rect = node.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - center);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = node;
      }
    }

    const centerItem = nearest?.dataset.wheelValue ?? WHEEL_UNSET_VALUE;
    onInteract?.();
    const normalized = snapSelection(centerItem);
    if (normalized !== value) {
      onChange(normalized);
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
        aria-activedescendant={`${label}-${value ? value : "unset"}`}
        onScroll={() => {
          if (locked) {
            return;
          }
          window.clearTimeout(scrollTimerRef.current);
          scrollTimerRef.current = window.setTimeout(selectValueInBand, 70);
        }}
        onWheel={() => {
          if (!locked) {
            onInteract?.();
          }
        }}
        onPointerDown={() => {
          if (!locked) {
            onInteract?.();
          }
        }}
      >
        {items.map((item) => {
          const selected = item === valueToWheelItem(value);
          const unsetItem = item === WHEEL_UNSET_VALUE;
          return (
            <button
              key={item === WHEEL_UNSET_VALUE ? `${label}-unset` : `${label}-${item}`}
              id={`${label}-${item === WHEEL_UNSET_VALUE ? "unset" : item}`}
              type="button"
              role="option"
              data-wheel-value={item}
              data-selected={selected ? "true" : undefined}
              aria-selected={selected}
              disabled={locked || isDisabled(item)}
              className={`datetime-wheel-item ${selected ? "is-selected" : ""} ${
                selected && unsetItem ? "is-unset-selected" : ""
              }`}
              onClick={() => {
                if (!locked) {
                  onInteract?.();
                  onChange(snapSelection(item));
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
      width="20"
      height="20"
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
      width="14"
      height="14"
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
