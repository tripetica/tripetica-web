import test from "node:test";
import assert from "node:assert/strict";
import { OPS_MIN_PASSWORD_LENGTH } from "@/lib/ops/constants";
import { isOpsPasswordLengthValid } from "@/lib/ops/password-policy";
import { OPS_NAV } from "@/lib/ops/nav";
import { OPS_PERMISSIONS, permissionsForRole } from "@/lib/ops/permissions";
import { opsCopy } from "@/lib/ops/copy";
import { readFileSync } from "node:fs";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("ops password minimum is 10 characters", () => {
  assert.equal(OPS_MIN_PASSWORD_LENGTH, 10);
  assert.equal(isOpsPasswordLengthValid("123456789"), false);
  assert.equal(isOpsPasswordLengthValid("1234567890"), true);
  assert.equal(isOpsPasswordLengthValid("existing-long-ops-password"), true);
  assert.match(opsCopy.tr.passwordTooShort, /10/);
  assert.doesNotMatch(source("lib/ops/actions.ts"), /password\.length < 12/);
  assert.doesNotMatch(source("lib/ops/actions.ts"), /password\.length === 10/);
  assert.doesNotMatch(source("lib/ops/auth.ts"), /isOpsPasswordLengthValid/);
  assert.doesNotMatch(source("lib/ops/auth.ts"), /password\.length === 10/);
  assert.doesNotMatch(source("components/ops/user-form.tsx"), /minLength=\{user \? 0 : 12\}/);
  assert.match(source("components/ops/user-form.tsx"), /OPS_MIN_PASSWORD_LENGTH/);
  assert.match(source("lib/ops/password-policy.ts"), /password\.length >= OPS_MIN_PASSWORD_LENGTH/);
});

test("ops password fields use the shared show/hide control", () => {
  assert.match(source("components/ops/login-form.tsx"), /OpsPasswordField/);
  assert.match(source("components/ops/user-form.tsx"), /OpsPasswordField/);
  assert.match(source("components/ops/password-field.tsx"), /type="button"/);
  assert.doesNotMatch(source("components/ops/login-form.tsx"), /type=\{visible \? "text" : "password"\}/);
  assert.doesNotMatch(source("components/ops/user-form.tsx"), /type="password"/);
});

test("ops nav includes Partnerler after customers", () => {
  assert.deepEqual(
    OPS_NAV.map((item) => item.labelKey),
    ["reservations", "processes", "customers", "partners", "drivers", "vehicles", "users"],
  );
  assert.equal(opsCopy.tr.partners, "Partnerler");
  assert.equal(opsCopy.tr.partnerLevel, "Partner Seviyesi");
  assert.equal(OPS_NAV.find((item) => item.href === "/ops/partners")?.permission, "partners.view");
  assert.equal(OPS_NAV.find((item) => item.href === "/ops/drivers")?.permission, "partners.view");
  assert.equal(OPS_NAV.find((item) => item.href === "/ops/vehicles")?.permission, "partners.view");
  assert.equal(opsCopy.tr.drivers, "Sürücüler");
  assert.equal(opsCopy.tr.vehicles, "Araçlar");
  assert.equal(permissionsForRole("owner", []).includes("partners.view"), true);
  assert.equal(permissionsForRole("owner", []).includes("partners.manage"), true);
  assert.equal(OPS_PERMISSIONS.includes("partners.view"), true);
  assert.equal(OPS_PERMISSIONS.includes("partners.manage"), true);
});
