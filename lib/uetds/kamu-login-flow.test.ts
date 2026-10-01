import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { captchaConsensus, captchaTextFromModel, voteKamuCaptcha } from "@/lib/uetds/kamu-captcha-read";
import { chromiumExecutable } from "@/lib/uetds/kamu-login-browser";
import { fitKamuFrameJpeg, jpegSize, kamuFrameUsesFullPage } from "@/lib/uetds/kamu-login-frame";
import {
  classifyKamuLoginPage,
  continueAfterMobileApproval,
  lunaStageErrorNote,
  isPendingAuthDocument,
  isSupersededPageFetch,
  matchPortalFirm,
  resolvePostLoginPage,
  runObservedKamuLogin,
  submitLoginAfterCaptcha,
  type KamuLoginControls,
  type KamuPortalCompany,
} from "@/lib/uetds/kamu-login-flow";
import {
  closeKamuLoginSession,
  inputKamuLoginSession,
  kamuLoginDevAllowed,
  openKamuLoginSession,
  readKamuLoginSession,
  resetKamuLoginSessionsForTests,
  setKamuLoginControl,
} from "@/lib/uetds/kamu-login-session";

const LOGIN_HTML = `<form id="loginForm"><label for="tridField">T.C. Kimlik No</label><input id="tridField" name="tridField"><label for="egpField">e-Devlet Şifresi</label><input id="egpField" name="egpField" type="password"><button name="submitButton" type="submit">Giriş Yap</button></form>`;
const CAPTCHA_HTML = `${LOGIN_HTML}<img class="captchaImage" alt="">`;
const TWO_FACTOR_HTML = `<h3>İki Aşamalı Giriş Onay</h3><strong>Mobil Onay</strong>`;
const WEB_APPROVAL_HTML = `<h3 class="main-title"><strong>e-Devlet Kapısı Kamu Uygulamalar Merkezi Uygulamasına Giriş Yapıyorsunuz.</strong></h3><form id="loginForm" action="AuthorizationController/SaveScope"><button class="btn btn-cancel" name="btn" type="submit" value="İptal">İptal</button><button class="btn btn-send" name="btn" type="submit" value="Onayla">Onayla</button></form>`;
const PORTAL_MENUS = `<a href="/">Ana Sayfa</a><a href="http://www.turkiye.gov.tr">e-Devlet Kapısı</a><a href="/index?page=hizmet-listesi">e-Hizmetler</a><a href="/index?page=hizmet-listesi-g2g">Servis Paylaşımları</a><a href="#">Kurum Uygulamaları</a>`;
const PORTAL_HOME_HTML = `<div id="headLinks"><strong>Yetkili</strong> | <a href="/index?page=logout">Çıkış</a></div><h2>Kamu Uygulamaları Merkezi'ne Hoş Geldiniz..</h2>${PORTAL_MENUS}`;
const PUBLIC_LANDING_HTML = `<div id="headLinks"><a href="https://giris.turkiye.gov.tr/OAuth2AuthorizationServer/AuthorizationController">Sisteme Giriş</a></div>${PORTAL_MENUS}`;
const GATE_HTML = `<a href="/giris">Kimliğimi Şimdi Doğrula</a>`;
const SERVICE_LIST_HTML = `<a href="/UAB_TARIFESIZ?page=tarifesiz-yolcu-tasimaciligi-islemleri">UETDS Tarifesiz Yolcu Taşımacılığı Bildirim İşlemleri</a>`;
const FIRM_NAME = "SEARCH TRAVEL AGENCY TURİZM TAŞIMACILIK TİCARET LİMİTED ŞİRKETİ";
const OTHER_FIRM = "ÖRNEK TAŞIMACILIK LİMİTED ŞİRKETİ";
const FIRM_HTML = `<form method="POST" action="/UAB_TARIFESIZ?page=tarifesiz-yolcu-tasimaciligi-islemleri&submit"><select name="firma" id="firma"><option value="">Seçiniz</option><option value="1046786" selected="selected">${FIRM_NAME}</option></select><input class="submitButton" type="submit" value="Devam Et" /></form>`;
const TRIP_LIST_HTML = `<h2>UETDS Tarifesiz Yolcu Taşımacılığı Bildirim İşlemleri</h2><th>Firma Sefer No</th><a href="/UAB_TARIFESIZ?asama=seferDetay&index=1">detay</a>`;
const TRIP_LIST_URL = "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?page=tarifesiz-yolcu-tasimaciligi-islemleri&asama=seferListesi";
const COMPANY: KamuPortalCompany = {
  legalName: FIRM_NAME,
  shortName: "SEARCH TRAVEL",
  taxNumber: "0000000000",
  authorityDocumentType: "D2",
  authorityDocumentNumber: "D2-000",
};

function page(start: { url: string; html: string }) {
  const calls: string[] = [];
  let current = { ...start };
  const controls = {
    calls,
    url: async () => current.url,
    html: async () => current.html,
    goto: async (url: string) => {
      calls.push(`goto:${url}`);
      current = { url, html: start.html };
    },
    clickGate: async () => {
      calls.push("gate");
      current = { url: "https://giris.turkiye.gov.tr/Giris/gir", html: LOGIN_HTML };
      return true;
    },
    clickPublicLogin: async (): Promise<"ok" | "public_login_link_missing" | "public_login_click_failed" | "public_login_navigation_failed"> => {
      calls.push("public-login");
      current = { url: "https://giris.turkiye.gov.tr/Giris/gir", html: CAPTCHA_HTML };
      return "ok";
    },
    clickEHizmetler: async () => {
      calls.push("e-hizmetler");
      current = { url: "https://kamu.turkiye.gov.tr/index?page=hizmet-listesi", html: SERVICE_LIST_HTML };
      return "ok" as const;
    },
    clickTarifesizNotification: async () => {
      calls.push("tarifesiz");
      current = { url: "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?page=tarifesiz-yolcu-tasimaciligi-islemleri", html: FIRM_HTML };
      return "ok" as const;
    },
    readFirmOptions: async () => [{ value: "1046786", label: FIRM_NAME, selected: true }],
    chooseFirm: async (value: string) => {
      calls.push(`choose:${value}`);
      return true;
    },
    submitFirmContinue: async () => {
      calls.push("devam");
      current = { url: TRIP_LIST_URL, html: TRIP_LIST_HTML };
      return "ok" as const;
    },
    hasIdentityField: async () => /tridField/.test(current.html),
    hasCaptcha: async () => /captchaImage/.test(current.html),
    fillIdentity: async (value: string) => {
      calls.push(`identity:${value.length}`);
    },
    fillPassword: async (value: string) => {
      calls.push(`password:${value.length}`);
    },
    submitLogin: async () => {
      calls.push("submit");
      current = { url: "https://giris.turkiye.gov.tr/Giris/e-Devlet-Sifresi", html: TWO_FACTOR_HTML };
    },
    confirmWebApproval: async () => {
      calls.push("approve");
      current = { url: "https://kamu.turkiye.gov.tr/", html: PORTAL_HOME_HTML };
      return true;
    },
    press: async (key: string) => {
      calls.push(`key:${key}`);
    },
    scroll: async (direction: "up" | "down") => {
      calls.push(`scroll:${direction}`);
    },
    setViewport: async () => {
      calls.push("viewport");
    },
    screenshot: async () => Buffer.from("jpeg"),
    close: async () => {
      calls.push("close");
    },
  };
  return { controls: controls satisfies KamuLoginControls & typeof controls, get current() { return current; }, setHtml(html: string) { current = { ...current, html }; } };
}

test("login page and two-factor markers come from the observed portal HTML", () => {
  assert.equal(classifyKamuLoginPage({ url: "https://giris.turkiye.gov.tr/Giris/gir", html: LOGIN_HTML }), "login_page");
  assert.equal(classifyKamuLoginPage({ url: "https://giris.turkiye.gov.tr/Giris/e-Devlet-Sifresi", html: TWO_FACTOR_HTML }), "two_factor");
  assert.equal(classifyKamuLoginPage({ url: "https://kamu.turkiye.gov.tr/", html: GATE_HTML }), "gate");
  assert.equal(classifyKamuLoginPage({ url: "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?asama=yolcuListesi", html: "" }), "passenger_list");
  assert.equal(classifyKamuLoginPage({ url: "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?asama=yeniYolcu&flush", html: "" }), "blocked");
});

test("an unauthenticated Kamu home clicks Sisteme Giriş, fills the form, and stops at captcha", async () => {
  const fake = page({ url: "https://kamu.turkiye.gov.tr/", html: PUBLIC_LANDING_HTML });
  const result = await runObservedKamuLogin(fake.controls, { identity: "10000000146", password: "plain-password-value" });
  assert.equal(result.phase, "captcha_required");
  assert.equal(result.error, null);
  assert.equal(fake.controls.calls.includes("public-login"), true);
  assert.equal(fake.controls.calls.includes("gate"), false);
  assert.equal(fake.controls.calls.includes("submit"), false);
  assert.equal(fake.controls.calls.includes("approve"), false);
  assert.equal(JSON.stringify(result).includes("plain-password-value"), false);
  assert.equal(JSON.stringify(result).includes("10000000146"), false);
});

test("a reset while the public home is already visible still opens Sisteme Giriş", async () => {
  const fake = page({ url: "https://kamu.turkiye.gov.tr/", html: PUBLIC_LANDING_HTML });
  fake.controls.goto = async () => {
    fake.controls.calls.push("goto:reset");
    throw new Error("net::ERR_CONNECTION_RESET");
  };
  const result = await runObservedKamuLogin(fake.controls, { identity: "10000000146", password: "plain-password-value" });
  assert.equal(result.phase, "captcha_required");
  assert.equal(result.error, null);
  assert.equal(fake.controls.calls.includes("public-login"), true);
  assert.equal(fake.controls.calls.includes("submit"), false);
});

test("a late Giriş navigation still stops at captcha after the click wait rejects", async () => {
  const fake = page({ url: "https://kamu.turkiye.gov.tr/", html: PUBLIC_LANDING_HTML });
  fake.controls.clickPublicLogin = async () => {
    fake.controls.calls.push("public-login");
    fake.setHtml(CAPTCHA_HTML);
    fake.current.url = "https://giris.turkiye.gov.tr/Giris/gir";
    return "public_login_navigation_failed";
  };
  const result = await runObservedKamuLogin(fake.controls, { identity: "10000000146", password: "plain-password-value" });
  assert.equal(result.phase, "captcha_required");
  assert.equal(result.error, null);
  assert.equal(fake.controls.calls.includes("submit"), false);
});

test("a missing Sisteme Giriş link reports its own code and does not fill credentials", async () => {
  const fake = page({ url: "https://kamu.turkiye.gov.tr/", html: PUBLIC_LANDING_HTML });
  fake.controls.clickPublicLogin = async () => {
    fake.controls.calls.push("public-login");
    return "public_login_link_missing";
  };
  const result = await runObservedKamuLogin(fake.controls, { identity: "10000000146", password: "plain-password-value" });
  assert.equal(result.phase, "page_changed");
  assert.equal(result.error, "public_login_link_missing");
  assert.equal(fake.controls.calls.some((call) => call.startsWith("identity:")), false);
  assert.equal(fake.controls.calls.some((call) => call.startsWith("password:")), false);
});

test("captcha stops before submit and does not put the password in the result", async () => {
  const fake = page({ url: "https://kamu.turkiye.gov.tr/", html: CAPTCHA_HTML });
  fake.controls.goto = async () => undefined;
  const result = await runObservedKamuLogin(fake.controls, { identity: "10000000146", password: "plain-password-value" });
  assert.equal(result.phase, "captcha_required");
  assert.equal(fake.controls.calls.includes("submit"), false);
  assert.equal(JSON.stringify(result).includes("plain-password-value"), false);
  assert.equal(JSON.stringify(result).includes("10000000146"), false);
});

test("web Onayla after phone approval is not the waiting screen", () => {
  const scope = `<p>İki Aşamalı Giriş: Açık</p><form><input type="submit" value="Onayla"><button type="submit" value="İptal">İptal</button></form>`;
  assert.equal(classifyKamuLoginPage({ url: "https://giris.turkiye.gov.tr/OAuth2AuthorizationServer/AuthorizationController", html: scope }), "web_approval");
  assert.equal(classifyKamuLoginPage({ url: "https://giris.turkiye.gov.tr/Giris/e-Devlet-Sifresi", html: TWO_FACTOR_HTML }), "two_factor");
});

test("a detached Onayla click is rechecked and does not become portal_update_failed", async () => {
  const fake = page({ url: "https://giris.turkiye.gov.tr/OAuth2AuthorizationServer/AuthorizationController", html: WEB_APPROVAL_HTML });
  let moved = false;
  const readHtml = fake.controls.html;
  const readUrl = fake.controls.url;
  fake.controls.confirmWebApproval = async () => {
    fake.controls.calls.push("approve");
    moved = true;
    throw new Error("Execution context was destroyed, most likely because of a navigation");
  };
  fake.controls.html = async () => {
    if (fake.controls.calls.includes("e-hizmetler")) return readHtml();
    return moved ? PORTAL_HOME_HTML : WEB_APPROVAL_HTML;
  };
  fake.controls.url = async () => {
    if (fake.controls.calls.includes("e-hizmetler") || fake.controls.calls.includes("tarifesiz") || fake.controls.calls.includes("devam")) return readUrl();
    return moved ? "https://kamu.turkiye.gov.tr/" : "https://giris.turkiye.gov.tr/OAuth2AuthorizationServer/AuthorizationController";
  };
  let clock = 0;
  const result = await continueAfterMobileApproval(fake.controls, {
    timeoutMs: 5000,
    intervalMs: 10,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    company: COMPANY,
  });
  assert.equal(result.phase, "trip_list_ready");
  assert.equal(result.error, null);
  assert.equal(JSON.stringify(result).includes("portal_update_failed"), false);
  assert.deepEqual(fake.controls.calls.filter((call) => call === "approve"), ["approve"]);
});

test("the observed web approval and portal home are distinct from a passenger edit", () => {
  assert.equal(classifyKamuLoginPage({ url: "https://giris.turkiye.gov.tr/OAuth2AuthorizationServer/AuthorizationController", html: WEB_APPROVAL_HTML }), "web_approval");
  assert.equal(classifyKamuLoginPage({ url: "https://kamu.turkiye.gov.tr/", html: PORTAL_HOME_HTML }), "portal_home");
  assert.equal(classifyKamuLoginPage({ url: "https://kamu.turkiye.gov.tr/", html: PUBLIC_LANDING_HTML }), "public_landing");
  assert.equal(classifyKamuLoginPage({ url: "https://kamu.turkiye.gov.tr/", html: PORTAL_MENUS }), "unexpected");
  assert.equal(classifyKamuLoginPage({ url: "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?asama=yolcuListesi", html: PORTAL_HOME_HTML }), "passenger_list");
  assert.equal(classifyKamuLoginPage({ url: "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?asama=seferDetay&index=1", html: PORTAL_HOME_HTML }), "blocked");
});

test("a public Kamu landing after web approval is not treated as a signed-in home", async () => {
  const fake = page({ url: "https://giris.turkiye.gov.tr/OAuth2AuthorizationServer/AuthorizationController", html: WEB_APPROVAL_HTML });
  fake.controls.confirmWebApproval = async () => {
    fake.controls.calls.push("approve");
    return true;
  };
  fake.controls.html = async () => (fake.controls.calls.includes("approve") ? PUBLIC_LANDING_HTML : WEB_APPROVAL_HTML);
  fake.controls.url = async () => (fake.controls.calls.includes("approve") ? "https://kamu.turkiye.gov.tr/" : "https://giris.turkiye.gov.tr/OAuth2AuthorizationServer/AuthorizationController");
  let clock = 0;
  const result = await continueAfterMobileApproval(fake.controls, {
    timeoutMs: 1000,
    intervalMs: 10,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
  });
  assert.equal(result.phase, "page_changed");
  assert.equal(result.error, "session_lost_after_web_approval");
});

test("Giriş Yap keeps the same document when the click reports a navigation error", async () => {
  const fake = page({ url: "https://giris.turkiye.gov.tr/Giris/gir", html: LOGIN_HTML });
  let submitted = false;
  fake.controls.submitLogin = async () => {
    fake.controls.calls.push("submit");
    submitted = true;
    throw new Error("Execution context was destroyed");
  };
  fake.controls.html = async () => (submitted ? TWO_FACTOR_HTML : LOGIN_HTML);
  fake.controls.url = async () => (submitted ? "https://giris.turkiye.gov.tr/Giris/e-Devlet-Sifresi" : "https://giris.turkiye.gov.tr/Giris/gir");
  const result = await submitLoginAfterCaptcha(fake.controls);
  assert.equal(result.phase, "two_factor");
  assert.equal(result.error, null);
  assert.deepEqual(fake.controls.calls.filter((call) => call === "submit"), ["submit"]);
});

test("mobile approval stays on the same page until Onayla, then stops at the portal home", async () => {
  const fake = page({ url: "https://giris.turkiye.gov.tr/Giris/e-Devlet-Sifresi", html: TWO_FACTOR_HTML });
  let reads = 0;
  fake.controls.html = async () => {
    if (fake.controls.calls.includes("e-hizmetler")) return fake.current.html;
    if (fake.controls.calls.includes("approve")) return PORTAL_HOME_HTML;
    reads += 1;
    return reads < 3 ? TWO_FACTOR_HTML : WEB_APPROVAL_HTML;
  };
  let clock = 0;
  const result = await continueAfterMobileApproval(fake.controls, {
    timeoutMs: 5000,
    intervalMs: 10,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    company: COMPANY,
  });
  assert.equal(result.phase, "trip_list_ready");
  assert.equal(result.error, null);
  assert.equal(result.firmLabel, FIRM_NAME);
  assert.deepEqual(fake.controls.calls.filter((call) => call === "approve"), ["approve"]);
  assert.equal(fake.controls.calls.includes("e-hizmetler"), true);
  assert.equal(fake.controls.calls.includes("tarifesiz"), true);
  assert.equal(fake.controls.calls.includes("devam"), true);
  assert.equal(fake.controls.calls.some((call) => call.startsWith("choose:")), false);
  assert.equal(fake.controls.calls.some((call) => call.includes("seferDetay")), false);
  assert.equal(fake.controls.calls.some((call) => call.startsWith("goto")), false);
  assert.equal(fake.controls.calls.includes("submit"), false);
  assert.equal(JSON.stringify(result).includes("Onayla"), false);
});

test("a mobile approval that never leaves the phone screen reports a timeout code", async () => {
  const fake = page({ url: "https://giris.turkiye.gov.tr/Giris/e-Devlet-Sifresi", html: TWO_FACTOR_HTML });
  let clock = 0;
  const result = await continueAfterMobileApproval(fake.controls, {
    timeoutMs: 30,
    intervalMs: 10,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
  });
  assert.equal(result.phase, "timeout");
  assert.equal(result.error, "mobile_approval_timeout");
  assert.equal(fake.controls.calls.includes("approve"), false);
});

test("the login session keeps its context while mobile approval continues to the portal home", async () => {
  resetKamuLoginSessionsForTests();
  const fake = page({ url: "https://giris.turkiye.gov.tr/Giris/e-Devlet-Sifresi", html: TWO_FACTOR_HTML });
  let reads = 0;
  fake.controls.html = async () => {
    if (fake.controls.calls.includes("e-hizmetler")) return fake.current.html;
    if (fake.controls.calls.includes("approve")) return PORTAL_HOME_HTML;
    reads += 1;
    return reads < 2 ? TWO_FACTOR_HTML : WEB_APPROVAL_HTML;
  };
  const opened = await openKamuLoginSession({
    ownerKey: "partner:test",
    notificationId: "n1",
    authorityId: "a1",
    viewport: "mobile",
    company: COMPANY,
    controls: fake.controls,
    login: async () => ({ phase: "two_factor", error: null }),
  });
  const deadline = Date.now() + 4000;
  let latest = opened;
  while (Date.now() < deadline && latest.phase !== "trip_list_ready") {
    await new Promise((resolve) => setTimeout(resolve, 200));
    latest = readKamuLoginSession(opened.sessionId, "partner:test") ?? latest;
  }
  assert.equal(latest.phase, "trip_list_ready");
  assert.equal(latest.error, null);
  assert.equal(latest.firmLabel, FIRM_NAME);
  assert.equal(latest.contextId, opened.contextId);
  assert.deepEqual(fake.controls.calls.filter((call) => call === "approve"), ["approve"]);
  await closeKamuLoginSession(opened.sessionId, "partner:test");
});

test("a reached two-factor page is not followed into a portal edit", async () => {
  const fake = page({ url: "https://giris.turkiye.gov.tr/Giris/gir", html: LOGIN_HTML });
  const result = await runObservedKamuLogin(fake.controls, { identity: "10000000146", password: "plain-password-value" });
  assert.equal(result.phase, "two_factor");
  assert.deepEqual(fake.controls.calls.filter((call) => call === "submit"), ["submit"]);
  const again = await submitLoginAfterCaptcha(fake.controls);
  assert.equal(again.phase, "two_factor");
  assert.equal(fake.controls.calls.filter((call) => call === "submit").length, 1);
});

test("luna does not submit an empty captcha and keeps the same context", async () => {
  resetKamuLoginSessionsForTests();
  const fake = page({ url: "https://giris.turkiye.gov.tr/Giris/gir", html: CAPTCHA_HTML });
  const controls = { ...fake.controls, captchaFilled: async () => false };
  const opened = await openKamuLoginSession({
    ownerKey: "partner:test",
    notificationId: "n1",
    authorityId: "a1",
    viewport: "mobile",
    controls,
    login: async () => ({ phase: "captcha_required", error: null }),
  });
  const returned = await setKamuLoginControl({ sessionId: opened.sessionId, ownerKey: "partner:test", control: "luna" });
  assert.equal(returned?.contextId, opened.contextId);
  assert.equal(returned?.phase, "captcha_required");
  assert.equal(returned?.control, "human");
  assert.equal(returned?.error, "captcha_empty");
  assert.equal(fake.controls.calls.includes("submit"), false);
  await closeKamuLoginSession(opened.sessionId, "partner:test");
});

test("human takeover keeps the same browser context and can return control", async () => {
  resetKamuLoginSessionsForTests();
  const fake = page({ url: "https://giris.turkiye.gov.tr/Giris/gir", html: CAPTCHA_HTML });
  const opened = await openKamuLoginSession({
    ownerKey: "partner:test",
    notificationId: "n1",
    authorityId: "a1",
    viewport: "mobile",
    controls: fake.controls,
    login: async () => ({ phase: "captcha_required", error: null }),
  });
  assert.equal(opened.control, "human");
  assert.equal(opened.viewport, "mobile");
  const contextId = opened.contextId;
  const typed = await inputKamuLoginSession({ sessionId: opened.sessionId, ownerKey: "partner:test", kind: "key", key: "A" });
  assert.equal(typed?.contextId, contextId);
  const desktop = await inputKamuLoginSession({ sessionId: opened.sessionId, ownerKey: "partner:test", kind: "viewport", viewport: "desktop" });
  assert.equal(desktop?.contextId, contextId);
  assert.equal(desktop?.viewport, "desktop");
  fake.setHtml(LOGIN_HTML);
  const returned = await setKamuLoginControl({ sessionId: opened.sessionId, ownerKey: "partner:test", control: "luna" });
  assert.equal(returned?.contextId, contextId);
  assert.equal(returned?.phase, "two_factor");
  assert.equal(returned?.control, "luna");
  await closeKamuLoginSession(opened.sessionId, "partner:test");
  assert.equal(fake.controls.calls.includes("close"), true);
});

test("a thrown login read keeps the same context when two-factor is already on the page", async () => {
  resetKamuLoginSessionsForTests();
  const fake = page({ url: "https://giris.turkiye.gov.tr/Giris/e-Devlet-Sifresi", html: TWO_FACTOR_HTML });
  const opened = await openKamuLoginSession({
    ownerKey: "partner:test",
    notificationId: "n1",
    authorityId: "a1",
    viewport: "mobile",
    controls: fake.controls,
    login: async () => {
      throw new Error("navigating");
    },
  });
  assert.equal(opened.phase, "two_factor");
  assert.equal(opened.error, null);
  assert.equal(opened.contextId.length > 0, true);
  await closeKamuLoginSession(opened.sessionId, "partner:test");
});

test("a thrown login read that lands on Sisteme Giriş is not stored as login_failed", async () => {
  resetKamuLoginSessionsForTests();
  const fake = page({ url: "https://kamu.turkiye.gov.tr/", html: PUBLIC_LANDING_HTML });
  const opened = await openKamuLoginSession({
    ownerKey: "partner:test",
    notificationId: "n1",
    authorityId: "a1",
    viewport: "mobile",
    controls: fake.controls,
    login: async () => {
      throw new Error("navigating");
    },
  });
  assert.equal(opened.phase, "page_changed");
  assert.equal(opened.error, "unexpected_public_landing");
  assert.notEqual(opened.phase, "portal_home");
  await closeKamuLoginSession(opened.sessionId, "partner:test");
});

test("the correct selected firm continues without a new choice, and a wrong selection is replaced", async () => {
  const selected = await continueAfterMobileApproval(page({ url: "https://kamu.turkiye.gov.tr/", html: PORTAL_HOME_HTML }).controls, {
    timeoutMs: 1000,
    intervalMs: 10,
    now: () => 0,
    sleep: async () => undefined,
    company: COMPANY,
  });
  assert.equal(selected.phase, "trip_list_ready");
  assert.equal(selected.firmLabel, FIRM_NAME);

  const wrong = page({ url: "https://kamu.turkiye.gov.tr/", html: PORTAL_HOME_HTML });
  wrong.controls.readFirmOptions = async () => [
    { value: "1", label: OTHER_FIRM, selected: true },
    { value: "1046786", label: FIRM_NAME, selected: false },
  ];
  const replaced = await continueAfterMobileApproval(wrong.controls, {
    timeoutMs: 1000,
    intervalMs: 10,
    now: () => 0,
    sleep: async () => undefined,
    company: COMPANY,
  });
  assert.equal(replaced.phase, "trip_list_ready");
  assert.deepEqual(wrong.controls.calls.filter((call) => call.startsWith("choose:")), ["choose:1046786"]);
  assert.equal(wrong.controls.calls.includes("devam"), true);
  assert.equal(wrong.controls.calls.some((call) => call.includes("seferDetay")), false);
});

test("a notification firm that is missing or ambiguous stops before Devam Et", async () => {
  const missing = page({ url: "https://kamu.turkiye.gov.tr/", html: PORTAL_HOME_HTML });
  missing.controls.readFirmOptions = async () => [{ value: "1", label: OTHER_FIRM, selected: true }];
  const missed = await continueAfterMobileApproval(missing.controls, {
    timeoutMs: 1000,
    intervalMs: 10,
    now: () => 0,
    sleep: async () => undefined,
    company: COMPANY,
  });
  assert.equal(missed.error, "firm_not_found");
  assert.equal(missing.controls.calls.includes("devam"), false);

  const ambiguous = matchPortalFirm([
    { value: "1", label: FIRM_NAME, selected: true },
    { value: "2", label: `${FIRM_NAME} LTD.`, selected: false },
  ], COMPANY);
  assert.equal(ambiguous.ok, false);
  if (!ambiguous.ok) assert.equal(ambiguous.reason, "firm_ambiguous");
});

test("the sefer list is recognized from its url and column, and a passenger edit url stays blocked", () => {
  assert.equal(classifyKamuLoginPage({ url: TRIP_LIST_URL, html: TRIP_LIST_HTML }), "trip_list");
  assert.equal(classifyKamuLoginPage({ url: "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?asama=seferDetay&index=1", html: TRIP_LIST_HTML }), "blocked");
  assert.equal(isSupersededPageFetch(new TypeError("Load failed")), true);
  assert.equal(isSupersededPageFetch(new TypeError("Failed to fetch")), true);
  assert.equal(isSupersededPageFetch(new Error("Load failed")), false);
});

test("a navigation read failure while approval continues does not become login_failed", async () => {
  const fake = page({ url: "https://giris.turkiye.gov.tr/Giris/e-Devlet-Sifresi", html: TWO_FACTOR_HTML });
  let reads = 0;
  fake.controls.html = async () => {
    reads += 1;
    if (reads === 1) throw new Error("Execution context was destroyed");
    if (fake.controls.calls.includes("e-hizmetler")) return fake.current.html;
    if (fake.controls.calls.includes("approve")) return PORTAL_HOME_HTML;
    return reads < 3 ? TWO_FACTOR_HTML : WEB_APPROVAL_HTML;
  };
  let clock = 0;
  const result = await continueAfterMobileApproval(fake.controls, {
    timeoutMs: 5000,
    intervalMs: 10,
    now: () => clock,
    sleep: async (ms) => {
      clock += ms;
    },
    company: COMPANY,
  });
  assert.equal(result.phase, "trip_list_ready");
  assert.equal(result.error, null);
  assert.notEqual(result.error, "login_failed");
});

test("luna reads the captcha onto the keyboard and submits only after Enter", async () => {
  resetKamuLoginSessionsForTests();
  const fake = page({ url: "https://giris.turkiye.gov.tr/Giris/gir", html: CAPTCHA_HTML });
  const controls = fake.controls as typeof fake.controls & {
    readCaptcha?: () => Promise<string | null>;
    fillCaptcha?: (value: string) => Promise<boolean>;
  };
  controls.readCaptcha = async () => {
    controls.calls.push("read-captcha");
    return "Ab12";
  };
  controls.fillCaptcha = async (value: string) => {
    controls.calls.push(`fill-captcha:${value.length}`);
    return value.length === 4;
  };
  const opened = await openKamuLoginSession({
    ownerKey: "partner:test",
    notificationId: "n1",
    authorityId: "a1",
    viewport: "mobile",
    controls: fake.controls,
    login: async () => ({ phase: "captcha_required", error: null }),
  });
  const deadline = Date.now() + 3000;
  let latest = opened;
  while (Date.now() < deadline && latest.captchaDraft !== "Ab12") {
    await new Promise((resolve) => setTimeout(resolve, 50));
    latest = readKamuLoginSession(opened.sessionId, "partner:test") ?? latest;
  }
  assert.equal(latest.phase, "captcha_required");
  assert.equal(latest.captchaDraft, "Ab12");
  assert.equal(fake.controls.calls.includes("submit"), false);
  const confirmed = await inputKamuLoginSession({
    sessionId: opened.sessionId,
    ownerKey: "partner:test",
    kind: "captcha",
    captcha: "Ab12",
  });
  assert.equal(confirmed?.phase, "two_factor");
  assert.equal(confirmed?.captchaDraft, null);
  assert.equal(fake.controls.calls.includes("read-captcha"), true);
  assert.deepEqual(fake.controls.calls.filter((call) => call.startsWith("fill-captcha:")), ["fill-captcha:4", "fill-captcha:4"]);
  assert.equal(fake.controls.calls.includes("submit"), true);
  assert.equal(JSON.stringify(confirmed).includes("Ab12"), false);
  assert.equal(captchaTextFromModel({ code: " ab-12 " }), "ab12");
  assert.equal(captchaTextFromModel({ code: "??" }), null);
  assert.equal(captchaConsensus(["Ab12", "Ab12"]), "Ab12");
  assert.equal(captchaConsensus(["Ab12", "ab12"]), "Ab12");
  assert.equal(captchaConsensus(["Ab12", "Cd34", "Ab12"]), "Ab12");
  assert.equal(captchaConsensus(["Ab12", "Cd34", "Ef56"]), "Ab12");
  await closeKamuLoginSession(opened.sessionId, "partner:test");
});

test("five reads of the same captcha image choose the majority and do not submit", async () => {
  const image = Buffer.alloc(40, 1);
  const samples = ["AB7KQ", "AB7KQ", "A87KQ", "AB7KQ", "AB7KO"];
  let calls = 0;
  const code = await voteKamuCaptcha(image, async (bytes) => {
    calls += 1;
    assert.equal(bytes, image);
    return samples[calls - 1] ?? null;
  });
  assert.equal(calls, 5);
  assert.equal(code, "AB7KQ");
  assert.equal(captchaConsensus(["ABC12", "ABCI2", "ABC12", "ABCI2", "ABCl2"]), "ABC12");
  assert.equal(captchaConsensus([
    { code: "ABC12", confidence: 0.2 },
    { code: "ABCI2", confidence: 0.9 },
    { code: "ABC12", confidence: 0.3 },
    { code: "ABCI2", confidence: 0.8 },
    { code: "ABCl2", confidence: 0.1 },
  ]), "ABCI2");
  assert.equal(captchaConsensus([null, null, "ZX81", null, null]), "ZX81");
  assert.equal(captchaConsensus([null, null, null, null, null]), null);
  const reader = readFileSync("lib/uetds/kamu-captcha-read.ts", "utf8");
  assert.doesNotMatch(reader, /waitForTimeout|page\.reload|submitLogin/);
  const browser = readFileSync("lib/uetds/kamu-login-browser.ts", "utf8");
  const readCaptcha = browser.slice(browser.indexOf("readCaptcha:"), browser.indexOf("clickEHizmetler:"));
  assert.match(readCaptcha, /voteKamuCaptcha\(bytes\)/);
  assert.equal(readCaptcha.match(/screenshot\(/g)?.length, 1);
  assert.doesNotMatch(readCaptcha, /reload|waitForTimeout|submitLogin|keyboard\.press\("Enter"\)/);
  const session = readFileSync("lib/uetds/kamu-login-session.ts", "utf8");
  const prepare = session.slice(session.indexOf("async function prepareCaptchaReview"), session.indexOf("async function confirmCaptcha"));
  assert.match(prepare, /readCaptcha\?\.\(\)/);
  assert.doesNotMatch(prepare, /submitLoginAfterCaptcha|press\("Enter"\)/);
});

test("login session code stays off production and out of the client bundle", () => {
  const env = process.env as { NODE_ENV?: string };
  const previous = env.NODE_ENV;
  env.NODE_ENV = "production";
  assert.equal(kamuLoginDevAllowed(), false);
  env.NODE_ENV = previous;
  const prodChrome = "/var/lib/tripetica-prod/pw-browsers/chromium-1243/chrome-linux64/chrome";
  assert.equal(
    chromiumExecutable({ NODE_ENV: "production", TRIPETICA_CHROMIUM: "/var/lib/tripetica-dev/pw-browsers/chromium-1243/chrome-linux64/chrome" }, (path) => path === prodChrome || path.includes("tripetica-dev")),
    prodChrome,
  );
  assert.equal(
    chromiumExecutable({ NODE_ENV: "production" }, (path) => path === prodChrome),
    prodChrome,
  );
  assert.equal(
    chromiumExecutable({ NODE_ENV: "development" }, (path) => path.includes("tripetica-dev")),
    "/var/lib/tripetica-dev/pw-browsers/chromium-1243/chrome-linux64/chrome",
  );
  const browser = readFileSync("lib/uetds/kamu-login-browser.ts", "utf8");
  const workspace = readFileSync("components/uetds/ai-edit-luna-workspace.tsx", "utf8");
  const actions = readFileSync("lib/uetds/kamu-login-actions.ts", "utf8");
  assert.match(browser, /locator\("#tridField"\)/);
  assert.match(browser, /locator\("#egpField"\)/);
  assert.match(browser, /getByRole\("button", \{ name: KAMU_LOGIN_TARGETS\.submitName \}\)/);
  assert.match(browser, /locator\("#headLinks"\)\.getByRole\("link", \{ name: "Sisteme Giriş", exact: true \}\)/);
  assert.match(browser, /locator\("#left #mainMenu"\)\.getByRole\("link", \{ name: "e-Hizmetler", exact: true \}\)/);
  assert.match(browser, /isBlockedPortalUrl/);
  assert.match(readFileSync("lib/uetds/kamu-login-flow.ts", "utf8"), /yolcuIndex=\\d\+/);
  assert.match(workspace, /isSupersededPageFetch/);
  assert.match(workspace, /frameBusy/);
  assert.doesNotMatch(workspace, /catch\s*\{\s*\}/);
  assert.match(workspace, /Güvenlik kodu okunuyor\. Tripetica AI klavyeye yazacak\./);
  assert.match(workspace, /Güvenlik kodu klavyede\. Doğruysa Enter’a basın\. Yanlışsa düzeltip Enter’a basın\./);
  assert.match(workspace, /kind: "captcha"/);
  assert.match(readFileSync("lib/uetds/kamu-captcha-read.ts", "utf8"), /captchaTextFromModel/);
  assert.match(readFileSync("lib/uetds/kamu-captcha-read.ts", "utf8"), /Promise\.all/);
  assert.match(readFileSync("lib/uetds/kamu-captcha-read.ts", "utf8"), /length: 5/);
  assert.doesNotMatch(readFileSync("lib/uetds/kamu-captcha-read.ts", "utf8"), /enlargeCaptcha/);
  assert.match(readFileSync("lib/uetds/kamu-captcha-read.ts", "utf8"), /effort: "low"/);
  assert.doesNotMatch(readFileSync("lib/uetds/kamu-captcha-read.ts", "utf8"), /effort: "high"/);
  assert.doesNotMatch(readFileSync("lib/uetds/kamu-captcha-read.ts", "utf8"), /console\.(log|info|debug)\(/);
  assert.match(browser, /getByRole\("button", \{ name: KAMU_LOGIN_TARGETS\.approveName, exact: true \}\)/);
  assert.match(readFileSync("lib/uetds/kamu-login-flow.ts", "utf8"), /continueAfterMobileApproval/);
  assert.match(workspace, /data-luna-panel/);
  assert.match(workspace, /setPanelOpen/);
  assert.doesNotMatch(browser, /page\.mouse\.click|page\.click\(\d/);
  assert.match(workspace, /\/api\/uetds\/login-frame/);
  assert.doesNotMatch(workspace, /\/api\/dev\//);
  assert.match(readFileSync("app/api/dev/uetds-login-frame/route.ts", "utf8"), /kamuLoginDevAllowed/);
  assert.match(readFileSync("app/api/dev/uetds-edit-dry-run/route.ts", "utf8"), /kamuLoginDevAllowed/);
  const liveUpdate = readFileSync("lib/uetds/kamu-portal/live-update.ts", "utf8");
  assert.match(liveUpdate, /source_data_mismatch/);
  assert.match(liveUpdate, /trip_identity_lost/);
  assert.match(liveUpdate, /flush\/i\.test\(passengerHref\)/);
  assert.match(liveUpdate, /searchParams\.delete\("flush"\)/);
  assert.doesNotMatch(workspace, /unsealSecret|password_sealed|identity_sealed/);
  assert.doesNotMatch(workspace, /scrollLeft/);
  assert.doesNotMatch(workspace, /<img[^>]*onClick/);
  assert.match(readFileSync("components/uetds/ai-edit-luna-workspace.module.css", "utf8"), /overflow-y:\s*auto/);
  assert.match(readFileSync("components/uetds/ai-edit-luna-workspace.module.css", "utf8"), /height:\s*auto/);
  assert.match(readFileSync("components/uetds/ai-edit-luna-workspace.module.css", "utf8"), /pointer-events:\s*none/);
  const frameCss = readFileSync("components/uetds/ai-edit-luna-workspace.module.css", "utf8");
  assert.match(frameCss, /touch-action:\s*pan-y/);
  assert.match(frameCss, /width:\s*100%/);
  assert.match(frameCss, /height:\s*auto/);
  assert.match(frameCss, /max-height:\s*none/);
  assert.doesNotMatch(frameCss, /object-fit:\s*cover/);
  assert.match(browser, /width: 1280, height: 800/);
  assert.doesNotMatch(browser, /width: 390/);
  assert.match(readFileSync("lib/uetds/kamu-login-session.ts", "utf8"), /setViewport\("desktop"\)/);
  assert.match(browser, /fullPage: true/);
  assert.doesNotMatch(browser, /fullPage: false/);
  assert.match(browser, /scrollTop = value/);
  assert.match(actions, /unsealSecret/);
  assert.match(actions, /kamu_login_failed code=/);
  assert.doesNotMatch(actions, /console\.(log|info|debug)\(/);
});

test("a sefer-list sized screenshot is not sent at full height", async () => {
  assert.equal(kamuFrameUsesFullPage(1800), true);
  assert.equal(kamuFrameUsesFullPage(4096), true);
  assert.equal(kamuFrameUsesFullPage(64046), false);
  assert.equal(kamuFrameUsesFullPage(0), false);
  const sharp = (await import("sharp")).default;
  const tall = await sharp({
    create: { width: 40, height: 5000, channels: 3, background: { r: 255, g: 255, b: 255 } },
  }).jpeg().toBuffer();
  assert.equal(jpegSize(tall)?.height, 5000);
  const fitted = await fitKamuFrameJpeg(tall);
  assert.ok(fitted);
  assert.equal(jpegSize(fitted)?.height, 4096);
  assert.ok((jpegSize(fitted)?.width ?? 99) < 40);
  assert.equal(await fitKamuFrameJpeg(Buffer.from("not-a-jpeg")), null);
});

test("a blank redirect or an already open passenger list is not auth_redirect_failed", async () => {
  assert.equal(isPendingAuthDocument({ url: "about:blank", html: "" }), true);
  assert.equal(isPendingAuthDocument({ url: "https://giris.turkiye.gov.tr/Giris/e-Devlet-Sifresi", html: TWO_FACTOR_HTML }), false);
  const blank = page({ url: "about:blank", html: "<html><body></body></html>" });
  let reads = 0;
  blank.controls.url = async () => (reads < 2 ? "about:blank" : "https://giris.turkiye.gov.tr/Giris/e-Devlet-Sifresi");
  blank.controls.html = async () => {
    reads += 1;
    return reads < 2 ? "<html><body></body></html>" : TWO_FACTOR_HTML;
  };
  const waited = await resolvePostLoginPage(blank.controls, { timeoutMs: 5000, sleep: async () => undefined });
  assert.equal(waited.phase, "two_factor");
  assert.equal(waited.error, null);
  const openList = page({
    url: "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?asama=yolcuListesi&index=4",
    html: "<table><tr><td>LY</td><td>11111111111</td><td>SARAH ELHODERI</td><td>Kadın</td></tr></table>",
  });
  openList.controls.goto = async (url: string) => {
    openList.controls.calls.push(`goto:${url}`);
    openList.controls.url = async () => TRIP_LIST_URL;
    openList.controls.html = async () => TRIP_LIST_HTML;
  };
  const listed = await resolvePostLoginPage(openList.controls, { timeoutMs: 5000, sleep: async () => undefined });
  assert.equal(listed.phase, "trip_list_ready");
  assert.equal(listed.error, null);
  assert.equal(JSON.stringify(listed).includes("auth_redirect_failed"), false);
});

test("a portal update failure is not described as an e-Devlet login failure", () => {
  assert.equal(lunaStageErrorNote("portal_update_failed", "e-Devlet girişi tamamlanamadı.", "U-ETDS güncelleme işlemi tamamlanamadı."), "U-ETDS güncelleme işlemi tamamlanamadı. (portal_update_failed)");
  assert.equal(lunaStageErrorNote("frame_failed", "e-Devlet girişi tamamlanamadı.", "U-ETDS güncelleme işlemi tamamlanamadı."), "e-Devlet girişi tamamlanamadı. (frame_failed)");
});
