import { OPS_MIN_PASSWORD_LENGTH } from "../lib/ops/constants";
import { DEV_OPS_OWNER_EMAIL } from "../lib/ops/dev-owner";
import { isOpsPasswordLengthValid } from "../lib/ops/password-policy";
import { loadDevelopmentEnv } from "./load-env";
import { assertDevPartnerScript, readHiddenPassword } from "./partner-dev-guard";

loadDevelopmentEnv();
assertDevPartnerScript();

async function resolveOpsBootstrapPassword() {
  const fromEnv = process.env.OPS_BOOTSTRAP_PASSWORD ?? "";
  if (fromEnv) {
    if (!isOpsPasswordLengthValid(fromEnv)) {
      throw new Error(`Şifre en az ${OPS_MIN_PASSWORD_LENGTH} karakter olmalı.`);
    }
    return fromEnv;
  }
  const password = await readHiddenPassword("Ops şifre: ");
  const repeat = await readHiddenPassword("Ops şifre tekrar: ");
  if (password !== repeat) {
    throw new Error("Şifreler eşleşmiyor.");
  }
  if (!isOpsPasswordLengthValid(password)) {
    throw new Error(`Şifre en az ${OPS_MIN_PASSWORD_LENGTH} karakter olmalı.`);
  }
  return password;
}

async function main() {
  const email = process.env.OPS_USER_EMAIL?.trim() || DEV_OPS_OWNER_EMAIL;
  const password = await resolveOpsBootstrapPassword();
  const { setOpsUserPasswordByEmail } = await import("../lib/ops/dev-owner");
  await setOpsUserPasswordByEmail(email, password);
  console.log(`Password updated for ${email}.`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Failed";
  console.error(message);
  process.exitCode = 1;
});
