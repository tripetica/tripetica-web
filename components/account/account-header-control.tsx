import { AccountGuestAuth } from "@/components/account/account-guest-auth";
import { AccountAuthenticatedNav } from "@/components/account/account-authenticated-nav";
import { AccountHeaderMenu } from "@/components/account/account-header-menu";
import { accountCopy } from "@/lib/account/copy";
import { formatAccountHeaderName } from "@/lib/account/format";
import { getAccountActor } from "@/lib/account/session";
import { type Locale } from "@/lib/i18n/config";

type MobileNavCopy = {
  services: string;
  contact: string;
  signIn: string;
  openMenu: string;
  closeMenu: string;
  mobileNav: string;
};

type AccountHeaderControlProps = {
  locale: Locale;
  pathWithoutLocale?: string;
  accountAriaLabel: string;
  guestMobile?: {
    homeHref: string;
    signInLabel: string;
    mobileCopy: MobileNavCopy;
    firstItem?: { href: string; label: string };
    mobileOnlyWrapper?: boolean;
  };
  authenticatedMobile?: {
    homeHref: string;
    mobileCopy: MobileNavCopy;
    firstItem?: { href: string; label: string };
    mobileOnlyWrapper?: boolean;
  };
};

export async function AccountHeaderControl({
  locale,
  pathWithoutLocale = "/",
  accountAriaLabel,
  guestMobile,
  authenticatedMobile,
}: AccountHeaderControlProps) {
  const actor = await getAccountActor();
  const copy = accountCopy[locale];

  if (!actor) {
    if (!guestMobile) {
      return null;
    }
    return (
      <AccountGuestAuth
        locale={locale}
        pathWithoutLocale={pathWithoutLocale}
        accountAriaLabel={accountAriaLabel}
        signInLabel={guestMobile.signInLabel}
        homeHref={guestMobile.homeHref}
        mobileCopy={guestMobile.mobileCopy}
        firstItem={guestMobile.firstItem}
        mobileOnlyWrapper={guestMobile.mobileOnlyWrapper}
      />
    );
  }

  const displayName =
    formatAccountHeaderName(actor.firstName, actor.lastName) || copy.myAccount;
  const onAccountArea =
    pathWithoutLocale === "/account" ||
    pathWithoutLocale.startsWith("/account/");

  if (authenticatedMobile) {
    return (
      <AccountAuthenticatedNav
        locale={locale}
        accountAriaLabel={accountAriaLabel}
        displayName={displayName}
        homeHref={authenticatedMobile.homeHref}
        onAccountArea={onAccountArea}
        mobileCopy={authenticatedMobile.mobileCopy}
        firstItem={authenticatedMobile.firstItem}
        mobileOnlyWrapper={authenticatedMobile.mobileOnlyWrapper}
      />
    );
  }

  return (
    <div className="hidden md:block">
      <AccountHeaderMenu
        locale={locale}
        copy={copy}
        headerAccountLabel={accountAriaLabel}
        displayName={displayName}
        onAccountArea={onAccountArea}
      />
    </div>
  );
}
