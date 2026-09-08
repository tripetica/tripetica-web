import {
  formatUtcToIstanbulLocal,
  istanbulLocalToUtcMs,
} from "@/lib/booking/istanbul-time";
import { ceilIstanbulLocalToFiveMinutes } from "@/lib/booking/datetime-wheel-rules";

export const CHECKOUT_PREP_TOLERANCE_MS = 50 * 60 * 1000;

export function suggestedCheckoutPickupLocal(nowUtcMs: number): string {
  const plusOneHour = formatUtcToIstanbulLocal(nowUtcMs + 60 * 60 * 1000);
  return ceilIstanbulLocalToFiveMinutes(plusOneHour);
}

export function checkoutPickupLocalToDate(local: string): Date {
  return new Date(istanbulLocalToUtcMs(local));
}

export function pickupPrepRemainingMs(pickupAt: Date, nowUtcMs: number): number {
  return pickupAt.getTime() - nowUtcMs;
}

export function hasSufficientCheckoutPrepTime(
  pickupAt: Date,
  nowUtcMs: number,
): boolean {
  return pickupPrepRemainingMs(pickupAt, nowUtcMs) >= CHECKOUT_PREP_TOLERANCE_MS;
}

export function evaluateCheckoutPickupPrep(pickupAt: Date, nowUtcMs: number) {
  if (hasSufficientCheckoutPrepTime(pickupAt, nowUtcMs)) {
    return { ok: true as const };
  }
  return {
    ok: false as const,
    suggestedPickupAtLocal: suggestedCheckoutPickupLocal(nowUtcMs),
  };
}
