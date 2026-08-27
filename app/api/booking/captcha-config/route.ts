import { NextRequest, NextResponse } from "next/server";
import {
  captchaProviderForLocale,
  captchaSiteKeyFor,
} from "@/lib/booking/checkout-complete";
import { isLocale } from "@/lib/i18n/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const localeParam = request.nextUrl.searchParams.get("locale");
  const locale = localeParam && isLocale(localeParam) ? localeParam : null;
  if (!locale) {
    return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
  }
  const provider = captchaProviderForLocale(locale);
  const siteKey = captchaSiteKeyFor(locale);
  return NextResponse.json({ provider, siteKey });
}
