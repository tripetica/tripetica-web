import { NextRequest, NextResponse } from "next/server";
import { getPartnerActor } from "@/lib/partner/session";
import { isUuid } from "@/lib/ops/process-filters";
import { readStoredFirmaSeferNo } from "@/lib/uetds/firma-sefer-no";
import { matchPortalTrip, parsePortalSeferRows, type PortalTripTarget } from "@/lib/uetds/kamu-portal/edit-plan";
import { kamuLoginDevAllowed, readOpenKamuSeferLists } from "@/lib/uetds/kamu-login-session";
import { getUetdsNotification } from "@/lib/uetds/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  if (!kamuLoginDevAllowed()) return NextResponse.json({ ok: false }, { status: 404 });
  const partner = await getPartnerActor();
  if (!partner) return NextResponse.json({ ok: false }, { status: 404 });
  const owner = `partner:${partner.partnerId}:${partner.userId}`;
  const notificationId = request.nextUrl.searchParams.get("notification") ?? "";
  let target: PortalTripTarget | null = null;
  if (isUuid(notificationId)) {
    const notification = await getUetdsNotification({ id: notificationId, partnerId: partner.partnerId });
    if (notification) {
      const snapshot = JSON.parse(notification.snapshotJson) as { trip?: Record<string, unknown>; vehicle?: Record<string, unknown>; ministry?: Record<string, unknown> };
      target = {
        startDate: text(snapshot.trip?.startDate),
        startTime: text(snapshot.trip?.startTime),
        endDate: text(snapshot.trip?.endDate),
        endTime: text(snapshot.trip?.endTime),
        plate: text(snapshot.vehicle?.plate),
        seferNumber: notification.ministryReference?.trim() || text(snapshot.ministry?.seferReferansNo),
        firmaSeferNo: readStoredFirmaSeferNo(snapshot),
      };
    }
  }
  const open = await readOpenKamuSeferLists(owner);
  const results = open.pages.map((page) => {
    const rows = page.rows.length > 0 ? page.rows : parsePortalSeferRows(page.html);
    const listed = /Firma Sefer No/i.test(page.html);
    const match = target && listed ? matchPortalTrip(rows, target) : { ok: false as const, error: "trip_not_found" as const };
    return { rows: rows.length, listed, trip: match.ok ? "matched" : match.error, tripIndex: match.ok ? match.listPosition : null };
  });
  const same = results.length > 0 && results.every((item) => item.trip === results[0]!.trip && item.tripIndex === results[0]!.tripIndex);
  return NextResponse.json({
    ok: true,
    session: open.pages.length === 0 ? "missing" : same ? "consistent" : "ambiguous",
    openSessions: open.openSessions,
    seferLists: open.pages.length,
    targetReady: Boolean(target && target.startDate && target.startTime && target.endDate && target.endTime && target.plate),
    results,
    groupListReached: false,
    passengerListReached: false,
    saveClicked: false,
  });
}
