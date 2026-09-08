import { NextRequest, NextResponse } from "next/server";
import { requireOpsPushActor } from "@/lib/ops/push/api-auth";
import { readOpsPushVapidConfig } from "@/lib/ops/push/config";
import {
  deleteOpsPushSubscription,
  upsertOpsPushSubscription,
} from "@/lib/ops/push/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readSubscription(body: unknown) {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  const subscription =
    typeof record.subscription === "object" && record.subscription !== null
      ? (record.subscription as Record<string, unknown>)
      : record;
  const endpoint =
    typeof subscription.endpoint === "string" ? subscription.endpoint.trim() : "";
  const keys =
    typeof subscription.keys === "object" && subscription.keys !== null
      ? (subscription.keys as Record<string, unknown>)
      : {};
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
  const auth = typeof keys.auth === "string" ? keys.auth.trim() : "";
  if (!endpoint || !p256dh || !auth) {
    return null;
  }
  const locale = typeof record.locale === "string" ? record.locale : null;
  return { endpoint, p256dh, auth, locale };
}

export async function POST(request: NextRequest) {
  const auth = await requireOpsPushActor();
  if ("response" in auth) {
    return auth.response;
  }
  if (!readOpsPushVapidConfig()) {
    return NextResponse.json({ error: "Push is not configured" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = readSubscription(body);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  await upsertOpsPushSubscription({
    opsUserId: auth.actor.id,
    endpoint: parsed.endpoint,
    p256dh: parsed.p256dh,
    auth: parsed.auth,
    locale: parsed.locale,
    userAgent: request.headers.get("user-agent"),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireOpsPushActor();
  if ("response" in auth) {
    return auth.response;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = readSubscription(body);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
  }
  await deleteOpsPushSubscription(auth.actor.id, parsed.endpoint);
  return NextResponse.json({ ok: true });
}
