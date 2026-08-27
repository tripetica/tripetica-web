import "server-only";

import { type NextRequest, type NextResponse } from "next/server";

export const BROWSER_SESSION_COOKIE = "tripetica_browser_session";
export const BROWSER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBrowserSessionId(value: string | undefined): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function readBrowserSessionId(request: NextRequest) {
  const existing = request.cookies.get(BROWSER_SESSION_COOKIE)?.value;
  return isBrowserSessionId(existing) ? existing : null;
}

export function resolveBrowserSessionId(request: NextRequest) {
  const existing = readBrowserSessionId(request);
  if (existing) {
    return { id: existing, isNew: false };
  }
  return { id: crypto.randomUUID(), isNew: true };
}

export function attachBrowserSessionCookie(
  response: NextResponse,
  sessionId: string,
  isNew: boolean,
  request?: NextRequest,
) {
  if (!isNew) {
    return response;
  }
  const forwardedProto = request?.headers.get("x-forwarded-proto");
  response.cookies.set({
    name: BROWSER_SESSION_COOKIE,
    value: sessionId,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: BROWSER_SESSION_MAX_AGE_SECONDS,
    secure:
      process.env.NODE_ENV === "production" || forwardedProto === "https",
  });
  return response;
}
