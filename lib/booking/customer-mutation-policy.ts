/**
 * Single source of truth for customer cancel + edit time window.
 * remainingTime > 6 hours → ALLOW; remainingTime <= 6 hours → BLOCK.
 * No calendar-day exceptions.
 */

export const CUSTOMER_MUTATION_WINDOW_MS = 6 * 60 * 60 * 1000;

/** @deprecated Prefer CUSTOMER_MUTATION_WINDOW_MS */
export const CUSTOMER_STATUS_WINDOW_MS = CUSTOMER_MUTATION_WINDOW_MS;

function pickupUtcMs(pickupAt: Date | string | number | null | undefined) {
  if (typeof pickupAt === "number") {
    return pickupAt;
  }
  if (pickupAt instanceof Date) {
    return pickupAt.getTime();
  }
  if (pickupAt == null || pickupAt === "") {
    return Number.NaN;
  }
  return Date.parse(String(pickupAt));
}

export function remainingMsBeforePickup(
  pickupAt: Date | string | number | null | undefined,
  nowUtcMs = Date.now(),
) {
  const pickupMs = pickupUtcMs(pickupAt);
  if (!Number.isFinite(pickupMs)) {
    return null;
  }
  return pickupMs - nowUtcMs;
}

/** True when pickup is strictly more than 6 hours away. */
export function hasMoreThanMutationWindowBeforePickup(
  pickupAt: Date | string | number | null | undefined,
  nowUtcMs = Date.now(),
) {
  const remainingMs = remainingMsBeforePickup(pickupAt, nowUtcMs);
  if (remainingMs == null) {
    return false;
  }
  return remainingMs > CUSTOMER_MUTATION_WINDOW_MS;
}

/** Alias kept for existing imports. */
export const hasMoreThanSixHoursBeforePickup =
  hasMoreThanMutationWindowBeforePickup;

export function canMutateCustomerReservation(input: {
  pickupAt: Date | string | number | null | undefined;
  nowUtcMs?: number;
}) {
  return hasMoreThanMutationWindowBeforePickup(
    input.pickupAt,
    input.nowUtcMs,
  );
}
