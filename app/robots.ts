import type { MetadataRoute } from "next";
import {
  getSiteUrl,
  isProductionSeoEnvironment,
} from "@/lib/seo/metadata";

export function createRobots(isProduction: boolean): MetadataRoute.Robots {
  if (!isProduction) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const siteUrl = getSiteUrl().origin;
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/tr/ops/",
        "/en/ops/",
        "/ru/ops/",
        "/tr/partner/",
        "/en/partner/",
        "/ru/partner/",
        "/tr/account/",
        "/en/account/",
        "/ru/account/",
        "/tr/booking",
        "/en/booking",
        "/ru/booking",
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

export default function robots(): MetadataRoute.Robots {
  return createRobots(isProductionSeoEnvironment());
}
