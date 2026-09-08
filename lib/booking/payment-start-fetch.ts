export type PaymentStartResponse = {
  ok?: boolean;
  paymentUrl?: string;
};

let inflightPaymentStart: Promise<PaymentStartResponse> | null = null;

/** Test-only reset. */
export function resetPaymentStartInflightForTests() {
  inflightPaymentStart = null;
}

/**
 * Dedupe concurrent payment/start calls (e.g. React Strict Mode double mount).
 * Successful responses are cached for the page lifetime until redirect.
 */
export async function fetchPaymentStartOnce(
  fetchImpl: typeof fetch = fetch,
): Promise<PaymentStartResponse> {
  if (!inflightPaymentStart) {
    inflightPaymentStart = (async () => {
      const response = await fetchImpl("/api/booking/payment/start", {
        method: "POST",
      });
      const payload = (await response.json()) as PaymentStartResponse;
      if (!response.ok || !payload.paymentUrl) {
        inflightPaymentStart = null;
        throw new Error("payment_start_failed");
      }
      return payload;
    })();
  }
  return inflightPaymentStart;
}
