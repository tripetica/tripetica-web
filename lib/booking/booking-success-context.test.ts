import test from "node:test";
import assert from "node:assert/strict";
import {
  BOOKING_SUCCESS_COOKIE,
  isBookingSuccessReservationId,
  readBookingSuccessReservationIdFromStore,
} from "@/lib/booking/booking-success-cookie";

test("booking success cookie accepts reservation UUIDs only", () => {
  assert.equal(
    isBookingSuccessReservationId("00000000-0000-4000-8000-000000000001"),
    true,
  );
  assert.equal(isBookingSuccessReservationId("TRP-20260829-0002"), false);
  assert.equal(isBookingSuccessReservationId("not-a-uuid"), false);
  assert.equal(isBookingSuccessReservationId(""), false);
  assert.equal(isBookingSuccessReservationId(null), false);
});

test("booking success cookie store reader ignores codes and bad values", () => {
  assert.equal(
    readBookingSuccessReservationIdFromStore((name) =>
      name === BOOKING_SUCCESS_COOKIE
        ? "00000000-0000-4000-8000-000000000001"
        : undefined,
    ),
    "00000000-0000-4000-8000-000000000001",
  );
  assert.equal(
    readBookingSuccessReservationIdFromStore((name) =>
      name === BOOKING_SUCCESS_COOKIE ? "TRP-20260829-0002" : undefined,
    ),
    null,
  );
  assert.equal(
    readBookingSuccessReservationIdFromStore(() => undefined),
    null,
  );
});
