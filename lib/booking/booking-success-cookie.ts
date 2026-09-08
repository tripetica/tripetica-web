import { type NextRequest, type NextResponse } from "next/server";

/** HttpOnly cookie pointing at the just-completed reservation (UUID), not a public code. */
export const BOOKING_SUCCESS_COOKIE = "tripetica_booking_success";
/** Optional flow marker: create (default) | edit */
export const BOOKING_SUCCESS_FLOW_COOKIE = "tripetica_booking_success_flow";
export const BOOKING_SUCCESS_MAX_AGE_SECONDS = 60 * 60 * 24;

export type BookingSuccessFlow = "create" | "edit";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isBookingSuccessReservationId(
  value: string | undefined | null,
): value is string {
  return Boolean(value && UUID_RE.test(value));
}

export function readBookingSuccessReservationId(request: NextRequest) {
  const value = request.cookies.get(BOOKING_SUCCESS_COOKIE)?.value;
  return isBookingSuccessReservationId(value) ? value : null;
}

export function readBookingSuccessReservationIdFromStore(
  getCookie: (name: string) => string | undefined,
) {
  const value = getCookie(BOOKING_SUCCESS_COOKIE);
  return isBookingSuccessReservationId(value) ? value : null;
}

export function readBookingSuccessFlowFromStore(
  getCookie: (name: string) => string | undefined,
): BookingSuccessFlow {
  return getCookie(BOOKING_SUCCESS_FLOW_COOKIE) === "edit" ? "edit" : "create";
}

export function attachBookingSuccessCookie(
  response: NextResponse,
  reservationId: string,
  request?: NextRequest,
  flow: BookingSuccessFlow = "create",
) {
  if (!isBookingSuccessReservationId(reservationId)) {
    return response;
  }
  const forwardedProto = request?.headers.get("x-forwarded-proto");
  const secure =
    process.env.NODE_ENV === "production" || forwardedProto === "https";
  response.cookies.set({
    name: BOOKING_SUCCESS_COOKIE,
    value: reservationId,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: BOOKING_SUCCESS_MAX_AGE_SECONDS,
    secure,
  });
  response.cookies.set({
    name: BOOKING_SUCCESS_FLOW_COOKIE,
    value: flow,
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: BOOKING_SUCCESS_MAX_AGE_SECONDS,
    secure,
  });
  return response;
}
