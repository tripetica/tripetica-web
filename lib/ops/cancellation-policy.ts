import {
  CUSTOMER_MUTATION_WINDOW_MS,
  remainingMsBeforePickup,
} from "@/lib/booking/customer-mutation-policy";
import { isBosphorusDinnerTour } from "@/lib/booking/pricing/bosphorus-dinner-pricing";

/** @deprecated Prefer CUSTOMER_MUTATION_WINDOW_MS from customer-mutation-policy */
export const BOSPHORUS_REFUND_WINDOW_MS = CUSTOMER_MUTATION_WINDOW_MS;

export type OpsCancelPolicyKind = "bosphorus-dinner" | "standard" | "none";

export type OpsCancelPolicyEvaluation = {
  kind: OpsCancelPolicyKind;
  /** Milliseconds from now until pickup; null if pickup unknown. */
  remainingMs: number | null;
  /**
   * True when remainingTime > 6h (same boundary as customer cancel/edit).
   * Null when pickup unknown.
   */
  withinRefundWindow: boolean | null;
};

export function evaluateOpsCancelPolicy(input: {
  serviceType: string | null | undefined;
  tourCode: string | null | undefined;
  pickupAt: Date | string | null | undefined;
  nowUtcMs?: number;
}): OpsCancelPolicyEvaluation {
  const nowUtcMs = input.nowUtcMs ?? Date.now();
  const remainingMs = remainingMsBeforePickup(input.pickupAt, nowUtcMs);
  const withinRefundWindow =
    remainingMs == null ? null : remainingMs > CUSTOMER_MUTATION_WINDOW_MS;

  if (isBosphorusDinnerTour(input.serviceType, input.tourCode)) {
    return {
      kind: "bosphorus-dinner",
      remainingMs,
      withinRefundWindow,
    };
  }

  if (remainingMs == null) {
    return { kind: "none", remainingMs: null, withinRefundWindow: null };
  }

  return {
    kind: "standard",
    remainingMs,
    withinRefundWindow,
  };
}
