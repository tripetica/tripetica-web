import { LanguageSwitcher } from "@/components/language-switcher";
import { SiteHeaderLogoLink } from "@/components/site-header-logo";
import { AccountHeaderControl } from "@/components/account/account-header-control";
import { type Locale } from "@/lib/i18n/config";
import { contactSectionId } from "@/lib/contact/links";
import { headerCopy } from "@/lib/i18n/header";
import { localizedPath } from "@/lib/i18n/path";
import { headerControlClassName } from "@/lib/ui/header";
import { getAccountActor } from "@/lib/account/session";

type SiteHeaderProps = {
  locale: Locale;
  pathWithoutLocale?: string;
  variant?: "home" | "service";
  showLanguageSwitcher?: boolean;
};

export async function SiteHeader({
  locale,
  pathWithoutLocale = "/",
  variant = "home",
  showLanguageSwitcher = true,
}: SiteHeaderProps) {
  const copy = headerCopy[locale];
  const homeHref = localizedPath(locale);
  const isHomePage = !pathWithoutLocale || pathWithoutLocale === "/";
  const isServicePage = variant === "service";
  const actor = await getAccountActor();
  const logoClassName =
    "header-foreground shrink min-w-0 px-2 py-1 text-[clamp(0.98rem,4.2vw,1.35rem)] font-semibold tracking-[0.08em] sm:tracking-[0.14em]";

  const firstItem = isServicePage ? { href: homeHref, label: copy.home } : undefined;
  const mobileOnlyWrapper = isServicePage;

  return (
    <header className="absolute inset-x-0 top-0 z-[100] bg-transparent">
      <div className="flex items-center justify-between gap-2 px-[clamp(0.75rem,4vw,2.75rem)] py-[clamp(0.65rem,1.8vw,1.15rem)] sm:gap-3">
        {isHomePage ? (
          <span className={`${logoClassName} cursor-default`}>Tripetica</span>
        ) : (
          <SiteHeaderLogoLink href={homeHref} className={logoClassName}>
            Tripetica
          </SiteHeaderLogoLink>
        )}

        <div className="flex shrink-0 items-center gap-[clamp(0.15rem,1.2vw,1.75rem)]">
          <nav
            className="hidden items-center gap-1 text-[0.95rem] font-medium md:flex"
            aria-label={copy.primaryNav}
          >
            {isServicePage ? (
              <a
                href={homeHref}
                className={`${headerControlClassName} liquid-lens px-3 py-2`}
              >
                {copy.home}
              </a>
            ) : (
              <a
                href="#services"
                className={`${headerControlClassName} liquid-lens px-3 py-2`}
              >
                {copy.services}
              </a>
            )}
            <a
              href={`#${contactSectionId}`}
              className={`${headerControlClassName} liquid-lens px-3 py-2`}
            >
              {copy.contact}
            </a>
          </nav>

          {showLanguageSwitcher ? (
            <LanguageSwitcher
              locale={locale}
              pathWithoutLocale={pathWithoutLocale}
              label={copy.language}
            />
          ) : null}

          {actor ? (
            <AccountHeaderControl
              locale={locale}
              pathWithoutLocale={pathWithoutLocale}
              accountAriaLabel={copy.accountMenu}
              authenticatedMobile={{
                homeHref,
                mobileCopy: copy,
                firstItem,
                mobileOnlyWrapper,
              }}
            />
          ) : (
            <AccountHeaderControl
              locale={locale}
              pathWithoutLocale={pathWithoutLocale}
              accountAriaLabel={copy.account}
              guestMobile={{
                homeHref,
                signInLabel: copy.signIn,
                mobileCopy: copy,
                firstItem,
                mobileOnlyWrapper,
              }}
            />
          )}
        </div>
      </div>
    </header>
  );
}
