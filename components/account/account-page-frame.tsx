import { SiteHeader } from "@/components/site-header";
import { type Locale } from "@/lib/i18n/config";
import { type ReactNode } from "react";

export function AccountPageFrame({
  locale,
  pathWithoutLocale,
  title,
  children,
}: {
  locale: Locale;
  pathWithoutLocale: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="service-page light-theme-page account-page">
      <SiteHeader
        locale={locale}
        pathWithoutLocale={pathWithoutLocale}
        variant="service"
      />
      <div className="account-page-inner">
        <h1 className="account-page-title">{title}</h1>
        {children}
      </div>
    </main>
  );
}
