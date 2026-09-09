import {
  PARTNER_BUSINESS_TYPES,
  PARTNER_PRIORITY_LEVELS,
  type PartnerBusinessType,
  type PartnerPriorityLevel,
  type PartnerStatus,
} from "@/lib/partner/constants";
import {
  isPasswordLengthValid,
  passwordsMatch,
} from "@/lib/security/password-policy";

export function isPartnerStatus(value: string): value is PartnerStatus {
  return value === "pending" || value === "active" || value === "inactive";
}

export function isPartnerBusinessType(value: string): value is PartnerBusinessType {
  return (PARTNER_BUSINESS_TYPES as readonly string[]).includes(value);
}

export function isPartnerPriorityLevel(value: number): value is PartnerPriorityLevel {
  return (PARTNER_PRIORITY_LEVELS as readonly number[]).includes(value);
}

export function isPartnerAccountLoginEligible(input: {
  userStatus: PartnerStatus;
  partnerStatus: PartnerStatus;
}) {
  return input.userStatus === "active" && input.partnerStatus === "active";
}

export function partnerHasRequiredProfileFields(input: {
  name: string;
  email: string;
  phone: string;
  contactFirstName: string;
  contactLastName: string;
  businessType: string | null;
  addressLine: string;
  countryCode: string;
  taxOffice: string;
  taxNumber: string;
}) {
  return (
    Boolean(input.name.trim()) &&
    Boolean(input.email.trim()) &&
    Boolean(input.phone.trim()) &&
    Boolean(input.contactFirstName.trim()) &&
    Boolean(input.contactLastName.trim()) &&
    isPartnerBusinessType(input.businessType ?? "") &&
    Boolean(input.addressLine.trim()) &&
    Boolean(input.countryCode.trim()) &&
    Boolean(input.taxOffice.trim()) &&
    Boolean(input.taxNumber.trim())
  );
}

export function canActivateExternalPartner(input: {
  isPrimaryPartner: boolean;
  status: PartnerStatus;
  priorityLevel: number | null;
  hasRequiredFields: boolean;
}) {
  if (input.isPrimaryPartner) {
    return false;
  }
  if (input.status !== "pending" && input.status !== "inactive") {
    return false;
  }
  return input.hasRequiredFields && isPartnerPriorityLevel(input.priorityLevel ?? 0);
}

export function canDeactivateExternalPartner(input: {
  isPrimaryPartner: boolean;
  status: PartnerStatus;
}) {
  return input.status === "active";
}

export function isPartnerPasswordLengthValid(password: string) {
  return isPasswordLengthValid(password);
}

export function partnerPasswordsMatch(password: string, confirmation: string) {
  return passwordsMatch(password, confirmation);
}
