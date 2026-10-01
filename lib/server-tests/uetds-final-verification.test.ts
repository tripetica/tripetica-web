import test from "node:test";
import assert from "node:assert/strict";
import { createEmptyDraft, createPassengerDraft } from "../uetds/draft";
import { submitUetdsTestNotification } from "../uetds/ministry-submit";
import { retryUetdsFinalVerification } from "../uetds/retry-verification";
import { verifyUetdsMinistryNotification } from "../uetds/verify-ministry";
import { UETDS_LIVE_ENDPOINT, UETDS_TEST_ENDPOINT } from "../uetds/ministry-env";
import { sealSecret } from "../security/sealed-secret";

const reference = "1234567890123456";
const companyId = "11111111-1111-4111-8111-111111111111";
const notificationId = "22222222-2222-4222-8222-222222222222";
const partnerId = "33333333-3333-4333-8333-333333333333";
const otherPartnerId = "44444444-4444-4444-8444-444444444444";
const summary = `<return><sonucKodu>0</sonucKodu><uetdsSeferReferansNo>${reference}</uetdsSeferReferansNo><seferDurumKodu>0</seferDurumKodu><seferDurumAciklama>GEÇERLİ</seferDurumAciklama><aracPlaka>34EGP847</aracPlaka><grupListesi><grupId>1234</grupId></grupListesi><ariziPersonelListesi><durumAciklama>Geçerli</durumAciklama></ariziPersonelListesi><ariziYolcuListesi><uetdsBiletRefNo>5678</uetdsBiletRefNo><durumAciklama>Geçerli</durumAciklama></ariziYolcuListesi></return>`;
const expected = { seferReference: reference, plate: "34 EGP 847", groupCount: 1, personnelCount: 1, passengerCount: 1 };

test("create final verification and read-only reconciliation with all network mocked", async (t) => {
  const before = { ...process.env };
  const originalFetch = globalThis.fetch;
  const globals = globalThis as typeof globalThis & { tripeticaPgPool?: unknown };
  const originalPool = globals.tripeticaPgPool;
  const draft = createEmptyDraft("manual");
  draft.fare = "0";
  draft.startDate = draft.endDate = "2030-01-01";
  draft.startTime = "19:00"; draft.endTime = "22:00";
  draft.passengers = [createPassengerDraft({ firstName: "Johanna", lastName: "Huedo-Gonzalez", identityNumber: "FAKE-TEST", nationality: "TR", gender: "male" })];
  let operations: string[] = [];
  let summaryXml = summary;
  let timeout = false;
  let expectedEndpoint = UETDS_TEST_ENDPOINT;
  let expectedUsername = "test-fixture";
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), expectedEndpoint);
    assert.match(String((init?.headers as Record<string,string>).Authorization), /^Basic /);
    const user = Buffer.from(String((init?.headers as Record<string,string>).Authorization).slice(6), "base64").toString().split(":")[0];
    assert.equal(user, expectedUsername);
    const action = String((init?.headers as Record<string,string>).SOAPAction).replaceAll('"', '').split('/').pop()!;
    operations.push(action);
    if (action === "yolcuEkle") {
      assert.match(String(init?.body), /<adi>Johanna<\/adi>/);
      assert.match(String(init?.body), /<soyadi>Huedo Gonzalez<\/soyadi>/);
      assert.doesNotMatch(String(init?.body), /Huedo-Gonzalez/);
    }

    if (action === "bildirimOzeti") {
      assert.ok(init?.signal, "final summary has a bounded timeout");
      if (timeout) throw new DOMException("Fixture timeout", "TimeoutError");
      return new Response(summaryXml);
    }
    const response: Record<string,string> = {
      seferEkle: `<uetdsSeferReferansNo>${reference}</uetdsSeferReferansNo>`,
      personelEkle: "", seferGrupEkle: "<uetdsGrupRefNo>1234</uetdsGrupRefNo>", yolcuEkle: "<uetdsYolcuRefNo>5678</uetdsYolcuRefNo>",
    };
    assert.ok(action in response, "unexpected SOAP operation");
    return new Response(`<return><sonucKodu>0</sonucKodu>${response[action]}</return>`);
  };
  try {
    for (const environment of ["test", "live"] as const) {
      await t.test(`${environment}: only its endpoint and final exact match yields submitted`, async () => {
        Object.assign(process.env, { NODE_ENV: environment === "live" ? "production" : "development", EXPECTED_DATABASE: environment === "live" ? "tripetica" : "tripetica_dev" });
        expectedEndpoint = environment === "live" ? UETDS_LIVE_ENDPOINT : UETDS_TEST_ENDPOINT;
        expectedUsername = `${environment}-fixture`;
        operations = [];
        const result = await submitUetdsTestNotification({ username: expectedUsername, password: "fake", plate: expected.plate, driverNationalId: "FAKE", driverFullName: "Fixture Driver", draft });
        assert.equal(result.status, "submitted");
        assert.equal(result.finalVerification?.environment, environment);
        assert.equal(result.finalVerification?.result, "verified");
        assert.deepEqual(operations, ["seferEkle", "personelEkle", "seferGrupEkle", "yolcuEkle", "bildirimOzeti"]);
      });
    }
    await t.test("summary failure preserves sefer/group/passenger references without replay", async () => {
      operations = [];
      summaryXml = summary.replace("<sonucKodu>0", "<sonucKodu>99");
      const result = await submitUetdsTestNotification({ username: expectedUsername, password: "fake", plate: expected.plate, driverNationalId: "FAKE", driverFullName: "Fixture Driver", draft });
      assert.equal(result.status, "partial");
      assert.equal(result.finalVerification?.result, "final-verification-failed");
      assert.equal(result.seferReferansNo, reference);
      assert.equal(result.grupReferansNo, "1234");
      assert.equal(result.passengerRefs[0].reference, "5678");
      assert.equal(operations.filter(x => x === "seferEkle").length, 1);
    });
    await t.test("timeout never produces submitted", async () => {
      operations = []; timeout = true;
      const result = await submitUetdsTestNotification({ username: expectedUsername, password: "fake", plate: expected.plate, driverNationalId: "FAKE", driverFullName: "Fixture Driver", draft });
      assert.equal(result.status, "partial");
      assert.equal(result.finalVerification?.result, "final-verification-failed");
      assert.equal(operations.filter(x => x === "bildirimOzeti").length, 1);
      timeout = false;
    });
    await t.test("non-valid personnel/passenger labels cannot inflate final counts", async () => {
      summaryXml = summary.replaceAll("<durumAciklama>Geçerli</durumAciklama>", "<durumAciklama>Geçerli değil</durumAciklama>");
      const result = await verifyUetdsMinistryNotification({ username: expectedUsername, password: "fake", environment: "live", expected });
      assert.equal(result.result, "final-verification-failed");
      assert.equal(result.actual.personnelCount, 0);
      assert.equal(result.actual.passengerCount, 0);
      summaryXml = summary.replace("<sonucKodu>0", "<sonucKodu>99");
    });
    await t.test("wrong runtime refuses read-only query as well", async () => {
      operations = [];
      const result = await verifyUetdsMinistryNotification({ username: "fake", password: "fake", environment: "test", expected });
      assert.equal(result.result, "final-verification-failed");
      assert.deepEqual(operations, []);
    });
    await t.test("retry persists safe audit and never repeats mutations, including cross-partner and stale writes", async () => {
      process.env.UETDS_CREDENTIALS_KEY = Buffer.alloc(32, 8).toString("base64");
      const credentials = { test_username: null, test_password_sealed: null, live_username: expectedUsername, live_password_sealed: sealSecret("fake") };
      const initialVerification = await verifyUetdsMinistryNotification({ username: expectedUsername, password: "fake", environment: "live", expected });
      let row = {
        id: notificationId, partner_id: partnerId, company_id: companyId, company_short_name: "Fixture Company", reservation_id: null,
        source: "manual", status: "partial", ministry_env: "live", ministry_reference: reference, created_at: new Date(),
        snapshot: { vehicle: { plate: expected.plate }, passengers: [{}], ministry: { seferReferansNo: reference, finalVerification: initialVerification, finalVerificationHistory: [initialVerification] } },
      };
      let concurrentChange = false;
      let writes = 0;
      globals.tripeticaPgPool = { query: async (sql: string, values: unknown[]) => {
        if (sql.includes("FROM uetds_companies")) return { rows: [credentials] };
        if (sql.startsWith("UPDATE")) {
          if (concurrentChange) return { rows: [] };
          assert.equal(values[3], JSON.stringify(row.snapshot));
          assert.equal(values[6], partnerId);
          row = { ...row, status: String(values[1]), snapshot: JSON.parse(String(values[2])) };
          writes++;
          return { rows: [{ id: notificationId }] };
        }
        return { rows: !values[1] || values[1] === partnerId ? [row] : [] };
      } };
      operations = [];
      row.ministry_env = "test";
      assert.equal((await retryUetdsFinalVerification({ notificationId, actorType: "partner", partnerId })).ok, false);
      assert.deepEqual(operations, []);
      row.ministry_env = "live";
      assert.equal((await retryUetdsFinalVerification({ notificationId, actorType: "partner", partnerId: otherPartnerId })).ok, false);
      assert.deepEqual(operations, []);
      const failedRetry = await retryUetdsFinalVerification({ notificationId, actorType: "partner", partnerId });
      assert.ok(failedRetry.ok);
      assert.equal(failedRetry.verification.result, "final-verification-failed");
      assert.equal(row.status, "partial");
      assert.equal(row.snapshot.ministry.finalVerificationHistory.length, 2);
      summaryXml = summary;
      concurrentChange = true;
      assert.equal((await retryUetdsFinalVerification({ notificationId, actorType: "partner", partnerId })).ok, false);
      assert.equal(writes, 1);
      concurrentChange = false;
      const verifiedRetry = await retryUetdsFinalVerification({ notificationId, actorType: "partner", partnerId });
      assert.ok(verifiedRetry.ok);
      assert.equal(verifiedRetry.status, "submitted");
      assert.equal(row.snapshot.ministry.finalVerificationHistory.length, 3);
      assert.ok(operations.every(x => x === "bildirimOzeti"));
      assert.equal((await retryUetdsFinalVerification({ notificationId, actorType: "partner", partnerId })).ok, false);
      assert.equal(writes, 2);
    });
  } finally {
    process.env = before; globalThis.fetch = originalFetch; globals.tripeticaPgPool = originalPool;
  }
});
