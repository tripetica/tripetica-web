import "server-only";

import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import path from "node:path";

import { sealSecret, unsealSecret, SealedSecretError } from "@/lib/security/sealed-secret";

const DEFAULT_RELATIVE = "tmp/uetds-kamu-session.sealed";
/** Writable under tripetica-dev systemd (ReadWritePaths=/var/lib/tripetica-dev). */
const DEFAULT_DEV_ABSOLUTE = "/var/lib/tripetica-dev/uetds-kamu-session.sealed";

export type KamuPortalSession = {
  cookieHeader: string;
  savedAt: string;
};

/**
 * DEV process-local session. Avoids requiring disk + UETDS_CREDENTIALS_KEY for the
 * acceptance bind, and never logs cookie values. Cleared on server restart/HMR.
 */
let memorySession: KamuPortalSession | null = null;

function sessionPath(env: Record<string, string | undefined> = process.env) {
  const configured = env.UETDS_KAMU_SESSION_PATH?.trim();
  if (configured) {
    return configured.startsWith("/")
      ? configured
      : path.join(process.cwd(), configured);
  }
  if (env.EXPECTED_DATABASE === "tripetica_dev") {
    return DEFAULT_DEV_ABSOLUTE;
  }
  return path.join(process.cwd(), DEFAULT_RELATIVE);
}

function isDevDatabase(env: Record<string, string | undefined> = process.env) {
  return env.EXPECTED_DATABASE === "tripetica_dev" || env.NODE_ENV === "development";
}

/** Never log or return cookie values. */
export function kamuPortalSessionConfigured(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.UETDS_CREDENTIALS_KEY?.trim());
}

export async function loadKamuPortalSession(
  env: Record<string, string | undefined> = process.env,
): Promise<KamuPortalSession | null> {
  if (memorySession?.cookieHeader) {
    return memorySession;
  }
  if (!kamuPortalSessionConfigured(env)) {
    return null;
  }
  try {
    const sealed = (await readFile(sessionPath(env), "utf8")).trim();
    if (!sealed) {
      return null;
    }
    const raw = unsealSecret(sealed);
    const parsed = JSON.parse(raw) as { cookieHeader?: unknown; savedAt?: unknown };
    const cookieHeader = typeof parsed.cookieHeader === "string" ? parsed.cookieHeader.trim() : "";
    if (!cookieHeader) {
      return null;
    }
    memorySession = {
      cookieHeader,
      savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
    };
    return memorySession;
  } catch (error) {
    if (error instanceof SealedSecretError || (error as NodeJS.ErrnoException)?.code === "ENOENT") {
      return null;
    }
    return null;
  }
}

export async function hasKamuPortalSession(env: Record<string, string | undefined> = process.env) {
  return Boolean(await loadKamuPortalSession(env));
}

/**
 * DEV-only: persist browser Cookie header after the operator completes e-Devlet
 * login on official pages. Never accepts or stores e-Devlet passwords.
 * Always keeps an in-memory copy for this Node process; seals to disk when the
 * credentials key is available and the path is writable.
 */
export async function saveKamuPortalSession(
  cookieHeader: string,
  env: Record<string, string | undefined> = process.env,
): Promise<{ ok: true } | { ok: false; error: "forbidden" | "invalid" | "unavailable" }> {
  if (!isDevDatabase(env)) {
    return { ok: false, error: "forbidden" };
  }
  const cleaned = sanitizeCookieHeader(cookieHeader);
  if (!cleaned) {
    return { ok: false, error: "invalid" };
  }
  memorySession = {
    cookieHeader: cleaned,
    savedAt: new Date().toISOString(),
  };

  if (kamuPortalSessionConfigured(env)) {
    try {
      const payload = JSON.stringify(memorySession);
      const sealed = sealSecret(payload);
      const filePath = sessionPath(env);
      await mkdir(path.dirname(filePath), { recursive: true });
      await writeFile(filePath, sealed, { mode: 0o600 });
    } catch {
      // Memory bind is enough for DEV acceptance; disk is best-effort.
    }
  }
  return { ok: true };
}

export async function clearKamuPortalSession(env: Record<string, string | undefined> = process.env) {
  if (!isDevDatabase(env)) {
    return { ok: false as const, error: "forbidden" as const };
  }
  memorySession = null;
  try {
    await unlink(sessionPath(env));
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
      throw error;
    }
  }
  return { ok: true as const };
}

export function sanitizeCookieHeader(raw: string) {
  const text = raw.trim().replace(/^Cookie:\s*/i, "");
  if (!text || text.length > 16_000) {
    return "";
  }
  // Reject obvious password form fields; session cookies only.
  if (/e-?devlet\s*şifre|password\s*=/i.test(text)) {
    return "";
  }
  const pairs = text
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);
  if (pairs.length === 0) {
    return "";
  }
  // Require at least one session-ish cookie name from turkiye.gov.tr family.
  const names = pairs.map((pair) => pair.split("=")[0]?.trim().toLowerCase() ?? "");
  const looksLikeSession = names.some(
    (name) =>
      name.includes("session") ||
      name === "jsessionid" ||
      name.includes("turkiye") ||
      name.includes("oauth") ||
      name.includes("auth"),
  );
  if (!looksLikeSession) {
    return "";
  }
  return pairs.join("; ");
}
