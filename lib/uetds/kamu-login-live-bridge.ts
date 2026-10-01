import { readFileSync } from "node:fs";
import { type KamuLoginPhase } from "@/lib/uetds/kamu-login-flow";
import { type KamuLoginViewport } from "@/lib/uetds/kamu-login-session";

const bridgeFile = "/tmp/edevlet-dev-login/bridge.json";

type BridgeFile = {
  port: number;
  token: string;
  contextId: string;
  authorityId: string;
  partnerId: string;
  notificationId: string;
  viewport: KamuLoginViewport;
};

export type LiveBridgeMeta = {
  contextId: string;
  authorityId: string;
  partnerId: string;
  notificationId: string;
  viewport: KamuLoginViewport;
};

function readBridgeFile(): BridgeFile | null {
  try {
    const parsed = JSON.parse(readFileSync(bridgeFile, "utf8")) as Partial<BridgeFile>;
    if (!parsed || typeof parsed.port !== "number" || typeof parsed.token !== "string") return null;
    if (typeof parsed.contextId !== "string" || typeof parsed.authorityId !== "string") return null;
    if (typeof parsed.partnerId !== "string" || typeof parsed.notificationId !== "string") return null;
    if (parsed.viewport !== "mobile" && parsed.viewport !== "desktop") return null;
    return parsed as BridgeFile;
  } catch {
    return null;
  }
}

export function readLiveBridgeMeta(): LiveBridgeMeta | null {
  const file = readBridgeFile();
  if (!file) return null;
  return {
    contextId: file.contextId,
    authorityId: file.authorityId,
    partnerId: file.partnerId,
    notificationId: file.notificationId,
    viewport: file.viewport,
  };
}

function header(token: string) {
  return { "content-type": "application/json", "x-luna-bridge": token };
}

async function bridgeFetch(file: BridgeFile, path: string, init?: RequestInit) {
  return fetch(`http://127.0.0.1:${file.port}${path}`, {
    ...init,
    headers: { ...header(file.token), ...(init?.headers ?? {}) },
    cache: "no-store",
  });
}

export async function openLiveBridgeControls(file = readBridgeFile()) {
  if (!file) return null;
  let status: { ok?: boolean; phase?: KamuLoginPhase; viewport?: KamuLoginViewport; contextId?: string };
  try {
    const response = await bridgeFetch(file, "/status");
    if (!response.ok) return null;
    status = await response.json();
  } catch {
    return null;
  }
  if (!status.ok || (status.phase !== "captcha_required" && status.phase !== "two_factor")) return null;
  if (status.contextId !== file.contextId) return null;
  const viewport = status.viewport === "desktop" ? "desktop" : "mobile";
  const controls = {
    url: async () => "https://giris.turkiye.gov.tr/",
    html: async () => "",
    goto: async () => undefined,
    clickGate: async () => false,
    clickPublicLogin: async () => "public_login_link_missing" as const,
    clickEHizmetler: async () => "service_menu_missing" as const,
    clickTarifesizNotification: async () => "tarifesiz_link_missing" as const,
    readFirmOptions: async () => [],
    chooseFirm: async () => false,
    submitFirmContinue: async () => "continue_missing" as const,
    hasIdentityField: async () => true,
    hasCaptcha: async () => status.phase === "captcha_required",
    fillIdentity: async () => undefined,
    fillPassword: async () => undefined,
    submitLogin: async () => undefined,
    confirmWebApproval: async () => false,
    press: async (key: string) => {
      await bridgeFetch(file, "/input", { method: "POST", body: JSON.stringify({ kind: "key", key }) });
    },
    scroll: async (direction: "up" | "down") => {
      await bridgeFetch(file, "/input", { method: "POST", body: JSON.stringify({ kind: "scroll", direction }) });
    },
    setViewport: async (next: KamuLoginViewport) => {
      await bridgeFetch(file, "/input", { method: "POST", body: JSON.stringify({ kind: "viewport", viewport: next }) });
    },
    screenshot: async () => {
      const response = await bridgeFetch(file, "/frame");
      if (!response.ok) throw new Error("frame_unavailable");
      return Buffer.from(await response.arrayBuffer());
    },
    focusCaptcha: async () => true,
    captchaFilled: async () => false,
    completeCaptchaHandoff: async () => {
      const response = await bridgeFetch(file, "/handoff", { method: "POST", body: "{}" });
      const body = (await response.json()) as { phase?: KamuLoginPhase; error?: string | null };
      const phase = body.phase ?? "unexpected";
      return { phase, error: body.error ?? null };
    },
    close: async () => {
      await bridgeFetch(file, "/close", { method: "POST", body: "{}" });
    },
  };
  return { file, viewport, phase: status.phase, controls };
}
