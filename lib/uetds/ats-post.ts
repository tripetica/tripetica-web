import "server-only";

import { atsKonumBildirInnerXml, type AtsKonumInput } from "@/lib/uetds/ats-soap";
import { UETDS_ATS_SOAP_ACTIONS } from "@/lib/uetds/ministry-env";
import { callUetdsTestSoap } from "@/lib/uetds/ministry-soap";

export function atsMinistryDispatchAllowed(
  env: Record<string, string | undefined> = process.env,
) {
  return env.ATS_MINISTRY_DISPATCH === "allow-test";
}

/**
 * Builds a test-endpoint atsKonumBildir call.
 * Refuses before any HTTP unless a later phase sets ATS_MINISTRY_DISPATCH=allow-test.
 */
export async function postAtsKonumBildir(input: AtsKonumInput) {
  if (!atsMinistryDispatchAllowed()) {
    throw new Error("ats_dispatch_withheld");
  }
  return callUetdsTestSoap({
    operation: "atsKonumBildir",
    soapAction: UETDS_ATS_SOAP_ACTIONS.atsKonumBildir,
    innerXml: atsKonumBildirInnerXml(input),
    username: input.username,
    password: input.password,
  });
}
