import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { isLocale } from "@/lib/i18n/config";

type PublicLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function PublicLayout({
  children,
  params,
}: PublicLayoutProps) {
  const { locale } = await params;

  if (!isLocale(locale)) {
    notFound();
  }

  return (
    <>
      {children}
      <SiteFooter locale={locale} />
    </>
  );
}
