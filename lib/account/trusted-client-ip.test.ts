import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeTrustedClientIp,
  trustedClientIpFromHeaders,
} from "@/lib/security/trusted-client-ip";

function headerReader(values: Record<string, string | null>) {
  return {
    get(name: string) {
      return values[name.toLowerCase()] ?? null;
    },
  };
}

test("spoofed X-Forwarded-For cannot change the rate-limit identity", () => {
  const first = trustedClientIpFromHeaders(
    headerReader({
      "x-real-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.1, 203.0.113.10",
    }),
  );
  const second = trustedClientIpFromHeaders(
    headerReader({
      "x-real-ip": "203.0.113.10",
      "x-forwarded-for": "198.51.100.200, 203.0.113.10",
    }),
  );
  assert.equal(first, "203.0.113.10");
  assert.equal(second, first);
});

test("trusted proxy X-Real-IP is normalized and accepted", () => {
  assert.equal(normalizeTrustedClientIp(" 2001:db8::7 "), "2001:db8::7");
  assert.equal(
    trustedClientIpFromHeaders(
      headerReader({ "x-real-ip": " 192.0.2.44 " }),
    ),
    "192.0.2.44",
  );
});

test("missing or invalid trusted header fails closed without XFF fallback", () => {
  assert.equal(
    trustedClientIpFromHeaders(
      headerReader({ "x-forwarded-for": "198.51.100.99" }),
    ),
    null,
  );
  assert.equal(
    trustedClientIpFromHeaders(
      headerReader({
        "x-real-ip": "not-an-ip",
        "x-forwarded-for": "198.51.100.99",
      }),
    ),
    null,
  );
  assert.equal(normalizeTrustedClientIp("192.0.2.1, 198.51.100.3"), null);
});
