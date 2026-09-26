import "server-only";
import { resolveUetdsMinistryRuntime, type UetdsMinistryRuntime } from "@/lib/uetds/ministry-env";
import { queryUetdsTestBildirimOzeti } from "@/lib/uetds/ministry-ozet";
import { evaluateUetdsFinalVerification, type UetdsVerificationExpected } from "@/lib/uetds/final-verification";

/** Read-only. Never creates, corrects, cancels, or retries a mutation. */
export async function verifyUetdsMinistryNotification(input: {
  username: string;
  password: string;
  environment: UetdsMinistryRuntime;
  expected: UetdsVerificationExpected;
}) {
  if (resolveUetdsMinistryRuntime() !== input.environment) {
    return evaluateUetdsFinalVerification(input.expected, null, input.environment);
  }
  try {
    const summary = await queryUetdsTestBildirimOzeti({
      username: input.username, password: input.password,
      seferReferansNo: input.expected.seferReference,
    });
    const isValid = (status: string) => status.trim().toLocaleUpperCase("tr-TR") === "GEÇERLİ";
    return evaluateUetdsFinalVerification(input.expected, {
      ...summary,
      activeCount: summary.passengers.filter((item) => isValid(item.durum)).length,
      activePersonnelCount: summary.personnel.filter((item) => isValid(item.durum)).length,
    }, input.environment);
  } catch {
    return evaluateUetdsFinalVerification(input.expected, null, input.environment);
  }
}
