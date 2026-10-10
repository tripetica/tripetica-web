import { NextRequest, NextResponse } from "next/server";
import { getPool } from "@/lib/db/postgres";
import { getDriverPortalActor } from "@/lib/driver-portal/session";
import { readOpsPushVapidConfig } from "@/lib/ops/push/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSubscription(body: unknown) {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const subscription = typeof record.subscription === "object" && record.subscription !== null
    ? record.subscription as Record<string, unknown>
    : record;
  const endpoint = typeof subscription.endpoint === "string" ? subscription.endpoint.trim() : "";
  const keys = typeof subscription.keys === "object" && subscription.keys !== null
    ? subscription.keys as Record<string, unknown>
    : {};
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
  const auth = typeof keys.auth === "string" ? keys.auth.trim() : "";
  if (!endpoint || !p256dh || !auth) return null;
  return { endpoint, p256dh, auth };
}

export async function POST(request: NextRequest) {
  const actor = await getDriverPortalActor();
  if (!actor) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!readOpsPushVapidConfig()) return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  const parsed = readSubscription(await request.json().catch(() => null));
  if (!parsed) return NextResponse.json({ error: "invalid" }, { status: 400 });
  await getPool().query(
    `INSERT INTO driver_push_subscriptions (driver_id, partner_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (endpoint) DO UPDATE
       SET driver_id = EXCLUDED.driver_id,
           partner_id = EXCLUDED.partner_id,
           p256dh = EXCLUDED.p256dh,
           auth = EXCLUDED.auth,
           disabled_at = NULL,
           updated_at = NOW()`,
    [actor.driverId, actor.partnerId, parsed.endpoint, parsed.p256dh, parsed.auth, request.headers.get("user-agent")],
  );
  return NextResponse.json({ ok: true });
}
