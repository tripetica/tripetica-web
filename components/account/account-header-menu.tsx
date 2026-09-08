"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  accountLogoutAction,
  accountStartNewBookingAction,
} from "@/lib/account/actions";
import { type AccountCopy } from "@/lib/account/copy";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { headerControlClassName } from "@/lib/ui/header";

type AccountHeaderMenuProps = {
  locale: Locale;
  copy: AccountCopy;
  headerAccountLabel: string;
  displayName: string;
  /** When true (on /account/*), show Book reservation → home instead of My account. */
  onAccountArea?: boolean;
  className?: string;
};

/** Desktop authenticated control: glass trigger + contextual account dropdown. */
export function AccountHeaderMenu({
  locale,
  copy,
  headerAccountLabel,
  displayName,
  onAccountArea = false,
  className,
}: AccountHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const accountHref = localizedPath(locale, "/account");
  const primaryLabel = onAccountArea ? copy.bookReservation : copy.myAccount;

  return (
    <div
      className={`account-header-menu${className ? ` ${className}` : ""}`}
      ref={rootRef}
    >
      <button
        type="button"
        className={`${headerControlClassName} liquid-lens account-header-trigger`}
        aria-label={headerAccountLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="account-header-name">{displayName}</span>
      </button>
      {open ? (
        <div className="account-header-popover" id={menuId} role="menu">
          {onAccountArea ? (
            <form action={accountStartNewBookingAction}>
              <input type="hidden" name="locale" value={locale} />
              <button
                type="submit"
                role="menuitem"
                className="account-header-popover-item"
              >
                {primaryLabel}
              </button>
            </form>
          ) : (
            <a
              role="menuitem"
              href={accountHref}
              className="account-header-popover-item"
              onClick={() => setOpen(false)}
            >
              {primaryLabel}
            </a>
          )}
          <form action={accountLogoutAction}>
            <input type="hidden" name="locale" value={locale} />
            <button
              type="submit"
              role="menuitem"
              className="account-header-popover-item is-danger"
            >
              {copy.logout}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
