export type TransferProvinceCode =
  | "istanbul"
  | "bursa"
  | "yalova"
  | "antalya"
  | "other";

export type LocationGeo = {
  provinceCode: TransferProvinceCode;
  districtCode: string | null;
};

export const ISTANBUL_DISTRICT_CODES = [
  "adalar",
  "arnavutkoy",
  "atasehir",
  "avcilar",
  "bagcilar",
  "bahcelievler",
  "bakirkoy",
  "basaksehir",
  "bayrampasa",
  "besiktas",
  "beykoz",
  "beylikduzu",
  "beyoglu",
  "buyukcekmece",
  "catalca",
  "cekmekoy",
  "esenler",
  "esenyurt",
  "eyupsultan",
  "fatih",
  "gaziosmanpasa",
  "gungoren",
  "kadikoy",
  "kagithane",
  "kartal",
  "kucukcekmece",
  "maltepe",
  "pendik",
  "sancaktepe",
  "sariyer",
  "silivri",
  "sultanbeyli",
  "sultangazi",
  "sile",
  "sisli",
  "tuzla",
  "umraniye",
  "uskudar",
  "zeytinburnu",
] as const;

export type IstanbulDistrictCode = (typeof ISTANBUL_DISTRICT_CODES)[number];

const ISTANBUL_DISTRICT_SET = new Set<string>(ISTANBUL_DISTRICT_CODES);

const SPECIAL_PROVINCES = new Set<string>([
  "istanbul",
  "bursa",
  "yalova",
  "antalya",
]);

/**
 * Language-independent aliases for Google address-component tokens.
 * Keys are lowercase Unicode (Cyrillic kept) or ASCII folds.
 */
const WORD_ALIASES: Record<string, string> = {
  tr: "tr",
  turkey: "tr",
  turkiye: "tr",
  турция: "tr",
  türkiye: "tr",

  istanbul: "istanbul",
  стамбул: "istanbul",

  bursa: "bursa",
  бурса: "bursa",

  yalova: "yalova",
  ялова: "yalova",

  antalya: "antalya",
  анталья: "antalya",
  анталия: "antalya",

  eyup: "eyupsultan",
  eyupsultan: "eyupsultan",
  gop: "gaziosmanpasa",

  taksim: "beyoglu",
  таксим: "beyoglu",

  адалар: "adalar",
  арнавуткёй: "arnavutkoy",
  арнавуткой: "arnavutkoy",
  аташехир: "atasehir",
  авджилар: "avcilar",
  багджылар: "bagcilar",
  бахчелиэвлер: "bahcelievler",
  бакыркёй: "bakirkoy",
  бакыркой: "bakirkoy",
  башакшехир: "basaksehir",
  байрампаша: "bayrampasa",
  бешикташ: "besiktas",
  бейкоз: "beykoz",
  бейликдюзю: "beylikduzu",
  бейоглу: "beyoglu",
  бююкчекмедже: "buyukcekmece",
  чаталджа: "catalca",
  чекмекёй: "cekmekoy",
  чекмекой: "cekmekoy",
  эсенлер: "esenler",
  эсеньюрт: "esenyurt",
  эюпсультан: "eyupsultan",
  эюп: "eyupsultan",
  фатих: "fatih",
  газиосманпаша: "gaziosmanpasa",
  гюнгорен: "gungoren",
  кадыкёй: "kadikoy",
  кадыкой: "kadikoy",
  кягытхане: "kagithane",
  кагытхане: "kagithane",
  картал: "kartal",
  кючюкчекмедже: "kucukcekmece",
  малтепе: "maltepe",
  пендик: "pendik",
  санджактепе: "sancaktepe",
  сарыер: "sariyer",
  силиври: "silivri",
  султанбейли: "sultanbeyli",
  султангази: "sultangazi",
  шиле: "sile",
  шишли: "sisli",
  тузла: "tuzla",
  умрание: "umraniye",
  ускюдар: "uskudar",
  зейтинбурну: "zeytinburnu",
};

const TOKEN_NOISE = new Set([
  "province",
  "region",
  "ili",
  "il",
  "oblast",
  "провинция",
  "ил",
  "илы",
  "область",
]);

export type AddressComponents = {
  city?: string | null;
  district?: string | null;
  region?: string | null;
  country?: string | null;
  countryCode?: string | null;
  airportCode?: string | null;
};

const AIRPORT_GEO: Record<string, LocationGeo> = {
  IST: { provinceCode: "istanbul", districtCode: "arnavutkoy" },
  SAW: { provinceCode: "istanbul", districtCode: "pendik" },
  AYT: { provinceCode: "antalya", districtCode: null },
};

export function geoForAirportCode(code: string | null | undefined): LocationGeo | null {
  const airportCode = code?.trim().toUpperCase() ?? "";
  return AIRPORT_GEO[airportCode] ?? null;
}

export function isCanonicalProvinceCode(
  value: string | null | undefined,
): value is TransferProvinceCode {
  return (
    value === "istanbul" ||
    value === "bursa" ||
    value === "yalova" ||
    value === "antalya" ||
    value === "other"
  );
}

export function isTrustedStoredProvince(
  value: string | null | undefined,
): value is Exclude<TransferProvinceCode, "other"> {
  return (
    value === "istanbul" ||
    value === "bursa" ||
    value === "yalova" ||
    value === "antalya"
  );
}

export function canonicalDistrictCode(
  value: string | null | undefined,
): IstanbulDistrictCode | null {
  if (!value) {
    return null;
  }
  return matchDistrict(value);
}

export function foldPlaceName(value: string): string {
  return value
    .replaceAll("İ", "i")
    .replaceAll("I", "i")
    .replaceAll("ı", "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function normalizeWord(raw: string): string {
  const unicodeKey = raw.toLowerCase();
  const aliased = WORD_ALIASES[unicodeKey];
  if (aliased) {
    return aliased;
  }
  const folded = foldPlaceName(raw);
  if (!folded) {
    return unicodeKey;
  }
  return WORD_ALIASES[folded] ?? folded;
}

function componentWords(value: string | null | undefined): string[] {
  if (!value?.trim()) {
    return [];
  }
  return value
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .map(normalizeWord)
    .filter((word) => word.length > 0 && !TOKEN_NOISE.has(word));
}

function exclusiveProvince(words: string[]): TransferProvinceCode | null {
  const geographic = words.filter((word) => word !== "tr");
  const provinces = geographic.filter((word) => SPECIAL_PROVINCES.has(word));
  if (provinces.length !== 1) {
    return null;
  }
  const rest = geographic.filter((word) => word !== provinces[0]);
  if (rest.length > 0) {
    return null;
  }
  return provinces[0] as TransferProvinceCode;
}

function isTurkeyCountry(components: AddressComponents) {
  const iso = components.countryCode?.trim().toUpperCase() ?? "";
  if (iso) {
    return iso === "TR";
  }
  const words = componentWords(components.country);
  if (words.length === 0) {
    return true;
  }
  return words.every((word) => word === "tr");
}

function asDistrict(word: string): IstanbulDistrictCode | null {
  if (SPECIAL_PROVINCES.has(word) || word === "tr") {
    return null;
  }
  if (ISTANBUL_DISTRICT_SET.has(word)) {
    return word as IstanbulDistrictCode;
  }
  return null;
}

function matchDistrict(raw: string | null | undefined): IstanbulDistrictCode | null {
  if (!raw) {
    return null;
  }
  for (const word of componentWords(raw)) {
    const district = asDistrict(word);
    if (district) {
      return district;
    }
  }
  const folded = foldPlaceName(raw);
  return asDistrict(WORD_ALIASES[folded] ?? folded);
}

/**
 * Uses structured Google address components / airport presets.
 * Does not scan formattedAddress, so a street such as "İstanbul Caddesi"
 * cannot be treated as Istanbul province.
 */
export function classifyTransferLocation(components: AddressComponents): LocationGeo {
  const airportGeo = geoForAirportCode(components.airportCode);
  if (airportGeo) {
    return airportGeo;
  }

  if (!isTurkeyCountry(components)) {
    return { provinceCode: "other", districtCode: null };
  }

  const regionWords = componentWords(components.region);
  const cityWords = componentWords(components.city);
  const province = exclusiveProvince(regionWords) ?? exclusiveProvince(cityWords);

  if (province === "istanbul") {
    const district =
      matchDistrict(components.district) ??
      (exclusiveProvince(cityWords) === "istanbul"
        ? null
        : matchDistrict(components.city));
    return { provinceCode: "istanbul", districtCode: district };
  }

  if (province) {
    return { provinceCode: province, districtCode: null };
  }

  const districtOnly =
    matchDistrict(components.district) ?? matchDistrict(components.city);
  if (districtOnly) {
    return { provinceCode: "istanbul", districtCode: districtOnly };
  }

  return { provinceCode: "other", districtCode: null };
}
