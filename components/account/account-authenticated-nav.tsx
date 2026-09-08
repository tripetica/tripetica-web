"use client";

import { AccountHeaderMenu } from "@/components/account/account-header-menu";
import { MobileNav } from "@/components/mobile-nav";
import { accountCopy } from "@/lib/account/copy";
import { type Locale } from "@/lib/i18n/config";

type MobileNavCopy = {
  services: string;
  contact: string;
  signIn: string;
  openMenu: string;
  closeMenu: string;
  mobileNav: string;
};

type AccountAuthenticatedNavProps = {
  locale: Locale;
  accountAriaLabel: string;
  displayName: string;
  homeHref: string;
  /** True when current path is under /account (authenticated account area). */
  onAccountArea?: boolean;
  mobileCopy: MobileNavCopy;
  firstItem?: { href: string; label: string };
  mobileOnlyWrapper?: boolean;
};

/**
 * Desktop: Trip E. dropdown (contextual primary + logout).
 * Mobile: Trip E. accordion inside hamburger drawer.
 */
export function AccountAuthenticatedNav({
  locale,
  accountAriaLabel,
  displayName,
  homeHref,
  onAccountArea = false,
  mobileCopy,
  firstItem,
  mobileOnlyWrapper = false,
}: AccountAuthenticatedNavProps) {
  const copy = accountCopy[locale];

  const mobileNav = (
    <MobileNav
      copy={mobileCopy}
      homeHref={homeHref}
      showSignIn={false}
      firstItem={firstItem}
      account={{
        locale,
        label: displayName,
        ariaLabel: accountAriaLabel,
        onAccountArea,
        myAccountLabel: copy.myAccount,
        bookReservationLabel: copy.bookReservation,
        logoutLabel: copy.logout,
      }}
    />
  );

  return (
    <>
      <div className="hidden md:block">
        <AccountHeaderMenu
          locale={locale}
          copy={copy}
          headerAccountLabel={accountAriaLabel}
          displayName={displayName}
          onAccountArea={onAccountArea}
        />
      </div>
      {mobileOnlyWrapper ? (
        <div className="md:hidden">{mobileNav}</div>
      ) : (
        mobileNav
      )}
    </>
  );
}
