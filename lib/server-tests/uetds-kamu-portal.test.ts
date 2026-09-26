import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  hasYolcuUpdatedFlash,
  isKamuAuthenticatedShell,
  isKamuFirmSelect,
  isKamuLoginWall,
  kamuYeniYolcuUrl,
  matchKamuSeferIndex,
  matchKamuYolcuIndex,
  parseKamuSeferListRows,
  parseKamuYolcuListRows,
  portalGenderValue,
  usesFlushNewPassengerPath,
} from "@/lib/uetds/kamu-portal/html";
import { kamuPassengerUpdateUnetAllowlist } from "@/lib/uetds/kamu-portal/eligibility";
import { sanitizeCookieHeader, saveKamuPortalSession, loadKamuPortalSession, clearKamuPortalSession } from "@/lib/uetds/kamu-portal/session";
import { updateExistingKamuPassenger, type KamuPortalFetch } from "@/lib/uetds/kamu-portal/client";
import {
  updateEditedPassengersViaKamuPortal,
  KAMU_YOLCU_GUNCELLE_OPERATION,
} from "@/lib/uetds/kamu-portal/update-passengers";
import { type ClassifiedUetdsPassenger } from "@/lib/uetds/passenger-class";
import { type UetdsPassengerDraft } from "@/lib/uetds/draft";

test("kamu allowlist uses UNET ids not short names", () => {
  assert.deepEqual(
    [...kamuPassengerUpdateUnetAllowlist({ UETDS_KAMU_PASSENGER_UPDATE_UNET_IDS: "1046786,999" })].sort(),
    ["1046786", "999"],
  );
  assert.ok(kamuPassengerUpdateUnetAllowlist({}).has("1046786"));
});

test("flush new-passenger path is detected and blocked in URL builder", () => {
  assert.equal(usesFlushNewPassengerPath("…&yolcuIndex=flush"), true);
  assert.equal(usesFlushNewPassengerPath(kamuYeniYolcuUrl({ index: 1, grupIndex: 0, yolcuIndex: 0 })), false);
});

test("portal gender maps to Kadın/Erkek", () => {
  assert.equal(portalGenderValue("female"), "Kadın");
  assert.equal(portalGenderValue("male"), "Erkek");
});

test("sefer matching prefers firma sefer no then plate+time", () => {
  const html = `
    <a href="?asama=seferDetay&index=3">TRP-111 24/09/2026 23:30 34FDN767</a>
    <a href="?asama=seferDetay&index=7">SEFER2105 24/09/2026 23:30 34ABC123</a>
  `;
  const rows = parseKamuSeferListRows(html);
  assert.ok(rows.length >= 2);
  assert.equal(
    matchKamuSeferIndex({
      rows,
      firmaSeferNo: "SEFER2105",
      ministrySeferRef: "2609247158982990",
      plate: "34ABC123",
    }),
    7,
  );
  assert.equal(
    matchKamuSeferIndex({
      rows,
      firmaSeferNo: null,
      ministrySeferRef: null,
      plate: "34FDN767",
      startDate: "2026-09-24",
      startTime: "23:30",
    }),
    3,
  );
});

test("yolcu matching uses identity number and requires yolcuIndex not flush", () => {
  const html = `
    <tr>AHMAD HASAN tu6438282 <a href="?asama=yeniYolcu&index=0&grupIndex=0&yolcuIndex=0">Güncelle</a></tr>
    ${"<!-- pad -->".repeat(40)}
    <tr>OTHER PERSON zz99999 <a href="?asama=yeniYolcu&index=0&grupIndex=0&yolcuIndex=2">Güncelle</a></tr>
  `;
  const rows = parseKamuYolcuListRows(html);
  assert.equal(matchKamuYolcuIndex({ rows, identityNumber: "tu6438282" }), 0);
  assert.equal(matchKamuYolcuIndex({ rows, identityNumber: "zz99999" }), 2);
});

test("login wall detection", () => {
  assert.equal(isKamuLoginWall("Kimliğimi Şimdi Doğrula"), true);
  assert.equal(isKamuLoginWall("<h1>Sefer Listesi</h1>"), false);
  assert.equal(hasYolcuUpdatedFlash("Yolcu Güncellenmiştir."), true);
});

test("authenticated Kamu chrome is not treated as login wall", () => {
  const authenticatedHtml = `
    <a href="/">e-Devlet Kapısı Kamu Uygulamaları Merkezi</a>
    <a href="/cikis">Çıkış</a>
    <h1>Sefer Listesi</h1>
    <p>Firma Sefer Numarası</p>
  `;
  assert.equal(isKamuLoginWall(authenticatedHtml), false);
  assert.equal(isKamuAuthenticatedShell(authenticatedHtml), true);
  const firmHtml = `
    <a href="/cikis">Çıkış</a>
    <p>Lütfen yetkiniz olan firmalar içinden işlem yapmak istediğiniz firmayı seçiniz.</p>
    <select name="firma"></select>
    <input type="submit" value="Devam Et" />
  `;
  assert.equal(isKamuLoginWall(firmHtml), false);
  assert.equal(isKamuFirmSelect(firmHtml), true);
});

test("cookie sanitize rejects passwords and requires session-like names", () => {
  assert.equal(sanitizeCookieHeader("password=secret"), "");
  assert.equal(sanitizeCookieHeader("foo=bar"), "");
  assert.ok(sanitizeCookieHeader("TURKIYESESSIONID=abc; JSESSIONID=xyz").includes("TURKIYESESSIONID"));
});

test("DEV session seal round-trip does not store plaintext on disk", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uetds-kamu-"));
  const key = randomBytes(32).toString("hex");
  const file = path.join(dir, "session.sealed");
  const prevKey = process.env.UETDS_CREDENTIALS_KEY;
  const prevPath = process.env.UETDS_KAMU_SESSION_PATH;
  const prevDb = process.env.EXPECTED_DATABASE;
  process.env.UETDS_CREDENTIALS_KEY = key;
  process.env.UETDS_KAMU_SESSION_PATH = file;
  process.env.EXPECTED_DATABASE = "tripetica_dev";
  const env: Record<string, string | undefined> = {
    ...process.env,
    NODE_ENV: "development",
    EXPECTED_DATABASE: "tripetica_dev",
    UETDS_CREDENTIALS_KEY: key,
    UETDS_KAMU_SESSION_PATH: file,
  };
  try {
    const saved = await saveKamuPortalSession("TURKIYESESSIONID=secret-value; JSESSIONID=j1", env);
    assert.equal(saved.ok, true);
    const onDisk = await readFile(file, "utf8");
    assert.equal(onDisk.includes("secret-value"), false);
    assert.ok(onDisk.startsWith("v1."));
    const loaded = await loadKamuPortalSession(env);
    assert.equal(loaded?.cookieHeader.includes("secret-value"), true);
  } finally {
    if (prevKey === undefined) delete process.env.UETDS_CREDENTIALS_KEY;
    else process.env.UETDS_CREDENTIALS_KEY = prevKey;
    if (prevPath === undefined) delete process.env.UETDS_KAMU_SESSION_PATH;
    else process.env.UETDS_KAMU_SESSION_PATH = prevPath;
    if (prevDb === undefined) delete process.env.EXPECTED_DATABASE;
    else process.env.EXPECTED_DATABASE = prevDb;
    await rm(dir, { recursive: true, force: true });
  }
});

test("existing passenger update uses yolcuIndex POST and never flush / iptal / ekle", async () => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const fetchImpl: KamuPortalFetch = async (input) => {
    calls.push({
      url: input.url,
      method: input.method ?? "GET",
      body: input.body?.toString(),
    });
    if (input.url.includes("asama=seferListesi")) {
      return {
        url: input.url,
        status: 200,
        finalUrl: input.url,
        html: `<a href="?asama=seferDetay&index=5">RES-1 24/09/2026 10:00 34AAA111</a>`,
      };
    }
    if (input.url.includes("asama=yolcuListesi")) {
      return {
        url: input.url,
        status: 200,
        finalUrl: input.url,
        html: `<a href="?asama=yeniYolcu&index=5&grupIndex=0&yolcuIndex=1">Güncelle</a> OLDNAME OLDSUR P12345`,
      };
    }
    if (input.url.includes("asama=yeniYolcu") && !input.url.includes("submit")) {
      return {
        url: input.url,
        status: 200,
        finalUrl: input.url,
        html: `<input name="token" value="tok123"/><select name="ulke"><option value="Amerika Birleşik Devletleri" selected></option></select>`,
      };
    }
    if (input.url.includes("submit")) {
      return {
        url: input.url,
        status: 302,
        finalUrl: input.url.replace("&submit", "").replace("yeniYolcu", "yolcuListesi"),
        html: `<div>Yolcu Güncellenmiştir.</div>`,
      };
    }
    return { url: input.url, status: 404, finalUrl: input.url, html: "" };
  };

  const dir = await mkdtemp(path.join(os.tmpdir(), "uetds-kamu-"));
  const key = randomBytes(32).toString("hex");
  const file = path.join(dir, "session.sealed");
  const env: Record<string, string | undefined> = {
    ...process.env,
    NODE_ENV: "development",
    EXPECTED_DATABASE: "tripetica_dev",
    UETDS_CREDENTIALS_KEY: key,
    UETDS_KAMU_SESSION_PATH: file,
  };
  const prevKey = process.env.UETDS_CREDENTIALS_KEY;
  const prevPath = process.env.UETDS_KAMU_SESSION_PATH;
  process.env.UETDS_CREDENTIALS_KEY = key;
  process.env.UETDS_KAMU_SESSION_PATH = file;
  try {
    await saveKamuPortalSession("TURKIYESESSIONID=abc; JSESSIONID=def", env);
    const passenger: UetdsPassengerDraft = {
      key: "p1",
      nationality: "US",
      identityType: "passport",
      identityNumber: "P12345",
      firstName: "NEWNAME",
      lastName: "NEWSUR",
      gender: "male",
      ministryReference: "392560718",
      provenance: {
        nationality: "user",
        identityNumber: "user",
        firstName: "user",
        lastName: "user",
        gender: "user",
      },
    };
    const result = await updateExistingKamuPassenger({
      firmaSeferNo: "RES-1",
      ministrySeferRef: "2609247158982990",
      plate: "34AAA111",
      startDate: "2026-09-24",
      startTime: "10:00",
      matchIdentityNumber: "P12345",
      matchFirstName: "OLDNAME",
      matchLastName: "OLDSUR",
      passenger,
      fetchImpl,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.yolcuIndex, 1);
    }
    assert.ok(calls.some((c) => c.method === "POST" && c.url.includes("yolcuIndex=1") && c.url.includes("submit")));
    assert.ok(!calls.some((c) => /flush/i.test(c.url)));
    assert.ok(!calls.some((c) => /yolcuIptal|yolcuEkle/i.test(c.url + (c.body || ""))));
    const post = calls.find((c) => c.method === "POST");
    assert.ok(post?.body?.includes("adi=NEWNAME"));
    assert.ok(post?.body?.includes("token=tok123"));
  } finally {
    if (prevKey === undefined) delete process.env.UETDS_CREDENTIALS_KEY;
    else process.env.UETDS_CREDENTIALS_KEY = prevKey;
    if (prevPath === undefined) delete process.env.UETDS_KAMU_SESSION_PATH;
    else process.env.UETDS_KAMU_SESSION_PATH = prevPath;
    await rm(dir, { recursive: true, force: true });
  }
});

test("batch update keeps same ministry refs and uses kamuYolcuGuncelle op", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uetds-kamu-"));
  const key = randomBytes(32).toString("hex");
  const file = path.join(dir, "session.sealed");
  const env: Record<string, string | undefined> = {
    ...process.env,
    NODE_ENV: "development",
    EXPECTED_DATABASE: "tripetica_dev",
    UETDS_CREDENTIALS_KEY: key,
    UETDS_KAMU_SESSION_PATH: file,
  };
  const prevKey = process.env.UETDS_CREDENTIALS_KEY;
  const prevPath = process.env.UETDS_KAMU_SESSION_PATH;
  process.env.UETDS_CREDENTIALS_KEY = key;
  process.env.UETDS_KAMU_SESSION_PATH = file;
  try {
    await saveKamuPortalSession("TURKIYESESSIONID=abc; JSESSIONID=def", env);
    const fetchImpl: KamuPortalFetch = async (input) => {
      if (input.url.includes("seferListesi")) {
        return {
          url: input.url,
          status: 200,
          finalUrl: input.url,
          html: `<a href="?asama=seferDetay&index=0">R1 01/01/2026 12:00 34ZZZ999</a>`,
        };
      }
      if (input.url.includes("yolcuListesi")) {
        return {
          url: input.url,
          status: 200,
          finalUrl: input.url,
          html: `<a href="?asama=yeniYolcu&index=0&grupIndex=0&yolcuIndex=0">Güncelle</a> AA BB id1`,
        };
      }
      if (input.url.includes("yeniYolcu") && !input.url.includes("submit")) {
        return {
          url: input.url,
          status: 200,
          finalUrl: input.url,
          html: `<input name="token" value="t"/><select name="ulke"><option selected value="Türkiye">Türkiye</option></select>`,
        };
      }
      return {
        url: input.url,
        status: 200,
        finalUrl: input.url,
        html: "Yolcu Güncellenmiştir.",
      };
    };
    const original: UetdsPassengerDraft = {
      key: "k",
      nationality: "TR",
      identityType: "passport",
      identityNumber: "id1",
      firstName: "AA",
      lastName: "BB",
      gender: "female",
      ministryReference: "REFKEEP",
      provenance: {
        nationality: "user",
        identityNumber: "user",
        firstName: "user",
        lastName: "user",
        gender: "user",
      },
    };
    const edited: UetdsPassengerDraft = { ...original, firstName: "CC", lastName: "DD" };
    const classified: ClassifiedUetdsPassenger[] = [
      {
        kind: "EDITED_EXISTING",
        index: 0,
        ministryReference: "REFKEEP",
        original,
        edited,
      },
    ];
    const result = await updateEditedPassengersViaKamuPortal({
      companyId: "00000000-0000-4000-8000-000000000001",
      ministrySeferRef: "SEFER1",
      firmaSeferNo: "R1",
      plate: "34ZZZ999",
      startDate: "2026-01-01",
      startTime: "12:00",
      editedExisting: classified,
      fetchImpl,
      verifyWithSoap: false,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.keptRefs.get(0), "REFKEEP");
      assert.equal(result.operations[0]?.operation, KAMU_YOLCU_GUNCELLE_OPERATION);
      assert.equal(result.operations[0]?.reference, "REFKEEP");
    }
  } finally {
    if (prevKey === undefined) delete process.env.UETDS_CREDENTIALS_KEY;
    else process.env.UETDS_CREDENTIALS_KEY = prevKey;
    if (prevPath === undefined) delete process.env.UETDS_KAMU_SESSION_PATH;
    else process.env.UETDS_KAMU_SESSION_PATH = prevPath;
    await rm(dir, { recursive: true, force: true });
  }
});

test("missing session returns kamu-session-required without calling portal", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "uetds-kamu-"));
  const key = randomBytes(32).toString("hex");
  const prevKey = process.env.UETDS_CREDENTIALS_KEY;
  const prevPath = process.env.UETDS_KAMU_SESSION_PATH;
  process.env.UETDS_CREDENTIALS_KEY = key;
  process.env.UETDS_KAMU_SESSION_PATH = path.join(dir, "missing.sealed");
  process.env.EXPECTED_DATABASE = "tripetica_dev";
  let called = false;
  try {
    await clearKamuPortalSession({
      ...process.env,
      EXPECTED_DATABASE: "tripetica_dev",
      UETDS_KAMU_SESSION_PATH: path.join(dir, "missing.sealed"),
    });
    const result = await updateExistingKamuPassenger({
      ministrySeferRef: "1",
      matchIdentityNumber: "x",
      passenger: {
        key: "k",
        nationality: "TR",
        identityType: "tc",
        identityNumber: "x",
        firstName: "A",
        lastName: "B",
        gender: "male",
        ministryReference: "r",
        provenance: {
          nationality: "user",
          identityNumber: "user",
          firstName: "user",
          lastName: "user",
          gender: "user",
        },
      },
      fetchImpl: async () => {
        called = true;
        return { url: "", status: 200, finalUrl: "", html: "" };
      },
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error, "kamu-session-required");
    }
    assert.equal(called, false);
  } finally {
    if (prevKey === undefined) delete process.env.UETDS_CREDENTIALS_KEY;
    else process.env.UETDS_CREDENTIALS_KEY = prevKey;
    if (prevPath === undefined) delete process.env.UETDS_KAMU_SESSION_PATH;
    else process.env.UETDS_KAMU_SESSION_PATH = prevPath;
    await rm(dir, { recursive: true, force: true });
  }
});
