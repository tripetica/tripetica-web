import test from "node:test";
import assert from "node:assert/strict";
import { parseBaselineExcept, parseBaselineThrough } from "./db-migrate-cli";

test("baseline-through is omitted by default", () => {
  assert.equal(parseBaselineThrough(["--status"]), null);
});

test("baseline-through parses a positive integer", () => {
  assert.equal(parseBaselineThrough(["--baseline-through=027"]), 27);
});

test("baseline-except parses skipped versions", () => {
  assert.deepEqual(parseBaselineExcept(["--baseline-except=009"]), [9]);
});

test("baseline-through rejects invalid values", () => {
  assert.throws(() => parseBaselineThrough(["--baseline-through=0"]), /positive integer/);
  assert.throws(() => parseBaselineThrough(["--baseline-through=foo"]), /positive integer/);
});
