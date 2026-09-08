import {
  BOSPHORUS_SERVICE_PICKUP_LOCAL,
  isBosphorusDinnerTour,
} from "@/lib/booking/pricing/bosphorus-dinner-pricing";
import {
  canMutateCustomerReservation,
  hasMoreThanMutationWindowBeforePickup,
} from "@/lib/booking/customer-mutation-policy";
import {
  istanbulLocalToUtcMs,
  timestamptzToIstanbulLocal,
} from "@/lib/booking/istanbul-time";

export {
  CUSTOMER_MUTATION_WINDOW_MS,
  CUSTOMER_STATUS_WINDOW_MS,
  canMutateCustomerReservation,
  hasMoreThanMutationWindowBeforePickup,
  hasMoreThanSixHoursBeforePickup,
  remainingMsBeforePickup,
} from "@/lib/booking/customer-mutation-policy";

/**
 * Bosphorus dinner: reactivate allowed strictly before service-day 19:00 Istanbul.
 * Cancel/edit still use the shared 6-hour mutation window.
 */
export function canReactivateBosphorusBeforeServiceDayCutoff(
  pickupAt: Date | string | number | null | undefined,
  nowUtcMs = Date.now(),
) {
  const pickupMs =
    typeof pickupAt === "number"
      ? pickupAt
      : pickupAt instanceof Date
        ? pickupAt.getTime()
        : pickupAt == null || pickupAt === ""
          ? Number.NaN
          : Date.parse(String(pickupAt));
  if (!Number.isFinite(pickupMs)) {
    return false;
  }
  const local = timestamptzToIstanbulLocal(pickupMs);
  const day = local.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return false;
  }
  const deadlineMs = istanbulLocalToUtcMs(
    `${day}T${BOSPHORUS_SERVICE_PICKUP_LOCAL}`,
  );
  if (!Number.isFinite(deadlineMs)) {
    return false;
  }
  return nowUtcMs < deadlineMs;
}

export function evaluateCustomerCancel(input: {
  status: string | null | undefined;
  pickupAt: Date | string | number | null | undefined;
  nowUtcMs?: number;
}) {
  const status = (input.status ?? "").trim().toLowerCase();
  if (status === "cancelled") {
    return { allowed: false as const, reason: "already_cancelled" as const };
  }
  if (
    !canMutateCustomerReservation({
      pickupAt: input.pickupAt,
      nowUtcMs: input.nowUtcMs,
    })
  ) {
    return { allowed: false as const, reason: "within_six_hours" as const };
  }
  return { allowed: true as const, reason: null };
}

/** Online edit of an active reservation: same 6h gate as cancel. */
export function evaluateCustomerEdit(input: {
  status: string | null | undefined;
  pickupAt: Date | string | number | null | undefined;
  nowUtcMs?: number;
}) {
  const status = (input.status ?? "").trim().toLowerCase();
  if (status === "cancelled") {
    return { allowed: false as const, reason: "cancelled" as const };
  }
  if (!status) {
    return { allowed: false as const, reason: "cancelled" as const };
  }
  if (
    !canMutateCustomerReservation({
      pickupAt: input.pickupAt,
      nowUtcMs: input.nowUtcMs,
    })
  ) {
    return { allowed: false as const, reason: "within_six_hours" as const };
  }
  return { allowed: true as const, reason: null };
}

export function evaluateCustomerReactivate(input: {
  status: string | null | undefined;
  serviceType: string | null | undefined;
  tourCode: string | null | undefined;
  pickupAt: Date | string | number | null | undefined;
  nowUtcMs?: number;
}) {
  const status = (input.status ?? "").trim().toLowerCase();
  if (status !== "cancelled") {
    return { allowed: false as const, reason: "not_cancelled" as const };
  }

  if (isBosphorusDinnerTour(input.serviceType, input.tourCode)) {
    if (
      !canReactivateBosphorusBeforeServiceDayCutoff(
        input.pickupAt,
        input.nowUtcMs,
      )
    ) {
      return {
        allowed: false as const,
        reason: "bosphorus_after_cutoff" as const,
      };
    }
    return { allowed: true as const, reason: null };
  }

  if (
    !hasMoreThanMutationWindowBeforePickup(input.pickupAt, input.nowUtcMs)
  ) {
    return { allowed: false as const, reason: "within_six_hours" as const };
  }
  return { allowed: true as const, reason: null };
}
