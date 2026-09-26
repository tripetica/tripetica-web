/**
 * Pure HTML helpers for Kamu UAB_TARIFESIZ parsing. No network, no secrets.
 */

export const KAMU_PORTAL_HOME = "https://kamu.turkiye.gov.tr";

export const KAMU_TARIFESIZ_BASE =
  "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?page=tarifesiz-yolcu-tasimaciligi-islemleri";

export function kamuSeferListesiUrl() {
  return `${KAMU_TARIFESIZ_BASE}&asama=seferListesi`;
}

export function kamuYolcuListesiUrl(input: { index: number; grupIndex: number }) {
  return `${KAMU_TARIFESIZ_BASE}&asama=yolcuListesi&index=${input.index}&grupIndex=${input.grupIndex}`;
}

export function kamuYeniYolcuUrl(input: {
  index: number;
  grupIndex: number;
  yolcuIndex: number;
  submit?: boolean;
}) {
  const base = `${KAMU_TARIFESIZ_BASE}&asama=yeniYolcu&index=${input.index}&grupIndex=${input.grupIndex}&yolcuIndex=${input.yolcuIndex}`;
  return input.submit ? `${base}&submit` : base;
}

export function isKamuLoginWall(html: string) {
  const lower = html.toLowerCase();
  // Real unauthenticated / OAuth gates only.
  // Do NOT match brand chrome like "e-Devlet Kapısı" — that appears on every
  // authenticated Kamu page and caused false "session expired" on bind.
  if (
    lower.includes("kimliğimi şimdi doğrula") ||
    lower.includes("kimligimi simdi dogrula") ||
    lower.includes("henüz kimliğinizi doğrulamadınız") ||
    lower.includes("henuz kimliginizi dogrulamadiniz")
  ) {
    return true;
  }
  if (lower.includes("authorizationcontroller")) {
    return true;
  }
  if (
    lower.includes("giriş yapıyorsunuz") &&
    (lower.includes("kamu uygulamaları") || lower.includes("kamu uygulamalari"))
  ) {
    return true;
  }
  if (
    lower.includes("giris.turkiye.gov.tr") &&
    (lower.includes("e-devlet şifresi") ||
      lower.includes("e-devlet sifresi") ||
      lower.includes("t.c. kimlik"))
  ) {
    return true;
  }
  return false;
}

/** Authenticated shell signals (never treat brand text alone as auth). */
export function isKamuAuthenticatedShell(html: string) {
  const lower = html.toLowerCase();
  return (
    />\s*çıkış\s*</i.test(html) ||
    />\s*cikis\s*</i.test(html) ||
    /href=["'][^"']*(?:cikis|logout)[^"']*["']/i.test(html) ||
    lower.includes("kamu uygulamaları merkezi'ne hoş geldiniz") ||
    lower.includes("kamu uygulamalari merkezine hos geldiniz")
  );
}

export function isKamuFirmSelect(html: string) {
  const lower = html.toLowerCase();
  if (
    lower.includes("yetkiniz olan firma") ||
    lower.includes("yetkili olduğunuz firma") ||
    lower.includes("yetkili oldugunuz firma") ||
    lower.includes("işlem yapmak istediğiniz firmayı") ||
    lower.includes("islem yapmak istediginiz firmayi")
  ) {
    return true;
  }
  const hasFirmaField =
    /name=["']firma["']/i.test(html) || /id=["']firma["']/i.test(html);
  const hasContinue =
    lower.includes("devam et") || /value=["']devam et["']/i.test(html);
  return hasFirmaField && hasContinue;
}

/** Safe probe summary — never includes cookie or HTML bodies. */
export function summarizeKamuProbePage(input: {
  status: number;
  finalUrl: string;
  html: string;
}) {
  let finalHost = "";
  let finalPath = "";
  try {
    const url = new URL(input.finalUrl);
    finalHost = url.host;
    finalPath = url.pathname + url.search;
  } catch {
    finalHost = "";
    finalPath = "";
  }
  return {
    status: input.status,
    finalHost,
    finalPath,
    htmlLength: input.html.length,
    loginWall: isKamuLoginWall(input.html),
    firmSelect: isKamuFirmSelect(input.html),
    authenticatedShell: isKamuAuthenticatedShell(input.html),
  };
}

export function extractHiddenInput(html: string, name: string) {
  const re = new RegExp(
    `<input[^>]*name=["']${name}["'][^>]*value=["']([^"']*)["'][^>]*>|<input[^>]*value=["']([^"']*)["'][^>]*name=["']${name}["'][^>]*>`,
    "i",
  );
  const match = html.match(re);
  return (match?.[1] ?? match?.[2] ?? "").trim();
}

export function extractSelectValue(html: string, name: string) {
  const block = html.match(new RegExp(`<select[^>]*name=["']${name}["'][^>]*>([\\s\\S]*?)</select>`, "i"));
  if (!block?.[1]) {
    return "";
  }
  const selected = block[1].match(/<option[^>]*selected[^>]*value=["']([^"']*)["']/i);
  if (selected?.[1]) {
    return selected[1].trim();
  }
  const first = block[1].match(/<option[^>]*value=["']([^"']+)["']/i);
  return (first?.[1] ?? "").trim();
}

export function extractCheckedRadio(html: string, name: string) {
  const re = new RegExp(
    `<input[^>]*type=["']radio["'][^>]*name=["']${name}["'][^>]*value=["']([^"']*)["'][^>]*checked|<input[^>]*type=["']radio["'][^>]*name=["']${name}["'][^>]*checked[^>]*value=["']([^"']*)["']`,
    "i",
  );
  const match = html.match(re);
  return (match?.[1] ?? match?.[2] ?? "").trim();
}

export type KamuSeferListRow = {
  index: number;
  firmaSeferNo: string;
  plate: string;
  startDate: string;
  startTime: string;
  raw: string;
};

function nearestAnchorSnippet(html: string, at: number) {
  const from = html.lastIndexOf("<a", at);
  const to = html.indexOf("</a>", at);
  if (from >= 0 && to > from && to - from < 1200) {
    return html.slice(from, to + 4).replace(/\s+/g, " ");
  }
  const start = Math.max(0, at - 80);
  const end = Math.min(html.length, at + 220);
  return html.slice(start, end).replace(/\s+/g, " ");
}

function nearestRowSnippet(html: string, at: number) {
  const fromTr = html.lastIndexOf("<tr", at);
  const toTr = html.indexOf("</tr>", at);
  if (fromTr >= 0 && toTr > fromTr && toTr - fromTr < 2000) {
    return html.slice(fromTr, toTr + 5).replace(/\s+/g, " ");
  }
  const start = Math.max(0, at - 180);
  const end = Math.min(html.length, at + 80);
  return html.slice(start, end).replace(/\s+/g, " ");
}

/**
 * Portal sefer list rows expose firma sefer no + plate + times.
 * Index is the portal's current list position (session-local, not durable).
 */
export function parseKamuSeferListRows(html: string): KamuSeferListRow[] {
  const rows: KamuSeferListRow[] = [];
  const linkRe =
    /asama=seferDetay[^"'>\s]*index=(\d+)[^"'>\s]*|index=(\d+)[^"'>\s]*asama=seferDetay/gi;
  const seen = new Set<number>();
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html))) {
    const index = Number(match[1] ?? match[2]);
    if (!Number.isFinite(index) || seen.has(index)) {
      continue;
    }
    seen.add(index);
    const raw = nearestAnchorSnippet(html, match.index);
    const plate =
      raw.match(/\b(\d{2}\s*[A-ZÇĞİÖŞÜ]{1,3}\s*\d{2,4})\b/i)?.[1]?.replace(/\s+/g, "") ??
      raw.match(/\b(\d{2}[A-Z]{1,3}\d{2,4})\b/i)?.[1] ??
      "";
    const date = raw.match(/\b(\d{2}\/\d{2}\/\d{4})\b/)?.[1] ?? "";
    const time = raw.match(/\b(\d{2}:\d{2})\b/)?.[1] ?? "";
    const beforeDate = date ? raw.slice(0, raw.indexOf(date)) : raw;
    const firmaSeferNo =
      beforeDate.match(/\b(TRP-\d+)\b/)?.[1] ??
      beforeDate.match(/Firma\s*Sefer[^0-9A-Za-z]*([0-9A-Za-z\-_]{3,})/i)?.[1] ??
      beforeDate.match(/\b([A-Z]*\d{4,})\b/i)?.[1] ??
      beforeDate.match(/\b(\d{6,})\b/)?.[1] ??
      "";
    rows.push({
      index,
      firmaSeferNo,
      plate: plate.replace(/\s+/g, "").toUpperCase(),
      startDate: date,
      startTime: time,
      raw,
    });
  }
  return rows;
}

export function matchKamuSeferIndex(input: {
  rows: KamuSeferListRow[];
  firmaSeferNo?: string | null;
  ministrySeferRef?: string | null;
  plate?: string | null;
  startDate?: string | null;
  startTime?: string | null;
}): number | null {
  const firma = input.firmaSeferNo?.trim() || "";
  const ministry = input.ministrySeferRef?.trim() || "";
  const plate = (input.plate || "").replace(/\s+/g, "").toUpperCase();
  const startDate = normalizePortalDate(input.startDate || "");
  const startTime = (input.startTime || "").trim().slice(0, 5);

  if (firma) {
    const exactFirma = input.rows.find((row) => row.firmaSeferNo === firma);
    if (exactFirma) {
      return exactFirma.index;
    }
    const byFirma = input.rows.find(
      (row) =>
        row.raw.includes(firma) || (ministry.length >= 6 && row.raw.includes(ministry)),
    );
    if (byFirma) {
      return byFirma.index;
    }
  }
  if (ministry.length >= 6) {
    const byMinistry = input.rows.find(
      (row) => row.firmaSeferNo === ministry || row.raw.includes(ministry),
    );
    if (byMinistry) {
      return byMinistry.index;
    }
  }

  const candidates = input.rows.filter((row) => {
    const plateOk = !plate || row.plate === plate || row.raw.toUpperCase().includes(plate);
    const dateOk = !startDate || row.startDate === startDate || row.raw.includes(startDate);
    const timeOk = !startTime || row.startTime === startTime || row.raw.includes(startTime);
    return plateOk && dateOk && timeOk;
  });
  if (candidates.length === 1) {
    return candidates[0]!.index;
  }
  return null;
}

export type KamuYolcuListRow = {
  yolcuIndex: number;
  identityNumber: string;
  firstName: string;
  lastName: string;
  raw: string;
};

export function parseKamuYolcuListRows(html: string): KamuYolcuListRow[] {
  const rows: KamuYolcuListRow[] = [];
  const linkRe = /asama=yeniYolcu[^"'>\s]*yolcuIndex=(\d+)|yolcuIndex=(\d+)[^"'>\s]*asama=yeniYolcu/gi;
  const seen = new Set<number>();
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html))) {
    const yolcuIndex = Number(match[1] ?? match[2]);
    if (!Number.isFinite(yolcuIndex) || seen.has(yolcuIndex)) {
      continue;
    }
    seen.add(yolcuIndex);
    const raw = nearestRowSnippet(html, match.index);
    const identityNumber =
      raw.match(/\b([A-Za-z]{1,4}\d{4,18})\b/)?.[1] ??
      raw.match(/\b(\d{11})\b/)?.[1] ??
      raw.match(/\b([A-Za-z0-9]{6,20})\b(?![A-Za-z]*\s*<)/)?.[1] ??
      "";
    const nameBits = raw.match(/([A-ZÇĞİÖŞÜ]{2,}(?:\s+[A-ZÇĞİÖŞÜ]{2,}){0,3})/g) ?? [];
    rows.push({
      yolcuIndex,
      identityNumber: identityNumber.trim(),
      firstName: nameBits[0]?.split(/\s+/)[0] ?? "",
      lastName: nameBits[0]?.split(/\s+/).slice(1).join(" ") ?? "",
      raw,
    });
  }
  return rows;
}

export function matchKamuYolcuIndex(input: {
  rows: KamuYolcuListRow[];
  identityNumber: string;
  firstName?: string;
  lastName?: string;
}): number | null {
  const identity = input.identityNumber.trim().toLowerCase();
  if (identity) {
    const exact = input.rows.find((row) => row.identityNumber.toLowerCase() === identity);
    if (exact) {
      return exact.yolcuIndex;
    }
    // Fallback: only rows whose identity field is empty may match via raw text.
    const loose = input.rows.find(
      (row) => !row.identityNumber && row.raw.toLowerCase().includes(identity),
    );
    if (loose) {
      return loose.yolcuIndex;
    }
  }
  const first = (input.firstName || "").trim().toUpperCase();
  const last = (input.lastName || "").trim().toUpperCase();
  if (first && last) {
    const byName = input.rows.find(
      (row) =>
        row.raw.toUpperCase().includes(first) && row.raw.toUpperCase().includes(last),
    );
    if (byName) {
      return byName.yolcuIndex;
    }
  }
  return null;
}

export function portalGenderValue(gender: "" | "male" | "female") {
  if (gender === "female") {
    return "Kadın";
  }
  if (gender === "male") {
    return "Erkek";
  }
  return "";
}

export function normalizePortalDate(value: string) {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split("-");
    return `${d}/${m}/${y}`;
  }
  return trimmed;
}

export function hasYolcuUpdatedFlash(html: string) {
  return /Yolcu\s+Güncellenmi[şs]tir/i.test(html);
}

export function usesFlushNewPassengerPath(url: string) {
  return /flush/i.test(url) || /yolcuIndex=flush/i.test(url);
}
