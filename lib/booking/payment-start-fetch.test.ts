import test from "node:test";
import assert from "node:assert/strict";
import {
  fetchPaymentStartOnce,
  resetPaymentStartInflightForTests,
} from "@/lib/booking/payment-start-fetch";

test("fetchPaymentStartOnce sends one POST for parallel callers", async () => {
  resetPaymentStartInflightForTests();
  let fetchCalls = 0;

  const fetchImpl = (async () => {
    fetchCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 20));
    return {
      ok: true,
      json: async () => ({ ok: true, paymentUrl: "https://payment.example/one" }),
    } as Response;
  }) as typeof fetch;

  const [first, second] = await Promise.all([
    fetchPaymentStartOnce(fetchImpl),
    fetchPaymentStartOnce(fetchImpl),
  ]);

  assert.equal(fetchCalls, 1);
  assert.equal(first.paymentUrl, "https://payment.example/one");
  assert.equal(second.paymentUrl, "https://payment.example/one");
});

test("fetchPaymentStartOnce allows retry after failure", async () => {
  resetPaymentStartInflightForTests();
  let fetchCalls = 0;

  const fetchImpl = (async () => {
    fetchCalls += 1;
    if (fetchCalls === 1) {
      return {
        ok: false,
        json: async () => ({ ok: false }),
      } as Response;
    }
    return {
      ok: true,
      json: async () => ({ ok: true, paymentUrl: "https://payment.example/two" }),
    } as Response;
  }) as typeof fetch;

  await assert.rejects(() => fetchPaymentStartOnce(fetchImpl));
  const recovered = await fetchPaymentStartOnce(fetchImpl);
  assert.equal(fetchCalls, 2);
  assert.equal(recovered.paymentUrl, "https://payment.example/two");
});
