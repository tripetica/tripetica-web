import "server-only";

import { atsPlate } from "@/lib/gps/ats-policy";
import { atsArizaBildirInnerXml, atsKonumBildirInnerXml, type AtsArizaInput, type AtsKonumInput } from "@/lib/uetds/ats-soap";
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

/**
 * Posts atsArizaBildir. DEV can reach only the test service.
 * Production can reach only the live service, and only with the live dispatch flag.
 * A missing ministry result is returned as sonucKodu null and must not be stored as success.
 */
export async function postAtsArizaBildir(input: AtsArizaInput) {
  const runtime = resolveUetdsMinistryRuntime();
  const plate = atsPlate(input.plate, runtime);
  const testAllowed = runtime === "test" && atsMinistryDispatchAllowed();
  const liveAllowed = runtime === "live" && atsLiveDispatchAllowed();
  if (!plate || (!testAllowed && !liveAllowed)) {
    throw new Error("ats_fault_withheld");
  }
  const endpoint = resolveUetdsMinistryEndpoint();
  if (testAllowed && endpoint !== UETDS_TEST_ENDPOINT) {
    throw new Error("ats_fault_withheld");
  }
  if (liveAllowed && endpoint !== UETDS_LIVE_ENDPOINT) {
    throw new Error("ats_fault_withheld");
  }
  return callUetdsTestSoap({
    operation: "atsArizaBildir",
    soapAction: UETDS_ATS_SOAP_ACTIONS.atsArizaBildir,
    innerXml: atsArizaBildirInnerXml({ ...input, plate }),
    username: input.username,
    password: input.password,
    timeoutMs: 20_000,
  });
}
