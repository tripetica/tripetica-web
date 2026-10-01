import { transliterateUetdsPersonName } from "@/lib/uetds/form-language";

const INVISIBLE_OR_FORMAT =
  /[\u0000-\u001F\u007F\u00AD\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;
const NON_ASCII_SPACE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

/**
 * Characters NFKD does not reliably map to English ASCII letters.
 * Ligatures expand (æ→ae); Scandinavian/slashed letters fold to base Latin.
 */
const UETDS_PERSON_NAME_ASCII_SPECIAL: Record<string, string> = {
  ø: "o",
  Ø: "O",
  ł: "l",
  Ł: "L",
  đ: "d",
  Đ: "D",
  ð: "d",
  Ð: "D",
  þ: "th",
  Þ: "Th",
  æ: "ae",
  Æ: "Ae",
  œ: "oe",
  Œ: "Oe",
  ß: "ss",
  ẞ: "Ss",
  // Turkish / Azerbaijani letters that need explicit maps (ı stays after NFKD).
  ı: "i",
  İ: "I",
  ğ: "g",
  Ğ: "G",
  ş: "s",
  Ş: "S",
  ç: "c",
  Ç: "C",
  ö: "o",
  Ö: "O",
  ü: "u",
  Ü: "U",
};

/**
 * Common surname particles (case-insensitive). Used only when repairing a full
 * name dumped into firstName with an empty lastName — never invents tokens.
 */
const UETDS_SURNAME_PARTICLES = new Set([
  "da",
  "das",
  "de",
  "del",
  "della",
  "delle",
  "dello",
  "di",
  "do",
  "dos",
  "du",
  "la",
  "le",
  "van",
  "von",
  "bin",
  "bint",
  "al",
  "el",
]);

/**
 * Strip iOS/invisible characters, then Latinize non-Latin scripts.
 * Never translates names; reuse the existing ASCII fold and separator cleanup.
 * Used by Ops and Partner ministry payload paths (manual/ministry submit).
 */
export function normalizeUetdsPersonName(value: string) {
  return foldUetdsPersonNameToEnglishAscii(transliterateUetdsPersonName(
    value
      .normalize("NFC")
      .replace(INVISIBLE_OR_FORMAT, "")
      .replace(NON_ASCII_SPACE, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ));
}

/**
 * Shared deterministic English-ASCII fold for U-ETDS names.
 * After script transliteration, maps special Latin letters (ø, æ, ı, …) and
 * strips remaining diacritics and replaces separators with spaces.
 */
export function foldUetdsPersonNameToEnglishAscii(value: string) {
  let out = "";
  for (const char of value) {
    if (Object.prototype.hasOwnProperty.call(UETDS_PERSON_NAME_ASCII_SPECIAL, char)) {
      out += UETDS_PERSON_NAME_ASCII_SPECIAL[char]!;
      continue;
    }
    // Normalize curly / typographic apostrophes to ASCII apostrophe.
    if (char === "\u2019" || char === "\u2018" || char === "\u02BC" || char === "`") {
      out += "'";
      continue;
    }
    out += char;
  }
  out = out
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
  // Replace non-letter separators with spaces so words never join.
  out = out.replace(/[^A-Za-z\s]/g, " ");
  return out.replace(/\s+/g, " ").trim();
}

/**
 * AI extraction pipeline only: transliterate non-Latin scripts, then fold to
 * English ASCII A–Z/a–z using the same normalization as SOAP.
 */
export function normalizeUetdsExtractedPersonName(value: string) {
  return normalizeUetdsPersonName(value);
}

export function uetdsPersonNameTooLong(value: string) {
  return normalizeUetdsPersonName(value).length > 50;
}

function isSurnameParticle(token: string) {
  return UETDS_SURNAME_PARTICLES.has(token.toLocaleLowerCase("en-US"));
}

/**
 * Split a free-text full name into given names + surname.
 * Prefers the first non-leading surname particle (da/de/van/…) through the end;
 * otherwise uses the last token as surname. Single-token names keep lastName empty.
 */
export function splitUetdsFullPersonName(fullName: string): {
  firstName: string;
  lastName: string;
} {
  const parts = normalizeUetdsExtractedPersonName(fullName).split(" ").filter(Boolean);
  if (parts.length === 0) {
    return { firstName: "", lastName: "" };
  }
  if (parts.length === 1) {
    return { firstName: parts[0]!, lastName: "" };
  }

  let particleIndex = -1;
  for (let i = 1; i < parts.length; i++) {
    if (isSurnameParticle(parts[i]!)) {
      particleIndex = i;
      break;
    }
  }
  // Particle must have at least one following surname token (e.g. "da Silva").
  if (particleIndex > 0 && particleIndex < parts.length - 1) {
    return {
      firstName: parts.slice(0, particleIndex).join(" "),
      lastName: parts.slice(particleIndex).join(" "),
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1]!,
  };
}

/**
 * Deterministic post-AI repair: when firstName holds a multi-word full name and
 * lastName is empty, split safely. Never overwrites a non-empty lastName and
 * never invents a surname for a single-token given name.
 * Applies English-ASCII normalization to AI-extracted given/surname fields only.
 */
/** Airline and voucher form SURNAME/GIVEN, e.g. SUN/CHONG → surname SUN, given CHONG. */
export function splitUetdsSurnameSlashGiven(value: string): { firstName: string; lastName: string } | null {
  const withoutDocument = value.trim().replace(/\s*[=:#]\s*[A-Za-z0-9][A-Za-z0-9-]{4,20}\s*$/u, "").trim();
  const match = withoutDocument.match(/^([A-Za-z]{2,40})\s*\/\s*([A-Za-z]+(?:\s+[A-Za-z]+){0,4})$/);
  if (!match) return null;
  const lastName = normalizeUetdsExtractedPersonName(match[1]!);
  const firstName = normalizeUetdsExtractedPersonName(match[2]!);
  if (!lastName || !firstName) return null;
  return { firstName, lastName };
}

export function repairUetdsExtractedPersonNames(input: {
  firstName?: string | null;
  lastName?: string | null;
}): { firstName?: string; lastName?: string } {
  const rawFirst = input.firstName?.trim() ?? "";
  const rawLast = input.lastName?.trim() ?? "";
  const slash = [rawFirst, rawLast].map(splitUetdsSurnameSlashGiven).find((item) => item != null);
  if (slash) return slash;

  if (rawLast) {
    return {
      firstName: rawFirst ? normalizeUetdsExtractedPersonName(rawFirst) : undefined,
      lastName: normalizeUetdsExtractedPersonName(rawLast),
    };
  }

  if (!rawFirst) {
    return { firstName: undefined, lastName: undefined };
  }

  const normalized = normalizeUetdsExtractedPersonName(rawFirst);
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length < 2) {
    return { firstName: normalized || undefined, lastName: undefined };
  }

  const split = splitUetdsFullPersonName(normalized);
  return {
    firstName: split.firstName || undefined,
    lastName: split.lastName || undefined,
  };
}
