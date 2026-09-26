import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { asPanelLocale, panelLocales } from "@/lib/i18n/config";
import { opsCopy } from "@/lib/ops/copy";
import { OPS_NAV } from "@/lib/ops/nav";
import {
  computeUetdsIntegrationStatus,
  parseUetdsCompanyInput,
} from "@/lib/ops/uetds-company-fields";
import { parseUetdsCompanyListFilters } from "@/lib/ops/uetds-company-filters";
import {
  classifyUetdsCompanySaveError,
  resolveUetdsEnvPassword,
} from "@/lib/ops/uetds-companies";
import { SealedSecretError, isSealedSecret, sealSecret } from "@/lib/security/sealed-secret";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("uetds copy and nav stay complete across panel locales", () => {
  assert.equal(opsCopy.tr.uetdsTitle, "U-ETDS Bildirim İşlemleri");
  assert.equal(opsCopy.tr.uetdsCompanies, "Firmalar");
  assert.equal(opsCopy.tr.uetdsNewNotification, "Yeni Bildirim");
  assert.equal(opsCopy.tr.uetdsNotifications, "Bildirimler");
  assert.equal(opsCopy.tr.uetdsLegalName, "Resmi Ticari Ünvan");
  assert.equal(opsCopy.tr.uetdsTestCredentials, "U-ETDS Test Servis Yetki Bilgileri");
  assert.equal(opsCopy.tr.uetdsTestUsername, "Test Servis Kullanıcı Adı");
  assert.equal(opsCopy.tr.uetdsTestPassword, "Test Servis Şifresi");
  assert.equal(opsCopy.tr.uetdsLiveCredentials, "U-ETDS Gerçek Servis Yetki Bilgileri");
  assert.equal(opsCopy.tr.uetdsLiveUsername, "Gerçek Servis Kullanıcı Adı");
  assert.equal(opsCopy.tr.uetdsLivePassword, "Gerçek Servis Şifresi");
  assert.doesNotMatch(opsCopy.tr.uetdsLiveCredentials, /CANLI/i);
  assert.equal(OPS_NAV.find((item) => item.href === "/ops/uetds")?.labelKey, "uetds");
  for (const locale of panelLocales) {
    const copy = opsCopy[asPanelLocale(locale)];
    assert.ok(copy.uetdsTitle);
    assert.ok(copy.uetdsCompanies);
    assert.ok(copy.uetdsNewCompany);
    assert.ok(copy.uetdsPasswordSaved);
    assert.doesNotMatch(copy.uetdsLiveCredentials, /CANLI/i);
    assert.ok(copy.permissionLabels["uetds.view"]);
    assert.ok(copy.permissionLabels["uetds.manage"]);
  }
});

test("uetds company search covers name, legal name, tax and document number", () => {
  const filters = parseUetdsCompanyListFilters({ q: "  acme  ", status: "active" });
  assert.deepEqual(filters, { query: "acme", status: "active" });
  assert.equal(parseUetdsCompanyListFilters({ status: "pending" }).status, "");
  const store = source("lib/ops/uetds-companies.ts");
  assert.match(store, /short_name ILIKE/);
  assert.match(store, /legal_name ILIKE/);
  assert.match(store, /tax_number ILIKE/);
  assert.match(store, /authority_document_number ILIKE/);
});

test("uetds integration status is config completeness, not a ministry test", () => {
  const base = {
    shortName: "Kısa",
    legalName: "Example Tasimacilik A.S.",
    taxNumber: "1234567890",
    authorityDocumentType: "D2",
    authorityDocumentNumber: "D2-100",
    testUsername: "",
    liveUsername: "",
    hasTestPassword: false,
    hasLivePassword: false,
  };
  assert.equal(computeUetdsIntegrationStatus(base), "incomplete");
  assert.equal(
    computeUetdsIntegrationStatus(
      {
        ...base,
        testUsername: "test-user",
        hasTestPassword: true,
      },
      { NODE_ENV: "development", EXPECTED_DATABASE: "tripetica_dev" },
    ),
    "ready",
  );
  assert.equal(
    computeUetdsIntegrationStatus({
      ...base,
      liveUsername: "live-user",
      hasLivePassword: true,
    }),
    "incomplete",
  );
  assert.equal(
    computeUetdsIntegrationStatus(
      {
        ...base,
        liveUsername: "live-user",
        hasLivePassword: true,
      },
      { NODE_ENV: "production", EXPECTED_DATABASE: "tripetica" },
    ),
    "ready",
  );
  assert.equal(
    computeUetdsIntegrationStatus(
      {
        ...base,
        testUsername: "test-user",
        hasTestPassword: true,
      },
      { NODE_ENV: "production", EXPECTED_DATABASE: "tripetica" },
    ),
    "incomplete",
  );
  assert.equal(
    computeUetdsIntegrationStatus(
      {
        ...base,
        liveUsername: "live-user",
        hasLivePassword: true,
      },
      { NODE_ENV: "development", EXPECTED_DATABASE: "tripetica_dev" },
    ),
    "incomplete",
  );
  assert.equal(
    computeUetdsIntegrationStatus({
      ...base,
      shortName: "",
      testUsername: "test-user",
      hasTestPassword: true,
    }),
    "incomplete",
  );
  const table = source("components/ops/uetds-company-table.tsx");
  assert.match(table, /uetdsIntegrationReadyHint/);
  assert.doesNotMatch(table, /bağlantı başarılı|connection succeeded/i);
  const fields = source("lib/ops/uetds-company-fields.ts");
  assert.match(fields, /runtime === "live" \? liveReady/);
  assert.doesNotMatch(fields, /testReady \|\| liveReady/);
  assert.match(source("lib/uetds/ministry-credentials.ts"), /if \(runtime === "live"\)/);
  assert.doesNotMatch(source("lib/uetds/submit.ts"), /if \(!isDevUetdsRuntime\(\)\)/);
  assert.match(source("components/uetds/uetds-notification-form.tsx"), /ministryEnv === "test"/);
});

test("uetds company input rejects incomplete business fields", () => {
  assert.equal(parseUetdsCompanyInput({ shortName: "A" }), null);
  const parsed = parseUetdsCompanyInput({
    shortName: "Kısa",
    legalName: "Resmi Unvan",
    taxNumber: "123",
    authorityDocumentType: "D2",
    authorityDocumentNumber: "D2-1",
    status: "inactive",
    testUsername: " t ",
    testPassword: "  ",
  });
  assert.equal(parsed?.status, "inactive");
  assert.equal(parsed?.testUsername, "t");
  assert.equal(parsed?.testPassword, null);
});

test("company save classifies encryption failure without logging secrets", () => {
  const previous = process.env.UETDS_CREDENTIALS_KEY;
  delete process.env.UETDS_CREDENTIALS_KEY;
  try {
    assert.equal(
      classifyUetdsCompanySaveError(new SealedSecretError()).reason,
      "sealed_secret_key_missing",
    );
    assert.throws(() => sealSecret("visible-password"), SealedSecretError);
  } finally {
    if (previous === undefined) {
      delete process.env.UETDS_CREDENTIALS_KEY;
    } else {
      process.env.UETDS_CREDENTIALS_KEY = previous;
    }
  }
  process.env.UETDS_CREDENTIALS_KEY = "a".repeat(64);
  try {
    const sealed = sealSecret("visible-password");
    assert.equal(isSealedSecret(sealed), true);
    assert.doesNotMatch(sealed, /visible-password/);
    assert.equal(
      classifyUetdsCompanySaveError(new SealedSecretError()).reason,
      "sealed_secret_unavailable",
    );
    assert.deepEqual(classifyUetdsCompanySaveError({ code: "42501" }), {
      reason: "db_error",
      dbCode: "42501",
    });
  } finally {
    if (previous === undefined) {
      delete process.env.UETDS_CREDENTIALS_KEY;
    } else {
      process.env.UETDS_CREDENTIALS_KEY = previous;
    }
  }
  const store = source("lib/ops/uetds-companies.ts");
  const logLine = store.slice(store.indexOf("console.error(\"[ops-uetds-company] save failed\""));
  assert.match(store, /\[ops-uetds-company\] save failed/);
  assert.match(store, /sealed_secret_key_missing/);
  assert.match(logLine, /classifyUetdsCompanySaveError\(error\)/);
  assert.doesNotMatch(logLine, /testPassword|livePassword|password_sealed|UETDS_CREDENTIALS_KEY\?\.trim\(\)/);
  assert.doesNotMatch(source("lib/ops/uetds-company-actions.ts"), /console\.(log|info|debug|error)/);
});

test("empty password keeps the sealed value; clearing username drops it", () => {
  assert.equal(
    resolveUetdsEnvPassword({
      username: "user",
      nextPassword: null,
      existingSealed: "v1.keep",
    }),
    "v1.keep",
  );
  assert.equal(
    resolveUetdsEnvPassword({
      username: "",
      nextPassword: null,
      existingSealed: "v1.keep",
    }),
    null,
  );
});

test("production UETDS key helper never prints or rotates an existing key", () => {
  const script = source("deploy/ensure-production-uetds-credentials-key.sh");
  assert.match(script, /UETDS_CREDENTIALS_KEY=present/);
  assert.match(script, /copied_from_current|awk -F= '\$1=="UETDS_CREDENTIALS_KEY"/);
  assert.match(script, /missing_with_ciphertext/);
  assert.match(script, /openssl rand -hex 32/);
  assert.doesNotMatch(script, /echo \"\$|cat \"\$TARGET\"|printenv UETDS_CREDENTIALS_KEY/);
  assert.doesNotMatch(script, /\.env\.development\.local|tripetica_dev/);
  assert.match(source("deploy/prepare-release.sh"), /install -o tripetica-prod -g tripetica-prod -m 600 \"\$CURRENT_ENV\" \"\$RELEASE\/\.env\.production\.local\"/);
});

test("uetds list and editor never expose sealed passwords", () => {
  const store = source("lib/ops/uetds-companies.ts");
  const actions = source("lib/ops/uetds-company-actions.ts");
  const dialog = source("components/ops/uetds-company-dialog.tsx");
  const table = source("components/ops/uetds-company-table.tsx");
  assert.match(store, /test_password_sealed IS NOT NULL/);
  assert.doesNotMatch(store, /unsealSecret/);
  assert.doesNotMatch(actions, /unsealSecret/);
  assert.doesNotMatch(actions, /console\.(log|info|debug|error)/);
  assert.doesNotMatch(dialog, /hasTestPassword \? company/);
  assert.doesNotMatch(table, /password/i);
  assert.match(dialog, /uetdsPasswordSaved/);
  assert.match(dialog, /uetdsTestUsername/);
  assert.match(dialog, /uetdsTestPassword/);
  assert.match(dialog, /uetdsLiveUsername/);
  assert.match(dialog, /uetdsLivePassword/);
  assert.doesNotMatch(dialog, /wsdl|WSDL/i);
  assert.match(dialog, /createPortal/);
  assert.match(dialog, /portal-root/);
  assert.doesNotMatch(source("db/migrations/053_uetds_companies.sql"), /INSERT INTO uetds_companies/i);
  assert.doesNotMatch(store, /fetch\(|http:\/\/|https:\/\//);
  assert.doesNotMatch(actions, /fetch\(|http:\/\/|https:\/\//);
});

test("uetds routes stay inside existing ops panel convention", () => {
  const layout = source("app/[locale]/ops/(panel)/uetds/layout.tsx");
  const companies = source("app/[locale]/ops/(panel)/uetds/companies/page.tsx");
  const notifications = source("app/[locale]/ops/(panel)/uetds/notifications/page.tsx");
  const create = source("app/[locale]/ops/(panel)/uetds/notifications/new/page.tsx");
  assert.match(layout, /uetdsTitle/);
  assert.match(layout, /UetdsSubnav/);
  assert.match(layout, /uetdsCompanies/);
  assert.match(layout, /\/ops\/uetds\/companies/);
  assert.match(companies, /UetdsCompaniesScreen/);
  assert.match(notifications, /uetdsEmptyNotifications/);
  assert.match(create, /UetdsNotificationForm/);
  assert.doesNotMatch(source("components/ops/uetds-company-dialog.tsx"), /drawer|offcanvas/i);
});
