import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("production release retention helper covers keep/abort scenarios without touching live releases", () => {
  const script = fileURLToPath(
    new URL("../deploy/cleanup-old-production-releases.test.sh", import.meta.url),
  );
  const result = spawnSync("bash", [script], { encoding: "utf8" });
  assert.equal(
    result.status,
    0,
    `${result.stdout}\n${result.stderr}`,
  );
  assert.match(result.stdout, /ALL_RETENTION_TESTS_PASSED/);
});
