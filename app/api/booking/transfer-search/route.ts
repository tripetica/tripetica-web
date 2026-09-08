import { NextRequest, NextResponse } from "next/server";
import { notifyOpsProcessCreated } from "@/lib/ops/push/notify-process";
import { scheduleOpsPush } from "@/lib/ops/push/schedule";
import {
  attachBrowserSessionCookie,
  resolveBrowserSessionId,
} from "@/lib/booking/browser-session";
import {
  computeSelectedRoute,
  HOURLY_SERVICE_TYPE,
  upsertTransferDraft,
} from "@/lib/booking/reservation-search";
import {
  parseTransferSearchBody,
  toTransferSearchFields,
} from "@/lib/booking/transfer-search-input";
import { UntrustedLocationError } from "@/lib/booking/location-persist";
import { BOSPHORUS_DINNER_TOUR_CODE } from "@/lib/booking/pricing/bosphorus-dinner-pricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseTransferSearchBody(body);
  if ("status" in parsed) {
    return NextResponse.json({ error: parsed.message }, { status: parsed.status });
  }

  const session = resolveBrowserSessionId(request);
  let fields: Awaited<ReturnType<typeof toTransferSearchFields>>;
  try {
    fields = await toTransferSearchFields(parsed);
  } catch (error) {
    if (error instanceof UntrustedLocationError) {
      return NextResponse.json(
        { error: "Location could not be verified" },
        { status: 400 },
      );
    }
    throw error;
  }
  if (
    fields.serviceType === "tour" &&
    fields.tourCode === BOSPHORUS_DINNER_TOUR_CODE &&
    fields.pickup.provinceCode !== "istanbul"
  ) {
    return NextResponse.json(
      { error: "Invalid bosphorus dinner pickup location" },
      { status: 400 },
    );
  }

  let distanceKm: number | null = null;
  let distanceError = false;
  if (
    fields.serviceType === HOURLY_SERVICE_TYPE ||
    (fields.serviceType === "tour" && fields.tourCode)
  ) {
    distanceKm = null;
  } else {
    const route = await computeSelectedRoute(fields.pickup, fields.dropoff);
    distanceKm = route?.distanceKm ?? null;
    distanceError = distanceKm === null;
  }

  try {
    const { id: reservationSearchId, created } = await upsertTransferDraft(
      session.id,
      {
        ...fields,
        distanceKm,
        durationHours:
          fields.serviceType === HOURLY_SERVICE_TYPE ? fields.durationHours : null,
      },
    );
    if (created) {
      scheduleOpsPush("process-created", () =>
        notifyOpsProcessCreated(reservationSearchId),
      );
    }
    const response = NextResponse.json({
      reservationSearchId,
      distanceKm,
      distanceError,
      durationHours: fields.durationHours,
      serviceType: fields.serviceType,
    });
    return attachBrowserSessionCookie(response, session.id, session.isNew, request);
  } catch (error) {
    console.error("[Tripetica transfer-search]", error);
    return NextResponse.json({ error: "Could not save search" }, { status: 500 });
  }
}
