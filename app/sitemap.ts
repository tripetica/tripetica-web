import type { MetadataRoute } from "next";
import { defaultLocale, locales } from "@/lib/i18n/config";
import { localizedPath } from "@/lib/i18n/path";
import { legalPath, legalSlugs } from "@/lib/legal/catalog";
import { getSiteUrl } from "@/lib/seo/metadata";
import { serviceIds, servicePath } from "@/lib/services/catalog";

const publicIndexablePaths = [
  "/",
  ...serviceIds.map(servicePath),
  ...legalSlugs.map(legalPath),
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl().origin;
  return publicIndexablePaths.flatMap((path) => {
    const languages = Object.fromEntries([
      ...locales.map((locale) => [
        locale,
        `${siteUrl}${localizedPath(locale, path)}`,
      ]),
      ["x-default", `${siteUrl}${localizedPath(defaultLocale, path)}`],
    ]);

    return locales.map((locale) => ({
      url: `${siteUrl}${localizedPath(locale, path)}`,
      changeFrequency: path === "/" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : 0.8,
      alternates: { languages },
    }));
  });
}
