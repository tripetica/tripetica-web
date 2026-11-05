"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { type FleetChoice } from "@/lib/partner/fleet-pairing-rules";

function labelsFor(values: readonly string[], options: readonly FleetChoice[], emptyLabel: string) {
  const names = options.filter((option) => values.includes(option.id)).map((option) => option.label);
  return names.length > 0 ? names.join(", ") : emptyLabel;
}

function placePopover(popover: HTMLElement, anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const width = Math.min(320, Math.max(224, rect.width));
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  popover.style.width = `${width}px`;
  popover.style.left = `${left}px`;
  popover.style.right = "auto";
  popover.style.margin = "0";
  popover.style.height = "auto";
  const spaceBelow = window.innerHeight - rect.bottom;
  if (spaceBelow < 220 && rect.top > spaceBelow) {
    popover.style.top = "auto";
    popover.style.bottom = `${window.innerHeight - rect.top + 6}px`;
    return;
  }
  popover.style.bottom = "auto";
  popover.style.top = `${rect.bottom + 6}px`;
}

export function FleetLinkMenu({
  mode,
  values,
  options,
  emptyLabel,
  saveLabel,
  cancelLabel,
  saveFailedLabel,
  open,
  onOpenChange,
  onSave,
  showTrigger = true,
}: {
  mode: "multiple" | "single";
  values: readonly string[];
  options: readonly FleetChoice[];
  emptyLabel: string;
  saveLabel: string;
  cancelLabel: string;
  saveFailedLabel: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSave: (next: string[]) => Promise<boolean>;
  showTrigger?: boolean;
}) {
  const generatedId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const opened = open ?? internalOpen;
  const setOpened = onOpenChange ?? setInternalOpen;
  const [draft, setDraft] = useState(values);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const seen = values.join(",");
  const [seenKey, setSeenKey] = useState(seen);
  if (seenKey !== seen) {
    setSeenKey(seen);
    if (!opened) {
      setDraft(values);
      setError(null);
    }
  }

  useEffect(() => {
    const popover = popoverRef.current;
    const anchor = anchorRef.current;
    if (!popover || !anchor) {
      return;
    }
    const menu: HTMLElement = popover;
    const point: HTMLElement = anchor;
    if (!opened) {
      if (menu.matches(":popover-open")) {
        menu.hidePopover();
      }
      return;
    }
    placePopover(menu, point);
    if (!menu.matches(":popover-open")) {
      menu.showPopover();
    }
    function onReflow() {
      if (menu.matches(":popover-open")) {
        placePopover(menu, point);
      }
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      if (menu.contains(target) || rootRef.current?.contains(target)) {
        return;
      }
      menu.hidePopover();
    }
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [opened]);

  const summary = labelsFor(values, options, emptyLabel);
  const choices = mode === "single" ? [{ id: "", label: emptyLabel }, ...options] : options;
  const selected = mode === "single" ? draft[0] ?? "" : "";

  function close() {
    setDraft(values);
    setError(null);
    setOpened(false);
  }

  function save() {
    const next = mode === "single" ? draft.slice(0, 1).filter(Boolean) : [...new Set(draft)];
    startTransition(async () => {
      const ok = await onSave(next);
      if (!ok) {
        setError(saveFailedLabel);
        return;
      }
      setError(null);
      setOpened(false);
    });
  }

  return (
    <div className="fleet-link-menu" ref={rootRef}>
      {showTrigger ? (
        <button
          ref={(node) => {
            anchorRef.current = node;
          }}
          type="button"
          className={`fleet-link-trigger${mode === "multiple" ? " is-wrapping" : ""}`}
          aria-expanded={opened}
          aria-controls={generatedId}
          onClick={() => {
            if (opened) {
              close();
              return;
            }
            setDraft(values);
            setError(null);
            setOpened(true);
          }}
        >
          {summary}
        </button>
      ) : (
        <span
          ref={(node) => {
            anchorRef.current = node;
          }}
          className="fleet-link-summary-text"
        >
          {summary}
        </span>
      )}
      <div
        id={generatedId}
        ref={popoverRef}
        className="fleet-link-popover"
        role="dialog"
        popover="manual"
        onToggle={(event) => {
          if (event.newState === "closed" && opened) {
            setDraft(values);
            setError(null);
            setOpened(false);
          }
        }}
      >
        <ul>
          {choices.map((option) => {
            const checked = mode === "single" ? selected === option.id : draft.includes(option.id);
            return (
              <li key={option.id || "none"}>
                <label className="fleet-link-option">
                  <span>{option.label}</span>
                  <input
                    type={mode === "single" ? "radio" : "checkbox"}
                    name={mode === "single" ? generatedId : undefined}
                    value={option.id}
                    checked={checked}
                    disabled={pending}
                    onChange={() => {
                      if (mode === "single") {
                        setDraft(option.id ? [option.id] : []);
                        return;
                      }
                      setDraft((current) =>
                        current.includes(option.id)
                          ? current.filter((id) => id !== option.id)
                          : [...current, option.id],
                      );
                    }}
                  />
                </label>
              </li>
            );
          })}
        </ul>
        <div className="fleet-link-actions">
          <button type="button" className="ops-btn-secondary" disabled={pending} onClick={close}>
            {cancelLabel}
          </button>
          <button type="button" className="ops-btn-primary" disabled={pending} onClick={save}>
            {saveLabel}
          </button>
        </div>
        {error ? <p className="ops-driver-sub-error" role="alert">{error}</p> : null}
      </div>
    </div>
  );
}
