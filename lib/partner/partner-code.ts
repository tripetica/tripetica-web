import { PARTNER_CODE_MAX_SEQ, PARTNER_CODE_PREFIX } from "@/lib/partner/constants";

export function formatPartnerCode(seq: number) {
  if (!Number.isInteger(seq) || seq < 1 || seq > PARTNER_CODE_MAX_SEQ) {
    throw new Error("Invalid partner code sequence");
  }
  return `${PARTNER_CODE_PREFIX}-${String(seq).padStart(4, "0")}`;
}
