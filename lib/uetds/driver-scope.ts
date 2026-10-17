import type { UetdsDraft } from "@/lib/uetds/draft";

/** Keep the session driver and reject a vehicle outside the authorized set. */
export function clampDriverUetdsDraft(
  draft: UetdsDraft,
  input: { driverId: string; vehicleIds: readonly string[] },
): UetdsDraft | null {
  if (!input.vehicleIds.includes(draft.vehicleId)) {
    return null;
  }
  return { ...draft, driverId: input.driverId };
}

export function forceDriverUetdsIdentity(draft: UetdsDraft, driverId: string): UetdsDraft {
  return { ...draft, driverId };
}
