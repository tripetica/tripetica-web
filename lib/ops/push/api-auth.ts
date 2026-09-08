import { NextResponse } from "next/server";
import { actorCan, getOpsActor, type OpsActor } from "@/lib/ops/session";

export async function requireOpsPushActor(): Promise<
  { actor: OpsActor } | { response: NextResponse }
> {
  const actor = await getOpsActor();
  if (!actor) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!actorCan(actor, "processes.view") && !actorCan(actor, "reservations.view")) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actor };
}
