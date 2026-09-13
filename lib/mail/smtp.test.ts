import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTransientSmtpError } from "@/lib/mail/smtp-errors";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("SMTP treats idle-socket resets and timeouts as transient", () => {
  assert.equal(isTransientSmtpError(new Error("read ECONNRESET")), true);
  assert.equal(isTransientSmtpError(new Error("Connection timeout")), true);
  assert.equal(isTransientSmtpError(new Error("socket hang up")), true);
  assert.equal(isTransientSmtpError(new Error("Greeting never received")), true);
  assert.equal(isTransientSmtpError(new Error("Invalid login")), false);
  assert.equal(isTransientSmtpError(new Error("Message rejected")), false);
});

test("account SMTP send retries once after a transient failure and does not pool sockets", () => {
  const smtp = source("lib/mail/smtp.ts");
  assert.match(smtp, /SMTP retry after transient failure/);
  assert.match(smtp, /evictSmtpTransport/);
  assert.doesNotMatch(smtp, /pool:\s*true/);
  assert.doesNotMatch(smtp, /maxConnections/);
  assert.doesNotMatch(smtp, /maxMessages/);
});
