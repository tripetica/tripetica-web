import test from "node:test";
import assert from "node:assert/strict";
import {
  kamuEditDeepLinkFirmaHint,
  resolveKamuEditDeepLink,
} from "@/lib/uetds/kamu-portal/deep-link";
import { kamuSeferListesiUrl } from "@/lib/uetds/kamu-portal/html";

test("offline deep-link stops at seferListesi and does not guess index", () => {
  const link = resolveKamuEditDeepLink({
    firmaSeferNo: "11111111-1111-1111-1111-111111111111",
    ministrySeferRef: "2609247158982990",
    plate: "34 ABC 123",
  });
  assert.equal(link.stage, "seferListesi");
  assert.equal(link.url, kamuSeferListesiUrl());
  assert.equal(link.matchedSefer, false);
  assert.doesNotMatch(link.url, /index=/);
  assert.doesNotMatch(link.url, /grupIndex=/);
  assert.doesNotMatch(link.url, /yolcuListesi|yeniYolcu/);
  assert.equal(link.firmaSeferNo, "11111111-1111-1111-1111-111111111111");
  assert.equal(kamuEditDeepLinkFirmaHint(link), "11111111-1111-1111-1111-111111111111");
});

test("deep-link hint falls back to plate when firma sefer no missing", () => {
  const link = resolveKamuEditDeepLink({ plate: "06XYZ99" });
  assert.equal(kamuEditDeepLinkFirmaHint(link), "06XYZ99");
  assert.equal(link.stage, "seferListesi");
});
