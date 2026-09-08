import { NextResponse, type NextRequest } from "next/server";
import { OPS_SESSION_COOKIE } from "@/lib/ops/constants";
import { PARTNER_SESSION_COOKIE } from "@/lib/partner/constants";
import {
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

export function proxy(request: NextRequest) {
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
  const opsMatch = pathname.match(/^\/(tr|en|ru)\/ops(?:\/(.*))?$/);
  if (opsMatch) {
    const locale = opsMatch[1];
    const rest = opsMatch[2] ?? "";
    const isLogin = rest === "login" || rest === "login/";
    const hasSession = Boolean(request.cookies.get(OPS_SESSION_COOKIE)?.value);
    if (!isLogin && !hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/ops/login`;
      url.search = "";
      return NextResponse.redirect(url);
    }
    return withPathnameHeader(request, "x-ops-pathname", pathname);
  }

  const partnerMatch = pathname.match(/^\/(tr|en|ru)\/partner(?:\/(.*))?$/);
  if (partnerMatch) {
    const locale = partnerMatch[1];
    const rest = partnerMatch[2] ?? "";
    const isPublic =
      rest === "login" ||
      rest === "login/" ||
      rest === "register" ||
      rest === "register/";
    const hasSession = Boolean(request.cookies.get(PARTNER_SESSION_COOKIE)?.value);
    if (!isPublic && !hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}/partner/login`;
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return withPathnameHeader(request, "x-partner-pathname", pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/((?!_next/|api/).*)"],
};
