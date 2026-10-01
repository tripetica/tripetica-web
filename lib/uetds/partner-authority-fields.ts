export const EDEVLET_AUTHORITY_STATUSES = ["active", "inactive"] as const;
export type EdevletAuthorityStatus = (typeof EDEVLET_AUTHORITY_STATUSES)[number];

export type EdevletAuthorityCompanyRef = {
  id: string;
  shortName: string;
};

/** Safe partner-facing projection. Never includes identity or password plaintext. */
export type PartnerEdevletAuthoritySummary = {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  maskedIdentity: string;
  status: EdevletAuthorityStatus;
  companies: EdevletAuthorityCompanyRef[];
};

export type OpsEdevletAuthoritySummary = PartnerEdevletAuthoritySummary & {
  partnerId: string;
  partnerName: string;
};

export type PartnerEdevletAuthorityState = {
  ok: boolean;
  error: "invalid" | "forbidden" | "not-found" | "failed" | null;
  authority?: PartnerEdevletAuthoritySummary;
};

export function maskNationalIdLast4(last4: string) {
  return `•••••••${last4}`;
}

export function collapseAuthorityName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function parseAuthorityName(value: string) {
  const name = collapseAuthorityName(value);
  if (!name || name.length > 80) return null;
  return name;
}

export function isEdevletAuthorityStatus(value: string): value is EdevletAuthorityStatus {
  return value === "active" || value === "inactive";
}

/** Empty input means "keep the stored value". A non-empty value must be 11 digits. */
export function parseOptionalNationalId(value: string): { ok: true; identity: string } | { ok: false } {
  const identity = value.replace(/\s/g, "");
  if (!identity) return { ok: true, identity: "" };
  if (!/^[1-9]\d{10}$/.test(identity)) return { ok: false };
  return { ok: true, identity };
}

export function parseOptionalPassword(value: string): { ok: true; password: string } | { ok: false } {
  if (value.length > 1024) return { ok: false };
  return { ok: true, password: value };
}
