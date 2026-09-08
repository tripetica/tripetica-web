import { type PartnerStatus } from "@/lib/partner/constants";

export type PartnerLoginDenial = "invalid" | "pending" | "inactive";

export function partnerLoginDenialAfterPassword(input: {
  userStatus: PartnerStatus;
  partnerStatus: PartnerStatus;
  deleted?: boolean;
}): PartnerLoginDenial | null {
  if (input.deleted) {
    return "invalid";
  }
  if (input.userStatus === "active" && input.partnerStatus === "active") {
    return null;
  }
  if (input.userStatus === "inactive" || input.partnerStatus === "inactive") {
    return "inactive";
  }
  return "pending";
}
