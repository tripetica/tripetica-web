import assert from "node:assert/strict";
import test from "node:test";
import { FMB920_OBD_GROUP_COUNT, fmb920ObdParameters } from "@/lib/teltonika/obd";
import { configuratorWireCommandAllowed, parameterControl, planDeviceDispatch } from "@/lib/teltonika/config-plan";
import { fmb920Parameters, parameterById } from "@/lib/teltonika/parameters";

test("the OBD II catalog covers every published group and leaves dashed fields out", () => {
  const rows = fmb920ObdParameters();
  assert.equal(FMB920_OBD_GROUP_COUNT, 45);
  assert.equal(rows.length, 307);
  assert.equal(new Set(rows.map((row) => row.id)).size, 307);
  const catalog = fmb920Parameters().filter((row) => row.section === "OBD II (Bluetooth)");
  assert.equal(catalog.length, 307);
  assert.equal(parameterById(40100)?.name, "Number Of DTC — Priority");
  assert.equal(parameterById(40103)?.name, "Number Of DTC — Low level");
  assert.equal(parameterById(40410)?.name, "VIN — Priority");
  assert.equal(parameterById(40412), null);
  assert.equal(parameterById(40413), null);
  assert.equal(parameterById(40515), null);
  assert.equal(parameterById(40605), null);
  assert.equal(parameterControl(parameterById(40100)!), "select");
  assert.equal(parameterControl(parameterById(8038)!), "text");
  assert.equal(parameterById(805)?.section, "Bluetooth");
  assert.equal(parameterById(807)?.section, "Bluetooth");
});

test("an OBD SMS text with spaces can be planned and is still one catalog command", () => {
  const plan = planDeviceDispatch({ target: { "8038": "Number of DTC" }, device: {} });
  const write = plan.steps.find((step) => step.startsWith("setparam"));
  assert.equal(write, "setparam 8038:Number of DTC");
  assert.equal(configuratorWireCommandAllowed(write ?? ""), true);
  assert.equal(configuratorWireCommandAllowed("setparam 8038:Number of DTC;setdigout 1"), false);
  assert.equal(plan.phase, "waiting_link");
});
