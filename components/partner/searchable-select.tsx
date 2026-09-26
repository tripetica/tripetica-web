"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  filterSearchableSelectOptions,
  pointerGestureExceededSlop,
  shouldPreventDefaultOnOptionPointerDown,
} from "@/lib/partner/searchable-select";

type SearchableSelectOption = {
  value: string;
  label: string;
};

type SearchableSelectProps = {
  name?: string;
  value: string;
  options: readonly SearchableSelectOption[];
  placeholder: string;
  emptyLabel: string;
  disabled?: boolean;
  error?: string | null;
  fieldId?: string;
  defaultOpen?: boolean;
  menuInFlow?: boolean;
  onChange: (value: string) => void;
  onDismiss?: () => void;
};

type OptionGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  moved: boolean;
};

export function SearchableSelect({
  name,
  value,
  options,
  placeholder,
  emptyLabel,
  disabled = false,
  error,
  fieldId,
  defaultOpen = false,
  menuInFlow = false,
  onChange,
  onDismiss,
}: SearchableSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const ignoreNextFocusRef = useRef(false);
  const gestureRef = useRef<OptionGesture | null>(null);
  const selectedByPointerRef = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(defaultOpen);
  const selected = options.find((option) => option.value === value) ?? null;
  const visible = useMemo(
    () => filterSearchableSelectOptions(options, query),
    [options, query],
  );

  function closeMenu(dismissed = false) {
    setOpen(false);
    setQuery("");
    if (dismissed) {
      onDismissRef.current?.();
    }
  }

  function selectOption(nextValue: string) {
    ignoreNextFocusRef.current = true;
    onChange(nextValue);
    closeMenu(false);
  }

  useEffect(() => {
    if (!open || disabled) {
      return;
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target)) {
        return;
      }
      closeMenu(true);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      closeMenu(true);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [disabled, open]);

  return (
    <div className={`partner-language-select${menuInFlow ? " is-inflow" : ""}`} ref={rootRef}>
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <input
        id={fieldId}
        className={`partner-language-search${error ? " is-invalid" : ""}`}
        value={open ? query : selected?.label ?? ""}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={defaultOpen}
        disabled={disabled}
        aria-expanded={open}
        aria-invalid={error ? true : undefined}
        onFocus={() => {
          if (disabled) {
            return;
          }
          if (ignoreNextFocusRef.current) {
            ignoreNextFocusRef.current = false;
            return;
          }
          setQuery("");
          setOpen(true);
        }}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape" || !open) {
            return;
          }
          event.preventDefault();
          closeMenu(true);
        }}
      />
      {open && !disabled ? (
        <div className="partner-language-menu" role="listbox">
          {visible.length === 0 ? (
            <p className="partner-language-empty">{emptyLabel}</p>
          ) : (
            visible.map((option) => (
              <button
                key={option.value}
                type="button"
                className="partner-language-option"
                onPointerDown={(event) => {
                  // Keep outside-dismiss listeners from closing the menu.
                  event.stopPropagation();
                  // Mouse/pen: preventDefault keeps the search input focused so click lands.
                  // Touch: never preventDefault — that blocks native list scrolling.
                  if (shouldPreventDefaultOnOptionPointerDown(event.pointerType)) {
                    event.preventDefault();
                  }
                  gestureRef.current = {
                    pointerId: event.pointerId,
                    startX: event.clientX,
                    startY: event.clientY,
                    moved: false,
                  };
                  selectedByPointerRef.current = false;
                }}
                onPointerMove={(event) => {
                  const gesture = gestureRef.current;
                  if (!gesture || gesture.pointerId !== event.pointerId || gesture.moved) {
                    return;
                  }
                  if (
                    pointerGestureExceededSlop({
                      startX: gesture.startX,
                      startY: gesture.startY,
                      x: event.clientX,
                      y: event.clientY,
                    })
                  ) {
                    gesture.moved = true;
                  }
                }}
                onPointerUp={(event) => {
                  const gesture = gestureRef.current;
                  gestureRef.current = null;
                  if (!gesture || gesture.pointerId !== event.pointerId || gesture.moved) {
                    return;
                  }
                  selectedByPointerRef.current = true;
                  selectOption(option.value);
                }}
                onPointerCancel={() => {
                  gestureRef.current = null;
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  // Keyboard activation (and any missed pointerup) still selects once.
                  if (selectedByPointerRef.current) {
                    selectedByPointerRef.current = false;
                    return;
                  }
                  if (open) {
                    selectOption(option.value);
                  }
                }}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
