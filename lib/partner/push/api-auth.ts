import { NextResponse } from "next/server";
import { getPartnerActor, type PartnerActor } from "@/lib/partner/session";

export async function requirePartnerPushActor(): Promise<
  { actor: PartnerActor } | { response: NextResponse }
> {
  const actor = await getPartnerActor();
  if (!actor) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (actor.mustChangePassword) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { actor };
}
