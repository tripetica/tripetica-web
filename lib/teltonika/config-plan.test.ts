import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parseTeltonikaGetparam, TELTONIKA_GREEN_SETPARAM } from "@/lib/teltonika/config-read";
import { productionListenerCommandAllowed } from "@/lib/teltonika/restart";
import {
  advanceConfiguratorJob,
  automaticApplyNeeded,
  classifyApply,
  configDispatchEnabled,
  configDraftForSave,
  configValuesEqual,
  configuratorWireCommandAllowed,
  configImportHeld,
  deviceCatalogOutsideText,
  deviceParameterText,
  deviceReadLabel,
  formatConfigSetparam,
  importDeviceReadIntoDraft,
  formatConnectionCommand,
  mergeConfig,
  parameterControl,
  parameterValueApplicable,
  parameterValuesDiffer,
  retainUnverifiedObservations,
  savedChoiceObservations,
  planAutomaticSync,
  parseConfiguratorPlan,
  planConfiguratorRead,
  productionConfiguratorGetparamAllowed,
  planConfigChanges,
  parameterApplyAllowed,
  parameterApplyCommandAllowed,
  parameterApplyCounts,
  parameterApplyGuarded,
  planParameterApply,
  planDeviceDispatch,
  profileSaveAllowed,
} from "@/lib/teltonika/config-plan";
import { fmb920Parameters, fmb920ReadParameterIds, parameterById, unsupportedConfiguratorSections, VERIFIED_GREEN_DRIVING } from "@/lib/teltonika/parameters";
import { corneringDisplayUnit, formatGreenDrivingValue, greenDrivingSource } from "@/lib/teltonika/green-driving";

const verifiedRead = "Param ID:11000 Value:1;11003:0;11004:2.310000;11005:2.520000;11006:2.940000;11007:1;11008:1;11011:0;11015:0;11019:0;";

test("the catalog keeps published FMB920 IDs and leaves unpublished sections empty", () => {
  const ids = fmb920Parameters().map((parameter) => parameter.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length > 700);
  assert.equal(parameterById(11000)?.name, "Scenario settings");
  assert.equal(parameterById(2004)?.name, "Domain");
  assert.equal(parameterById(2004)?.level, "critical");
  assert.equal(parameterById(11003)?.level, "critical");
  assert.equal(parameterById(11019)?.evidence, "device-readback");
  assert.equal(parameterById(11011)?.evidence, "device-readback");
  assert.equal(parameterById(11015)?.evidence, "device-readback");
  assert.equal(parameterById(11700)?.level, "critical");
  assert.equal(parameterById(253), null);
  assert.equal(parameterById(254), null);
  assert.equal(unsupportedConfiguratorSections.length, 2);
});

test("a device override survives a later standard profile and critical IDs stay out of the automatic diff", () => {
  const current = parseTeltonikaGetparam(verifiedRead);
  const standard = { ...VERIFIED_GREEN_DRIVING, "10250": "30" };
  const override = { "10250": "10" };
  const target = mergeConfig(standard, override);
  assert.equal(target["10250"], "10");
  assert.equal(mergeConfig({ ...standard, "10250": "60" }, override)["10250"], "10");
  const currentWithPeriod = { ...current, "10250": "300" };
  const plan = planConfigChanges({ current: currentWithPeriod, target });
  assert.deepEqual(plan.changes.map((change) => change.id), [10250]);
  assert.deepEqual(plan.connection.map((change) => change.id), []);
  assert.deepEqual(plan.safety.map((change) => change.id), []);
  const output = planConfigChanges({
    current: { ...currentWithPeriod, "2005": "0", "11003": "0" },
    target: { ...target, "11003": "1", "2005": "5028" },
  });
  assert.deepEqual(output.connection.map((change) => change.id), [2005]);
  assert.deepEqual(output.safety.map((change) => change.id), [11003]);
  assert.equal(formatConfigSetparam(output.changes), "setparam 10250:10");
  assert.equal(formatConfigSetparam(output.connection), null);
  assert.equal(output.connectionCommand, "setparam 2005:5028");
  assert.equal(output.connectionCommand?.includes("11003"), false);
  const safetyOnly = classifyApply({ read: { ...VERIFIED_GREEN_DRIVING }, target: { ...VERIFIED_GREEN_DRIVING, "11003": "1" } });
  assert.equal(safetyOnly.phase, "waiting_link");
  assert.equal(safetyOnly.error, "vehicle_safety");
  assert.equal(safetyOnly.connectionCommand, null);
  assert.deepEqual(safetyOnly.safety.map((change) => change.id), [11003]);
  assert.equal(planConfigChanges({ current: {}, target: { ...target, "10250": "10" } }).changes.length, 0);
});

test("a critical edit is stored and kept out of the bulk command", () => {
  const previous = { ...VERIFIED_GREEN_DRIVING };
  const kept = configDraftForSave({ ...previous, "11004": "2.40" }, previous, false);
  assert.equal(kept.values["11003"], "0");
  assert.equal(kept.values["11004"], "2.40");
  assert.equal(configDraftForSave({ ...previous, "11004": "" }, previous, false).values["11004"], "2.31");
  const changed = configDraftForSave({ ...previous, "11003": "1", "2001": "internet", "2004": "cfg-test.invalid", "2005": "9", "2006": "0" }, previous, false);
  assert.equal(changed.rejected.length, 0);
  assert.equal(changed.values["11003"], "1");
  assert.equal(changed.values["2001"], "internet");
  assert.equal(changed.values["2004"], "cfg-test.invalid");
  assert.equal(changed.values["2005"], "9");
  assert.equal(changed.values["2006"], "0");
  assert.equal(changed.values["11019"], "0");
  const retained = configDraftForSave({ "2004": "cfg-test.invalid", "2005": "9" }, { ...previous, "2006": "1", "138": "2" }, false);
  assert.equal(retained.rejected.length, 0);
  assert.equal(retained.values["2004"], "cfg-test.invalid");
  assert.equal(retained.values["2005"], "9");
  assert.equal(retained.values["2006"], "1");
  assert.equal(retained.values["138"], "2");
  assert.equal(retained.values["11000"], "1");
  assert.equal(configDraftForSave({ ...previous, "2005": "0" }, previous, false).values["2005"], "0");
  assert.equal(profileSaveAllowed("tripetica"), true);
  assert.equal(profileSaveAllowed("tripetica_dev"), true);
  assert.equal(profileSaveAllowed("other"), false);
  const plan = planConfigChanges({ current: { ...previous, "2001": "", "2004": "", "2005": "0", "2006": "1" }, target: changed.values });
  assert.equal(plan.changes.some((change) => change.id === 11003 || change.id === 2001 || change.id === 2004), false);
  assert.deepEqual(plan.connection.map((change) => change.id), [2001, 2004, 2005, 2006]);
  assert.deepEqual(plan.safety.map((change) => change.id), [11003]);
  assert.equal(plan.connectionCommand, "setparam 2001:internet;2004:cfg-test.invalid;2005:9;2006:0");
  assert.equal(formatConnectionCommand([{ id: 2004, from: "", to: "bad host", level: "critical" }]), null);
  assert.equal(formatConfigSetparam(plan.safety), null);
  const rejected = configDraftForSave({ "11004": "99", "2004": `${"a".repeat(56)}`, "2005": "70000", "2006": "2" }, previous, false);
  assert.deepEqual(rejected.rejected.map((item) => `${item.id}:${item.reason}`).sort(), ["11004:range", "2004:length", "2005:range", "2006:choice"].sort());
  assert.equal(configDraftForSave({ "999999": "1" }, previous, true).values["999999"], undefined);
});

test("production listener stays unwired while the DEV listener can claim configurator jobs", () => {
  assert.equal(configDispatchEnabled(), false);
  const store = readFileSync(new URL("../gps/configurator-store.ts", import.meta.url), "utf8");
  const listener = readFileSync(new URL("../../scripts/teltonika-listen-prod.ts", import.meta.url), "utf8");
  const server = readFileSync(new URL("./server.ts", import.meta.url), "utf8");
  assert.doesNotMatch(store, /setparam|setdigout|INSERT INTO gps_teltonika_config_reads|UPDATE gps_teltonika_config_reads/);
  assert.doesNotMatch(listener, /configDispatchEnabled|formatConfigSetparam|claimConfiguratorCommand|queueAutomatic/);
  assert.match(listener, /claimParameterApply/);
  assert.match(listener, /finishParameterApply/);
  assert.match(listener, /timeoutParameterApply/);
  assert.match(listener, /parameterApplyCommandAllowed/);
  const pull = listener.slice(listener.indexOf("pullCommand"));
  assert.ok(pull.indexOf("claimTeltonikaConfigRead") < pull.indexOf("claimParameterApply"));
  assert.ok(pull.indexOf("claimParameterApply") < pull.indexOf("claimProductionConfiguratorRead"));
  assert.doesNotMatch(listener, /setparam|setdigout|setkey|delkey/);
  assert.match(listener, /claimProductionConfiguratorRead/);
  assert.match(listener, /productionConfiguratorGetparamAllowed/);
  assert.match(listener, /claimDeviceRestart/);
  assert.match(listener, /productionListenerCommandAllowed/);
  assert.match(listener, /TELTONIKA_CPU_RESET/);
  assert.doesNotMatch(listener, /claimDeviceKeyword|setkey|delkey/);
  assert.doesNotMatch(server, /gps_config_jobs|formatConfigSetparam/);
  const devListener = readFileSync(new URL("../../scripts/teltonika-listen.ts", import.meta.url), "utf8");
  assert.match(devListener, /claimConfiguratorCommand/);
  assert.match(devListener, /claimDeviceRestart/);
  assert.match(devListener, /claimDeviceKeyword/);
  assert.match(devListener, /devListenerCommandAllowed/);
  assert.doesNotMatch(devListener, /setdigout/);
  const panel = readFileSync(new URL("../../components/gps/configurator-panel.tsx", import.meta.url), "utf8");
  assert.match(panel, /set\("scope", "standard"\)/);
  assert.match(panel, /snapshot\?\.writesOpen/);
  assert.match(panel, /snapshot\?\.restartOpen/);
  assert.match(panel, /snapshot\?\.readsOpen/);
  assert.match(panel, /copy\.readDevice/);
  assert.match(panel, /snapshot\?\.saveOpen \|\| savePending \|\| !dirty/);
  assert.match(store, /profileSaveAllowed/);
  assert.match(store, /queueManualConfiguratorRead/);
  assert.doesNotMatch(panel, /syncConfiguratorReadAction/);
  assert.doesNotMatch(panel, /queueProductionConfiguratorRead/);
  assert.match(panel, /snapshot\?\.latest\?\.values/);
  assert.doesNotMatch(panel, /snapshot\?\.overrides|snapshot\?\.approved\?\.values/);
  assert.match(panel, /importDeviceReadIntoDraft/);
  assert.match(panel, /copy\.importDevice/);
  assert.match(panel, /copy\.applyRow/);
  assert.match(panel, /parameterApplies/);
  assert.match(panel, /configurator-row-apply/);
  const actions = readFileSync(new URL("../../lib/gps/configurator-actions.ts", import.meta.url), "utf8");
  const parameterAction = actions.slice(actions.indexOf("export async function applyParameterAction"));
  assert.ok(parameterAction.indexOf("actorCan") < parameterAction.indexOf("queueParameterApply"));
  assert.ok(parameterAction.indexOf("deviceIds.length === 0") < parameterAction.indexOf("queueParameterApply"));
  const parameterQueue = readFileSync(new URL("../../lib/gps/parameter-apply.ts", import.meta.url), "utf8");
  assert.match(parameterQueue, /gps_config_overrides/);
  assert.doesNotMatch(parameterQueue, /INSERT INTO gps_config_versions|setdigout|setparam/);
  assert.equal(parameterApplyAllowed("tripetica"), true);
  assert.equal(parameterApplyAllowed("tripetica_dev"), true);
  assert.equal(parameterApplyAllowed("other"), false);
  assert.match(panel, /type="button"/);
  assert.doesNotMatch(panel, /setparam|setdigout|cpureset|setkey|delkey/);
});

test("a missing device read does not block apply, and setdigout stays out of the command", () => {
  const unread = planDeviceDispatch({
    read: null,
    target: { ...VERIFIED_GREEN_DRIVING, "2004": "cfg-test.invalid", "2005": "9" },
  });
  assert.equal(unread.phase, "waiting_link");
  assert.equal(unread.error, null);
  assert.equal(unread.steps.some((step) => step.startsWith("setparam ") && step.includes("2004:cfg-test.invalid") && step.includes("2005:9")), true);
  assert.equal(unread.steps.some((step) => step.startsWith("setparam ") && step.includes("11003:0")), true);
  assert.equal(unread.steps.some((step) => step.startsWith("getparam ")), true);
  assert.equal(unread.steps.some((step) => step.includes("setdigout")), false);
  const outputOnly = planDeviceDispatch({
    read: { ...VERIFIED_GREEN_DRIVING },
    target: { ...VERIFIED_GREEN_DRIVING, "11003": "1", "11700": "0" },
  });
  const outputWrite = outputOnly.steps.filter((step) => step.startsWith("setparam "));
  assert.equal(outputWrite.length, 1);
  assert.match(outputWrite[0] ?? "", /^setparam 11003:1;11700:0$/);
  assert.equal(outputOnly.steps.some((step) => step.includes("setdigout") || step.includes("11000:")), false);
  const spaced = planDeviceDispatch({ read: { "8268": "Blood" }, target: { "8268": "Blood Alcohol" } });
  assert.equal(spaced.steps.some((step) => step === "setparam 8268:Blood Alcohol"), true);
  assert.equal(spaced.steps.some((step) => step.includes("setdigout")), false);
  const held = planDeviceDispatch({ read: { "8268": "Blood" }, target: { "8268": "Blood;Alcohol" } });
  assert.equal(held.phase, "no_change");
  assert.equal(held.error, "vehicle_safety");
  assert.deepEqual(held.steps, []);
  const same = planDeviceDispatch({ read: { ...VERIFIED_GREEN_DRIVING }, target: { ...VERIFIED_GREEN_DRIVING } });
  assert.equal(same.phase, "no_change");
  assert.deepEqual(same.steps, []);
  assert.equal(configuratorWireCommandAllowed("getparam 2004;2005"), true);
  assert.equal(configuratorWireCommandAllowed("setparam 2004:cfg-test.invalid;2005:9"), true);
  assert.equal(configuratorWireCommandAllowed("setparam 11003:1"), true);
  assert.equal(configuratorWireCommandAllowed("setparam 11700:0"), true);
  assert.equal(configuratorWireCommandAllowed("setdigout 1"), false);
  assert.equal(productionConfiguratorGetparamAllowed("getparam 2004;2005"), true);
  assert.equal(productionConfiguratorGetparamAllowed("setparam 2004:cfg-test.invalid"), false);
  assert.equal(productionConfiguratorGetparamAllowed("setdigout 1"), false);
  assert.equal(productionConfiguratorGetparamAllowed("cpureset"), false);
  assert.equal(configuratorWireCommandAllowed("setparam 11700:0 setdigout 1"), false);
  assert.equal(configuratorWireCommandAllowed("getparam 999999"), false);
  assert.ok(planConfiguratorRead([2005, 2004, 999999]).join(" ").includes("2004;2005") || planConfiguratorRead([2005, 2004]).join(" ").includes("2004"));
  assert.equal(automaticApplyNeeded(5, 5), false);
  assert.equal(automaticApplyNeeded(4, 5), true);
  assert.equal(automaticApplyNeeded(null, 5), true);
  assert.equal(automaticApplyNeeded(null, null), false);
  const plan = {
    kind: "apply" as const,
    version: 5,
    steps: ["setparam 2005:9", "getparam 2005"],
    step: 1,
    values: {},
    target: { "2005": "9" },
    expect: ["2005"],
  };
  const midway = advanceConfiguratorJob(plan, "Param ID:2005 New Val:9");
  assert.equal(midway.phase, "waiting_link");
  const verified = advanceConfiguratorJob({ ...midway.plan, step: 2 }, "Param ID:2005 Value:9");
  assert.equal(verified.phase, "verified");
  const missed = advanceConfiguratorJob({ ...midway.plan, step: 2 }, "Param ID:2005 Value:1");
  assert.equal(missed.phase, "unverified");
  assert.equal(advanceConfiguratorJob(plan, "blocked").phase, "failed");
});

test("editors follow the published type and an unread value is not a match", () => {
  assert.equal(parameterControl(parameterById(11000)!), "select");
  assert.equal(parameterControl(parameterById(11004)!), "number");
  assert.equal(parameterControl(parameterById(2001)!), "text");
  const same = classifyApply({ read: { ...VERIFIED_GREEN_DRIVING }, target: { ...VERIFIED_GREEN_DRIVING } });
  assert.equal(same.phase, "no_change");
  const missing = classifyApply({ read: null, target: { ...VERIFIED_GREEN_DRIVING } });
  assert.equal(missing.phase, "waiting_link");
  assert.equal(missing.error, "unread");
  const partial = classifyApply({ read: { "11000": "1" }, target: { ...VERIFIED_GREEN_DRIVING } });
  assert.equal(partial.phase, "waiting_link");
  const auto = planAutomaticSync({
    read: { ...VERIFIED_GREEN_DRIVING, "11004": "2.50" },
    approved: { ...VERIFIED_GREEN_DRIVING },
    override: null,
  });
  assert.equal(auto.command, null);
  assert.equal(configDispatchEnabled(), false);
});

test("a single device read is compared by type and an old read stays marked old", () => {
  const number = parameterById(11004)!;
  const text = parameterById(2004)!;
  const choice = parameterById(11000)!;
  assert.equal(parameterValuesDiffer(number, "2.31", "2,31"), false);
  assert.equal(parameterValuesDiffer(number, "2.310000", "2.31"), false);
  assert.equal(parameterValuesDiffer(number, "2.31", "2.40"), true);
  assert.equal(parameterValuesDiffer(text, "cfg-test.invalid", "cfg-test.invalid"), false);
  assert.equal(parameterValuesDiffer(text, "cfg-test.invalid", "other.invalid"), true);
  assert.equal(parameterValuesDiffer(choice, "1", "1.0"), false);
  assert.equal(parameterValuesDiffer(choice, "1", "0"), true);
  assert.equal(parameterValuesDiffer(number, undefined, "2.31"), false);
  assert.equal(parameterValuesDiffer(number, "", "2.31"), false);
  const sleep = parameterById(102)!;
  const enabled = parameterById(11019)!;
  assert.equal(configValuesEqual("", "0"), false);
  assert.equal(configValuesEqual("2,31", "2.310000"), true);
  assert.equal(parameterValuesDiffer(sleep, "0", "0 – Disable"), false);
  assert.equal(parameterValuesDiffer(enabled, "1", "1 – Enable"), false);
  assert.equal(parameterValuesDiffer(number, "2.310000", "2,31"), false);
  assert.equal(parameterValuesDiffer(sleep, "0", "2 – Deep sleep"), true);
  const listCheck = parameterById(11703)!;
  assert.equal(parameterValuesDiffer(listCheck, "2", "2"), false);
  assert.equal(parameterValuesDiffer(listCheck, "2", "2 – Tanımlanmamış değer"), false);
  assert.equal(parameterValuesDiffer(listCheck, "2", "0"), true);
  assert.equal(parameterValuesDiffer(listCheck, "2", "1"), true);
  assert.equal(deviceCatalogOutsideText(listCheck, "2", "katalog dışı değer"), "2 – katalog dışı değer");
  assert.equal(deviceCatalogOutsideText(listCheck, "0", "katalog dışı değer"), null);
  assert.equal(savedChoiceObservations(listCheck, "2"), null);
  assert.equal(parameterValueApplicable(listCheck, "1"), true);
  assert.equal(parameterValueApplicable(listCheck, "2"), false);
  assert.equal(parameterValueApplicable(parameterById(11816)!, "15"), true);
  assert.equal(parameterControl(parameterById(50164)!), "select");
  assert.equal(parameterControl(parameterById(53800)!), "number");
  assert.equal(deviceParameterText(listCheck, "2"), "2");
  assert.equal(deviceParameterText(sleep, "0"), "0 – Disable");
  assert.equal(deviceParameterText(parameterById(1002)!, "1"), "1 – Oldest");
  assert.equal(deviceParameterText(number, "2.310000"), "2.310000");
  assert.equal(deviceParameterText(sleep, "9"), "9");
  const now = Date.parse("2026-11-15T16:40:00Z");
  assert.equal(deviceReadLabel({ selectedCount: 2, status: "answered", readAt: "2026-11-15T16:39:00Z", hasValues: true, now }), "multiple");
  assert.equal(deviceReadLabel({ selectedCount: 1, status: "answered", readAt: "2026-11-15T16:39:00Z", hasValues: true, now }), "current");
  assert.equal(deviceReadLabel({ selectedCount: 1, status: "answered", readAt: "2026-11-15T16:00:00Z", hasValues: true, now }), "stale");
  assert.equal(deviceReadLabel({ selectedCount: 1, status: null, readAt: null, hasValues: false, now }), "missing");
  assert.equal(deviceReadLabel({ selectedCount: 1, status: "failed", readAt: "2026-11-15T16:00:00Z", hasValues: true, now }), "failed-stale");
  assert.equal(deviceReadLabel({ selectedCount: 1, status: "partial", readAt: "2026-11-15T16:39:00Z", hasValues: true, now }), "partial");
  const read = {
    kind: "read" as const,
    version: 3,
    steps: ["getparam 11004;11005", "getparam 2005"],
    step: 1,
    values: {},
    target: {},
    expect: [],
  };
  const kept = advanceConfiguratorJob(read, "Param ID:11004 Value:2,31");
  assert.equal(kept.phase, "waiting_link");
  assert.equal(kept.plan.values["11004"], "2,31");
  assert.equal(kept.plan.steps.includes("getparam 11005"), true);
  assert.equal(kept.plan.steps.some((step) => step.startsWith("setparam")), false);
  const named = advanceConfiguratorJob({
    kind: "read",
    version: 3,
    steps: ["getparam 24;11004;138"],
    step: 1,
    values: {},
    target: {},
    expect: ["24", "11004", "138"],
  }, "Param ID:24 doesn't exist");
  assert.equal(named.phase, "waiting_link");
  assert.equal(named.plan.outcomes?.["24"], "unsupported");
  assert.equal(named.plan.values["24"], undefined);
  assert.equal(named.plan.steps.some((step) => step === "getparam 11004"), true);
  assert.equal(named.plan.steps.slice(1).some((step) => step.includes("24")), false);
  const skipped = advanceConfiguratorJob({ ...kept.plan, step: kept.plan.step + 1 }, "ERR:Param ID not found");
  assert.equal(skipped.phase, "waiting_link");
  assert.equal(skipped.plan.values["11004"], "2,31");
  assert.equal(skipped.plan.outcomes?.["11005"], "unsupported");
  const partialRead = advanceConfiguratorJob({ ...skipped.plan, step: skipped.plan.steps.length }, "");
  assert.equal(partialRead.phase, "verified");
  assert.equal(partialRead.error, "partial");
  assert.equal(partialRead.plan.values["2005"], undefined);
  assert.equal(partialRead.plan.outcomes?.["2005"], "empty");
  const timed = advanceConfiguratorJob({
    kind: "read",
    version: 3,
    steps: ["getparam 1;2;3", "getparam 138"],
    step: 1,
    values: {},
    target: {},
    expect: ["1", "2", "3", "138"],
  }, "", { timeout: true });
  assert.equal(timed.phase, "waiting_link");
  assert.equal(timed.plan.steps.length, 2);
  assert.equal(timed.plan.outcomes?.["1"], "timeout");
  assert.equal(timed.plan.outcomes?.["138"], undefined);
  const short = advanceConfiguratorJob({ ...timed.plan, step: 2 }, "138:2");
  assert.equal(short.plan.values["138"], "2");
  assert.equal(short.plan.outcomes?.["138"], "read");
  assert.equal(short.error, "partial");
  const secret = advanceConfiguratorJob({
    kind: "read",
    version: 3,
    steps: ["getparam 11004;2003"],
    step: 1,
    values: {},
    target: {},
    expect: ["11004", "2003"],
  }, "Param ID:11004 Value:2.31;Param ID:2003 Value:s3cret-apn");
  assert.equal(secret.plan.values["11004"], "2.31");
  assert.equal(secret.plan.values["2003"], undefined);
  assert.equal(secret.plan.outcomes?.["2003"], "read");
  assert.equal(JSON.stringify(secret.plan).includes("s3cret-apn"), false);
  const readIds = fmb920ReadParameterIds();
  const wired = planConfiguratorRead(readIds);
  const wiredIds = wired.flatMap((step) => step.slice("getparam ".length).split(";"));
  assert.equal(wiredIds.includes("138"), true);
  assert.equal(wiredIds.includes("1"), true);
  assert.equal(wiredIds.includes("150"), false);
  assert.equal(wiredIds.includes("8141"), false);
  assert.equal(wiredIds.length, new Set(wiredIds).size);
  assert.ok(wired.length < planConfiguratorRead(fmb920Parameters().map((parameter) => parameter.id)).length);
  assert.equal(parameterById(81411), null);
  assert.equal(parameterById(8141)?.section, "LVCAN");
  assert.equal(parameterById(150)?.section, "RS232/RS485");
  const duplicate = planConfiguratorRead([2005, 2005, 2004]);
  assert.equal(duplicate.every((step) => step.startsWith("getparam ") && productionConfiguratorGetparamAllowed(step)), true);
  assert.equal(duplicate.some((step) => /setparam|setdigout|setkey|delkey|cpureset/.test(step)), false);
});

test("11703 is stored only when the reply names that ID", () => {
  const named = advanceConfiguratorJob({
    kind: "read",
    version: 8,
    steps: ["getparam 11702;11703;11704"],
    step: 1,
    values: {},
    target: {},
    expect: ["11702", "11703", "11704"],
  }, "Param ID:11702 Value:0;Param ID:11703 Value:2;Param ID:11704 Value:0");
  assert.equal(named.plan.values["11702"], "0");
  assert.equal(named.plan.values["11703"], "2");
  assert.equal(named.plan.values["11704"], "0");
  const neighbor = advanceConfiguratorJob({
    kind: "read",
    version: 8,
    steps: ["getparam 11702;11703;11704"],
    step: 1,
    values: {},
    target: {},
    expect: ["11702", "11703", "11704"],
  }, "11702:2;11703:0;11704:0");
  assert.equal(neighbor.plan.values["11703"], "0");
  const unlabeled = advanceConfiguratorJob({
    kind: "read",
    version: 8,
    steps: ["getparam 11702;11703;11704"],
    step: 1,
    values: {},
    target: {},
    expect: ["11702", "11703", "11704"],
  }, "0;2;0");
  assert.equal(unlabeled.plan.values["11703"], undefined);
  assert.equal(unlabeled.phase, "waiting_link");
  assert.equal(unlabeled.plan.steps.includes("getparam 11703"), true);
});

test("accelerometer cornering recorded after the verified change is shown in g", () => {
  const response = verifiedRead;
  assert.equal(greenDrivingSource(response), "accelerometer");
  const at = Date.parse("2026-11-15T14:30:06.000Z");
  assert.equal(corneringDisplayUnit({ recordedAtMs: at, source: "accelerometer" }), "g");
  assert.equal(formatGreenDrivingValue("cornering", 34, "en", "g"), "0.34 g");
  assert.equal(corneringDisplayUnit({
    recordedAtMs: Date.parse("2026-10-25T14:36:00.000Z"),
    source: "accelerometer",
  }), "rad/s");
  assert.equal(formatGreenDrivingValue("cornering", 34, "en"), "0.34 rad/s");
});

test("a device import copies verified values and leaves critical rows on the saved draft", () => {
  const parameters = fmb920Parameters();
  const draft = { "11004": "2.31", "2004": "kept.example", "102": "2" };
  const other = { "109": "8" };
  assert.equal(configImportHeld(parameterById(102)!), true);
  assert.equal(configImportHeld(parameterById(1002)!), false);
  assert.equal(configImportHeld(parameterById(109)!), false);
  assert.equal(configImportHeld(parameterById(2001)!), true);
  assert.equal(configImportHeld(parameterById(11004)!), true);
  assert.equal(configImportHeld(parameterById(11205)!), true);
  assert.equal(configImportHeld(parameterById(10050)!), true);
  assert.equal(configImportHeld(parameterById(11702)!), true);
  assert.equal(configImportHeld(parameterById(3003)!), true);
  assert.equal(configImportHeld(parameterById(113)!), true);
  const result = importDeviceReadIntoDraft({
    draft,
    deviceValues: {
      "109": "10",
      "1002": "1",
      "111": "1",
      "102": "0",
      "11004": "9.99",
      "11200": "0",
      "2001": "carrier",
      "2004": "other.example",
      "2005": "1",
      "3003": "login",
      "11700": "1",
      "10050": "30",
      "110": "99",
    },
    parameters,
  });
  assert.equal(result.values["109"], "10");
  assert.equal(result.values["1002"], "1");
  assert.equal(result.values["111"], "1");
  assert.equal(result.values["102"], "2");
  assert.equal(result.values["11004"], "2.31");
  assert.equal(result.values["2004"], "kept.example");
  assert.equal(result.values["2001"], undefined);
  assert.equal(result.values["2005"], undefined);
  assert.equal(result.values["3003"], undefined);
  assert.equal(result.values["11700"], undefined);
  assert.equal(result.values["11200"], undefined);
  assert.equal(result.values["10050"], undefined);
  assert.equal(result.values["110"], "99");
  assert.equal(draft["102"], "2");
  assert.equal(result.transferred, 4);
  assert.equal(result.unchanged, 9);
  const unnamed = importDeviceReadIntoDraft({
    draft: {},
    deviceValues: { "11703": "2", "11706": "2", "50164": "2", "11816": "15" },
    parameters,
  });
  assert.equal(unnamed.values["11703"], undefined);
  assert.equal(unnamed.values["11706"], "2");
  assert.equal(unnamed.values["50164"], "2");
  assert.equal(unnamed.values["11816"], "15");
  const keptObservation = retainUnverifiedObservations(
    configDraftForSave({ "11703": "2", "11004": "99" }, { ...VERIFIED_GREEN_DRIVING, "11703": "2" }, false),
    { "11703": "2", "11004": "99" },
    {},
  );
  assert.equal(keptObservation.values["11703"], undefined);
  assert.equal(keptObservation.values["11004"], undefined);
  assert.equal(keptObservation.rejected.some((item) => item.id === "11703"), true);
  assert.equal(keptObservation.rejected.some((item) => item.id === "11004"), true);
  const fromDevice = retainUnverifiedObservations(
    configDraftForSave({ "11703": "0" }, { ...VERIFIED_GREEN_DRIVING, "11703": "2" }, false),
    { "11703": "0" },
    { "11703": "2" },
  );
  assert.equal(fromDevice.values["11703"], "0");
  assert.equal(fromDevice.rejected.some((item) => item.id === "11703"), false);
  const blocked = planDeviceDispatch({ read: { "11703": "2", "11004": "2.31" }, target: { "11703": "2", "11004": "2.40" } });
  assert.equal(blocked.steps.some((step) => step.includes("11703")), false);
  assert.equal(blocked.steps.some((step) => step.includes("11004:2.40")), true);
  assert.equal(configuratorWireCommandAllowed("setparam 11703:2"), false);
  assert.equal(configuratorWireCommandAllowed("setparam 11703:1"), true);
  assert.equal(configuratorWireCommandAllowed("setparam 11004:2.31"), true);
  const second = importDeviceReadIntoDraft({ draft: other, deviceValues: { "109": "10", "102": "0" }, parameters });
  assert.equal(second.values["109"], "10");
  assert.equal(other["109"], "8");
  assert.equal(second.values["102"], undefined);
  const copy = readFileSync(new URL("../../lib/gps/configurator-copy.ts", import.meta.url), "utf8");
  assert.match(copy, /Konfigürasyon kaydedildi\. Cihazlara uygulanmadı\./);
  assert.match(copy, /Cihaza Uygula/);
});

test("one parameter apply writes only that ID and verifies the read-back", () => {
  const planned = planParameterApply({ parameterId: 106, value: "0", previous: "1" });
  assert.equal(planned.ok, true);
  if (!planned.ok) return;
  assert.equal(planned.unchanged, false);
  assert.equal(planned.plan.rollback, null);
  assert.deepEqual(planned.plan.steps, ["setparam 106:0", "getparam 106"]);
  assert.equal(planned.plan.steps.some((step) => /11004|11703|setdigout/.test(step)), false);
  const stored = parseConfiguratorPlan(JSON.parse(JSON.stringify({ ...planned.plan, step: 1 })));
  assert.ok(stored);
  if (!stored) return;
  const sent = advanceConfiguratorJob(stored, "New value 106:0");
  assert.equal(sent.phase, "waiting_link");
  assert.deepEqual(sent.plan.steps, ["setparam 106:0", "getparam 106"]);
  const verified = advanceConfiguratorJob({ ...sent.plan, step: 2 }, "Param ID:106 Value:0");
  assert.equal(verified.phase, "verified");
  assert.equal(verified.error, null);
  assert.equal(verified.plan.values["106"], "0");
  const mismatch = advanceConfiguratorJob({ ...sent.plan, step: 2 }, "Param ID:106 Value:1");
  assert.equal(mismatch.phase, "unverified");
  assert.equal(mismatch.plan.steps.length, 2);
  const same = planParameterApply({ parameterId: 106, value: "0", previous: "0" });
  assert.equal(same.ok && same.unchanged, true);
  assert.deepEqual(same.ok ? same.plan.steps : ["sent"], []);
  const invalid = planParameterApply({ parameterId: 11703, value: "2", previous: "0" });
  assert.equal(invalid.ok, false);
  const guarded = planParameterApply({ parameterId: 11703, value: "1", previous: "2" });
  assert.equal(guarded.ok, true);
  if (!guarded.ok) return;
  assert.equal(guarded.plan.rollback, null);
  assert.deepEqual(guarded.plan.steps, ["setparam 11703:1", "getparam 11703"]);
  assert.equal(parameterApplyGuarded(parameterById(106)!), false);
  assert.equal(parameterApplyGuarded(parameterById(11004)!), true);
  assert.equal(parameterApplyCommandAllowed("setparam 106:0"), true);
  assert.equal(parameterApplyCommandAllowed("setparam 106:0;11004:2.31"), false);
  assert.equal(parameterApplyCommandAllowed("setparam 11703:2"), false);
  assert.equal(parameterApplyCommandAllowed("setdigout 1"), false);
  assert.equal(parameterApplyCommandAllowed(TELTONIKA_GREEN_SETPARAM), false);
  assert.equal(productionListenerCommandAllowed(TELTONIKA_GREEN_SETPARAM), true);
  assert.equal(productionListenerCommandAllowed("setparam 106:0"), true);
  assert.equal(productionListenerCommandAllowed("setdigout 0"), true);
  assert.equal(productionListenerCommandAllowed("setkey 0000"), false);
  const accel = planParameterApply({ parameterId: 11004, value: "2.40", previous: "2.31" });
  assert.equal(accel.ok, true);
  if (!accel.ok) return;
  assert.equal(accel.plan.rollback, "2.31");
  const afterWrite = advanceConfiguratorJob({ ...accel.plan, step: 1 }, "New value 11004:2.40");
  const rollback = advanceConfiguratorJob({ ...afterWrite.plan, step: 2 }, "Param ID:11004 Value:9");
  assert.equal(rollback.phase, "waiting_link");
  assert.deepEqual(rollback.plan.steps.slice(2), ["setparam 11004:2.31", "getparam 11004"]);
  const restored = advanceConfiguratorJob({ ...rollback.plan, step: 4 }, "Param ID:11004 Value:2.31");
  assert.equal(restored.phase, "failed");
  assert.equal(restored.error, "rolled_back");
  assert.notEqual(restored.phase, "verified");
  const offline = advanceConfiguratorJob({ ...planned.plan, step: 1 }, "", { timeout: true });
  assert.equal(offline.phase, "failed");
  assert.equal(offline.plan.steps.length, 2);
  const readTimeout = advanceConfiguratorJob({ ...sent.plan, step: 2 }, "", { timeout: true });
  assert.equal(readTimeout.phase, "waiting_link");
  assert.equal(readTimeout.plan.steps.filter((step) => step.startsWith("setparam")).length, 1);
  assert.deepEqual(parameterApplyCounts(["verified", "failed", "waiting_link", "no_change"]), { verified: 1, waiting: 1, failed: 1, unchanged: 1 });
  const foreign = parseConfiguratorPlan({ ...planned.plan, steps: ["setparam 106:0", "getparam 11004"] });
  assert.equal(foreign, null);
});
