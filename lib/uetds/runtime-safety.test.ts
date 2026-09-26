import test from "node:test";
import assert from "node:assert/strict";
import { resolveUetdsMinistryRuntime, resolveUetdsMinistryEndpoint, assertDevUetdsTestOnly, assertProductionUetdsLiveOnly, UETDS_TEST_ENDPOINT, UETDS_LIVE_ENDPOINT } from "./ministry-env";
import { canonicalMinistryPlate } from "./ministry-plate";

const dev = { NODE_ENV: "development", EXPECTED_DATABASE: "tripetica_dev" };
const prod = { NODE_ENV: "production", EXPECTED_DATABASE: "tripetica" };
test("runtime and official endpoint selection fail closed without fallback", () => {
  assert.equal(resolveUetdsMinistryRuntime(dev), "test");
  assert.equal(resolveUetdsMinistryEndpoint(dev), UETDS_TEST_ENDPOINT);
  assert.equal(resolveUetdsMinistryRuntime(prod), "live");
  assert.equal(resolveUetdsMinistryEndpoint(prod), UETDS_LIVE_ENDPOINT);
  assert.throws(() => assertDevUetdsTestOnly(UETDS_LIVE_ENDPOINT, dev));
  assert.throws(() => assertProductionUetdsLiveOnly(UETDS_TEST_ENDPOINT, prod));
  assert.throws(() => assertProductionUetdsLiveOnly("https://evil.invalid/kdgm/uetdsarizi", prod));
  for (const env of [{}, { ...prod, EXPECTED_DATABASE: "tripetica_dev" }, { ...dev, EXPECTED_DATABASE: "tripetica" }]) {
    assert.equal(resolveUetdsMinistryRuntime(env), null);
    assert.throws(() => resolveUetdsMinistryEndpoint(env));
  }
});
test("REAL uses canonical assigned plate and rejects Ministry TEST fixture", () => {
  const before = { ...process.env };
  try {
    Object.assign(process.env, prod);
    assert.equal(canonicalMinistryPlate("34 EGP 847"), "34EGP847");
    assert.throws(() => canonicalMinistryPlate("06TARIFESIZ123"));
    Object.assign(process.env, dev);
    assert.equal(canonicalMinistryPlate("06TARIFESIZ123"), "06TARIFESIZ123");
  } finally { process.env = before; }
});
