import { NextResponse } from "next/server";
import { readOpsPushVapidConfig } from "@/lib/ops/push/config";
import { requirePartnerPushActor } from "@/lib/partner/push/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requirePartnerPushActor();
  if ("response" in auth) {
    return auth.response;
  }
  const vapid = readOpsPushVapidConfig();
  if (!vapid) {
    return NextResponse.json({ configured: false, publicKey: null });
  }
  return NextResponse.json({ configured: true, publicKey: vapid.publicKey });
}
