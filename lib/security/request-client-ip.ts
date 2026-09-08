import "server-only";

import { headers } from "next/headers";
import { trustedClientIpFromHeaders } from "@/lib/security/trusted-client-ip";

export async function requestClientIp() {
  return trustedClientIpFromHeaders(await headers());
}
