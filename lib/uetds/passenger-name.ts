import { transliterateUetdsPersonName } from "@/lib/uetds/form-language";

const INVISIBLE_OR_FORMAT =
  /[\u0000-\u001F\u007F\u00AD\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;
const NON_ASCII_SPACE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;

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
 * Never translates person names into Turkish. Turkish letters stay as-is.
 * Used by Ops and Partner ministry payload paths.
 */
export function normalizeUetdsPersonName(value: string) {
  return transliterateUetdsPersonName(
    value
      .normalize("NFC")
      .replace(INVISIBLE_OR_FORMAT, "")
      .replace(NON_ASCII_SPACE, " ")
      .replace(/\s+/g, " ")
      .trim(),
  )
    .replace(/\s+/g, " ")
    .trim();
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
  const parts = normalizeUetdsPersonName(fullName).split(" ").filter(Boolean);
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
 */
export function repairUetdsExtractedPersonNames(input: {
  firstName?: string | null;
  lastName?: string | null;
}): { firstName?: string; lastName?: string } {
  const rawFirst = input.firstName?.trim() ?? "";
  const rawLast = input.lastName?.trim() ?? "";

  if (rawLast) {
    return {
      firstName: rawFirst ? normalizeUetdsPersonName(rawFirst) : undefined,
      lastName: normalizeUetdsPersonName(rawLast),
    };
  }

  if (!rawFirst) {
    return { firstName: undefined, lastName: undefined };
  }

  const normalized = normalizeUetdsPersonName(rawFirst);
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
