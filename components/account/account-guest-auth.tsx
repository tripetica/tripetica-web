"use client";

import { useState } from "react";
import { AccountAuthModal } from "@/components/account/auth-modal";
import { MobileNav } from "@/components/mobile-nav";
import { type Locale } from "@/lib/i18n/config";
import { headerControlClassName } from "@/lib/ui/header";

type MobileNavCopy = {
  services: string;
  contact: string;
  signIn: string;
  openMenu: string;
  closeMenu: string;
  mobileNav: string;
};

type AccountGuestAuthProps = {
  locale: Locale;
  pathWithoutLocale: string;
  accountAriaLabel: string;
  signInLabel: string;
  homeHref: string;
  mobileCopy: MobileNavCopy;
  firstItem?: { href: string; label: string };
  mobileOnlyWrapper?: boolean;
};

export function AccountGuestAuth({
  locale,
  pathWithoutLocale,
  accountAriaLabel,
  signInLabel,
  homeHref,
  mobileCopy,
  firstItem,
  mobileOnlyWrapper = false,
}: AccountGuestAuthProps) {
  const [open, setOpen] = useState(false);

  const mobileNav = (
    <MobileNav
      copy={mobileCopy}
      homeHref={homeHref}
      signInLabel={signInLabel}
      onSignInClick={() => setOpen(true)}
      firstItem={firstItem}
    />
  );

  return (
    <>
      <button
        type="button"
        className={`${headerControlClassName} liquid-lens hidden h-11 w-11 shrink-0 items-center justify-center md:inline-flex`}
        aria-label={accountAriaLabel}
        onClick={() => setOpen(true)}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-[1.35rem] w-[1.35rem]"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.6"
        >
          <circle cx="12" cy="8" r="3.25" />
          <path d="M5.4 19.2a6.8 6.8 0 0 1 13.2 0" />
        </svg>
      </button>
      {mobileOnlyWrapper ? <div className="md:hidden">{mobileNav}</div> : mobileNav}
      <AccountAuthModal
        locale={locale}
        pathWithoutLocale={pathWithoutLocale}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
