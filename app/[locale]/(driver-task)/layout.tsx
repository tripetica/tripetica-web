import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n/config";
import { noindexNofollowRobots } from "@/lib/seo/metadata";
import { lightBrowserThemeColor } from "@/lib/theme";

export const viewport: Viewport = {
  themeColor: lightBrowserThemeColor,
  colorScheme: "only light",
};

export const metadata: Metadata = {
  robots: noindexNofollowRobots,
};

type DriverTaskLayoutProps = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function DriverTaskLayout({
  children,
  params,
}: DriverTaskLayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    notFound();
  }
  return children;
}
