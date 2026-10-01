/**
 * e-Devlet login steps observed from the Kamu HAR and the login-wall HTML.
 * Selectors are the labels and controls on that form, not guessed coordinates.
 * This module never accepts or returns credential values in its public result.
 */

export const KAMU_LOGIN_HOME = "https://kamu.turkiye.gov.tr";
export const KAMU_SEFER_LIST_URL = "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?page=tarifesiz-yolcu-tasimaciligi-islemleri&asama=seferListesi";

export const KAMU_LOGIN_TARGETS = {
  identityLabel: "T.C. Kimlik No",
  passwordLabel: "e-Devlet Şifresi",
  submitName: "Giriş Yap",
  approveName: "Onayla",
  gate: /Kimliğimi Şimdi Doğrula|Sisteme Giriş/,
  captchaImage: ".captchaImage",
  portalMenus: ["Ana Sayfa", "e-Devlet Kapısı", "e-Hizmetler", "Servis Paylaşımları", "Kurum Uygulamaları"],
} as const;

export type KamuLoginPhase =
  | "login_page"
  | "captcha_required"
  | "two_factor"
  | "web_approval"
  | "portal_home"
  | "service_opening"
  | "firm_checking"
  | "list_loading"
  | "trip_list_ready"
  | "trip_verified"
  | "trip_matched"
  | "group_list_ready"
  | "group_compare"
  | "group_updated"
  | "group_unchanged"
  | "passenger_list_ready"
  | "passengers_done"
  | "update_flow_complete"
  | `passenger_${number}_matched`
  | `passenger_${number}_updated`
  | "credential_rejected"
  | "captcha_rejected"
  | "page_changed"
  | "timeout"
  | "unexpected";

export type KamuPortalCompany = {
  legalName: string;
  shortName: string;
  taxNumber: string;
  authorityDocumentType: "D1" | "D2" | "";
  authorityDocumentNumber: string;
};

export type KamuFirmOption = {
  value: string;
  label: string;
  selected: boolean;
};

export type KamuLoginPublicResult = {
  phase: KamuLoginPhase;
  error: string | null;
  firmLabel: string | null;
};

export type KamuLoginControls = {
  url(): Promise<string>;
  html(): Promise<string>;
  goto(url: string): Promise<void>;
  clickGate(): Promise<boolean>;
  clickPublicLogin(): Promise<"ok" | "public_login_link_missing" | "public_login_click_failed" | "public_login_navigation_failed">;
  hasIdentityField(): Promise<boolean>;
  hasCaptcha(): Promise<boolean>;
  fillIdentity(value: string): Promise<void>;
  fillPassword(value: string): Promise<void>;
  submitLogin(): Promise<void>;
  confirmWebApproval(): Promise<boolean>;
  clickEHizmetler(): Promise<"ok" | "service_menu_missing" | "service_menu_navigation_failed">;
  clickTarifesizNotification(): Promise<"ok" | "tarifesiz_link_missing" | "tarifesiz_navigation_failed">;
  readFirmOptions(): Promise<KamuFirmOption[]>;
  chooseFirm(value: string): Promise<boolean>;
  submitFirmContinue(): Promise<"ok" | "continue_missing" | "continue_navigation_failed">;
};

const TWO_FACTOR = /İki Aşamalı Giriş Onayı|İki Aşamalı Giriş Onay/i;
const WEB_APPROVAL = /Giriş Yapıyorsunuz|Giris Yapiyorsunuz/i;
const APPROVE_BUTTON = />\s*Onayla\s*</i;
const APPROVE_VALUE = /value=["']Onayla["']/i;
const TWO_FACTOR_STATUS = /İki Aşamalı Giriş\s*:/i;

function hasApproveControl(html: string) {
  return APPROVE_BUTTON.test(html) || APPROVE_VALUE.test(html);
}
const LOGIN_FIELD = /id=["']tridField["']|name=["']tridField["']/i;
const CAPTCHA = /class=["'][^"']*captchaImage/i;
const TIMEOUT = /oturumunuzun süresi dolmuş|oturumunuz sona erdi|session timeout/i;
const MUTATION_PORTAL = /asama=(?:seferDetay|grupIptali|yolcuIptali|excelYukle)/i;

/** Existing group and passenger edits stay open. New-passenger flush, sefer detail, and cancel links stay blocked. */
export function isBlockedPortalUrl(url: string) {
  if (MUTATION_PORTAL.test(url)) return true;
  if (/asama=yeniYolcu/i.test(url) && !/[?&]yolcuIndex=\d+(?:&|$)/i.test(url)) return true;
  if (/asama=yeniGrup/i.test(url) && !/[?&]grupIndex=\d+(?:&|$)/i.test(url)) return true;
  return false;
}

export function lunaStageErrorNote(error: string, loginFailed: string, updateFailed: string) {
  if (error === "portal_update_failed") return `${updateFailed} (${error})`;
  return `${loginFailed} (${error})`;
}

export function classifyKamuLoginPage(input: { url: string; html: string }): KamuLoginPhase | "gate" | "blocked" | "public_landing" | "service_list" | "firm_select" | "trip_list" | "group_list" | "passenger_list" {
  const html = input.html;
  if (isBlockedPortalUrl(input.url)) return "blocked";
  if (/asama=grupListesi/i.test(input.url)) return "group_list";
  if (/asama=yolcuListesi/i.test(input.url)) return "passenger_list";
  if (isTripList(input)) return "trip_list";
  if (isFirmSelect(input)) return "firm_select";
  if (isServiceList(input)) return "service_list";
  if (isAuthenticatedHome(input)) return "portal_home";
  if (isPublicLanding(input)) return "public_landing";
  if (hasApproveControl(html) && (WEB_APPROVAL.test(html) || TWO_FACTOR_STATUS.test(html))) return "web_approval";
  if (TWO_FACTOR.test(html)) return "two_factor";
  if (TIMEOUT.test(html)) return "timeout";
  if (LOGIN_FIELD.test(html)) return "login_page";
  if (KAMU_LOGIN_TARGETS.gate.test(html)) return "gate";
  return "unexpected";
}

/** Authenticated shell from the captured Kamu home: logout link plus the welcome heading, and no public sign-in link. */
function isAuthenticatedHome(input: { url: string; html: string }) {
  if (!/kamu\.turkiye\.gov\.tr/i.test(input.url) || MUTATION_PORTAL.test(input.url) || /asama=seferListesi/i.test(input.url)) return false;
  if (hasPublicSignIn(input.html)) return false;
  const logout = /page=logout/i.test(input.html) && />\s*Çıkış\s*</i.test(input.html);
  const welcome = /Kamu Uygulamaları Merkezi['’]ne Hoş Geldiniz/i.test(input.html);
  const menus = KAMU_LOGIN_TARGETS.portalMenus.every((label) => input.html.includes(label));
  return logout && welcome && menus;
}

/** The same menu labels are on the public landing. Sisteme Giriş in the header means the session is not authenticated. */
function isPublicLanding(input: { url: string; html: string }) {
  if (!/kamu\.turkiye\.gov\.tr/i.test(input.url)) return false;
  return hasPublicSignIn(input.html) && !/page=logout/i.test(input.html);
}

function hasPublicSignIn(html: string) {
  return />\s*Sisteme Giriş\s*</i.test(html);
}

function isServiceList(input: { url: string; html: string }) {
  return /page=hizmet-listesi/i.test(input.url) && input.html.includes("UETDS Tarifesiz Yolcu Taşımacılığı Bildirim İşlemleri");
}

function isFirmSelect(input: { url: string; html: string }) {
  return /UAB_TARIFESIZ/i.test(input.url) && /name=["']firma["']/i.test(input.html) && /value=["']Devam Et["']/i.test(input.html);
}

function isTripList(input: { url: string; html: string }) {
  return /asama=seferListesi/i.test(input.url) && /Firma Sefer No/i.test(input.html);
}

function publicResult(phase: KamuLoginPhase, error: string | null = null, firmLabel: string | null = null): KamuLoginPublicResult {
  return { phase, error, firmLabel };
}

/** WebKit reports an aborted fetch as TypeError: Load failed. Chromium uses Failed to fetch. */
export function isSupersededPageFetch(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const name = "name" in error ? String(error.name) : "";
  const message = "message" in error ? String(error.message) : "";
  if (name === "AbortError") return true;
  return name === "TypeError" && (message === "Load failed" || message === "Failed to fetch");
}

async function readPage(page: KamuLoginControls) {
  return { url: await page.url(), html: await page.html() };
}

async function pause(ms: number) {
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}

/** A reset connection can reject goto after the public document is already visible. */
async function openObservedHome(page: KamuLoginControls) {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await page.goto(KAMU_LOGIN_HOME);
      return;
    } catch (error) {
      lastError = error;
      try {
        const kind = classifyKamuLoginPage(await readPage(page));
        if (kind === "public_landing" || kind === "portal_home" || kind === "gate" || kind === "login_page") return;
      } catch {
        // The document was still failing over.
      }
      if (attempt < 2) await pause(400);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("kamu_home_unavailable");
}

export async function runObservedKamuLogin(
  page: KamuLoginControls,
  secrets: { identity: string; password: string },
): Promise<KamuLoginPublicResult> {
  await openObservedHome(page);
  let viewed = await readPage(page);
  let kind = classifyKamuLoginPage(viewed);
  if (kind === "blocked") return publicResult("unexpected", "portal_edit_blocked");
  if (kind === "portal_home") return publicResult("portal_home");
  if (kind === "public_landing") {
    const opened = await page.clickPublicLogin();
    viewed = await readPage(page);
    kind = classifyKamuLoginPage(viewed);
    // The Giriş navigation can commit after waitForURL has already rejected.
    if (opened !== "ok" && kind !== "login_page") return publicResult("page_changed", opened);
  } else if (kind === "gate") {
    const clicked = await page.clickGate();
    if (!clicked) return publicResult("page_changed", "login_gate_missing");
    viewed = await readPage(page);
    kind = classifyKamuLoginPage(viewed);
  }
  if (kind === "two_factor") return publicResult("two_factor");
  if (kind === "timeout") return publicResult("timeout");
  if (kind !== "login_page" || !(await page.hasIdentityField())) {
    return publicResult("page_changed", "login_form_missing");
  }
  await page.fillIdentity(secrets.identity);
  await page.fillPassword(secrets.password);
  if (await page.hasCaptcha() || CAPTCHA.test(viewed.html)) {
    return publicResult("captcha_required");
  }
  try {
    await page.submitLogin();
  } catch {
    // Navigation can detach Giriş Yap after the same document has already submitted.
  }
  return resolvePostLoginPage(page);
}

export async function submitLoginAfterCaptcha(page: KamuLoginControls): Promise<KamuLoginPublicResult> {
  const before = classifyKamuLoginPage(await readPage(page));
  if (before === "two_factor") return publicResult("two_factor");
  if (before === "blocked") return publicResult("unexpected", "portal_edit_blocked");
  if (before !== "login_page") return publicResult("page_changed", "login_form_missing");
  try {
    await page.submitLogin();
  } catch {
    // A navigation that detaches Giriş Yap has already started the same document.
  }
  return resolvePostLoginPage(page);
}

function resultAfterSubmit(kind: ReturnType<typeof classifyKamuLoginPage>, captchaVisible: boolean): KamuLoginPublicResult {
  if (kind === "two_factor" || kind === "web_approval") return publicResult(kind);
  if (kind === "portal_home" || kind === "service_list" || kind === "firm_select") return publicResult("portal_home");
  if (kind === "trip_list") return publicResult("trip_list_ready");
  if (kind === "public_landing") return publicResult("page_changed", "unexpected_public_landing");
  if (kind === "timeout") return publicResult("timeout");
  if (kind === "blocked") return publicResult("unexpected", "portal_edit_blocked");
  if (kind === "login_page") return publicResult(captchaVisible ? "captcha_rejected" : "credential_rejected");
  return publicResult("unexpected", "auth_redirect_failed");
}

export function isPendingAuthDocument(input: { url: string; html: string }) {
  const url = input.url.trim();
  if (TWO_FACTOR.test(input.html) || TWO_FACTOR_STATUS.test(input.html) || WEB_APPROVAL.test(input.html) || LOGIN_FIELD.test(input.html) || hasApproveControl(input.html)) return false;
  if (!url || /^about:blank/i.test(url) || /chrome-error:|chromewebdata/i.test(url)) return true;
  const text = input.html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length < 40) return true;
  return /yönlendiriliyor|yonlendiriliyor|lütfen bekleyiniz|lutfen bekleyiniz|sayfa yükleniyor|sayfa yukleniyor/i.test(text);
}

/** The first hop after Giriş Yap is often blank. An already open group or passenger list is not a failed login. */
export async function resolvePostLoginPage(
  page: KamuLoginControls,
  options?: { timeoutMs?: number; sleep?: (ms: number) => Promise<void>; now?: () => number },
): Promise<KamuLoginPublicResult> {
  const timeoutMs = options?.timeoutMs ?? 20000;
  const sleep = options?.sleep ?? pause;
  const now = options?.now ?? Date.now;
  const started = now();
  while (now() - started <= timeoutMs) {
    let viewed: { url: string; html: string };
    try {
      viewed = await readPage(page);
    } catch {
      await sleep(400);
      continue;
    }
    const kind = classifyKamuLoginPage(viewed);
    if (kind === "group_list" || kind === "passenger_list") {
      try {
        await page.goto(KAMU_SEFER_LIST_URL);
      } catch {
        await sleep(400);
      }
      continue;
    }
    if (kind === "unexpected" && isPendingAuthDocument(viewed)) {
      await sleep(400);
      continue;
    }
    const captchaVisible = kind === "login_page" ? await page.hasCaptcha() : false;
    const result = resultAfterSubmit(kind, captchaVisible);
    if (result.error === "auth_redirect_failed") {
      await sleep(400);
      continue;
    }
    return result;
  }
  return publicResult("unexpected", "auth_redirect_failed");
}

const MOBILE_APPROVAL_WAIT_MS = 180_000;

/** Wait on the same page for the phone approval, then submit the observed Onayla control once. */
export async function continueAfterMobileApproval(
  page: KamuLoginControls,
  options?: {
    timeoutMs?: number;
    intervalMs?: number;
    now?: () => number;
    sleep?: (ms: number) => Promise<void>;
    onPhase?: (phase: KamuLoginPhase) => void;
    cancelled?: () => boolean;
    company?: KamuPortalCompany | null;
  },
): Promise<KamuLoginPublicResult> {
  const timeoutMs = options?.timeoutMs ?? MOBILE_APPROVAL_WAIT_MS;
  const intervalMs = options?.intervalMs ?? 1500;
  const now = options?.now ?? Date.now;
  const sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  }));
  const started = now();
  let clicked = false;
  while (now() - started <= timeoutMs) {
    if (options?.cancelled?.()) return publicResult("timeout", "session_closed");
    let viewed: { url: string; html: string };
    try {
      viewed = await readPage(page);
    } catch {
      await sleep(intervalMs);
      continue;
    }
    const kind = classifyKamuLoginPage(viewed);
    if (kind === "blocked") return publicResult("unexpected", "portal_edit_blocked");
    if (kind === "public_landing") {
      return publicResult("page_changed", clicked ? "session_lost_after_web_approval" : "unexpected_public_landing");
    }
    if (kind === "portal_home" || kind === "service_list" || kind === "firm_select" || kind === "trip_list") {
      options?.onPhase?.("portal_home");
      return openTripList(page, options?.company ?? null, options);
    }
    if (clicked && kind === "unexpected" && /kamu\.turkiye\.gov\.tr/i.test(viewed.url)) {
      return publicResult("page_changed", "authenticated_marker_missing");
    }
    if (kind === "two_factor") {
      options?.onPhase?.("two_factor");
      await sleep(intervalMs);
      continue;
    }
    if (kind === "timeout") return publicResult("timeout", "mobile_approval_timeout");
    if (kind === "login_page") return publicResult("login_page", "mobile_approval_rejected");
    if (kind === "web_approval") {
      options?.onPhase?.("web_approval");
      if (clicked) return publicResult("page_changed", "portal_home_missing");
      clicked = true;
      try {
        await page.confirmWebApproval();
      } catch {
        // Onayla can detach as soon as the consent document navigates. The next read is the result.
      }
      let after: ReturnType<typeof classifyKamuLoginPage> | null = null;
      try {
        after = classifyKamuLoginPage(await readPage(page));
      } catch {
        await sleep(intervalMs);
        continue;
      }
      if (after === "public_landing") return publicResult("page_changed", "session_lost_after_web_approval");
      if (after === "timeout") return publicResult("timeout", "mobile_approval_timeout");
      if (after === "login_page") return publicResult("login_page", "mobile_approval_rejected");
      if (after === "blocked") return publicResult("unexpected", "portal_edit_blocked");
      if (after === "web_approval") return publicResult("page_changed", "web_approval_missing");
      continue;
    }
    await sleep(intervalMs);
  }
  return publicResult("timeout", "mobile_approval_timeout");
}

const FIRM_SUFFIX = new Set(["LTD", "STI", "AS", "LIMITED", "SIRKETI", "ANONIM"]);

export function normalizePortalFirmName(value: string) {
  const folded = value
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .toUpperCase()
    .replace(/Ç/g, "C")
    .replace(/Ğ/g, "G")
    .replace(/Ö/g, "O")
    .replace(/Ş/g, "S")
    .replace(/Ü/g, "U");
  const tokens = folded.replace(/[^A-Z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  while (tokens.length > 1 && FIRM_SUFFIX.has(tokens[tokens.length - 1] ?? "")) tokens.pop();
  return tokens.join(" ");
}

export function matchPortalFirm(options: KamuFirmOption[], company: KamuPortalCompany | null):
  | { ok: true; value: string; label: string; alreadySelected: boolean }
  | { ok: false; reason: "firm_not_found" | "firm_ambiguous" } {
  const firms = options.filter((option) => option.value.trim() && option.label.trim() && option.label.trim() !== "Seçiniz");
  if (!company) return { ok: false, reason: "firm_not_found" };
  const legal = normalizePortalFirmName(company.legalName);
  const documentNumber = company.authorityDocumentNumber.trim();
  const byName = legal ? firms.filter((option) => normalizePortalFirmName(option.label) === legal) : [];
  const byDocument = documentNumber
    ? firms.filter((option) => option.label.includes(documentNumber))
    : [];
  const nameIds = new Set(byName.map((option) => option.value));
  const documentIds = new Set(byDocument.map((option) => option.value));
  if (byName.length > 1 || byDocument.length > 1) return { ok: false, reason: "firm_ambiguous" };
  if (byName.length === 1 && byDocument.length === 1 && !nameIds.has([...documentIds][0] ?? "")) {
    return { ok: false, reason: "firm_ambiguous" };
  }
  const match = byName[0] ?? byDocument[0];
  if (!match) return { ok: false, reason: "firm_not_found" };
  if (company.authorityDocumentType === "D2" && byDocument.length === 1 && byName.length === 1 && match.value !== byDocument[0]?.value) {
    return { ok: false, reason: "firm_ambiguous" };
  }
  return { ok: true, value: match.value, label: match.label, alreadySelected: match.selected };
}

async function openTripList(
  page: KamuLoginControls,
  company: KamuPortalCompany | null,
  options?: { cancelled?: () => boolean; onPhase?: (phase: KamuLoginPhase) => void },
): Promise<KamuLoginPublicResult> {
  if (options?.cancelled?.()) return publicResult("timeout", "session_closed");
  const here = classifyKamuLoginPage(await readPage(page));
  if (here === "trip_list") return publicResult("trip_list_ready", null, company?.legalName ?? "");
  if (here !== "firm_select" && here !== "service_list") {
    const menu = await page.clickEHizmetler();
    if (menu !== "ok") {
      const afterMenu = classifyKamuLoginPage(await readPage(page));
      if (afterMenu !== "service_list" && afterMenu !== "firm_select" && afterMenu !== "trip_list") {
        return publicResult("page_changed", menu);
      }
    }
  }
  const services = classifyKamuLoginPage(await readPage(page));
  if (services === "trip_list") return publicResult("trip_list_ready", null, company?.legalName ?? "");
  if (services !== "service_list" && services !== "firm_select") return publicResult("page_changed", "service_menu_navigation_failed");
  if (options?.cancelled?.()) return publicResult("timeout", "session_closed");
  if (services === "service_list") {
    const tarifesiz = await page.clickTarifesizNotification();
    if (tarifesiz !== "ok") {
      const afterService = classifyKamuLoginPage(await readPage(page));
      if (afterService !== "firm_select" && afterService !== "trip_list") return publicResult("page_changed", tarifesiz);
    }
  }
  const arrived = classifyKamuLoginPage(await readPage(page));
  if (arrived === "blocked") return publicResult("unexpected", "portal_edit_blocked");
  if (arrived === "trip_list") {
    return publicResult("trip_list_ready", null, company?.legalName ?? "");
  }
  if (arrived !== "firm_select") return publicResult("page_changed", "firm_select_missing");
  const match = matchPortalFirm(await page.readFirmOptions(), company);
  if (!match.ok) return publicResult("page_changed", match.reason);
  if (!match.alreadySelected) {
    const chosen = await page.chooseFirm(match.value);
    if (!chosen) return publicResult("page_changed", "firm_not_found");
  }
  if (options?.cancelled?.()) return publicResult("timeout", "session_closed");
  const submitted = await page.submitFirmContinue();
  if (submitted !== "ok") return publicResult("page_changed", submitted);
  const listed = classifyKamuLoginPage(await readPage(page));
  if (listed === "blocked") return publicResult("unexpected", "portal_edit_blocked");
  if (listed !== "trip_list") return publicResult("page_changed", "trip_list_missing");
  return publicResult("trip_list_ready", null, match.label);
}

export function kamuLoginStatusKeys(value: Record<string, unknown>) {
  const forbidden = ["password", "identity", "identityNumber", "tckn", "encTridField", "encEgpField", "cookie", "html"];
  return forbidden.filter((key) => Object.prototype.hasOwnProperty.call(value, key) || JSON.stringify(value).toLowerCase().includes(`"${key.toLowerCase()}"`));
}
