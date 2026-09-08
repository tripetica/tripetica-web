import type { ReactNode } from "react";
import type { Viewport } from "next";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/site-footer";
import { ContactLauncher } from "@/components/contact-launcher";
import { isLocale } from "@/lib/i18n/config";
import { lightBrowserThemeColor } from "@/lib/theme";

export const viewport: Viewport = {
  themeColor: lightBrowserThemeColor,
  colorScheme: "only light",
};

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
      <ContactLauncher locale={locale} />
    </>
  );
}
