import { isIP } from "node:net";

type HeaderReader = {
  get(name: string): string | null;
};

export function normalizeTrustedClientIp(value: string | null) {
  const normalized = value?.trim() ?? "";
  if (!normalized || normalized.includes(",") || isIP(normalized) === 0) {
    return null;
  }
  return normalized;
}

/**
 * Nginx overwrites X-Real-IP with its direct peer's $remote_addr. Never fall
 * back to X-Forwarded-For: the current edge appends attacker-controlled values.
 */
export function trustedClientIpFromHeaders(headers: HeaderReader) {
  return normalizeTrustedClientIp(headers.get("x-real-ip"));
}
