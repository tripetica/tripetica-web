import test from "node:test";
import assert from "node:assert/strict";
import { isSealedSecret, sealSecret, SealedSecretError, unsealSecret } from "@/lib/security/sealed-secret";

const KEY_A = "a".repeat(64);
const KEY_B = "b".repeat(64);

test("sealed secrets round-trip without exposing plaintext in the stored value", () => {
  const previous = process.env.UETDS_CREDENTIALS_KEY;
  process.env.UETDS_CREDENTIALS_KEY = KEY_A;
  try {
    const sealed = sealSecret("uetds-test-password");
    assert.equal(isSealedSecret(sealed), true);
    assert.doesNotMatch(sealed, /uetds-test-password/);
    assert.equal(unsealSecret(sealed), "uetds-test-password");
  } finally {
    if (previous === undefined) {
      delete process.env.UETDS_CREDENTIALS_KEY;
    } else {
      process.env.UETDS_CREDENTIALS_KEY = previous;
    }
  }
});

test("missing or invalid keys fail closed without echoing the secret", () => {
  const previous = process.env.UETDS_CREDENTIALS_KEY;
  delete process.env.UETDS_CREDENTIALS_KEY;
  try {
    assert.throws(() => sealSecret("visible-secret"), SealedSecretError);
  } finally {
    if (previous === undefined) {
      delete process.env.UETDS_CREDENTIALS_KEY;
    } else {
      process.env.UETDS_CREDENTIALS_KEY = previous;
    }
  }

  process.env.UETDS_CREDENTIALS_KEY = KEY_A;
  const sealed = sealSecret("other-secret");
  process.env.UETDS_CREDENTIALS_KEY = KEY_B;
  try {
    assert.throws(() => unsealSecret(sealed), SealedSecretError);
  } finally {
    if (previous === undefined) {
      delete process.env.UETDS_CREDENTIALS_KEY;
    } else {
      process.env.UETDS_CREDENTIALS_KEY = previous;
    }
  }
});
