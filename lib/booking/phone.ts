import {
  formatIncompletePhoneNumber,
  isSupportedCountry,
  isValidPhoneNumber,
  parseIncompletePhoneNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
  type CountryCode,
} from "libphonenumber-js/max";
import { countryByIso2, normalizeIso2 } from "@/lib/geo/countries";

export type PhoneValidity =
  | "empty"
  | "too_short"
  | "too_long"
  | "invalid_length"
  | "invalid_country"
  | "invalid"
  | "valid";

export function phoneDigits(value: string) {
  return parseIncompletePhoneNumber(value);
}

function asCountry(iso2: string | null | undefined): CountryCode | null {
  const code = normalizeIso2(iso2);
  if (!code || !isSupportedCountry(code)) {
    return null;
  }
  return code;
}

function nationalDigits(iso2: string, local: string) {
  const country = asCountry(iso2);
  const parsed = country
    ? parsePhoneNumberFromString(local, { defaultCountry: country, extract: false })
    : parsePhoneNumberFromString(local);
  if (parsed?.nationalNumber) {
    return parsed.nationalNumber;
  }

  let digits = phoneDigits(local);
  const catalog = countryByIso2(iso2);
  if (catalog && digits.startsWith(catalog.dialCode) && digits.length > catalog.dialCode.length) {
    digits = digits.slice(catalog.dialCode.length);
  }
  if (digits.startsWith("0")) {
    digits = digits.replace(/^0+/, "");
  }
  return digits;
}

function acceptNationalDigits(country: CountryCode, digits: string) {
  let accepted = "";
  for (const digit of digits) {
    const next = accepted + digit;
    if (validatePhoneNumberLength(next, country) === "TOO_LONG") {
      break;
    }
    accepted = next;
  }
  return accepted;
}

export function formatNationalInput(
  iso2: string | null | undefined,
  local: string | null | undefined,
) {
  const country = asCountry(iso2);
  const digits = nationalDigits(iso2 ?? "", local ?? "");
  if (!country) {
    return digits;
  }
  const accepted = acceptNationalDigits(country, digits);
  return formatIncompletePhoneNumber(accepted, country);
}

export function phoneValidity(
  iso2: string | null | undefined,
  local: string | null | undefined,
): PhoneValidity {
  const country = asCountry(iso2);
  const digits = nationalDigits(iso2 ?? "", local ?? "");
  if (!digits) {
    return "empty";
  }
  if (!country) {
    return "invalid_country";
  }
  const length = validatePhoneNumberLength(digits, country);
  if (length === "TOO_SHORT") {
    return "too_short";
  }
  if (length === "TOO_LONG") {
    return "too_long";
  }
  if (length === "INVALID_COUNTRY") {
    return "invalid_country";
  }
  if (length === "NOT_A_NUMBER") {
    return "invalid";
  }
  if (length === "INVALID_LENGTH") {
    return "invalid_length";
  }
  return isValidPhoneNumber(digits, country) ? "valid" : "invalid";
}

export function toE164(iso2: string | null | undefined, local: string | null | undefined) {
  const country = asCountry(iso2);
  const digits = nationalDigits(iso2 ?? "", local ?? "");
  if (!country || !digits || !isValidPhoneNumber(digits, country)) {
    return null;
  }
  return parsePhoneNumberFromString(digits, country)?.number ?? null;
}

export function fromStoredPhone(
  iso2: string | null | undefined,
  e164: string | null | undefined,
) {
  const storedCode = normalizeIso2(iso2);
  const raw = e164?.trim() ?? "";
  if (!raw) {
    return { iso2: storedCode, national: "" };
  }
  const parsed = parsePhoneNumberFromString(raw, asCountry(storedCode) ?? undefined);
  const code = storedCode ?? parsed?.country ?? null;
  const national = parsed?.nationalNumber ?? phoneDigits(raw);
  return {
    iso2: code,
    national: formatNationalInput(code, national),
  };
}

export type EmailValidity = "empty" | "invalid" | "valid";

const EMAIL_MAX_LENGTH = 254;
const EMAIL_SYNTAX =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emailValidity(value: string): EmailValidity {
  const trimmed = value.trim();
  if (!trimmed) {
    return "empty";
  }
  if (trimmed.length > EMAIL_MAX_LENGTH) {
    return "invalid";
  }
  if (trimmed.includes("..") || trimmed.includes(" ")) {
    return "invalid";
  }
  const at = trimmed.indexOf("@");
  if (at <= 0 || at !== trimmed.lastIndexOf("@")) {
    return "invalid";
  }
  const domain = trimmed.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) {
    return "invalid";
  }
  const tld = domain.slice(domain.lastIndexOf(".") + 1);
  if (tld.length < 2) {
    return "invalid";
  }
  if (!EMAIL_SYNTAX.test(trimmed)) {
    return "invalid";
  }
  return "valid";
}

export function isValidEmail(value: string) {
  return emailValidity(value) === "valid";
}
