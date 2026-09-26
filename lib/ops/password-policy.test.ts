import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ACCOUNT_MIN_PASSWORD_LENGTH } from "@/lib/account/constants";
import { OPS_MIN_PASSWORD_LENGTH } from "@/lib/ops/constants";
import { isOpsPasswordLengthValid } from "@/lib/ops/password-policy";
import { OPS_NAV } from "@/lib/ops/nav";
import { OPS_PERMISSIONS, permissionsForRole } from "@/lib/ops/permissions";
import { opsCopy } from "@/lib/ops/copy";
import { PARTNER_MIN_PASSWORD_LENGTH } from "@/lib/partner/constants";
import {
  MIN_PASSWORD_LENGTH,
  isPasswordLengthValid,
} from "@/lib/security/password-policy";

function source(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("shared password minimum is 8 characters, not exactly 8", () => {
  assert.equal(MIN_PASSWORD_LENGTH, 8);
  assert.equal(ACCOUNT_MIN_PASSWORD_LENGTH, 8);
  assert.equal(PARTNER_MIN_PASSWORD_LENGTH, 8);
  assert.equal(OPS_MIN_PASSWORD_LENGTH, 8);
  assert.equal(isPasswordLengthValid("1234567"), false);
  assert.equal(isPasswordLengthValid("12345678"), true);
  assert.equal(isPasswordLengthValid("123456789"), true);
  assert.equal(isOpsPasswordLengthValid("1234567"), false);
  assert.equal(isOpsPasswordLengthValid("12345678"), true);
  assert.match(opsCopy.tr.passwordTooShort, /8/);
  assert.doesNotMatch(opsCopy.tr.passwordTooShort, /10|12/);
});

test("new-password flows use the shared minimum and login does not", () => {
  assert.match(source("lib/security/password-policy.ts"), /MIN_PASSWORD_LENGTH = 8/);
  assert.match(source("lib/ops/constants.ts"), /OPS_MIN_PASSWORD_LENGTH/);
  assert.match(source("lib/account/constants.ts"), /ACCOUNT_MIN_PASSWORD_LENGTH/);
  assert.match(source("lib/partner/constants.ts"), /PARTNER_MIN_PASSWORD_LENGTH/);
  assert.match(source("lib/account/auth.ts"), /isPasswordLengthValid/);
  assert.match(source("lib/ops/account.ts"), /isPasswordLengthValid/);
  assert.match(source("components/ops/user-form.tsx"), /OPS_MIN_PASSWORD_LENGTH/);
  assert.match(source("components/ops/account-form.tsx"), /OPS_MIN_PASSWORD_LENGTH/);
  assert.doesNotMatch(source("lib/ops/actions.ts"), /password\.length < 12/);
  assert.doesNotMatch(source("lib/ops/auth.ts"), /isOpsPasswordLengthValid|isPasswordLengthValid/);
  assert.doesNotMatch(source("lib/ops/auth.ts"), /password\.length === 8|password\.length < 8/);
  assert.doesNotMatch(source("lib/partner/auth.ts"), /isPartnerPasswordLengthValid|isPasswordLengthValid/);
  const accountAuth = source("lib/account/auth.ts");
  const loginStart = accountAuth.indexOf("export async function loginCustomer");
  const loginEnd = accountAuth.indexOf("export async function", loginStart + 1);
  assert.notEqual(loginStart, -1);
  assert.doesNotMatch(accountAuth.slice(loginStart, loginEnd), /isPasswordLengthValid|MIN_PASSWORD_LENGTH/);
  const registerStart = accountAuth.indexOf("export async function registerCustomer");
  const registerEnd = accountAuth.indexOf("export async function", registerStart + 1);
  assert.notEqual(registerStart, -1);
  assert.match(accountAuth.slice(registerStart, registerEnd), /isPasswordLengthValid/);
  const resetStart = accountAuth.indexOf("export async function resetCustomerPassword");
  const resetEnd = accountAuth.indexOf("export async function", resetStart + 1);
  assert.notEqual(resetStart, -1);
  assert.match(accountAuth.slice(resetStart, resetEnd), /isPasswordLengthValid/);
  assert.doesNotMatch(source("components/ops/login-form.tsx"), /minLength/);
  assert.doesNotMatch(source("components/ops/user-form.tsx"), /minLength=\{user \? 0 : 12\}/);
});

test("ops password fields use the shared show/hide control", () => {
  assert.match(source("components/ops/login-form.tsx"), /OpsPasswordField/);
  assert.match(source("components/ops/user-form.tsx"), /OpsPasswordField/);
  assert.match(source("components/ops/account-form.tsx"), /OpsPasswordField/);
  assert.match(source("components/ops/password-field.tsx"), /type="button"/);
  assert.doesNotMatch(source("components/ops/login-form.tsx"), /type=\{visible \? "text" : "password"\}/);
  assert.doesNotMatch(source("components/ops/user-form.tsx"), /type="password"/);
});

test("ops nav includes Bilgilerim for every user and keeps Panel Kullanıcıları", () => {
  assert.deepEqual(
    OPS_NAV.map((item) => item.labelKey),
    [
      "reservations",
      "processes",
      "customers",
      "partners",
      "drivers",
      "vehicles",
      "uetds",
      "users",
      "myAccount",
    ],
  );
  assert.equal(opsCopy.tr.users, "Panel Kullanıcıları");
  assert.equal(opsCopy.tr.myAccount, "Bilgilerim");
  assert.equal(OPS_NAV.find((item) => item.href === "/ops/users")?.permission, "users.view");
  assert.equal(OPS_NAV.find((item) => item.href === "/ops/account")?.permission, null);
  assert.equal(opsCopy.tr.partners, "Partnerler");
  assert.equal(opsCopy.tr.partnerLevel, "Partner Seviyesi");
  assert.equal(OPS_NAV.find((item) => item.href === "/ops/partners")?.permission, "partners.view");
  assert.equal(OPS_NAV.find((item) => item.href === "/ops/drivers")?.permission, "partners.view");
  assert.equal(OPS_NAV.find((item) => item.href === "/ops/vehicles")?.permission, "partners.view");
  assert.equal(OPS_NAV.find((item) => item.href === "/ops/uetds")?.permission, "uetds.view");
  assert.equal(opsCopy.tr.drivers, "Sürücüler");
  assert.equal(opsCopy.tr.vehicles, "Araçlar");
  assert.equal(opsCopy.tr.uetds, "U-ETDS");
  assert.equal(opsCopy.tr.uetdsTitle, "U-ETDS Bildirim İşlemleri");
  assert.equal(permissionsForRole("owner", []).includes("partners.view"), true);
  assert.equal(permissionsForRole("owner", []).includes("partners.manage"), true);
  assert.equal(OPS_PERMISSIONS.includes("partners.view"), true);
  assert.equal(OPS_PERMISSIONS.includes("partners.manage"), true);
  assert.equal(OPS_PERMISSIONS.includes("uetds.view"), true);
  assert.equal(OPS_PERMISSIONS.includes("uetds.manage"), true);
  assert.equal(permissionsForRole("owner", []).includes("uetds.manage"), true);
});
