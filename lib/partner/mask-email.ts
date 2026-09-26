import { normalizePartnerEmail } from "@/lib/partner/email";

/** Mask an email for UI display without revealing the full local-part. */
export function maskPartnerEmail(email: string) {
  const normalized = normalizePartnerEmail(email);
  const at = normalized.indexOf("@");
  if (at <= 0) {
    return normalized;
  }
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain) {
    return normalized;
  }
  if (local.length <= 1) {
    return `${local}***@${domain}`;
  }
  if (local.length === 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local.slice(0, 2)}***@${domain}`;
}
