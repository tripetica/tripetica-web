import { loadDevelopmentEnv } from "./load-env";
import { assertDevPartnerScript } from "./partner-dev-guard";

loadDevelopmentEnv();
assertDevPartnerScript();

async function main() {
  const { DEV_OPS_OWNER_EMAIL, ensureDevOpsOwner } = await import("../lib/ops/dev-owner");
  const result = await ensureDevOpsOwner();
  const action = result.created ? "created" : "updated";
  console.log(
    `DEV ops owner ${action}: ${DEV_OPS_OWNER_EMAIL} (active owner, all permissions). Set a password with npm run ops:set-password`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Failed";
  console.error(message);
  process.exitCode = 1;
});
