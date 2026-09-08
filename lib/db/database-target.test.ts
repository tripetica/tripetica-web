import test from "node:test";
import assert from "node:assert/strict";
import {
  assertExpectedDatabase,
  databaseNameFromUrl,
} from "@/lib/db/database-target";

test("extracts database name without exposing connection credentials", () => {
  assert.equal(
    databaseNameFromUrl("postgresql://user:secret@127.0.0.1:5432/tripetica_dev"),
    "tripetica_dev",
  );
});

test("production worker guard rejects the DEV database before connecting", () => {
  assert.throws(
    () =>
      assertExpectedDatabase(
        "postgresql://user:secret@127.0.0.1:5432/tripetica_dev",
        "tripetica",
      ),
    /Database target mismatch/,
  );
  assert.equal(
    assertExpectedDatabase(
      "postgresql://user:secret@127.0.0.1:5432/tripetica",
      "tripetica",
    ),
    "tripetica",
  );
});

test("DEV database guard rejects the production database before connecting", () => {
  assert.throws(
    () =>
      assertExpectedDatabase(
        "postgresql://user:secret@127.0.0.1:5432/tripetica",
        "tripetica_dev",
      ),
    /Database target mismatch/,
  );
  assert.equal(
    assertExpectedDatabase(
      "postgresql://user:secret@127.0.0.1:5432/tripetica_dev",
      "tripetica_dev",
    ),
    "tripetica_dev",
  );
});
