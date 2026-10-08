import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  UETDS_ATS_SOAP_ACTIONS,
  atsArizaBildirInnerXml,
  atsAutomaticFaultReportEnabled,
  atsKonumBildirInnerXml,
  formatAtsKonumZamani,
} from "@/lib/uetds/ats-soap";
import { UETDS_NS, UETDS_SOAP_ACTIONS } from "@/lib/uetds/ministry-env";

test("ATS SOAP actions match the Arızi V15 WSDL and stay off the sefer prefix", () => {
  assert.equal(UETDS_ATS_SOAP_ACTIONS.atsKonumBildir, `${UETDS_NS}uetdsyts/atsKonumBildir`);
  assert.equal(UETDS_ATS_SOAP_ACTIONS.atsArizaBildir, `${UETDS_NS}uetdsarizi/atsArizaBildir`);
  assert.equal("atsKonumBildir" in UETDS_SOAP_ACTIONS, false);
  assert.equal("atsArizaBildir" in UETDS_SOAP_ACTIONS, false);
  assert.equal(UETDS_SOAP_ACTIONS.seferEkle, `${UETDS_NS}uetdsytsarizi/seferEkle`);
});

test("atsKonumBildir XML follows the XSD sequence and keeps the GNSS timestamp", () => {
  const konumZamani = formatAtsKonumZamani(new Date("2026-01-07T11:15:30.000Z"));
  assert.equal(konumZamani, "07/01/2026 14:15:30");
  const xml = atsKonumBildirInnerXml({
    username: "test-user",
    password: "test-secret",
    plate: "34EGP847",
    latitude: 41.03,
    longitude: 28.81,
    ilKodu: 34,
    ilceMernisKodu: 2053,
    konumZamani,
  });
  const order = ["boylam", "enlem", "ilKodu", "ilceMernisKodu", "konumZamani", "plaka"].map((name) => xml.indexOf(`<${name}>`));
  assert.deepEqual(order, [...order].sort((left, right) => left - right));
  assert.ok(order.every((index) => index >= 0));
  assert.match(xml, /<konumEkleInput>/);
  assert.match(xml, /<konumZamani>07\/01\/2026 14:15:30<\/konumZamani>/);
  assert.doesNotMatch(xml, /imei|uetdsSeferReferansNo/i);
  assert.equal(atsAutomaticFaultReportEnabled(), false);
});

test("atsArizaBildir is buildable and is not wrapped as a position report", () => {
  const xml = atsArizaBildirInnerXml({
    username: "test-user",
    password: "test-secret",
    plate: "34EGP847",
    arizaBaslangicTarihi: "07/01/2026",
    aciklama: "unit",
  });
  assert.match(xml, /<wsuser>/);
  assert.match(xml, /<plaka>34EGP847<\/plaka>/);
  assert.doesNotMatch(xml, /konumEkleInput|enlem|boylam/);
  const poster = readFileSync(new URL("./ats-post.ts", import.meta.url), "utf8");
  assert.match(poster, /ats_dispatch_withheld/);
  assert.match(poster, /ATS_MINISTRY_DISPATCH === "allow-test"/);
  const guard = poster.indexOf("if (!plate || (!testAllowed && !liveAllowed))");
  const call = poster.indexOf("return callUetdsTestSoap");
  assert.ok(guard >= 0 && call > guard);
  assert.match(poster, /UETDS_LIVE_ENDPOINT/);
  assert.match(poster, /UETDS_TEST_ENDPOINT/);
});
