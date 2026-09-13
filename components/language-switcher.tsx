"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  localeCatalog,
  locales,
  type Locale,
} from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { headerControlClassName } from "@/lib/ui/header";

type LanguageSwitcherProps = {
  locale: Locale;
  pathWithoutLocale?: string;
  label: string;
};

function bindPressFeedback(element: HTMLElement, pressed: boolean) {
  if (pressed) {
    element.setAttribute("data-pressed", "true");
  } else {
    element.removeAttribute("data-pressed");
  }
}

export function LanguageSwitcher({
  locale,
  pathWithoutLocale = "/",
  label,
}: LanguageSwitcherProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const current = localeCatalog[locale];

  useEffect(() => {
    if (!open) {
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    function onDocumentClick(event: MouseEvent) {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node) || root.contains(event.target)) {
        return;
      }
      setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    const timer = window.setTimeout(() => {
      document.addEventListener("click", onDocumentClick);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("click", onDocumentClick);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative z-30">
      <button
        type="button"
        className={`${headerControlClassName} liquid-lens inline-flex min-h-11 items-center justify-center gap-1.5 px-2.5 text-sm font-medium tracking-wide whitespace-nowrap touch-manipulation`}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onPointerDown={(event) => bindPressFeedback(event.currentTarget, true)}
        onPointerUp={(event) => bindPressFeedback(event.currentTarget, false)}
        onPointerCancel={(event) => bindPressFeedback(event.currentTarget, false)}
        onPointerLeave={(event) => bindPressFeedback(event.currentTarget, false)}
        onClick={() => setOpen((value) => !value)}
      >
        <span aria-hidden="true" className="text-base leading-none">
          {current.flag}
        </span>
        <span>{current.code}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 shrink-0 text-white/90 transition-transform duration-200 ease-out ${
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
      </button>

      {open ? (
        <ul
          id={menuId}
          role="menu"
          aria-label={label}
          className="glass-surface absolute inset-inline-end-0 z-30 mt-2 w-max overflow-hidden rounded-2xl py-1"
        >
          {locales.map((target) => {
            const option = localeCatalog[target];
            const isCurrent = target === locale;

            return (
              <li key={target} role="none">
                <a
                  role="menuitem"
                  href={localizedPath(target, pathWithoutLocale)}
                  hrefLang={target}
                  lang={target}
                  aria-current={isCurrent ? "true" : undefined}
                  className={`liquid-lens-row flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm text-white ${
                    isCurrent ? "bg-white/8" : ""
                  }`}
                  onClick={() => setOpen(false)}
                >
                  <span aria-hidden="true">{option.flag}</span>
                  <span className="whitespace-nowrap">{option.nativeName}</span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
