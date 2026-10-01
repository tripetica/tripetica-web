import { existsSync } from "node:fs";
import { classifyKamuLoginPage, isBlockedPortalUrl, KAMU_LOGIN_TARGETS, type KamuLoginControls } from "@/lib/uetds/kamu-login-flow";
import { mergePortalSeferRows, portalSeferRowFromCells, type PortalSeferRow } from "@/lib/uetds/kamu-portal/edit-plan";
import { isDetachedNavigation, passengerSaveSucceeded } from "@/lib/uetds/kamu-portal/live-update";
import { type KamuLoginViewport } from "@/lib/uetds/kamu-login-session";

const MOBILE_VIEWPORT = { width: 1280, height: 800 };
const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

async function captureFrame(page: import("playwright-core").Page) {
  let top = 0;
  try {
    top = await page.evaluate(() => (document.scrollingElement || document.documentElement).scrollTop);
  } catch (error) {
    if (!isDetachedNavigation(error) && !isDetachedClick(error)) throw error;
  }
  let lastError: unknown = null;
  try {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        return await page.screenshot({ type: "jpeg", quality: 50, fullPage: true });
      } catch (error) {
        lastError = error;
        if (!isDetachedNavigation(error) && !isDetachedClick(error)) break;
        await page.waitForTimeout(300);
      }
    }
    throw lastError instanceof Error ? lastError : new Error("frame_unreadable");
  } finally {
    await page.evaluate((value) => {
      (document.scrollingElement || document.documentElement).scrollTop = value;
    }, top).catch(() => undefined);
  }
}

function isDetachedClick(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : "";
  return /detach|destroyed|navigat|aborted|ERR_ABORTED|not_element/i.test(message);
}

async function clickObservedLink<Missing extends string, Failed extends string>(
  page: import("playwright-core").Page,
  input: {
    locator: import("playwright-core").Locator;
    href: RegExp;
    url: RegExp;
    missing: Missing;
    navigationFailed: Failed;
  },
): Promise<"ok" | Missing | Failed> {
  if ((await input.locator.count()) !== 1) return input.missing;
  const href = await input.locator.getAttribute("href");
  if (!href || !input.href.test(href)) return input.missing;
  const navigated = page.waitForURL(input.url, { timeout: 45000, waitUntil: "domcontentloaded" });
  try {
    await input.locator.evaluate((element) => {
      if (!(element instanceof HTMLElement)) throw new Error("not_element");
      element.click();
    });
  } catch (error) {
    if (!isDetachedClick(error)) return input.missing;
  }
      try {
        await navigated;
      } catch {
        const landed = page.url();
        if (input.url.test(landed)) return "ok" as const;
        return input.navigationFailed;
      }
      return "ok" as const;
}

function viewportSize(viewport: KamuLoginViewport) {
  return viewport === "desktop" ? DESKTOP_VIEWPORT : MOBILE_VIEWPORT;
}

const PROD_CHROMIUM = "/var/lib/tripetica-prod/pw-browsers/chromium-1243/chrome-linux64/chrome";
const DEV_CHROMIUMS = [
  "/var/lib/tripetica-dev/pw-browsers/chromium-1243/chrome-linux64/chrome",
  "/tmp/pw-browsers/chromium-1243/chrome-linux64/chrome",
];

function isDevChromiumPath(path: string) {
  return path.startsWith("/var/lib/tripetica-dev/") || path.startsWith("/tmp/pw-browsers/");
}

export function chromiumExecutable(
  env: Record<string, string | undefined> = process.env,
  exists: (path: string) => boolean = existsSync,
) {
  const configured = env.TRIPETICA_CHROMIUM?.trim() ?? "";
  if (env.NODE_ENV === "production") {
    if (configured && !isDevChromiumPath(configured) && exists(configured)) return configured;
    if (exists(PROD_CHROMIUM)) return PROD_CHROMIUM;
    return "/usr/bin/chromium-browser";
  }
  if (configured && exists(configured)) return configured;
  for (const candidate of DEV_CHROMIUMS) {
    if (exists(candidate)) return candidate;
  }
  return "/usr/bin/chromium-browser";
}

export async function openChromiumLoginControls(viewport: KamuLoginViewport): Promise<
  KamuLoginControls & {
    press(key: string): Promise<void>;
    scroll(direction: "up" | "down"): Promise<void>;
    setViewport(next: KamuLoginViewport): Promise<void>;
    screenshot(): Promise<Buffer>;
    screenshotDocument(): Promise<Buffer>;
    screenshotCaptcha(): Promise<Buffer | null>;
    filledMatches(identity: string, password: string): Promise<{ tc: boolean; password: boolean }>;
    focusCaptcha(): Promise<boolean>;
    captchaFilled(): Promise<boolean>;
    captchaProgress(): Promise<{ length: number; maxLength: number } | null>;
    readCaptcha(): Promise<string | null>;
    fillCaptcha(value: string): Promise<boolean>;
    collectSeferRows(): Promise<PortalSeferRow[]>;
    saveGroupForm(input: { pickup: { provinceName: string; districtName: string } | null; dropoff: { provinceName: string; districtName: string } | null; identityConfirmed?: boolean }): Promise<boolean>;
    savePassengerForm(input: { yolcuIndex: number; nationality: string; documentNumber: string; firstName: string; lastName: string; gender: string }): Promise<boolean>;
    close(): Promise<void>;
  }
> {
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({
    headless: true,
    executablePath: chromiumExecutable(process.env),
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const size = viewportSize(viewport);
  const context = await browser.newContext({
    viewport: size,
    isMobile: viewport === "mobile",
    hasTouch: viewport === "mobile",
    locale: "tr-TR",
  });
  const page = await context.newPage();
  async function captchaField() {
    const near = page.locator(".captchaImage").locator("xpath=following::input[1]");
    if ((await near.count()) > 0) return near.first();
    const labelled = page.getByLabel("Güvenlik Kodu");
    if ((await labelled.count()) > 0) return labelled.first();
    return null;
  }
  await page.route("**/*", (route) => {
    if (isBlockedPortalUrl(route.request().url())) return route.abort();
    return route.continue();
  });
  return {
    url: async () => page.url(),
    html: async () => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          return await page.content();
        } catch (error) {
          const message = error instanceof Error ? error.message : "";
          if (!message.includes("navigating") || attempt === 3) throw error;
          await page.waitForLoadState("domcontentloaded");
        }
      }
      return page.content();
    },
    goto: (url) => page.goto(url, { waitUntil: "domcontentloaded" }).then(() => undefined),
    clickPublicLogin: async () => {
      // Observed header: #headLinks > a[href*="giris.turkiye.gov.tr/.../AuthorizationController"] "Sisteme Giriş"
      const link = page.locator("#headLinks").getByRole("link", { name: "Sisteme Giriş", exact: true });
      if ((await link.count()) !== 1) return "public_login_link_missing";
      const href = await link.getAttribute("href");
      if (!href || !/giris\.turkiye\.gov\.tr/i.test(href) || !/AuthorizationController/i.test(href)) {
        return "public_login_link_missing";
      }
      const navigated = page.waitForURL(/giris\.turkiye\.gov\.tr/, { timeout: 45000, waitUntil: "domcontentloaded" });
      try {
        await link.evaluate((element) => {
          if (!(element instanceof HTMLElement)) throw new Error("not_element");
          element.click();
        });
      } catch {
        return "public_login_click_failed";
      }
      try {
        await navigated;
      } catch {
        const deadline = Date.now() + 8000;
        while (Date.now() < deadline) {
          if (/giris\.turkiye\.gov\.tr/i.test(page.url())) return "ok";
          await page.waitForTimeout(250);
        }
        if (/giris\.turkiye\.gov\.tr/i.test(page.url())) return "ok";
        return "public_login_navigation_failed";
      }
      return "ok";
    },
    clickGate: async () => {
      const gate = page.getByRole("link", { name: KAMU_LOGIN_TARGETS.gate }).or(page.getByRole("button", { name: KAMU_LOGIN_TARGETS.gate }));
      if ((await gate.count()) < 1) return false;
      // The Kamu home lays this link in the page header. A DOM click uses the link.
      const navigated = page.waitForURL(/giris\.turkiye\.gov\.tr/, { timeout: 45000, waitUntil: "domcontentloaded" });
      await gate.first().evaluate((element) => {
        if (element instanceof HTMLElement) element.click();
      });
      await navigated;
      return true;
    },
    hasIdentityField: async () => (await page.locator("#tridField").count()) > 0,
    hasCaptcha: async () => (await page.locator(KAMU_LOGIN_TARGETS.captchaImage).count()) > 0,
    fillIdentity: (value) => page.locator("#tridField").fill(value),
    fillPassword: (value) => page.locator("#egpField").fill(value),
    filledMatches: async (identity: string, password: string) => {
      const tc = await page.locator("#tridField").inputValue();
      const pw = await page.locator("#egpField").inputValue();
      return { tc: tc === identity && /^\d{11}$/.test(tc), password: pw.length > 0 && pw === password };
    },
    focusCaptcha: async () => {
      const field = await captchaField();
      if (!field) return false;
      await field.focus();
      return true;
    },
    captchaFilled: async () => {
      const field = await captchaField();
      if (!field) return false;
      return (await field.inputValue()).trim().length > 0;
    },
    captchaProgress: async () => {
      const field = await captchaField();
      if (!field) return null;
      const value = (await field.inputValue()).trim();
      const maxLength = await field.evaluate((element) => (element instanceof HTMLInputElement ? element.maxLength : -1));
      return { length: value.length, maxLength };
    },
    fillCaptcha: async (value) => {
      const field = await captchaField();
      if (!field) return false;
      await field.fill("");
      await field.fill(value);
      return (await field.inputValue()) === value;
    },
    readCaptcha: async () => {
      const image = page.locator(".captchaImage");
      if ((await image.count()) < 1) return null;
      const bytes = await image.first().screenshot({ type: "png" });
      try {
        const { voteKamuCaptcha } = await import("@/lib/uetds/kamu-captcha-read");
        return await voteKamuCaptcha(bytes);
      } finally {
        bytes.fill(0);
      }
    },
    clickEHizmetler: () => clickObservedLink(page, {
      locator: page.locator("#left #mainMenu").getByRole("link", { name: "e-Hizmetler", exact: true }),
      href: /page=hizmet-listesi/i,
      url: /page=hizmet-listesi/i,
      missing: "service_menu_missing",
      navigationFailed: "service_menu_navigation_failed",
    }),
    clickTarifesizNotification: () => clickObservedLink(page, {
      locator: page.getByRole("link", { name: "UETDS Tarifesiz Yolcu Taşımacılığı Bildirim İşlemleri", exact: true }),
      href: /page=tarifesiz-yolcu-tasimaciligi-islemleri(?!-raporlama)/i,
      url: /page=tarifesiz-yolcu-tasimaciligi-islemleri/i,
      missing: "tarifesiz_link_missing",
      navigationFailed: "tarifesiz_navigation_failed",
    }),
    readFirmOptions: async () => {
      const select = page.locator("select#firma");
      if ((await select.count()) !== 1) return [];
      return select.locator("option").evaluateAll((options) => options.map((option) => {
        const item = option as HTMLOptionElement;
        return {
          value: item.value,
          label: (item.textContent ?? "").replace(/\s+/g, " ").trim(),
          selected: item.selected,
        };
      }));
    },
    chooseFirm: async (value: string) => {
      const select = page.locator("select#firma");
      if ((await select.count()) !== 1) return false;
      await select.selectOption(value);
      return true;
    },
    submitFirmContinue: async () => {
      const button = page.locator("input.submitButton[value='Devam Et']");
      if ((await button.count()) !== 1) return "continue_missing" as const;
      const navigated = page.waitForURL(/asama=seferListesi/i, { timeout: 45000, waitUntil: "domcontentloaded" });
      try {
        await button.evaluate((element) => {
          if (!(element instanceof HTMLElement)) throw new Error("not_element");
          element.click();
        });
      } catch (error) {
        if (!isDetachedClick(error)) return "continue_missing" as const;
      }
      try {
        await navigated;
      } catch {
        if (/asama=seferListesi/i.test(page.url())) return "ok" as const;
        return "continue_navigation_failed" as const;
      }
      return "ok" as const;
    },
    submitLogin: async () => {
      const button = page.getByRole("button", { name: KAMU_LOGIN_TARGETS.submitName });
      const started = page.url();
      await button.evaluate((element) => {
        if (element instanceof HTMLElement) element.click();
      });
      await page.waitForURL((url) => url.href !== started, { timeout: 45000 }).catch(() => undefined);
    },
    confirmWebApproval: async () => {
      const current = page.url();
      if (/asama=(?:yeniYolcu|yolcuListesi|seferListesi|grupListesi|seferDetay)/i.test(current)) return false;
      const button = page.getByRole("button", { name: KAMU_LOGIN_TARGETS.approveName, exact: true });
      if ((await button.count()) !== 1) return false;
      try {
        await button.evaluate((element) => {
          if (element instanceof HTMLElement) element.click();
        });
      } catch (error) {
        if (!isDetachedClick(error)) return false;
      }
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          const kind = classifyKamuLoginPage({ url: page.url(), html: await page.content() });
          if (kind === "portal_home" || kind === "service_list" || kind === "firm_select" || kind === "trip_list" || kind === "group_list" || kind === "passenger_list") return true;
          if (kind === "public_landing" || kind === "timeout" || kind === "login_page" || kind === "blocked") return false;
          if (kind === "web_approval" && attempt >= 3) return false;
        } catch (error) {
          if (!isDetachedClick(error) && attempt === 7) return false;
        }
        await page.waitForTimeout(400);
      }
      return false;
    },
    press: (key) => page.keyboard.press(key),
    scroll: (direction) => page.keyboard.press(direction === "up" ? "PageUp" : "PageDown"),
    setViewport: (next) => page.setViewportSize(viewportSize(next)),
    collectSeferRows: async () => {
      async function snapshot() {
        return page.evaluate(() => {
          const rows = [];
          for (const tr of Array.from(document.querySelectorAll("tr"))) {
            const link = tr.querySelector("a[href*='grupListesi']");
            if (!link) continue;
            const href = link.getAttribute("href") || "";
            const indexMatch = href.match(/index=(\d+)/);
            if (!indexMatch) continue;
            const cells = Array.from(tr.querySelectorAll("td")).map((cell) => (cell.textContent || "").replace(/\s+/g, " ").trim());
            rows.push({ index: Number(indexMatch[1]), cells });
          }
          const root = document.scrollingElement || document.documentElement;
          return {
            rows,
            scrollHeight: root.scrollHeight,
            clientHeight: root.clientHeight,
            scrollTop: root.scrollTop,
          };
        });
      }
      const merged: PortalSeferRow[] = [];
      let snap = await snapshot();
      for (const item of snap.rows) {
        const row = portalSeferRowFromCells(item.index, item.cells);
        if (row) merged.push(row);
      }
      const virtual = merged.length < 30 && snap.scrollHeight > snap.clientHeight + 40;
      if (!virtual) return mergePortalSeferRows(merged);
      for (let step = 0; step < 40; step += 1) {
        if (snap.scrollTop + snap.clientHeight >= snap.scrollHeight - 8) break;
        await page.evaluate(() => {
          const root = document.scrollingElement || document.documentElement;
          root.scrollTop = Math.min(root.scrollTop + Math.max(root.clientHeight, 1) * 0.8, root.scrollHeight);
        });
        await page.waitForTimeout(200);
        snap = await snapshot();
        const before = merged.length;
        for (const item of snap.rows) {
          const row = portalSeferRowFromCells(item.index, item.cells);
          if (row) merged.push(row);
        }
        if (mergePortalSeferRows(merged).length === mergePortalSeferRows(merged.slice(0, before)).length && snap.scrollTop + snap.clientHeight >= snap.scrollHeight - 8) break;
      }
      await page.evaluate(() => {
        const root = document.scrollingElement || document.documentElement;
        root.scrollTop = 0;
      });
      return mergePortalSeferRows(merged);
    },
    screenshot: async () => captureFrame(page),
    screenshotDocument: async () => captureFrame(page),
    saveGroupForm: async (input: { pickup: { provinceName: string; districtName: string } | null; dropoff: { provinceName: string; districtName: string } | null; identityConfirmed?: boolean }) => {
      const url = page.url();
      if (/flush/i.test(url) || /asama=(?:seferDetay|grupIptali|yolcuIptali|excelYukle|yeniYolcu)/i.test(url)) return false;
      const existingGroupUrl = /asama=yeniGrup/i.test(url) && /[?&]grupIndex=\d+(?:&|$)/i.test(url);
      if (!existingGroupUrl && !input.identityConfirmed) return false;
      const selectText = async (names: string[], label: string, attempts = 1) => {
        if (!label.trim()) return false;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
          let select = page.locator("select").nth(0);
          let found = false;
          for (const name of names) {
            const candidate = page.locator(`select[name="${name}"]`);
            if ((await candidate.count()) === 1) {
              select = candidate;
              found = true;
              break;
            }
          }
          if (found) {
            const options = select.locator("option");
            const count = await options.count();
            const wanted = label.trim().toLocaleUpperCase("tr-TR");
            for (let index = 0; index < count; index += 1) {
              const text = ((await options.nth(index).textContent()) || "").replace(/\s+/g, " ").trim();
              if (text.toLocaleUpperCase("tr-TR") === wanted) {
                await select.selectOption({ label: text });
                return true;
              }
            }
          }
          if (attempt + 1 < attempts) await page.waitForTimeout(300);
        }
        return false;
      };
      if (input.pickup) {
        if (!(await selectText(["baslangicIli", "baslangicIl"], input.pickup.provinceName))) return false;
        if (!(await selectText(["baslangicIlcesi", "baslangicIlce"], input.pickup.districtName, 8))) return false;
      }
      if (input.dropoff) {
        if (!(await selectText(["bitisIli", "bitisIl"], input.dropoff.provinceName))) return false;
        if (!(await selectText(["bitisIlcesi", "bitisIlce"], input.dropoff.districtName, 8))) return false;
      }
      const inputButton = page.locator("input[value='Güncelle']");
      const textButton = page.locator("button").filter({ hasText: /^\s*Güncelle\s*$/ });
      const inputCount = await inputButton.count();
      const textCount = await textButton.count();
      if (inputCount + textCount !== 1) return false;
      const button = inputCount === 1 ? inputButton : textButton;
      await Promise.all([
        page.waitForURL(/asama=grupListesi/i, { timeout: 45000 }).catch(() => undefined),
        button.evaluate((element) => { if (element instanceof HTMLElement) element.click(); }),
      ]);
      const html = await page.content();
      const pickupOk = !input.pickup || html.toLocaleUpperCase("tr-TR").includes(input.pickup.districtName.toLocaleUpperCase("tr-TR"));
      const dropoffOk = !input.dropoff || html.toLocaleUpperCase("tr-TR").includes(input.dropoff.districtName.toLocaleUpperCase("tr-TR"));
      return /asama=grupListesi/i.test(page.url()) && pickupOk && dropoffOk;
    },
    savePassengerForm: async (input: { yolcuIndex: number; nationality: string; documentNumber: string; firstName: string; lastName: string; gender: string }) => {
      const current = page.url();
      if (/flush/i.test(current) || !new RegExp(`[?&]yolcuIndex=${input.yolcuIndex}(?:&|$)`).test(current)) return false;
      const button = page.locator("input[type='submit'][value='Ekle']");
      if ((await button.count()) !== 1) return false;
      const heading = await page.locator("body").innerText();
      if (!/Yolcu Bilgileri/i.test(heading)) return false;
      const country = page.locator("select[name='ulke']");
      if ((await country.count()) === 1 && input.nationality.trim()) {
        const options = country.locator("option");
        const count = await options.count();
        const wanted = input.nationality.trim().toLocaleUpperCase("tr-TR");
        for (let index = 0; index < count; index += 1) {
          const text = ((await options.nth(index).textContent()) || "").replace(/\s+/g, " ").trim();
          const value = await options.nth(index).getAttribute("value");
          if (text.toLocaleUpperCase("tr-TR") === wanted || (value || "").toLocaleUpperCase("tr-TR") === wanted) {
            await country.selectOption({ label: text });
            break;
          }
        }
      }
      await page.locator("input[name='tckn']").fill(input.documentNumber);
      await page.locator("input[name='adi']").fill(input.firstName);
      await page.locator("input[name='soyadi']").fill(input.lastName);
      const gender = input.gender === "female" ? "Kadın" : input.gender === "male" ? "Erkek" : "";
      if (gender) await page.locator(`input[type='radio'][name='cinsiyet'][value='${gender}']`).check();
      try {
        await button.evaluate((element) => {
          if (!(element instanceof HTMLElement)) throw new Error("not_element");
          element.click();
        });
      } catch (error) {
        if (!isDetachedNavigation(error)) return false;
      }
      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const viewed = { url: page.url(), html: await page.content() };
          if (passengerSaveSucceeded({ ...viewed, firstName: input.firstName, lastName: input.lastName })) return true;
        } catch (error) {
          if (!isDetachedNavigation(error) && attempt === 5) return false;
        }
        await page.waitForTimeout(400);
      }
      return false;
    },
    screenshotCaptcha: async () => {
      const image = page.locator(".captchaImage");
      if ((await image.count()) < 1) return null;
      return image.first().screenshot({ type: "png" });
    },
    close: async () => {
      await context.close();
      await browser.close();
    },
  };
}
