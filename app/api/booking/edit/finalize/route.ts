import { NextResponse } from "next/server";
import {
  buildEditFinalizeReview,
  finalizeReservationEdit,
} from "@/lib/booking/edit-finalize";
import { attachBookingSuccessCookie } from "@/lib/booking/booking-success-cookie";
import {
  BROWSER_SESSION_COOKIE,
  isBrowserSessionId,
} from "@/lib/booking/browser-session";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function sessionId() {
  const jar = await cookies();
  const value = jar.get(BROWSER_SESSION_COOKIE)?.value;
  return isBrowserSessionId(value) ? value : null;
}

export async function GET() {
  const browserSessionId = await sessionId();
  if (!browserSessionId) {
    return NextResponse.json({ error: "No active search" }, { status: 401 });
  }
  const review = await buildEditFinalizeReview(browserSessionId);
  if (!review.ok) {
    return NextResponse.json({ error: review.reason }, { status: 400 });
  }
  return NextResponse.json({ ok: true, review: review.review });
}

export async function POST(request: Request) {
  let legalAccepted = false;
  try {
    const body = (await request.json()) as { legalAccepted?: unknown };
    legalAccepted = body.legalAccepted === true;
  } catch {
    legalAccepted = false;
  }

  const result = await finalizeReservationEdit({ legalAccepted });
  if (!result.ok) {
    const status =
      result.reason === "unauthenticated-session"
        ? 401
        : result.reason === "not-found"
          ? 404
            : result.reason === "provider"
            ? 502
            : result.reason === "legal_required" || result.reason === "checkout"
              ? 400
              : 400;
    console.error("[edit/finalize] failed", {
      reason: result.reason,
      mode: result.review?.mode ?? null,
      amountDue: result.review?.amountDue ?? null,
      currency: result.review?.newCurrency ?? null,
    });
    return NextResponse.json(
      { ok: false, error: result.reason, review: result.review ?? null },
      { status },
    );
  }
  if (result.outcome === "payment_required") {
    const response = NextResponse.json({
      ok: true,
      outcome: "payment_required",
      paymentUrl: result.paymentUrl,
      amountDue: result.amountDue,
      currency: result.currency,
      reservationCode: result.reservationCode,
      review: result.review,
    });
    return attachBookingSuccessCookie(
      response,
      result.reservationId,
      undefined,
      "edit",
    );
  }
  const response = NextResponse.json({
    ok: true,
    outcome: "committed",
    reservationCode: result.reservationCode,
    mode: result.mode,
    review: result.review,
    reservationId: result.reservationId,
  });
  // Zero-diff / refund edits: land on success with "updated" messaging.
  // Cash stays on account list (client decides); still attach cookie for consistency.
  if (result.mode === "zero_diff") {
    return attachBookingSuccessCookie(
      response,
      result.reservationId,
      undefined,
      "edit",
    );
  }
  return response;
}
