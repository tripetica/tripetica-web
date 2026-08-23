import { LanguageSwitcher } from "@/components/language-switcher";
import { MobileNav } from "@/components/mobile-nav";
import { type Locale } from "@/lib/i18n/config";
import { contactSectionId } from "@/lib/contact/links";
import { headerCopy } from "@/lib/i18n/header";
import { localizedPath } from "@/lib/i18n/path";
import { headerControlClassName } from "@/lib/ui/header";

type SiteHeaderProps = {
  locale: Locale;
  pathWithoutLocale?: string;
  variant?: "home" | "service";
};

export function SiteHeader({
  locale,
  pathWithoutLocale = "/",
  variant = "home",
}: SiteHeaderProps) {
  const copy = headerCopy[locale];
  const homeHref = localizedPath(locale);
  const isServicePage = variant === "service";
  const mobileNav = (
    <MobileNav
      copy={copy}
      homeHref={homeHref}
      firstItem={
        isServicePage ? { href: homeHref, label: copy.home } : undefined
      }
    />
  );

  return (
    <header className="absolute inset-x-0 top-0 z-[100] bg-transparent">
      <div className="flex items-center justify-between gap-2 px-[clamp(0.75rem,4vw,2.75rem)] py-[clamp(0.65rem,1.8vw,1.15rem)] sm:gap-3">
        <a
          href={homeHref}
          className="header-foreground shrink min-w-0 cursor-pointer px-2 py-1 text-[clamp(0.98rem,4.2vw,1.35rem)] font-semibold tracking-[0.08em] sm:tracking-[0.14em]"
        >
          Tripetica
        </a>

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

          <LanguageSwitcher
            locale={locale}
            pathWithoutLocale={pathWithoutLocale}
            label={copy.language}
          />

          <button
            type="button"
            className={`${headerControlClassName} liquid-lens hidden h-11 w-11 shrink-0 items-center justify-center md:inline-flex`}
            aria-label={copy.account}
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

          {isServicePage ? <div className="md:hidden">{mobileNav}</div> : mobileNav}
        </div>
      </div>
    </header>
  );
}
