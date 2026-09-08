"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { EditGlyph } from "@/components/booking/edit-glyph";
import {
  panelAboveField,
  positionAnchoredPanel,
} from "@/lib/booking/panel-position";
import {
  BOOKING_DESKTOP_QUERY,
  useMediaQuery,
} from "@/lib/ui/use-media-query";

type BookingSelectOption = {
  id: string;
  label: string;
};

type BookingSelectProps = {
  label: string;
  title: string;
  placeholder: string;
  closeLabel: string;
  icon?: ReactNode;
  value: string | null;
  options: BookingSelectOption[];
  onChange: (id: string) => void;
  variant?: "field" | "icon";
  editLabel?: string;
  className?: string;
  invalid?: boolean;
  clearLabel?: string;
  onClear?: () => void;
};

export function BookingSelect({
  label,
  title,
  placeholder,
  closeLabel,
  icon,
  value,
  options,
  onChange,
  variant = "field",
  editLabel,
  className = "",
  invalid = false,
  clearLabel,
  onClear,
}: BookingSelectProps) {
  const desktop = useMediaQuery(BOOKING_DESKTOP_QUERY);
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<DOMRect | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);
  const listBodyRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const selected = options.find((option) => option.id === value);
  const selectedLabel = selected?.label;
  const menuStyle = desktop
    ? variant === "icon"
      ? positionAnchoredPanel(menuBox, {
          minWidth: 280,
          maxWidth: 320,
          maxHeight: 420,
          prefer: "below",
        })
      : panelAboveField(menuBox)
    : undefined;

  useEffect(() => {
    if (!open) {
      return;
    }

    const selectedIndex = Math.max(
      0,
      options.findIndex((option) => option.id === value),
    );
    const activeIndexRef = { current: selectedIndex };

    function measure() {
      const button = buttonRef.current;
      if (button) {
        setMenuBox(button.getBoundingClientRect());
      }
    }

    function onKeyDownLive(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => {
          const next = Math.min(options.length - 1, index + 1);
          activeIndexRef.current = next;
          return next;
        });
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => {
          const next = Math.max(0, index - 1);
          activeIndexRef.current = next;
          return next;
        });
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        activeIndexRef.current = 0;
        setActiveIndex(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        activeIndexRef.current = options.length - 1;
        setActiveIndex(options.length - 1);
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
    document.addEventListener("keydown", onKeyDownLive);

    let previousOverflow = "";
    if (!desktop) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }

    const frame = window.requestAnimationFrame(() => {
      if (variant === "icon") {
        listBodyRef.current?.scrollTo({ top: 0 });
        document.getElementById(menuId)?.scrollTo({ top: 0 });
      } else {
        selectedRef.current?.scrollIntoView({ block: "center", inline: "nearest" });
      }
    });
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onOutside);
    }, 0);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      document.removeEventListener("keydown", onKeyDownLive);
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onOutside);
      if (!desktop) {
        document.body.style.overflow = previousOverflow;
      }
    };
  }, [open, menuId, options, value, desktop, variant]);

  function openPanel() {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuBox(rect);
    }
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((option) => option.id === value),
      ),
    );
    setOpen(true);
  }

  const list = (
    <ul className="location-panel-list" role="listbox">
      {options.map((option, index) => {
        const isSelected = option.id === value;
        return (
          <li key={option.id} role="none">
            <button
              ref={isSelected ? selectedRef : undefined}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`booking-menu-item ${isSelected ? "is-selected" : ""} ${
                index === activeIndex ? "is-active" : ""
              }`}
              onClick={() => {
                onChange(option.id);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          </li>
        );
      })}
    </ul>
  );

  const panel = open ? (
    <div
      id={menuId}
      className={desktop ? "booking-menu location-float" : "location-sheet"}
      style={menuStyle}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {desktop ? null : (
        <div className="location-sheet-bar">
          <button
            type="button"
            className="location-back"
            aria-label={closeLabel}
            onClick={() => setOpen(false)}
          >
            ←
          </button>
          <h2 className="location-sheet-title">{title}</h2>
        </div>
      )}
      <div ref={listBodyRef} className="location-sheet-body">
        {list}
      </div>
    </div>
  ) : null;

  function toggleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    openPanel();
  }

  function onTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) {
        onChange(option.id);
        setOpen(false);
      }
    }
  }

  if (variant === "icon") {
    return (
      <div ref={rootRef} className="booking-edit-anchor">
        <button
          ref={buttonRef}
          type="button"
          className="booking-edit-btn"
          aria-label={editLabel ?? title}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={menuId}
          onKeyDown={onTriggerKeyDown}
          onClick={toggleOpen}
        >
          <EditGlyph />
        </button>
        {open && typeof document !== "undefined"
          ? createPortal(panel, document.body)
          : null}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={`booking-field min-w-0${selectedLabel ? " is-filled" : ""}${invalid ? " is-invalid" : ""}${className ? ` ${className}` : " flex-1"}`}
    >
      <span className="booking-field-label booking-field-label-out">{label}</span>
      <div
        className={`booking-input-wrap${selectedLabel && clearLabel ? " is-clearable" : ""}`}
      >
        <button
          ref={buttonRef}
          type="button"
          className={`booking-field-button ${selectedLabel ? "is-filled" : ""}`}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={menuId}
          aria-invalid={invalid || undefined}
          onKeyDown={onTriggerKeyDown}
          onClick={toggleOpen}
        >
          <span className="booking-field-label booking-field-label-in" aria-hidden="true">
            {label}
          </span>
          {selectedLabel ? icon : null}
          <span className="min-w-0 truncate">{selectedLabel ?? placeholder}</span>
          {selectedLabel ? null : <Chevron open={open} />}
        </button>
        {selectedLabel && clearLabel && onClear ? (
          <button
            type="button"
            className="booking-clear"
            aria-label={clearLabel}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              onClear();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 shrink-0 text-white/80 transition-transform duration-200 ${
        open ? "rotate-180" : "rotate-0"
      }`}
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
