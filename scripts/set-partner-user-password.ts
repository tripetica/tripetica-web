import { DEV_PRIMARY_PARTNER_USER_EMAIL } from "../lib/partner/constants";
import { loadDevelopmentEnv } from "./load-env";
import { assertDevPartnerScript, resolveBootstrapPassword } from "./partner-dev-guard";

loadDevelopmentEnv();
assertDevPartnerScript();

async function main() {
  const email = process.env.PARTNER_USER_EMAIL?.trim() || DEV_PRIMARY_PARTNER_USER_EMAIL;
  const password = await resolveBootstrapPassword();
  const { setPartnerUserPasswordByEmail } = await import("../lib/partner/bootstrap");
  await setPartnerUserPasswordByEmail(email, password);
  console.log(`Password updated for ${email} (must_change_password=true).`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Failed";
  console.error(message);
  process.exitCode = 1;
});
