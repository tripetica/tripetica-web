import { NextResponse } from "next/server";
import { loadOpsMapFleet } from "@/lib/gps/ops-fleet";
import { listGpsDevices } from "@/lib/gps/queries";
import { actorCan, getOpsActor } from "@/lib/ops/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "private, no-store" };

export async function GET() {
  const actor = await getOpsActor();
  if (!actor || !actorCan(actor, "gps.view")) {
    return NextResponse.json({ ok: false }, { status: 401, headers: noStore });
  }
  const vehicles = await loadOpsMapFleet(await listGpsDevices(null));
  return NextResponse.json({ ok: true, vehicles }, { headers: noStore });
}
