import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  TELTONIKA_GREEN_GETPARAM,
  TELTONIKA_GREEN_SETPARAM,
  decideGreenDrivingFollowup,
  classifyTeltonikaGetparam,
  parseTeltonikaGetparam,
  redactTeltonikaReply,
  teltonikaWireCommandAllowed,
} from "@/lib/teltonika/config-read";

const PRIOR_READ = "Param ID:11000 Value:0;11003:0;11004:2.310000;11005:2.520000;11006:2.940000;11007:1;11008:1;11011:1;11015:1;11019:1";

test("only the approved Green Driving commands and the two existing DOUT commands may be written", () => {
  assert.equal(teltonikaWireCommandAllowed(TELTONIKA_GREEN_GETPARAM), true);
  assert.equal(teltonikaWireCommandAllowed(TELTONIKA_GREEN_SETPARAM), true);
  assert.equal(teltonikaWireCommandAllowed("setdigout 0"), true);
  assert.equal(teltonikaWireCommandAllowed("setdigout 1"), true);
  assert.equal(teltonikaWireCommandAllowed("setparam 11000:1"), false);
  assert.equal(teltonikaWireCommandAllowed("setparam 11000:1;11019:0;11011:0;11015:0;11004:2.31"), false);
  assert.equal(teltonikaWireCommandAllowed("setparam 11000:1;11003:1;11011:0;11015:0"), false);
  assert.equal(teltonikaWireCommandAllowed("setdigout 1 15"), false);
  assert.equal(teltonikaWireCommandAllowed("getparam 11000"), false);
  assert.equal(teltonikaWireCommandAllowed(`${TELTONIKA_GREEN_GETPARAM};2004`), false);
});

test("a completed safe read queues one setparam, and a failed verification does not retry", () => {
  assert.equal(decideGreenDrivingFollowup({
    applyEnabled: false,
    command: TELTONIKA_GREEN_GETPARAM,
    response: PRIOR_READ,
    priorSetparamAnswered: false,
  }), "none");
  assert.equal(decideGreenDrivingFollowup({
    applyEnabled: true,
    command: TELTONIKA_GREEN_GETPARAM,
    response: PRIOR_READ,
    priorSetparamAnswered: false,
  }), "setparam");
  assert.equal(decideGreenDrivingFollowup({
    applyEnabled: true,
    command: TELTONIKA_GREEN_GETPARAM,
    response: PRIOR_READ.replace("11003:0", "11003:1"),
    priorSetparamAnswered: false,
  }), "none");
  assert.equal(decideGreenDrivingFollowup({
    applyEnabled: true,
    command: TELTONIKA_GREEN_SETPARAM,
    response: "Param ID:11000 New Val:1;11019:0;11011:0;11015:0",
    priorSetparamAnswered: false,
  }), "verify");
  assert.equal(decideGreenDrivingFollowup({
    applyEnabled: true,
    command: TELTONIKA_GREEN_SETPARAM,
    response: "ERR:Bad Syntax",
    priorSetparamAnswered: false,
  }), "none");
  assert.deepEqual(parseTeltonikaGetparam("Param ID:11000 New Val:1;11019:0;11011:0;11015:0"), {
    "11000": "1", "11019": "0", "11011": "0", "11015": "0",
  });
  assert.equal(decideGreenDrivingFollowup({
    applyEnabled: true,
    command: TELTONIKA_GREEN_GETPARAM,
    response: "Param ID:11000 Value:0;11003:0;11004:2.31;11005:2.52;11006:2.94;11007:1;11011:1;11015:1;11019:1",
    priorSetparamAnswered: true,
  }), "none");
});

test("getparam replies keep the device's own value text", () => {
  const parsed = parseTeltonikaGetparam("Param ID:11000 Value:0 Param ID:11004 Value:2.31 Param ID:11007 Value:1");
  assert.deepEqual(parsed, { "11000": "0", "11004": "2.31", "11007": "1" });
  assert.deepEqual(parseTeltonikaGetparam("11019:1;11003:0"), { "11019": "1", "11003": "0" });
  assert.deepEqual(parseTeltonikaGetparam("Param ID:2004 Value:cfg-test.invalid;2005:9"), { "2004": "cfg-test.invalid", "2005": "9" });
  assert.deepEqual(parseTeltonikaGetparam("ERR:Bad Syntax"), {});
  assert.deepEqual(parseTeltonikaGetparam("Param ID:138 Value:2"), { "138": "2" });
  assert.deepEqual(parseTeltonikaGetparam("138:2"), { "138": "2" });
  assert.deepEqual(parseTeltonikaGetparam("Param ID:1 Value:0"), { "1": "0" });
  assert.deepEqual(parseTeltonikaGetparam("Param ID:7002 Value:"), {});
  assert.deepEqual(classifyTeltonikaGetparam("Param ID:7002 Value:").empty, ["7002"]);
  assert.equal(classifyTeltonikaGetparam("ERR:Param ID not found").reply, "not_found");
  const missing = classifyTeltonikaGetparam("Param ID:24 doesn't exist");
  assert.equal(missing.reply, "not_found");
  assert.deepEqual(missing.missing, ["24"]);
  assert.deepEqual(missing.values, {});
  assert.deepEqual(classifyTeltonikaGetparam("Param ID:6 does not exist").missing, ["6"]);
  assert.equal(classifyTeltonikaGetparam("", { timeout: true }).reply, "timeout");
  assert.equal(redactTeltonikaReply("Param ID:2003 Value:s3cret-apn;11004:2.31").includes("s3cret-apn"), false);
  assert.match(redactTeltonikaReply("Param ID:11004 Value:2.31"), /2\.31/);
});

test("the read queue SQL accepts only the exact getparam and does not touch immobilizer rows", () => {
  const store = readFileSync(new URL("./config-read-store.ts", import.meta.url), "utf8");
  const migration = readFileSync(new URL("../../db/migrations/123_teltonika_config_reads.sql", import.meta.url), "utf8");
  assert.match(store, /command_text = ANY\(\$2::text\[\]\)/);
  assert.match(store, /TELTONIKA_GREEN_SETPARAM/);
  assert.doesNotMatch(store, /gps_immobilizer|setdigout|11004:/);
  assert.match(migration, /CHECK \(command_text = 'getparam 11000;11003;11004;11005;11006;11007;11008;11011;11015;11019'\)/);
  assert.doesNotMatch(migration, /command_text = 'setparam/);
});
