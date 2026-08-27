"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { panelBelowField } from "@/lib/booking/panel-position";

const LIST_MAX_HEIGHT = 400;
const OPEN_EVENT = "tripetica:occupancy-open";
const SCROLL_INTO_VIEW_MS = 220;

type OccupancyOption = {
  value: number;
  label: string;
};

type OccupancySelectProps = {
  icon: ReactNode;
  label: string;
  value: number;
  options: OccupancyOption[];
  onChange: (next: number) => void;
  invalid?: boolean;
  error?: string;
  id?: string;
};

export function OccupancySelect({
  icon,
  label,
  value,
  options,
  onChange,
  invalid = false,
  error,
  id,
}: OccupancySelectProps) {
  const labelId = useId();
  const listId = useId();
  const instanceId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const centeredRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [menuBox, setMenuBox] = useState<DOMRect | null>(null);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const selected = options[selectedIndex] ?? options[0];
  const menuStyle = open ? panelBelowField(menuBox, { maxHeight: LIST_MAX_HEIGHT }) : undefined;

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const measure = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }
    setMenuBox(trigger.getBoundingClientRect());
  }, []);

  const openList = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const selectedNext = Math.max(
      0,
      options.findIndex((option) => option.value === value),
    );
    setActiveIndex(selectedNext);
    centeredRef.current = false;
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: instanceId }));

    const rect = trigger.getBoundingClientRect();
    const viewTop = window.visualViewport?.offsetTop ?? 0;
    const viewHeight = window.visualViewport?.height ?? window.innerHeight;
    const viewBottom = viewTop + viewHeight;
    const spaceBelow = viewBottom - rect.bottom - 6;
    const needsScroll = rect.top < viewTop + 8 || spaceBelow < 200;

    if (needsScroll) {
      trigger.scrollIntoView({ block: "center", behavior: "smooth" });
      window.setTimeout(() => {
        measure();
        setOpen(true);
      }, SCROLL_INTO_VIEW_MS);
      return;
    }

    measure();
    setOpen(true);
  }, [instanceId, measure, options, value]);

  useEffect(() => {
    function onPeerOpen(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail !== instanceId) {
        setOpen(false);
      }
    }

    window.addEventListener(OPEN_EVENT, onPeerOpen);
    return () => {
      window.removeEventListener(OPEN_EVENT, onPeerOpen);
    };
  }, [instanceId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => Math.min(options.length - 1, index + 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
        return;
      }
      if (event.key === "Home") {
        event.preventDefault();
        setActiveIndex(0);
        return;
      }
      if (event.key === "End") {
        event.preventDefault();
        setActiveIndex(options.length - 1);
        return;
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const option = options[activeIndex];
        if (option) {
          onChange(option.value);
          close();
          triggerRef.current?.focus();
        }
      }
    }

    function onOutside(event: Event) {
      const trigger = triggerRef.current;
      const list = listRef.current;
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (trigger?.contains(target) || list?.contains(target)) {
        return;
      }
      close();
    }

    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    window.visualViewport?.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("scroll", measure);
    const timer = window.setTimeout(() => {
      document.addEventListener("pointerdown", onOutside);
    }, 0);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      window.visualViewport?.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("scroll", measure);
      window.clearTimeout(timer);
      document.removeEventListener("pointerdown", onOutside);
    };
  }, [activeIndex, close, measure, onChange, open, options]);

  useLayoutEffect(() => {
    if (!open) {
      centeredRef.current = false;
      return;
    }
    const list = listRef.current;
    if (!list) {
      return;
    }

    if (!centeredRef.current) {
      const selectedOption = list.querySelector<HTMLElement>('[aria-selected="true"]');
      if (selectedOption) {
        list.scrollTop = Math.max(
          0,
          selectedOption.offsetTop -
            list.clientHeight / 2 +
            selectedOption.offsetHeight / 2,
        );
      }
      centeredRef.current = true;
      return;
    }

    const option = list.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (!option) {
      return;
    }
    const optionTop = option.offsetTop;
    const optionBottom = optionTop + option.offsetHeight;
    if (optionTop < list.scrollTop) {
      list.scrollTop = optionTop;
    } else if (optionBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = optionBottom - list.clientHeight;
    }
  }, [activeIndex, open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const list = listRef.current;
    if (!list) {
      return;
    }
    const scroller: HTMLUListElement = list;

    function onWheel(event: WheelEvent) {
      event.stopPropagation();
      const atTop = scroller.scrollTop <= 0 && event.deltaY < 0;
      const atBottom =
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1 &&
        event.deltaY > 0;
      if (atTop || atBottom) {
        event.preventDefault();
      }
    }

    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      scroller.removeEventListener("wheel", onWheel);
    };
  }, [open]);

  const activeOption = options[activeIndex];
  const activeId = activeOption ? `${listId}-opt-${activeOption.value}` : undefined;

  return (
    <div className={`booking-occupancy-block${invalid ? " is-invalid" : ""}`} id={id}>
      <div className="booking-extra-row booking-occupancy-row">
      <span className="booking-info-icon">{icon}</span>
      <span className="booking-occupancy-label" id={labelId}>
        {label}
      </span>
      <div className="booking-extra-control">
        <select
          className={`booking-occupancy-select booking-occupancy-native${invalid ? " is-invalid" : ""}`}
          value={value}
          aria-labelledby={labelId}
          aria-invalid={invalid || undefined}
          onChange={(event) => onChange(Number(event.target.value))}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          ref={triggerRef}
          type="button"
          className={`booking-occupancy-trigger${invalid ? " is-invalid" : ""}`}
          role="combobox"
          aria-labelledby={labelId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open ? activeId : undefined}
          aria-invalid={invalid || undefined}
          onClick={() => {
            if (open) {
              close();
              return;
            }
            openList();
          }}
          onKeyDown={(event) => {
            if (open) {
              return;
            }
            if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openList();
            }
          }}
        >
          {selected?.label}
        </button>
      </div>
      {open && menuStyle && typeof document !== "undefined"
        ? createPortal(
            <ul
              ref={listRef}
              id={listId}
              className="occupancy-listbox"
              style={menuStyle}
              role="listbox"
              aria-labelledby={labelId}
              tabIndex={-1}
            >
              {options.map((option, index) => {
                const isSelected = option.value === value;
                const isActive = index === activeIndex;
                return (
                  <li key={option.value} role="none">
                    <div
                      id={`${listId}-opt-${option.value}`}
                      role="option"
                      data-index={index}
                      aria-selected={isSelected}
                      className={`occupancy-listbox-option${isSelected ? " is-selected" : ""}${
                        isActive ? " is-active" : ""
                      }`}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => {
                        onChange(option.value);
                        close();
                        triggerRef.current?.focus();
                      }}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                    >
                      {option.label}
                    </div>
                  </li>
                );
              })}
            </ul>,
            document.body,
          )
        : null}
      </div>
      {invalid && error ? (
        <span className="booking-field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
