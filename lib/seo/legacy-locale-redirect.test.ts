import test from "node:test";
import assert from "node:assert/strict";
import {
  bubbleLangToLocale,
  resolveSeoRedirect,
  seoRedirectHref,
  SEO_REDIRECT_STATUS,
} from "@/lib/seo/legacy-locale-redirect";

function redirect(pathname: string, search = "") {
  return resolveSeoRedirect(pathname, new URLSearchParams(search));
}

test("Bubble lang query maps to the matching locale without a loop", () => {
  assert.equal(bubbleLangToLocale("ru_ru"), "ru");
  assert.equal(bubbleLangToLocale("en_us"), "en");
  assert.equal(bubbleLangToLocale("tr_tr"), "tr");
  assert.equal(bubbleLangToLocale("ru"), "ru");
  assert.equal(bubbleLangToLocale("en"), "en");
  assert.equal(bubbleLangToLocale("tr"), "tr");
  assert.deepEqual(redirect("/", "lang=ru_ru"), {
    pathname: "/ru",
    search: "",
    status: SEO_REDIRECT_STATUS,
  });
  assert.deepEqual(redirect("/", "lang=en_us"), {
    pathname: "/en",
    search: "",
    status: SEO_REDIRECT_STATUS,
  });
  assert.deepEqual(redirect("/", "lang=tr_tr"), {
    pathname: "/tr",
    search: "",
    status: SEO_REDIRECT_STATUS,
  });
  assert.equal(redirect("/ru"), null);
  assert.equal(redirect("/en"), null);
  assert.equal(redirect("/tr"), null);
});

test("lang query is stripped and never kept on the destination", () => {
  assert.deepEqual(redirect("/", "lang=tr_tr"), {
    pathname: "/tr",
    search: "",
    status: 301,
  });
  assert.deepEqual(redirect("/ru", "lang=tr_tr"), {
    pathname: "/tr",
    search: "",
    status: 301,
  });
  assert.deepEqual(redirect("/", "lang=en&utm_source=yandex"), {
    pathname: "/en",
    search: "?utm_source=yandex",
    status: 301,
  });
  assert.notEqual(redirect("/", "lang=tr_tr")?.search.includes("lang="), true);
});

test("root without lang is a single 301 to the default locale", () => {
  assert.deepEqual(redirect("/"), {
    pathname: "/ru",
    search: "",
    status: 301,
  });
});

test("locale case and trailing slash normalize in one hop", () => {
  assert.deepEqual(redirect("/RU"), {
    pathname: "/ru",
    search: "",
    status: 301,
  });
  assert.deepEqual(redirect("/EN"), {
    pathname: "/en",
    search: "",
    status: 301,
  });
  assert.deepEqual(redirect("/TR"), {
    pathname: "/tr",
    search: "",
    status: 301,
  });
  assert.deepEqual(redirect("/ru/"), {
    pathname: "/ru",
    search: "",
    status: 301,
  });
  assert.deepEqual(redirect("/ru/services/airport-transfer/"), {
    pathname: "/ru/services/airport-transfer",
    search: "",
    status: 301,
  });
  assert.deepEqual(redirect("/RU/", "lang=tr_tr"), {
    pathname: "/tr",
    search: "",
    status: 301,
  });
});

test("redirect Location drops trailing slash instead of looping", () => {
  const destination = resolveSeoRedirect("/tr/", new URLSearchParams());
  assert.deepEqual(destination, {
    pathname: "/tr",
    search: "",
    status: 301,
  });
  assert.equal(
    seoRedirectHref("http://127.0.0.1:3000/tr/", destination!),
    "http://127.0.0.1:3000/tr",
  );
  assert.equal(
    seoRedirectHref("http://127.0.0.1:3000/?lang=tr_tr", redirect("/", "lang=tr_tr")!),
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
