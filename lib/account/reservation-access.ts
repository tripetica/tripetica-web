import "server-only";

import {
  accountActorVerificationStatus,
} from "@/lib/account/customer-reservation-access-policy";
import {
  getAccountActor,
  type AccountActor,
} from "@/lib/account/session";

export type VerifiedAccountActorResult =
  | { ok: true; actor: AccountActor }
  | { ok: false; reason: "unauthenticated" | "unverified" };

export async function requireVerifiedAccountActor(): Promise<VerifiedAccountActorResult> {
  const actor = await getAccountActor();
  const status = accountActorVerificationStatus(actor);
  if (status === "unauthenticated") {
    return { ok: false, reason: "unauthenticated" };
  }
  if (status === "unverified") {
    return { ok: false, reason: "unverified" };
  }
  if (!actor) {
    return { ok: false, reason: "unauthenticated" };
  }
  return { ok: true, actor };
}
