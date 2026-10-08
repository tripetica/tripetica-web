import "server-only";

import { atsPlate } from "@/lib/gps/ats-policy";
import { atsKonumBildirInnerXml, type AtsKonumInput } from "@/lib/uetds/ats-soap";
import {
  resolveUetdsMinistryEndpoint,
  resolveUetdsMinistryRuntime,
  UETDS_ATS_SOAP_ACTIONS,
  UETDS_LIVE_ENDPOINT,
  UETDS_TEST_ENDPOINT,
} from "@/lib/uetds/ministry-env";
import { callUetdsTestSoap } from "@/lib/uetds/ministry-soap";

export function atsMinistryDispatchAllowed(
  env: Record<string, string | undefined> = process.env,
) {
  return env.ATS_MINISTRY_DISPATCH === "allow-test";
}

/** Production live ATS. Stays off unless this process is the live runtime and the flag is set. */
export function atsLiveDispatchAllowed(
  env: Record<string, string | undefined> = process.env,
) {
  return resolveUetdsMinistryRuntime(env) === "live"
    && env.ATS_LIVE_DISPATCH === "approved"
    && env.ATS_MINISTRY_DISPATCH !== "allow-test";
}

/**
 * Posts atsKonumBildir on the runtime endpoint.
 * DEV reaches only the test service, and only when ATS_MINISTRY_DISPATCH=allow-test.
 * Production reaches only the live service, and only when ATS_LIVE_DISPATCH=approved.
 */
export async function postAtsKonumBildir(input: AtsKonumInput) {
  const runtime = resolveUetdsMinistryRuntime();
  const plate = atsPlate(input.plate, runtime);
  const testAllowed = runtime === "test" && atsMinistryDispatchAllowed();
  const liveAllowed = runtime === "live" && atsLiveDispatchAllowed();
  if (!plate || (!testAllowed && !liveAllowed)) {
    throw new Error("ats_dispatch_withheld");
  }
  const endpoint = resolveUetdsMinistryEndpoint();
  if (testAllowed && endpoint !== UETDS_TEST_ENDPOINT) {
    throw new Error("ats_dispatch_withheld");
  }
  if (liveAllowed && endpoint !== UETDS_LIVE_ENDPOINT) {
    throw new Error("ats_dispatch_withheld");
  }
  return callUetdsTestSoap({
    operation: "atsKonumBildir",
    soapAction: UETDS_ATS_SOAP_ACTIONS.atsKonumBildir,
    innerXml: atsKonumBildirInnerXml({ ...input, plate }),
    username: input.username,
    password: input.password,
  });
}
