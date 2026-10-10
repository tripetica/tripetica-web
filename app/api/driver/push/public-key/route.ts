import { NextResponse } from "next/server";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { readOpsPushVapidConfig } from "@/lib/ops/push/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await getDriverPortalActor();
  if (!actor) return NextResponse.json({ configured: false }, { status: 401 });
  const vapid = readOpsPushVapidConfig();
  if (!vapid) return NextResponse.json({ configured: false, publicKey: null });
  return NextResponse.json({ configured: true, publicKey: vapid.publicKey });
}
