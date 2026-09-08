"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(defaultOpen);
  const selected = options.find((option) => option.value === value) ?? null;
  const visible = useMemo(() => {
    const folded = query.trim().toLocaleLowerCase("tr");
    if (!folded) {
      return options;
    }
    return options.filter((option) => option.label.toLocaleLowerCase("tr").includes(folded));
  }, [options, query]);

  function closeMenu(dismissed = false) {
    setOpen(false);
    setQuery("");
    if (dismissed) {
      onDismissRef.current?.();
    }
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
                onClick={() => {
                  onChange(option.value);
                  closeMenu(false);
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
