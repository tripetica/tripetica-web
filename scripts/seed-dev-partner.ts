import { DEV_PRIMARY_PARTNER_USER_EMAIL } from "../lib/partner/constants";
import { loadDevelopmentEnv } from "./load-env";
import { assertDevPartnerScript, resolveBootstrapPassword } from "./partner-dev-guard";

loadDevelopmentEnv();
assertDevPartnerScript();

async function main() {
  const password = await resolveBootstrapPassword();
  const { createOrResetPrimaryPartnerUser } = await import("../lib/partner/bootstrap");
  const result = await createOrResetPrimaryPartnerUser(password);
  const userAction = result.userCreated ? "created" : "password reset";
  const partnerAction = result.partnerCreated ? "created" : "existing";
  console.log(
    `Primary partner ${partnerAction}: ${result.partner.partner_code} (${result.partner.name})`,
  );
  console.log(
    `Partner user ${userAction}: ${DEV_PRIMARY_PARTNER_USER_EMAIL} (must_change_password=true)`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Failed";
  console.error(message);
  process.exitCode = 1;
});
