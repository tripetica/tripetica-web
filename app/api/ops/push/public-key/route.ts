import { NextResponse } from "next/server";
import { readOpsPushVapidConfig } from "@/lib/ops/push/config";
import { requireOpsPushActor } from "@/lib/ops/push/api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireOpsPushActor();
  if ("response" in auth) {
    return auth.response;
  }
  const vapid = readOpsPushVapidConfig();
  if (!vapid) {
    return NextResponse.json({ configured: false, publicKey: null });
  }
  return NextResponse.json({ configured: true, publicKey: vapid.publicKey });
}
