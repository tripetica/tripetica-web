import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sitemap from "@/app/sitemap";
import { createRobots } from "@/app/robots";
import {
  localeAlternates,
  noindexFollowRobots,
  publicIndexRobots,
  publicPageSeo,
  resolveProductionSeoEnvironment,
} from "@/lib/seo/metadata";
import { legalSlugs } from "@/lib/legal/catalog";
import { serviceIds } from "@/lib/services/catalog";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("SEO environment distinguishes production, dev, and invalid production config", () => {
  assert.equal(resolveProductionSeoEnvironment("development", undefined), false);
  assert.equal(
    resolveProductionSeoEnvironment("production", "https://dev.tripetica.com"),
    false,
  );
  assert.equal(
    resolveProductionSeoEnvironment("production", "https://tripetica.com"),
    true,
  );
  assert.throws(() => resolveProductionSeoEnvironment("production", undefined));
  assert.throws(() => resolveProductionSeoEnvironment("production", "not a url"));
});

test("robots blocks dev and permits production public routes", () => {
  assert.deepEqual(createRobots(false), {
    rules: { userAgent: "*", disallow: "/" },
  });
  const production = createRobots(true);
  assert.deepEqual(production.rules, {
    userAgent: "*",
    allow: "/",
    disallow: [
      "/api/",
      "/tr/ops/", "/en/ops/", "/ru/ops/", "/ar/ops/",
      "/tr/partner/", "/en/partner/", "/ru/partner/", "/ar/partner/",
      "/tr/account/", "/en/account/", "/ru/account/", "/ar/account/",
      "/tr/booking", "/en/booking", "/ru/booking", "/ar/booking",
    ],
  });
  assert.equal(production.sitemap, "https://tripetica.com/sitemap.xml");
});

test("booking and account are noindex follow; ops and partner stay noindex nofollow", () => {
  assert.deepEqual(noindexFollowRobots, { index: false, follow: true });
  const booking = source("app/[locale]/(public)/booking/page.tsx");
  const account = source("app/[locale]/(public)/account/layout.tsx");
  const review = source("app/[locale]/view/page.tsx");
  const reviewLayout = source("app/[locale]/view/layout.tsx");
  const ops = source("app/[locale]/ops/layout.tsx");
  const partner = source("app/[locale]/partner/layout.tsx");
  assert.match(booking, /robots: noindexFollowRobots/);
  assert.doesNotMatch(booking, /localeAlternates/);
  assert.match(account, /robots: noindexFollowRobots/);
  assert.match(review, /robots: noindexFollowRobots/);
  assert.match(reviewLayout, /robots: noindexFollowRobots/);
  assert.doesNotMatch(review, /localeAlternates|publicPageSeo/);
  assert.match(ops, /robots: noindexNofollowRobots/);
  assert.match(partner, /robots: noindexNofollowRobots/);
  assert.match(
    source("app/[locale]/(public)/booking/payment/page.tsx"),
    /noindexNofollowRobots/,
  );
  assert.match(
    source("app/[locale]/(public)/booking/success/page.tsx"),
    /noindexNofollowRobots/,
  );
  assert.doesNotMatch(
    source("app/[locale]/(public)/booking/payment/page.tsx"),
    /localeAlternates/,
  );
});

test("public service and legal pages stay index follow with canonical hreflang", () => {
  const seo = publicPageSeo("tr", "/services/bursa-tour");
  assert.deepEqual(seo.robots, publicIndexRobots);
  assert.deepEqual(
    seo.alternates,
    localeAlternates("tr", "/services/bursa-tour"),
  );
  assert.equal(seo.alternates?.canonical, "/tr/services/bursa-tour");
  assert.equal(seo.alternates?.languages?.ar, "/ar/services/bursa-tour");
  assert.equal(seo.alternates?.languages?.["x-default"], "/ru/services/bursa-tour");
  const arabic = publicPageSeo("ar", "/services/bursa-tour");
  assert.equal(arabic.alternates?.canonical, "/ar/services/bursa-tour");
  assert.equal(arabic.alternates?.languages?.["x-default"], "/ru/services/bursa-tour");
  assert.match(
    source("app/[locale]/(public)/services/airport-transfer/page.tsx"),
    /publicPageSeo\(locale, SERVICE_PATH\)/,
  );
  assert.match(
    source("app/[locale]/(public)/legal/[slug]/page.tsx"),
    /publicPageSeo\(locale, legalPath\(slug\)\)/,
  );
});

test("sitemap contains only localized public home, service, and legal routes", () => {
  const entries = sitemap();
  const publicPathCount = 1 + serviceIds.length + legalSlugs.length;
  assert.equal(entries.length, publicPathCount * 4);
  assert.equal(entries.some(({ url }) => /booking|account|ops|partner|api|payment|success|\/view/.test(url)), false);
  for (const entry of entries) {
    assert.equal(entry.url.startsWith("https://tripetica.com/"), true);
    assert.deepEqual(Object.keys(entry.alternates?.languages ?? {}).sort(), [
      "ar", "en", "ru", "tr", "x-default",
    ]);
    assert.equal(
      entry.alternates?.languages?.["x-default"]?.startsWith("https://tripetica.com/ru"),
      true,
    );
  }
});
