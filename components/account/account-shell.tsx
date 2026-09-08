import Link from "next/link";
import { accountCopy, type AccountCopy } from "@/lib/account/copy";
import { type Locale } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";

type AccountShellProps = {
  locale: Locale;
  active: "reservations" | "profile" | "companies";
  children: React.ReactNode;
};

function tabs(copy: AccountCopy, locale: Locale) {
  return [
    {
      id: "reservations" as const,
      href: localizedPath(locale, "/account/reservations"),
      label: copy.reservations,
    },
    {
      id: "profile" as const,
      href: localizedPath(locale, "/account/profile"),
      label: copy.profile,
    },
    {
      id: "companies" as const,
      href: localizedPath(locale, "/account/companies"),
      label: copy.companies,
    },
  ];
}

export function AccountShell({ locale, active, children }: AccountShellProps) {
  const copy = accountCopy[locale];
  return (
    <div className="account-shell">
      <header className="account-shell-head">
        <h1>{copy.accountTitle}</h1>
        <nav className="account-tabs" aria-label={copy.accountTitle}>
          {tabs(copy, locale).map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`account-tab${active === tab.id ? " is-active" : ""}`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="account-shell-body">{children}</div>
    </div>
  );
}
