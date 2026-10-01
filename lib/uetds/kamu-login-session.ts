import { randomUUID } from "node:crypto";
import {
  classifyKamuLoginPage,
  continueAfterMobileApproval,
  resolvePostLoginPage,
  submitLoginAfterCaptcha,
  type KamuLoginControls,
  type KamuLoginPhase,
  type KamuPortalCompany,
} from "@/lib/uetds/kamu-login-flow";
import { matchPortalTrip, parsePortalSeferRows, type PortalSeferRow, type PortalTripTarget } from "@/lib/uetds/kamu-portal/edit-plan";
import { runPortalUpdate, type PortalEditPlan } from "@/lib/uetds/kamu-portal/live-update";

export type KamuLoginViewport = "mobile" | "desktop";
export type KamuLoginControlMode = "luna" | "human";

export type KamuLoginSessionState = {
  sessionId: string;
  contextId: string;
  phase: KamuLoginPhase | "starting" | "closed";
  control: KamuLoginControlMode;
  viewport: KamuLoginViewport;
  error: string | null;
  firmLabel: string | null;
  attached: boolean;
  /** Characters read from the security-code image, shown only so the user can correct them. */
  captchaDraft: string | null;
  tripIndex: number | null;
  passengerStep: number | null;
};

type SessionRecord = KamuLoginSessionState & {
  ownerKey: string;
  notificationId: string;
  authorityId: string;
  company: KamuPortalCompany | null;
  tripTarget: PortalTripTarget | null;
  editPlan: PortalEditPlan | null;
  passengerStep: number | null;
  updateRunning?: Promise<void>;
  updateSettled?: boolean;
  tripScanStarted?: boolean;
  listFrame?: Buffer;
  listFrameAt?: number;
  watching?: boolean;
  captchaWatching?: boolean;
  captchaBusy?: boolean;
  controls: KamuLoginControls & {
    press(key: string): Promise<void>;
    scroll(direction: "up" | "down"): Promise<void>;
    setViewport(viewport: KamuLoginViewport): Promise<void>;
    screenshot(): Promise<Buffer>;
    screenshotDocument?(): Promise<Buffer>;
    close(): Promise<void>;
    captchaFilled?(): Promise<boolean>;
    captchaProgress?(): Promise<{ length: number; maxLength: number } | null>;
    readCaptcha?(): Promise<string | null>;
    fillCaptcha?(value: string): Promise<boolean>;
    collectSeferRows?(): Promise<import("@/lib/uetds/kamu-portal/edit-plan").PortalSeferRow[]>;
    saveGroupForm?(input: { pickup: { provinceName: string; districtName: string } | null; dropoff: { provinceName: string; districtName: string } | null; identityConfirmed?: boolean }): Promise<boolean>;
    savePassengerForm?(input: { yolcuIndex: number; nationality: string; documentNumber: string; firstName: string; lastName: string; gender: string }): Promise<boolean>;
    focusCaptcha?(): Promise<boolean>;
    completeCaptchaHandoff?(): Promise<{ phase: KamuLoginPhase; error: string | null }>;
  };
};

type Store = Map<string, SessionRecord>;

function store(): Store {
  const globalStore = globalThis as typeof globalThis & { __tripeticaKamuLoginSessions?: Store };
  if (!globalStore.__tripeticaKamuLoginSessions) {
    globalStore.__tripeticaKamuLoginSessions = new Map();
  }
  return globalStore.__tripeticaKamuLoginSessions;
}

export function kamuLoginDevAllowed() {
  return process.env.NODE_ENV !== "production";
}

/** Assisted Kamu login is part of the product. Mutation URLs stay blocked in the browser. */
export function kamuAssistedLoginAllowed() {
  return true;
}

function publish(record: SessionRecord): KamuLoginSessionState {
  return {
    sessionId: record.sessionId,
    contextId: record.contextId,
    phase: record.phase,
    control: record.control,
    viewport: record.viewport,
    error: record.error,
    firmLabel: record.firmLabel,
    attached: record.attached,
    captchaDraft: record.phase === "captcha_required" ? record.captchaDraft : null,
    tripIndex: record.tripIndex,
    passengerStep: record.passengerStep,
  };
}

export function readKamuLoginSession(sessionId: string, ownerKey: string): KamuLoginSessionState | null {
  const record = store().get(sessionId);
  if (!record || record.ownerKey !== ownerKey) return null;
  return publish(record);
}

export async function openKamuLoginSession(input: {
  ownerKey: string;
  notificationId: string;
  authorityId: string;
  viewport: KamuLoginViewport;
  company?: KamuPortalCompany | null;
  tripTarget?: PortalTripTarget | null;
  controls: SessionRecord["controls"];
  login: (controls: KamuLoginControls) => Promise<{ phase: KamuLoginPhase; error: string | null }>;
}): Promise<KamuLoginSessionState> {
  const sessionId = randomUUID();
  const contextId = randomUUID();
  const record: SessionRecord = {
    sessionId,
    contextId,
    ownerKey: input.ownerKey,
    notificationId: input.notificationId,
    authorityId: input.authorityId,
    phase: "starting",
    control: "luna",
    viewport: input.viewport,
    error: null,
    firmLabel: null,
    attached: false,
    captchaDraft: null,
    tripIndex: null,
    passengerStep: null,
    company: input.company ?? null,
    tripTarget: input.tripTarget ?? null,
    editPlan: null,
    controls: input.controls,
  };
  store().set(sessionId, record);
  try {
    const result = await input.login(record.controls);
    record.phase = result.phase;
    record.error = result.error;
    if (result.phase === "captcha_required") {
      record.control = "human";
      watchCaptcha(record);
    }
    if (result.phase === "two_factor" || result.phase === "web_approval") watchAfterMobileApproval(record);
  } catch {
    await settleThrownLogin(record);
  }
  return publish(record);
}

export function adoptKamuLoginSession(input: {
  ownerKey: string;
  notificationId: string;
  authorityId: string;
  viewport: KamuLoginViewport;
  contextId: string;
  phase: KamuLoginPhase;
  controls: SessionRecord["controls"];
}): KamuLoginSessionState {
  for (const record of store().values()) {
    if (record.contextId === input.contextId && record.ownerKey === input.ownerKey && record.phase !== "closed") {
      return publish(record);
    }
  }
  const record: SessionRecord = {
    sessionId: randomUUID(),
    contextId: input.contextId,
    ownerKey: input.ownerKey,
    notificationId: input.notificationId,
    authorityId: input.authorityId,
    phase: input.phase,
    control: input.phase === "captcha_required" ? "human" : "luna",
    viewport: input.viewport,
    error: null,
    firmLabel: null,
    attached: true,
    captchaDraft: null,
    tripIndex: null,
    passengerStep: null,
    company: null,
    tripTarget: null,
    editPlan: null,
    controls: input.controls,
  };
  store().set(record.sessionId, record);
  return publish(record);
}

export async function setKamuLoginControl(input: {
  sessionId: string;
  ownerKey: string;
  control: KamuLoginControlMode;
}): Promise<KamuLoginSessionState | null> {
  const record = store().get(input.sessionId);
  if (!record || record.ownerKey !== input.ownerKey || record.phase === "closed") return null;
  const sameContext = record.contextId;
  record.control = input.control;
  if (input.control === "luna" && record.phase === "captcha_required") {
    if (record.captchaDraft != null || record.captchaBusy) return publish(record);
    record.captchaBusy = true;
    try {
      const result = record.controls.completeCaptchaHandoff
        ? await record.controls.completeCaptchaHandoff()
        : (await record.controls.captchaFilled?.()) === false
          ? { phase: "captcha_required" as const, error: "captcha_empty" }
          : await submitLoginAfterCaptcha(record.controls);
      if (result.error === "captcha_empty") {
        record.control = "human";
        record.phase = "captcha_required";
        record.error = "captcha_empty";
      } else {
        applyLoginResult(record, result);
      }
    } catch {
      await settleThrownLogin(record);
    } finally {
      record.captchaBusy = false;
    }
  }
  if (record.contextId !== sameContext) {
    record.phase = "unexpected";
    record.error = "context_replaced";
  }
  return publish(record);
}

export async function inputKamuLoginSession(input: {
  sessionId: string;
  ownerKey: string;
  kind: "key" | "scroll" | "viewport" | "captcha";
  key?: string;
  direction?: "up" | "down";
  viewport?: KamuLoginViewport;
  captcha?: string;
}): Promise<KamuLoginSessionState | null> {
  const record = store().get(input.sessionId);
  if (!record || record.ownerKey !== input.ownerKey || record.phase === "closed") return null;
  if (input.kind === "captcha") {
    if (record.phase === "captcha_required") await confirmCaptcha(record, input.captcha ?? "");
    return publish(record);
  }
  if (input.kind === "viewport" && input.viewport) {
    await record.controls.setViewport("desktop");
    record.viewport = "desktop";
    return publish(record);
  }
  if (record.phase === "two_factor" || record.phase === "web_approval" || record.phase === "portal_home" || record.phase === "trip_list_ready" || record.phase === "trip_matched") return publish(record);
  if (record.control !== "human") return publish(record);
  if (input.kind === "key" && input.key) {
    if (record.phase === "captcha_required" && input.key === "Enter") return publish(record);
    if (record.phase === "captcha_required") await record.controls.focusCaptcha?.();
    await record.controls.press(input.key);
  }
  if (input.kind === "scroll" && input.direction) await record.controls.scroll(input.direction);
  return publish(record);
}

export async function readOpenKamuSeferLists(ownerKey: string) {
  const records = [...store().values()].filter((record) => record.ownerKey === ownerKey && record.phase !== "closed");
  const described = await Promise.all(records.map(async (record) => ({ record, url: await record.controls.url() })));
  const lists = described.filter((item) => /asama=seferListesi/i.test(item.url));
  const pages = await Promise.all(lists.map(async (item) => {
    const html = await item.record.controls.html();
    let rows: PortalSeferRow[] = parsePortalSeferRows(html);
    if (rows.length < 30 && item.record.controls.collectSeferRows) {
      rows = await item.record.controls.collectSeferRows();
    }
    return { phase: item.record.phase, url: item.url, html, rows };
  }));
  return { openSessions: described.length, pages };
}

export async function screenshotKamuLoginSession(sessionId: string, ownerKey: string) {
  const record = store().get(sessionId);
  if (!record || record.ownerKey !== ownerKey || record.phase === "closed") return null;
  if ((record.phase === "trip_list_ready" || record.phase === "trip_matched") && record.controls.screenshotDocument) {
    if (record.listFrame && record.listFrameAt && Date.now() - record.listFrameAt < 20000) return record.listFrame;
    const image = await record.controls.screenshotDocument();
    record.listFrame = image;
    record.listFrameAt = Date.now();
    return image;
  }
  return record.controls.screenshot();
}

export async function closeKamuLoginSession(sessionId: string, ownerKey: string) {
  const record = store().get(sessionId);
  if (!record || record.ownerKey !== ownerKey) return false;
  record.phase = "closed";
  store().delete(sessionId);
  await record.controls.close();
  return true;
}

async function settleThrownLogin(record: SessionRecord) {
  if (record.phase === "closed") return;
  const result = await resolvePostLoginPage(record.controls);
  if ((record.phase as string) === "closed") return;
  if (result.error === "auth_redirect_failed") {
    if (record.phase === "two_factor" || record.phase === "web_approval" || record.phase === "portal_home" || record.phase === "trip_list_ready" || record.phase === "trip_matched" || record.phase === "captcha_required") return;
    record.phase = "unexpected";
    record.error = "auth_redirect_failed";
    return;
  }
  applyLoginResult(record, result);
}

async function advanceTripMatch(record: SessionRecord) {
  if (record.phase !== "trip_list_ready" || record.tripScanStarted || !record.tripTarget) return;
  record.tripScanStarted = true;
  try {
    const rows = record.controls.collectSeferRows
      ? await record.controls.collectSeferRows()
      : parsePortalSeferRows(await record.controls.html());
    if ((record.phase as string) !== "trip_list_ready") return;
    const match = matchPortalTrip(rows, record.tripTarget);
    if (!match.ok) {
      record.error = match.error;
      if (match.error === "trip_number_mismatch") {
        const clock = rows.filter((row) => row.plate.replace(/\s+/g, "") === (record.tripTarget?.plate ?? "").replace(/\s+/g, ""));
        const tokens = clock.flatMap((row) => row.seferNumbers).filter((token) => token.length >= 8).slice(0, 12);
        console.error(`[uetds] trip_number_mismatch tokens=${tokens.join("|")}`);
      }
      return;
    }
    record.tripIndex = match.listPosition;
    record.phase = "trip_matched";
    record.error = null;
  } catch {
    record.tripScanStarted = false;
  }
}

function applyLoginResult(record: SessionRecord, result: { phase: KamuLoginPhase; error: string | null; firmLabel?: string | null }) {
  record.phase = result.phase;
  record.error = result.error;
  if (result.firmLabel) record.firmLabel = result.firmLabel;
  if (result.phase === "captcha_required") {
    record.control = "human";
    watchCaptcha(record);
  }
  if (result.phase === "two_factor" || result.phase === "web_approval") watchAfterMobileApproval(record);
    if (result.phase === "portal_home" || result.phase === "trip_list_ready" || result.phase === "trip_matched") record.error = null;
    if (result.phase === "trip_list_ready") void advanceTripMatch(record);
}

async function prepareCaptchaReview(record: SessionRecord) {
  if (record.phase !== "captcha_required" || record.captchaBusy) return;
  record.control = "human";
  record.captchaDraft = null;
  const code = await record.controls.readCaptcha?.();
  if ((record.phase as string) !== "captcha_required") return;
  if (!code) {
    record.captchaDraft = "";
    record.error = "captcha_unreadable";
    return;
  }
  if (record.controls.fillCaptcha) await record.controls.fillCaptcha(code);
  if ((record.phase as string) !== "captcha_required") return;
  record.captchaDraft = code;
  record.error = null;
}

async function confirmCaptcha(record: SessionRecord, raw: string) {
  if (record.phase !== "captcha_required" || record.captchaBusy) return;
  const code = raw.replace(/[^0-9A-Za-z]/g, "");
  if (code.length < 4 || code.length > 8 || !record.controls.fillCaptcha) {
    record.error = "captcha_empty";
    return;
  }
  record.captchaBusy = true;
  let reviewAgain = false;
  try {
    const filled = await record.controls.fillCaptcha(code);
    if (!filled) {
      record.error = "captcha_empty";
      return;
    }
    const result = await submitLoginAfterCaptcha(record.controls);
    if ((record.phase as string) === "closed") return;
    record.captchaDraft = null;
    if (result.phase === "captcha_rejected") {
      reviewAgain = true;
      record.phase = "captcha_required";
      record.control = "human";
      record.error = null;
    } else {
      applyLoginResult(record, result);
    }
  } catch {
    await settleThrownLogin(record);
  } finally {
    record.captchaBusy = false;
  }
  if (reviewAgain && record.phase === "captcha_required") await prepareCaptchaReview(record);
}

function watchCaptcha(record: SessionRecord) {
  if (record.captchaWatching || record.phase !== "captcha_required") return;
  if (!record.controls.readCaptcha && !record.controls.captchaProgress) return;
  record.captchaWatching = true;
  void (async () => {
    if (record.controls.readCaptcha && record.controls.fillCaptcha) {
      await prepareCaptchaReview(record);
      return;
    }
    void record.controls.focusCaptcha?.();
    let lastLength = -1;
    let stableSince = Date.now();
    while (record.phase === "captcha_required") {
      await sleepUnref(400);
      if (record.phase !== "captcha_required" || record.captchaBusy) return;
      const progress = await record.controls.captchaProgress?.();
      if (!progress) continue;
      if (progress.length !== lastLength) {
        lastLength = progress.length;
        stableSince = Date.now();
      }
      const complete = progress.maxLength > 0
        ? progress.length === progress.maxLength && progress.length > 0
        : progress.length >= 4 && Date.now() - stableSince >= 1200;
      if (!complete) continue;
      record.captchaBusy = true;
      try {
        const result = await submitLoginAfterCaptcha(record.controls);
        if ((record.phase as string) === "closed") return;
        applyLoginResult(record, result);
      } finally {
        record.captchaBusy = false;
      }
      return;
    }
  })().catch(async () => {
    if ((record.phase as string) === "closed") return;
    await settleThrownLogin(record);
  }).finally(() => {
    record.captchaWatching = false;
  });
}

function sleepUnref(ms: number) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref();
  });
}

function watchAfterMobileApproval(record: SessionRecord) {
  if (record.watching || record.phase === "closed") return;
  record.watching = true;
  void continueAfterMobileApproval(record.controls, {
    company: record.company,
    onPhase: (phase) => {
      if (record.phase === "closed") return;
      record.phase = phase;
      if (phase === "portal_home" || phase === "trip_list_ready") record.error = null;
    },
    cancelled: () => record.phase === "closed",
  }).then((result) => {
    if (record.phase === "closed") return;
    record.phase = result.phase;
    record.error = result.error;
    record.firmLabel = result.firmLabel;
    if (result.phase === "trip_list_ready") void advanceTripMatch(record);
    if (result.error) console.error(`kamu_login_failed code=${result.error} name=Error`);
  }).catch(async () => {
    if (record.phase === "closed") return;
    await settleThrownLogin(record);
  }).finally(() => {
    const resume = record.phase === "two_factor" || record.phase === "web_approval" || record.phase === "portal_home";
    record.watching = false;
    if (resume) watchAfterMobileApproval(record);
  });
}

export function rememberPortalEditPlan(sessionId: string, ownerKey: string, plan: PortalEditPlan) {
  const record = store().get(sessionId);
  if (!record || record.ownerKey !== ownerKey || record.phase === "closed" || record.editPlan) return false;
  record.editPlan = plan;
  return true;
}

export function kamuLoginNotificationId(sessionId: string, ownerKey: string) {
  const record = store().get(sessionId);
  if (!record || record.ownerKey !== ownerKey) return null;
  return record.notificationId;
}

async function recoverInterruptedPortalUpdate(record: SessionRecord) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const viewed = { url: await record.controls.url(), html: await record.controls.html() };
      const kind = classifyKamuLoginPage(viewed);
      if (kind === "web_approval" || kind === "two_factor") {
        record.phase = kind;
        record.error = null;
        record.updateSettled = false;
        if (!record.watching) watchAfterMobileApproval(record);
        return true;
      }
      if (kind === "public_landing") {
        record.phase = "page_changed";
        record.error = "unexpected_public_landing";
        record.updateSettled = true;
        return true;
      }
      if (kind === "timeout") {
        record.phase = "timeout";
        record.error = "mobile_approval_timeout";
        record.updateSettled = true;
        return true;
      }
      if (kind === "portal_home" || kind === "service_list" || kind === "firm_select") {
        record.phase = "portal_home";
        record.error = null;
        record.updateSettled = false;
        if (!record.watching) watchAfterMobileApproval(record);
        return true;
      }
      if (kind === "trip_list") {
        record.phase = "trip_list_ready";
        record.error = null;
        record.updateSettled = false;
        record.tripScanStarted = false;
        void advanceTripMatch(record);
        return true;
      }
      return false;
    } catch {
      await sleepUnref(400);
    }
  }
  return false;
}

export async function progressKamuPortalUpdate(sessionId: string, ownerKey: string, plan: PortalEditPlan | null): Promise<KamuLoginSessionState | null> {
  const record = store().get(sessionId);
  if (!record || record.ownerKey !== ownerKey || record.phase === "closed") return null;
  if (plan && !record.editPlan) record.editPlan = plan;
  if (record.updateSettled || record.tripIndex == null || !record.editPlan) return publish(record);
  if (record.phase !== "trip_matched") return publish(record);
  if (!record.updateRunning) {
    record.updateRunning = runPortalUpdate({
      page: record.controls,
      tripIndex: record.tripIndex,
      tripTarget: record.tripTarget ?? { startDate: "", startTime: "", endDate: "", endTime: "", plate: "", seferNumber: "" },
      plan: record.editPlan,
      onPhase: (phase) => {
        if (record.phase === "closed") return;
        record.phase = phase as KamuLoginPhase;
      },
    }).then((result) => {
      if (record.phase === "closed") return;
      record.phase = result.phase as KamuLoginPhase;
      record.error = result.error;
      record.passengerStep = result.passengerStep;
      record.updateSettled = true;
    }).catch(async () => {
      if (record.phase === "closed" || record.updateSettled) return;
      const recovered = await recoverInterruptedPortalUpdate(record);
      if (recovered || (record.phase as string) === "closed") return;
      record.phase = "unexpected";
      record.error = "portal_update_failed";
      record.updateSettled = true;
    }).finally(() => {
      record.updateRunning = undefined;
    });
  }
  await record.updateRunning;
  return publish(record);
}

export function resetKamuLoginSessionsForTests() {
  store().clear();
}
