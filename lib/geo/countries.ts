import { type Locale } from "@/lib/i18n/config";
import { COUNTRY_RECORDS, type CountryRecord } from "@/lib/geo/countries-data";

export type { CountryRecord, CountryNames } from "@/lib/geo/countries-data";

const ISO2_RE = /^[A-Z]{2}$/;

const byIso2 = new Map(
  COUNTRY_RECORDS.map((country) => [country.iso2, country] as const),
);

export function countries(): readonly CountryRecord[] {
  return COUNTRY_RECORDS;
}

export function countryCount() {
  return COUNTRY_RECORDS.length;
}

export function normalizeIso2(value: string | null | undefined) {
  const code = value?.trim().toUpperCase() ?? "";
  return ISO2_RE.test(code) ? code : null;
}

export function countryByIso2(value: string | null | undefined) {
  const code = normalizeIso2(value);
  return code ? byIso2.get(code) ?? null : null;
}

export function countryName(value: string | null | undefined, locale: Locale) {
  return countryByIso2(value)?.names[locale] ?? null;
}

/** E.164 country calling code digits, without `+`. */
export function countryDialCode(value: string | null | undefined) {
  return countryByIso2(value)?.dialCode ?? null;
}

export function formatDialCode(value: string | null | undefined) {
  const dial = countryDialCode(value);
  return dial ? `+${dial}` : null;
}

/** Regional-indicator flag emoji from ISO 3166-1 alpha-2. */
export function countryFlagEmoji(value: string | null | undefined) {
  const code = normalizeIso2(value);
  if (!code) {
    return null;
  }
  return String.fromCodePoint(
    ...[...code].map((char) => 0x1f1e6 - 65 + char.charCodeAt(0)),
  );
}

function fold(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function rankCountry(country: CountryRecord, locale: Locale, needle: string) {
  const name = fold(country.names[locale]);
  const aliases = (country.aliases?.[locale] ?? []).map(fold);
  if (name === needle || country.iso2.toLowerCase() === needle) {
    return 0;
  }
  if (aliases.includes(needle)) {
    return 1;
  }
  if (name.startsWith(needle) || aliases.some((alias) => alias.startsWith(needle))) {
    return 2;
  }
  if (name.includes(needle) || aliases.some((alias) => alias.includes(needle))) {
    return 3;
  }
  return null;
}

/** Locale-name search for nationality or phone-code pickers. Independent of the other field. */
export function searchCountries(query: string, locale: Locale): CountryRecord[] {
  const needle = fold(query);
  const list = [...COUNTRY_RECORDS];
  if (!needle) {
    return list.sort((a, b) =>
      a.names[locale].localeCompare(b.names[locale], locale, { sensitivity: "base" }),
    );
  }
  return list
    .map((country) => ({ country, rank: rankCountry(country, locale, needle) }))
    .filter((item): item is { country: CountryRecord; rank: number } => item.rank !== null)
    .sort((a, b) => {
      if (a.rank !== b.rank) {
        return a.rank - b.rank;
      }
      return a.country.names[locale].localeCompare(b.country.names[locale], locale, {
        sensitivity: "base",
      });
    })
    .map((item) => item.country);
}
