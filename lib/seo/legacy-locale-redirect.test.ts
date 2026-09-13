import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import sitemap from "@/app/sitemap";
import {
  isGoneLegacyLangRoot,
  resolveSeoRedirect,
  seoRedirectHref,
  SEO_REDIRECT_STATUS,
  LEGACY_LANG_GONE_STATUS,
} from "@/lib/seo/legacy-locale-redirect";

function redirect(pathname: string, search = "") {
  return resolveSeoRedirect(pathname, new URLSearchParams(search));
}

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("root ?lang= is gone and never redirected to a locale", () => {
  for (const lang of [
    "ru_ru",
    "tr_tr",
    "en_gb",
    "en_us",
    "it_it",
    "fr_fr",
    "de_de",
    "es_es",
    "ar_ar",
    "anything",
  ]) {
    const params = new URLSearchParams(`lang=${lang}`);
    assert.equal(isGoneLegacyLangRoot("/", params), true);
    assert.equal(redirect("/", `lang=${lang}`), null);
  }
  assert.equal(isGoneLegacyLangRoot("/", new URLSearchParams("lang=")), true);
  assert.equal(isGoneLegacyLangRoot("/", new URLSearchParams("lang=tr_tr&utm=1")), true);
  assert.equal(isGoneLegacyLangRoot("/ru", new URLSearchParams("lang=tr_tr")), false);
  assert.equal(LEGACY_LANG_GONE_STATUS, 410);
});

test("proxy returns 410 for root lang URLs and does not redirect them", () => {
  const proxy = source("proxy.ts");
  assert.match(proxy, /isGoneLegacyLangRoot/);
  assert.match(proxy, /LEGACY_LANG_GONE_STATUS/);
  assert.doesNotMatch(proxy, /bubbleLangToLocale/);
  assert.doesNotMatch(source("lib/seo/legacy-locale-redirect.ts"), /BUBBLE_LANG_TO_LOCALE|bubbleLangToLocale/);
  const nginx = source("deploy/nginx/tripetica.com.tls.conf");
  assert.match(nginx, /tripetica_legacy_lang_gone/);
  assert.match(nginx, /return 410/);
  assert.doesNotMatch(nginx, /\$arg_lang/);
  assert.doesNotMatch(nginx, /return 301 https:\/\/tripetica\.com\/(tr|en);/);
});

test("current locale homes are not redirected", () => {
  assert.equal(redirect("/ru"), null);
  assert.equal(redirect("/en"), null);
  assert.equal(redirect("/tr"), null);
  assert.equal(redirect("/ru", "lang=tr_tr"), null);
});

test("root without lang is a single 301 to the default locale", () => {
  assert.deepEqual(redirect("/"), {
    pathname: "/ru",
    search: "",
    status: SEO_REDIRECT_STATUS,
  });
});

test("locale case and trailing slash normalize in one hop without lang mapping", () => {
  assert.deepEqual(redirect("/RU"), {
    pathname: "/ru",
    search: "",
    status: SEO_REDIRECT_STATUS,
  });
  assert.deepEqual(redirect("/EN"), {
    pathname: "/en",
    search: "",
    status: SEO_REDIRECT_STATUS,
  });
  assert.deepEqual(redirect("/TR"), {
    pathname: "/tr",
    search: "",
    status: SEO_REDIRECT_STATUS,
  });
  assert.deepEqual(redirect("/ru/"), {
    pathname: "/ru",
    search: "",
    status: SEO_REDIRECT_STATUS,
  });
  assert.deepEqual(redirect("/ru/services/airport-transfer/"), {
    pathname: "/ru/services/airport-transfer",
    search: "",
    status: SEO_REDIRECT_STATUS,
  });
});

test("redirect Location drops trailing slash instead of looping", () => {
  const destination = resolveSeoRedirect("/tr/", new URLSearchParams());
  assert.deepEqual(destination, {
    pathname: "/tr",
    search: "",
    status: SEO_REDIRECT_STATUS,
  });
  assert.equal(
    seoRedirectHref("http://127.0.0.1:3000/tr/", destination!),
    "http://127.0.0.1:3000/tr",
  );
});

test("unproven Bubble paths are not redirected", () => {
  assert.equal(redirect("/about"), null);
  assert.equal(redirect("/about", "lang=tr_tr"), null);
  assert.equal(redirect("/version-test"), null);
  assert.equal(redirect("/version-test", "lang=tr_tr"), null);
  assert.equal(redirect("/version-test/ops-panel"), null);
  assert.equal(redirect("/ops-panel"), null);
  assert.equal(redirect("/services/airport-transfer"), null);
});

test("sitemap and public links do not use ?lang=", () => {
  const entries = sitemap();
  for (const entry of entries) {
    assert.equal(entry.url.includes("?lang="), false);
    for (const href of Object.values(entry.alternates?.languages ?? {})) {
      assert.equal((href ?? "").includes("?lang="), false);
    }
  }
  assert.doesNotMatch(source("components/language-switcher.tsx"), /\?lang=/);
  assert.doesNotMatch(source("lib/i18n/path.ts"), /\?lang=/);
  assert.doesNotMatch(source("app/sitemap.ts"), /\?lang=/);
});
