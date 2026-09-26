import "server-only";

import {
  extractCheckedRadio,
  extractHiddenInput,
  extractSelectValue,
  hasYolcuUpdatedFlash,
  isKamuAuthenticatedShell,
  isKamuFirmSelect,
  isKamuLoginWall,
  kamuSeferListesiUrl,
  kamuYeniYolcuUrl,
  kamuYolcuListesiUrl,
  matchKamuSeferIndex,
  matchKamuYolcuIndex,
  parseKamuSeferListRows,
  parseKamuYolcuListRows,
  portalGenderValue,
  summarizeKamuProbePage,
  usesFlushNewPassengerPath,
  type KamuSeferListRow,
  type KamuYolcuListRow,
} from "@/lib/uetds/kamu-portal/html";
import { loadKamuPortalSession } from "@/lib/uetds/kamu-portal/session";
import { officialUetdsCountryByCode } from "@/lib/uetds/official-locations";
import { type UetdsPassengerDraft } from "@/lib/uetds/draft";

export type KamuPortalClientError =
  | "kamu-session-required"
  | "kamu-session-expired"
  | "kamu-firm-required"
  | "kamu-sefer-not-found"
  | "kamu-yolcu-not-found"
  | "kamu-update-failed"
  | "kamu-flush-blocked";

export type KamuFetchResult = {
  url: string;
  status: number;
  html: string;
  finalUrl: string;
};

export type KamuPortalFetch = (input: {
  url: string;
  method?: "GET" | "POST";
  body?: URLSearchParams;
  cookieHeader: string;
}) => Promise<KamuFetchResult>;

const DEFAULT_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

export const defaultKamuPortalFetch: KamuPortalFetch = async (input) => {
  const response = await fetch(input.url, {
    method: input.method ?? "GET",
    redirect: "follow",
    headers: {
      Cookie: input.cookieHeader,
      "User-Agent": DEFAULT_UA,
      Accept: "text/html,application/xhtml+xml",
      ...(input.method === "POST"
        ? {
            "Content-Type": "application/x-www-form-urlencoded",
            Origin: "https://kamu.turkiye.gov.tr",
            Referer: input.url.replace(/&submit$/, ""),
          }
        : {}),
    },
    body: input.method === "POST" ? input.body?.toString() : undefined,
  });
  const html = await response.text();
  return {
    url: input.url,
    status: response.status,
    html,
    finalUrl: response.url || input.url,
  };
};

export async function probeKamuPortalSession(input?: {
  fetchImpl?: KamuPortalFetch;
}): Promise<
  | { ok: true; summary: ReturnType<typeof summarizeKamuProbePage> }
  | {
      ok: false;
      error: KamuPortalClientError;
      summary?: ReturnType<typeof summarizeKamuProbePage>;
    }
> {
  const session = await loadKamuPortalSession();
  if (!session) {
    return { ok: false, error: "kamu-session-required" };
  }
  const fetchImpl = input?.fetchImpl ?? defaultKamuPortalFetch;
  const page = await fetchImpl({
    url: kamuSeferListesiUrl(),
    cookieHeader: session.cookieHeader,
  });
  const summary = summarizeKamuProbePage({
    status: page.status,
    finalUrl: page.finalUrl,
    html: page.html,
  });
  // Prefer explicit login-wall signals; authenticated shell overrides brand false-positives.
  if (summary.loginWall && !summary.authenticatedShell) {
    return { ok: false, error: "kamu-session-expired", summary };
  }
  if (summary.firmSelect) {
    return { ok: false, error: "kamu-firm-required", summary };
  }
  if (!summary.authenticatedShell && summary.loginWall) {
    return { ok: false, error: "kamu-session-expired", summary };
  }
  return { ok: true, summary };
}

export async function updateExistingKamuPassenger(input: {
  firmaSeferNo?: string | null;
  ministrySeferRef: string;
  plate?: string | null;
  startDate?: string | null;
  startTime?: string | null;
  /** Original identity used to locate the portal row. */
  matchIdentityNumber: string;
  matchFirstName?: string;
  matchLastName?: string;
  passenger: UetdsPassengerDraft;
  telefon?: string;
  grupIndex?: number;
  fetchImpl?: KamuPortalFetch;
}): Promise<
  | { ok: true; seferIndex: number; grupIndex: number; yolcuIndex: number }
  | { ok: false; error: KamuPortalClientError; detail?: string }
> {
  const session = await loadKamuPortalSession();
  if (!session) {
    return { ok: false, error: "kamu-session-required" };
  }
  const fetchImpl = input.fetchImpl ?? defaultKamuPortalFetch;
  const cookieHeader = session.cookieHeader;

  const listPage = await fetchImpl({
    url: kamuSeferListesiUrl(),
    cookieHeader,
  });
  if (isKamuLoginWall(listPage.html) && !isKamuAuthenticatedShell(listPage.html)) {
    return { ok: false, error: "kamu-session-expired" };
  }
  if (isKamuFirmSelect(listPage.html)) {
    return { ok: false, error: "kamu-firm-required" };
  }

  const seferRows: KamuSeferListRow[] = parseKamuSeferListRows(listPage.html);
  const seferIndex = matchKamuSeferIndex({
    rows: seferRows,
    firmaSeferNo: input.firmaSeferNo,
    ministrySeferRef: input.ministrySeferRef,
    plate: input.plate,
    startDate: input.startDate,
    startTime: input.startTime,
  });
  if (seferIndex == null) {
    return { ok: false, error: "kamu-sefer-not-found" };
  }

  const grupIndex = input.grupIndex ?? 0;
  const yolcuListUrl = kamuYolcuListesiUrl({ index: seferIndex, grupIndex });
  const yolcuListPage = await fetchImpl({ url: yolcuListUrl, cookieHeader });
  if (isKamuLoginWall(yolcuListPage.html) && !isKamuAuthenticatedShell(yolcuListPage.html)) {
    return { ok: false, error: "kamu-session-expired" };
  }
  const yolcuRows: KamuYolcuListRow[] = parseKamuYolcuListRows(yolcuListPage.html);
  const yolcuIndex = matchKamuYolcuIndex({
    rows: yolcuRows,
    identityNumber: input.matchIdentityNumber,
    firstName: input.matchFirstName,
    lastName: input.matchLastName,
  });
  if (yolcuIndex == null) {
    return { ok: false, error: "kamu-yolcu-not-found" };
  }

  const formUrl = kamuYeniYolcuUrl({ index: seferIndex, grupIndex, yolcuIndex });
  if (usesFlushNewPassengerPath(formUrl)) {
    return { ok: false, error: "kamu-flush-blocked" };
  }
  const formPage = await fetchImpl({ url: formUrl, cookieHeader });
  if (isKamuLoginWall(formPage.html) && !isKamuAuthenticatedShell(formPage.html)) {
    return { ok: false, error: "kamu-session-expired" };
  }
  const token = extractHiddenInput(formPage.html, "token");
  if (!token) {
    return { ok: false, error: "kamu-update-failed", detail: "missing-token" };
  }

  const country =
    officialUetdsCountryByCode(input.passenger.nationality)?.name ||
    extractSelectValue(formPage.html, "ulke") ||
    "Türkiye";
  const existingPhone =
    extractHiddenInput(formPage.html, "telefon") ||
    formPage.html.match(/name=["']telefon["'][^>]*value=["']([^"']*)["']/i)?.[1] ||
    "";
  const gender =
    portalGenderValue(input.passenger.gender) ||
    extractCheckedRadio(formPage.html, "cinsiyet") ||
    "Erkek";

  const body = new URLSearchParams({
    ulke: country,
    tckn: input.passenger.identityNumber.trim(),
    adi: input.passenger.firstName.trim(),
    soyadi: input.passenger.lastName.trim(),
    cinsiyet: gender,
    telefon: (input.telefon ?? existingPhone).trim(),
    token,
  });

  const submitUrl = kamuYeniYolcuUrl({
    index: seferIndex,
    grupIndex,
    yolcuIndex,
    submit: true,
  });
  if (usesFlushNewPassengerPath(submitUrl)) {
    return { ok: false, error: "kamu-flush-blocked" };
  }

  const submitPage = await fetchImpl({
    url: submitUrl,
    method: "POST",
    body,
    cookieHeader,
  });
  if (isKamuLoginWall(submitPage.html) && !isKamuAuthenticatedShell(submitPage.html)) {
    return { ok: false, error: "kamu-session-expired" };
  }
  const updated =
    hasYolcuUpdatedFlash(submitPage.html) ||
    /yolcuListesi/i.test(submitPage.finalUrl) ||
    hasYolcuUpdatedFlash(
      (
        await fetchImpl({
          url: yolcuListUrl,
          cookieHeader,
        })
      ).html,
    );
  if (!updated) {
    return { ok: false, error: "kamu-update-failed", detail: "no-flash" };
  }
  return { ok: true, seferIndex, grupIndex, yolcuIndex };
}
