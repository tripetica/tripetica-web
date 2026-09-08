import { isValidEmail, phoneValidity, toE164 } from "@/lib/booking/phone";
import { countryByIso2, normalizeIso2 } from "@/lib/geo/countries";
import {
  PARTNER_ADDRESS_MAX_LENGTH,
  PARTNER_CONTACT_NAME_MAX_LENGTH,
  PARTNER_DEFAULT_COUNTRY_CODE,
  PARTNER_NAME_MAX_LENGTH,
  PARTNER_TAX_NUMBER_MAX_LENGTH,
  PARTNER_TAX_OFFICE_MAX_LENGTH,
} from "@/lib/partner/constants";
import { type PartnerBusinessType } from "@/lib/partner/constants";
import {
  isPartnerBusinessType,
  isPartnerPasswordLengthValid,
  partnerPasswordsMatch,
} from "@/lib/partner/policy";

export type PartnerApplicationError =
  | "invalid-email"
  | "invalid-phone"
  | "invalid-name"
  | "invalid-contact"
  | "invalid-business-type"
  | "invalid-address"
  | "invalid-country"
  | "invalid-tax-office"
  | "invalid-tax-number"
  | "invalid-national-id"
  | "password-short"
  | "password-mismatch";

export type PartnerRegisterField =
  | "email"
  | "phone"
  | "contactName"
  | "businessType"
  | "name"
  | "addressLine"
  | "taxOffice"
  | "taxNumber"
  | "password"
  | "confirmPassword";

export function partnerRegisterTaxIdMaxLength(
  businessType: PartnerBusinessType | "",
) {
  return businessType === "company" ? 10 : 11;
}

export function partnerRegisterErrorField(
  error: PartnerApplicationError | "duplicate" | "unverified-email" | "failed",
): PartnerRegisterField | null {
  switch (error) {
    case "invalid-email":
    case "duplicate":
    case "unverified-email":
      return "email";
    case "invalid-phone":
      return "phone";
    case "invalid-contact":
      return "contactName";
    case "invalid-business-type":
      return "businessType";
    case "invalid-name":
      return "name";
    case "invalid-address":
      return "addressLine";
    case "invalid-tax-office":
      return "taxOffice";
    case "invalid-tax-number":
    case "invalid-national-id":
      return "taxNumber";
    case "password-short":
      return "password";
    case "password-mismatch":
      return "confirmPassword";
    default:
      return null;
  }
}

function collapseSpaces(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function normalizePartnerPersonName(value: string) {
  return collapseSpaces(value);
}

export function normalizePartnerLegalName(value: string) {
  return collapseSpaces(value);
}

export function normalizePartnerAddress(value: string) {
  return value.trim().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
}

export function normalizePartnerTaxOffice(value: string) {
  return collapseSpaces(value);
}

export function normalizePartnerTaxNumber(value: string) {
  return value.trim().replace(/[\s-]+/g, "").toUpperCase();
}

export function normalizePartnerTaxIdDigits(value: string) {
  return value.replace(/\D/g, "");
}

export function isPartnerTaxNumberValid(
  countryCode: string,
  taxNumber: string,
  businessType?: PartnerBusinessType | "",
) {
  if (businessType === "individual") {
    return /^\d{11}$/.test(normalizePartnerTaxIdDigits(taxNumber));
  }
  if (businessType === "company") {
    return /^\d{10}$/.test(normalizePartnerTaxIdDigits(taxNumber));
  }
  const normalized = normalizePartnerTaxNumber(taxNumber);
  if (!normalized || normalized.length > PARTNER_TAX_NUMBER_MAX_LENGTH) {
    return false;
  }
  if (!/^[A-Z0-9]+$/.test(normalized)) {
    return false;
  }
  if (countryCode === "TR") {
    return /^\d{10,11}$/.test(normalized);
  }
  return normalized.length >= 5;
}

export function lockedRegisterCountryCode() {
  return PARTNER_DEFAULT_COUNTRY_CODE;
}

export function parsePartnerApplicationInput(input: {
  email: string;
  phoneCountryCode: string;
  phoneNational: string;
  contactFirstName: string;
  contactLastName: string;
  businessType: string;
  name: string;
  addressLine: string;
  countryCode: string;
  taxOffice: string;
  taxNumber: string;
  password: string;
  confirmPassword: string;
  lockCountryToDefault?: boolean;
  skipPassword?: boolean;
  strictRegisterTaxId?: boolean;
}) {
  const email = input.email.trim();
  const phoneCountryCode = normalizeIso2(input.phoneCountryCode);
  const contactFirstName = normalizePartnerPersonName(input.contactFirstName);
  const contactLastName = normalizePartnerPersonName(input.contactLastName);
  const name = normalizePartnerLegalName(input.name);
  const addressLine = normalizePartnerAddress(input.addressLine);
  const countryCode = input.lockCountryToDefault
    ? lockedRegisterCountryCode()
    : normalizeIso2(input.countryCode);
  const taxOffice = normalizePartnerTaxOffice(input.taxOffice);
  const taxNumber = input.strictRegisterTaxId
    ? normalizePartnerTaxIdDigits(input.taxNumber)
    : normalizePartnerTaxNumber(input.taxNumber);
  const password = input.password;
  const confirmPassword = input.confirmPassword;

  if (!isValidEmail(email)) {
    return { ok: false as const, error: "invalid-email" as const };
  }
  if (!phoneCountryCode || phoneValidity(phoneCountryCode, input.phoneNational) !== "valid") {
    return { ok: false as const, error: "invalid-phone" as const };
  }
  const phone = toE164(phoneCountryCode, input.phoneNational);
  if (!phone) {
    return { ok: false as const, error: "invalid-phone" as const };
  }
  if (
    !contactFirstName ||
    contactFirstName.length > PARTNER_CONTACT_NAME_MAX_LENGTH ||
    !contactLastName ||
    contactLastName.length > PARTNER_CONTACT_NAME_MAX_LENGTH
  ) {
    return { ok: false as const, error: "invalid-contact" as const };
  }
  if (!isPartnerBusinessType(input.businessType)) {
    return { ok: false as const, error: "invalid-business-type" as const };
  }
  if (!name || name.length > PARTNER_NAME_MAX_LENGTH) {
    return { ok: false as const, error: "invalid-name" as const };
  }
  if (!addressLine || addressLine.length > PARTNER_ADDRESS_MAX_LENGTH) {
    return { ok: false as const, error: "invalid-address" as const };
  }
  if (!countryCode || !countryByIso2(countryCode)) {
    return { ok: false as const, error: "invalid-country" as const };
  }
  if (!taxOffice || taxOffice.length > PARTNER_TAX_OFFICE_MAX_LENGTH) {
    return { ok: false as const, error: "invalid-tax-office" as const };
  }
  if (input.strictRegisterTaxId && input.businessType === "individual") {
    if (!isPartnerTaxNumberValid(countryCode, taxNumber, "individual")) {
      return { ok: false as const, error: "invalid-national-id" as const };
    }
  } else if (input.strictRegisterTaxId && input.businessType === "company") {
    if (!isPartnerTaxNumberValid(countryCode, taxNumber, "company")) {
      return { ok: false as const, error: "invalid-tax-number" as const };
    }
  } else if (!isPartnerTaxNumberValid(countryCode, taxNumber)) {
    return { ok: false as const, error: "invalid-tax-number" as const };
  }
  if (!input.skipPassword) {
    if (!isPartnerPasswordLengthValid(password)) {
      return { ok: false as const, error: "password-short" as const };
    }
    if (!partnerPasswordsMatch(password, confirmPassword)) {
      return { ok: false as const, error: "password-mismatch" as const };
    }
  }

  return {
    ok: true as const,
    value: {
      email,
      phone,
      phoneCountryCode,
      contactFirstName,
      contactLastName,
      businessType: input.businessType,
      name,
      addressLine,
      countryCode,
      taxOffice,
      taxNumber,
      password,
    },
  };
}
