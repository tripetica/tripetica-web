import assert from "node:assert/strict";
import test from "node:test";
import { classifyKeywordReply, keywordCommand, keywordCommandAllowed, keywordTextAllowed } from "@/lib/teltonika/keyword";
import { teltonikaWireCommandAllowed } from "@/lib/teltonika/config-read";
import { devListenerCommandAllowed } from "@/lib/teltonika/restart";

const SAMPLE = "Kw12test";

test("keyword commands follow the documented setkey and delkey forms", () => {
  assert.equal(keywordTextAllowed("abc"), false);
  assert.equal(keywordTextAllowed("abcd"), true);
  assert.equal(keywordTextAllowed("abc def"), false);
  assert.equal(keywordCommand("set", "", SAMPLE), `setkey  ${SAMPLE}`);
  assert.equal(keywordCommand("set", "OldKey1", SAMPLE), `setkey OldKey1 ${SAMPLE}`);
  assert.equal(keywordCommand("remove", "OldKey1", ""), "delkey OldKey1");
  assert.equal(keywordCommand("set", SAMPLE, SAMPLE), null);
  assert.equal(keywordCommandAllowed(`setkey  ${SAMPLE}`), true);
  assert.equal(keywordCommandAllowed("setkey bad"), false);
  assert.equal(devListenerCommandAllowed(`delkey ${SAMPLE}`), true);
  assert.equal(teltonikaWireCommandAllowed(`setkey  ${SAMPLE}`), false);
  assert.equal(teltonikaWireCommandAllowed(`delkey ${SAMPLE}`), false);
});

test("a keyword reply is reduced to a result code", () => {
  for (const reply of [`Keyword saved: ${SAMPLE}`, "Keyword removed", "Error:Locked", "Error:Wrong old keyword", "Error:Wrong keyword format", "Error:Bad Syntax", "Error:Cannot save keyword (1)", "Error:Keyword deletion failure (2)", "anything"]) {
    const result = classifyKeywordReply(reply);
    assert.equal(JSON.stringify(result).includes(SAMPLE), false);
    assert.equal(JSON.stringify(result).toLowerCase().includes("keyword saved"), false);
  }
  assert.deepEqual(classifyKeywordReply(`Keyword saved: ${SAMPLE}`), { phase: "accepted", error: null });
  assert.deepEqual(classifyKeywordReply("Keyword removed"), { phase: "accepted", error: null });
  assert.equal(classifyKeywordReply("Error:Locked").error, "locked");
  assert.equal(classifyKeywordReply("Error:Wrong old keyword").error, "wrong_old");
});
