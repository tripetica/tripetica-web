import test from "node:test";
import assert from "node:assert/strict";
import { sealSecret } from "../security/sealed-secret";
import { loadUetdsMinistryCredentials } from "../uetds/ministry-credentials";
import { callUetdsTestSoap } from "../uetds/ministry-soap";
import { UETDS_SOAP_ACTIONS, UETDS_LIVE_ENDPOINT, UETDS_TEST_ENDPOINT } from "../uetds/ministry-env";

test("credentials never cross environments; missing REAL secrets send no SOAP", async () => {
  const before = { ...process.env };
  const originalFetch = globalThis.fetch;
  const globals = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const previousPool = globals.tripeticaPgPool;
  let row: Record<string, string | null>;
  let calls = 0;
  let endpoint = "";
  globalThis.fetch = async (url) => { calls++; endpoint = String(url); return new Response("<sonucKodu>0</sonucKodu>"); };
  globals.tripeticaPgPool = { query: async () => ({ rows: [row] }) };
  try {
    process.env.UETDS_CREDENTIALS_KEY = Buffer.alloc(32, 7).toString("base64");
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.EXPECTED_DATABASE = "tripetica";
    row = { live_username: "live-user", live_password_sealed: sealSecret("live-pass"), test_username: null, test_password_sealed: null };
    assert.deepEqual(await loadUetdsMinistryCredentials("11111111-1111-4111-8111-111111111111"), { username: "live-user", password: "live-pass", env: "live" });
    row.live_password_sealed = null;
    row.test_username = "test-user";
    row.test_password_sealed = sealSecret("test-pass");
    assert.equal(await loadUetdsMinistryCredentials("11111111-1111-4111-8111-111111111111"), null);
    const request = { operation: "seferEkle" as const, soapAction: UETDS_SOAP_ACTIONS.seferEkle, innerXml: "", username: "", password: "" };
    await assert.rejects(callUetdsTestSoap(request), /credentials_missing/);
    assert.equal(calls, 0);
    await callUetdsTestSoap({ ...request, username: "fake", password: "fake" });
    assert.equal(endpoint, UETDS_LIVE_ENDPOINT);
    Object.assign(process.env, { NODE_ENV: "development" });
    process.env.EXPECTED_DATABASE = "tripetica_dev";
    assert.deepEqual(await loadUetdsMinistryCredentials("11111111-1111-4111-8111-111111111111"), { username: "test-user", password: "test-pass", env: "test" });
    await callUetdsTestSoap({ ...request, username: "fake", password: "fake" });
    assert.equal(endpoint, UETDS_TEST_ENDPOINT);
    row.test_password_sealed = null;
    row.live_password_sealed = sealSecret("live-pass");
    assert.equal(await loadUetdsMinistryCredentials("11111111-1111-4111-8111-111111111111"), null);
  } finally {
    process.env = before; globalThis.fetch = originalFetch; globals.tripeticaPgPool = previousPool;
  }
});
