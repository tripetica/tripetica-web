import { type PartnerPriorityLevel } from "@/lib/partner/constants";
import { isPartnerPriorityLevel } from "@/lib/partner/policy";

export const PARTNER_PRIMARY_FORM_VALUE = "primary";

export type ParsedPartnerPriority =
  | { ok: true; isPrimary: boolean; level: PartnerPriorityLevel | null }
  | { ok: false };

export function partnerPriorityFormValue(input: {
  isPrimaryPartner: boolean;
  priorityLevel: PartnerPriorityLevel | null;
}) {
  if (input.isPrimaryPartner) {
    return PARTNER_PRIMARY_FORM_VALUE;
  }
  if (input.priorityLevel) {
    return String(input.priorityLevel);
  }
  return "";
}

export function canOfferPrimaryPriority(input: {
  partnerId: string;
  primaryPartnerId: string | null;
}) {
  return !input.primaryPartnerId || input.primaryPartnerId === input.partnerId;
}

export function partnerPrioritySelectValues(input: {
  partnerId: string;
  primaryPartnerId: string | null;
}) {
  const values = [""];
  if (canOfferPrimaryPriority(input)) {
    values.push(PARTNER_PRIMARY_FORM_VALUE);
  }
  values.push("1", "2", "3");
  return values;
}

export function parsePartnerPriorityFormValue(raw: string): ParsedPartnerPriority {
  const value = raw.trim();
  if (!value) {
    return { ok: true, isPrimary: false, level: null };
  }
  if (value === PARTNER_PRIMARY_FORM_VALUE) {
    return { ok: true, isPrimary: true, level: null };
  }
  const numeric = Number(value);
  if (!isPartnerPriorityLevel(numeric)) {
    return { ok: false };
  }
  return { ok: true, isPrimary: false, level: numeric };
}
