import { NextResponse, type NextRequest } from "next/server";
import { DRIVER_PORTAL_SESSION_COOKIE } from "@/lib/driver-portal/constants";
import { resolveLegacyDriverRedirect } from "@/lib/driver-routes";
import { OPS_SESSION_COOKIE } from "@/lib/ops/constants";
import { PARTNER_SESSION_COOKIE } from "@/lib/partner/constants";
import { partnerSessionCookieOptions } from "@/lib/partner/session-expiry";
import {
  isGoneLegacyLangRoot,
  LEGACY_LANG_GONE_STATUS,
  resolveSeoRedirect,
  seoRedirectHref,
} from "@/lib/seo/legacy-locale-redirect";

function withPathnameHeader(request: NextRequest, name: string, pathname: string) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(name, pathname);
  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

function requestIsHttps(request: NextRequest) {
  return (
    process.env.NODE_ENV === "production" ||
    request.headers.get("x-forwarded-proto") === "https"
  );
}

async function maybeAttachRenewedPartnerSessionCookie(
  request: NextRequest,
  response: NextResponse,
  token: string,
) {
  try {
    const { renewPartnerSessionIfNeeded } = await import("@/lib/partner/session");
    const expiresAt = await renewPartnerSessionIfNeeded(token);
    if (!expiresAt) {
      return;
    }
    response.cookies.set(
      PARTNER_SESSION_COOKIE,
      token,
      partnerSessionCookieOptions(expiresAt, requestIsHttps(request)),
    );
  } catch {
    // Auth still proceeds via getPartnerActor; miss one renew rather than fail the request.
  }
}

async function maybeAttachRenewedOpsSessionCookie(request: NextRequest, response: NextResponse, token: string) {
  try {
    const { renewOpsSessionIfNeeded } = await import("@/lib/ops/session");
    const expiresAt = await renewOpsSessionIfNeeded(token);
    if (expiresAt) {
      response.cookies.set(OPS_SESSION_COOKIE, token, {
        httpOnly: true, sameSite: "lax", secure: requestIsHttps(request), path: "/", expires: expiresAt,
      });
    }
  } catch {
    // getOpsActor still validates the session; renewal failure must not bypass auth.
  }
}

export async function proxy(request: NextRequest) {
  if (isGoneLegacyLangRoot(request.nextUrl.pathname, request.nextUrl.searchParams)) {
    return new NextResponse(null, { status: LEGACY_LANG_GONE_STATUS });
  }

  const seoRedirect = resolveSeoRedirect(
    request.nextUrl.pathname,
    request.nextUrl.searchParams,
  );
  if (seoRedirect) {
    return NextResponse.redirect(
      seoRedirectHref(request.url, seoRedirect),
      seoRedirect.status,
    );
  }

  const { pathname } = request.nextUrl;
  const arabicPanel = pathname.match(
    /^\/ar\/(ops|partner|driver|driver-task|sofor|sofor-gorevi)(\/.*)?$/,
  );
  if (arabicPanel) {
    const url = request.nextUrl.clone();
    const area = arabicPanel[1];
    const rest = arabicPanel[2] ?? "";
    const locale = area === "ops" || area === "partner" ? "en" : "tr";
    url.pathname = `/${locale}/${area}${rest}`;
    return NextResponse.redirect(url, 308);
  }

  const legacyDriver = resolveLegacyDriverRedirect(pathname);
  if (legacyDriver) {
    const url = request.nextUrl.clone();
    url.pathname = legacyDriver;
    url.search = "";
    return NextResponse.redirect(url, 308);
  }

  const opsMatch = pathname.match(/^\/(tr|en|ru)\/ops(?:\/(.*))?$/);
  if (opsMatch) {
    const locale = opsMatch[1];
    const rest = opsMatch[2] ?? "";
    const isLogin = rest === "login" || rest === "login/";
    const token = request.cookies.get(OPS_SESSION_COOKIE)?.value;
    const hasSession = Boolean(token);
    if (!isLogin && !hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/ops/login`;
      url.search = "";
      return NextResponse.redirect(url);
    }
    const response = withPathnameHeader(request, "x-ops-pathname", pathname);
    if (token && !isLogin) await maybeAttachRenewedOpsSessionCookie(request, response, token);
    return response;
  }

  const driverPortalMatch = pathname.match(/^\/(tr|en|ru)\/driver(?:\/(.*))?$/);
  if (driverPortalMatch) {
    const locale = driverPortalMatch[1];
    const rest = driverPortalMatch[2] ?? "";
    const isHome = rest === "" || rest === "/";
    const hasSession = Boolean(request.cookies.get(DRIVER_PORTAL_SESSION_COOKIE)?.value);
    if (!isHome && !hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/driver`;
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  const partnerMatch = pathname.match(/^\/(tr|en|ru)\/partner(?:\/(.*))?$/);
  if (partnerMatch) {
    const locale = partnerMatch[1];
    const rest = partnerMatch[2] ?? "";
    const isPublic =
      rest === "login" ||
      rest === "login/" ||
      rest === "register" ||
      rest === "register/" ||
      rest === "forgot-password" ||
      rest === "forgot-password/";
    const token = request.cookies.get(PARTNER_SESSION_COOKIE)?.value;
    if (!isPublic && !token) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/partner/login`;
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    const response = withPathnameHeader(request, "x-partner-pathname", pathname);
    // Cookie Set-Cookie is not allowed during RSC render; renew here (nodejs proxy).
    if (token && !isPublic) {
      await maybeAttachRenewedPartnerSessionCookie(request, response, token);
    }
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!_next/|api/).*)"],
};
