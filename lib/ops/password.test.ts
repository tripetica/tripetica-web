import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "@/lib/ops/password";

test("password hash verifies and does not store plaintext", async () => {
  const password = "correct-horse-battery";
  const hash = await hashPassword(password);
  assert.equal(hash.includes(password), false);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword("wrong-password-value", hash), false);
});
