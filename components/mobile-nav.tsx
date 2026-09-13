"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { accountLogoutAction, accountStartNewBookingAction } from "@/lib/account/actions";
import { contactSectionId } from "@/lib/contact/links";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { headerControlClassName } from "@/lib/ui/header";

type MobileNavCopy = {
  services: string;
  contact: string;
  signIn: string;
  openMenu: string;
  closeMenu: string;
  mobileNav: string;
};

type MobileAccountProps = {
  locale: Locale;
  label: string;
  ariaLabel: string;
  /** When true (on /account/*), show Book reservation → home instead of My account. */
  onAccountArea?: boolean;
  myAccountLabel: string;
  bookReservationLabel: string;
  logoutLabel: string;
};

type MobileNavProps = {
  copy: MobileNavCopy;
  homeHref: string;
  signInHref?: string;
  signInLabel?: string;
  onSignInClick?: () => void;
  /** When false, omit the guest sign-in drawer row. */
  showSignIn?: boolean;
  /** Authenticated account accordion inside the drawer. */
  account?: MobileAccountProps;
  firstItem?: { href: string; label: string };
};

const drawerItemClassName =
  "drawer-nav-item liquid-lens-row flex min-h-12 cursor-pointer items-center border-b border-white/10 px-3 py-4 text-start text-[1.05rem] font-medium";

function clearHamburgerVisualState(button: HTMLButtonElement | null) {
  if (!button) {
    return;
  }
  button.removeAttribute("data-pressed");
  button.blur();
}

export function MobileNav({
  copy,
  homeHref,
  signInHref,
  signInLabel,
  onSignInClick,
  showSignIn = true,
  account,
  firstItem,
}: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);
  const hamburgerRef = useRef<HTMLButtonElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const ignoreOverlayUntilRef = useRef(0);
  const panelId = useId();
  const accountPanelId = useId();

  useEffect(() => {
    if (!open) {
      clearHamburgerVisualState(hamburgerRef.current);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!open && accountExpanded) {
    setAccountExpanded(false);
  }

  function toggleMenu() {
    setOpen((isOpen) => {
      if (isOpen) {
        return false;
      }
      ignoreOverlayUntilRef.current = Date.now() + 650;
      return true;
    });
    clearHamburgerVisualState(hamburgerRef.current);
  }

  function close() {
    clearHamburgerVisualState(hamburgerRef.current);
    setOpen(false);
  }

  function closeFromOverlay() {
    if (Date.now() < ignoreOverlayUntilRef.current) {
      return;
    }
    close();
  }

  const navItems = [
    firstItem ?? { href: `${homeHref}#services`, label: copy.services },
    { href: `#${contactSectionId}`, label: copy.contact },
  ];
  const signInLabelResolved = signInLabel ?? copy.signIn;

  const drawer =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[80] bg-black/30"
              aria-hidden="true"
              onClick={closeFromOverlay}
            />
            <div
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label={copy.openMenu}
              className="drawer-panel fixed inset-y-0 inset-inline-end-0 z-[120] flex w-[min(22rem,82vw)] max-w-full flex-col"
              style={{ transform: "none" }}
            >
              <div className="flex items-center justify-end px-3 py-3">
                <button
                  ref={closeButtonRef}
                  type="button"
                  className={`${headerControlClassName} liquid-lens inline-flex h-11 w-11 shrink-0 items-center justify-center touch-manipulation`}
                  aria-label={copy.closeMenu}
                  onClick={() => setOpen(false)}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeWidth="1.7"
                  >
                    <path d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </div>

              <nav className="flex flex-col px-4 pb-8" aria-label={copy.mobileNav}>
                {navItems.map((item) => (
                  <a
                    key={item.href}
                    href={item.href}
                    className={drawerItemClassName}
                    onClick={close}
                  >
                    <span>{item.label}</span>
                  </a>
                ))}
                {showSignIn ? (
                  onSignInClick ? (
                    <button
                      type="button"
                      className={drawerItemClassName}
                      onClick={() => {
                        close();
                        onSignInClick();
                      }}
                    >
                      <span>{signInLabelResolved}</span>
                    </button>
                  ) : (
                    <a
                      href={signInHref ?? `${homeHref}/account/login`}
                      className={drawerItemClassName}
                      onClick={close}
                    >
                      <span>{signInLabelResolved}</span>
                    </a>
                  )
                ) : null}
                {account ? (
                  <div className="drawer-account-block">
                    <button
                      type="button"
                      className={`${drawerItemClassName} is-account is-account-toggle`}
                      aria-label={account.ariaLabel}
                      aria-expanded={accountExpanded}
                      aria-controls={accountPanelId}
                      onClick={() => setAccountExpanded((value) => !value)}
                    >
                      <span>{account.label}</span>
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        className={`drawer-account-chevron${accountExpanded ? " is-open" : ""}`}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                    {accountExpanded ? (
                      <div
                        id={accountPanelId}
                        className="drawer-account-submenu"
                        role="group"
                        aria-label={account.ariaLabel}
                      >
                        {account.onAccountArea ? (
                          <form
                            action={accountStartNewBookingAction}
                            className="drawer-account-logout-form"
                          >
                            <input
                              type="hidden"
                              name="locale"
                              value={account.locale}
                            />
                            <button
                              type="submit"
                              className="drawer-nav-item drawer-account-subitem liquid-lens-row"
                              onClick={close}
                            >
                              <span>{account.bookReservationLabel}</span>
                            </button>
                          </form>
                        ) : (
                          <a
                            href={localizedPath(account.locale, "/account")}
                            className="drawer-nav-item drawer-account-subitem liquid-lens-row"
                            onClick={close}
                          >
                            <span>{account.myAccountLabel}</span>
                          </a>
                        )}
                        <form
                          action={accountLogoutAction}
                          className="drawer-account-logout-form"
                        >
                          <input
                            type="hidden"
                            name="locale"
                            value={account.locale}
                          />
                          <button
                            type="submit"
                            className="drawer-nav-item drawer-account-subitem liquid-lens-row is-danger"
                          >
                            <span>{account.logoutLabel}</span>
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </nav>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={hamburgerRef}
        type="button"
        className={`${headerControlClassName} liquid-lens relative z-[110] inline-flex h-11 w-11 shrink-0 items-center justify-center touch-manipulation md:hidden${open ? " invisible" : ""}`}
        aria-label={open ? copy.closeMenu : copy.openMenu}
        aria-expanded={open}
        aria-controls={panelId}
        onPointerDown={(event) => {
          event.currentTarget.setAttribute("data-pressed", "true");
        }}
        onPointerUp={(event) => {
          event.currentTarget.removeAttribute("data-pressed");
        }}
        onPointerCancel={(event) => {
          event.currentTarget.removeAttribute("data-pressed");
        }}
        onPointerLeave={(event) => {
          event.currentTarget.removeAttribute("data-pressed");
        }}
        onClick={toggleMenu}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeWidth="1.7"
        >
          {open ? (
            <path d="M6 6l12 12M18 6l-12 12" />
          ) : (
            <path d="M4 7h16M4 12h16M4 17h16" />
          )}
        </svg>
      </button>
      {drawer}
    </>
  );
}
