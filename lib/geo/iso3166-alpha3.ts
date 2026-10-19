/** ISO 3166-1 alpha-3 → alpha-2, plus ICAO 9303 exceptional codes used on MRZ. */
const ISO3_TO_ISO2: Record<string, string> = {
  AND: "AD", ARE: "AE", AFG: "AF", ATG: "AG", AIA: "AI", ALB: "AL", ARM: "AM",
  AGO: "AO", ATA: "AQ", ARG: "AR", ASM: "AS", AUT: "AT", AUS: "AU", ABW: "AW",
  ALA: "AX", AZE: "AZ", BIH: "BA", BRB: "BB", BGD: "BD", BEL: "BE", BFA: "BF",
  BGR: "BG", BHR: "BH", BDI: "BI", BEN: "BJ", BLM: "BL", BMU: "BM", BRN: "BN",
  BOL: "BO", BES: "BQ", BRA: "BR", BHS: "BS", BTN: "BT", BVT: "BV", BWA: "BW",
  BLR: "BY", BLZ: "BZ", CAN: "CA", CCK: "CC", COD: "CD", CAF: "CF", COG: "CG",
  CHE: "CH", CIV: "CI", COK: "CK", CHL: "CL", CMR: "CM", CHN: "CN", COL: "CO",
  CRI: "CR", CUB: "CU", CPV: "CV", CUW: "CW", CXR: "CX", CYP: "CY", CZE: "CZ",
  DEU: "DE", DJI: "DJ", DNK: "DK", DMA: "DM", DOM: "DO", DZA: "DZ", ECU: "EC",
  EST: "EE", EGY: "EG", ESH: "EH", ERI: "ER", ESP: "ES", ETH: "ET", FIN: "FI",
  FJI: "FJ", FLK: "FK", FSM: "FM", FRO: "FO", FRA: "FR", GAB: "GA", GBR: "GB",
  GRD: "GD", GEO: "GE", GUF: "GF", GGY: "GG", GHA: "GH", GIB: "GI", GRL: "GL",
  GMB: "GM", GIN: "GN", GLP: "GP", GNQ: "GQ", GRC: "GR", SGS: "GS", GTM: "GT",
  GUM: "GU", GNB: "GW", GUY: "GY", HKG: "HK", HMD: "HM", HND: "HN", HRV: "HR",
  HTI: "HT", HUN: "HU", IDN: "ID", IRL: "IE", ISR: "IL", IMN: "IM", IND: "IN",
  IOT: "IO", IRQ: "IQ", IRN: "IR", ISL: "IS", ITA: "IT", JEY: "JE", JAM: "JM",
  JOR: "JO", JPN: "JP", KEN: "KE", KGZ: "KG", KHM: "KH", KIR: "KI", COM: "KM",
  KNA: "KN", PRK: "KP", KOR: "KR", KWT: "KW", CYM: "KY", KAZ: "KZ", LAO: "LA",
  LBN: "LB", LCA: "LC", LIE: "LI", LKA: "LK", LBR: "LR", LSO: "LS", LTU: "LT",
  LUX: "LU", LVA: "LV", LBY: "LY", MAR: "MA", MCO: "MC", MDA: "MD", MNE: "ME",
  MAF: "MF", MDG: "MG", MHL: "MH", MKD: "MK", MLI: "ML", MMR: "MM", MNG: "MN",
  MAC: "MO", MNP: "MP", MTQ: "MQ", MRT: "MR", MSR: "MS", MLT: "MT", MUS: "MU",
  MDV: "MV", MWI: "MW", MEX: "MX", MYS: "MY", MOZ: "MZ", NAM: "NA", NCL: "NC",
  NER: "NE", NFK: "NF", NGA: "NG", NIC: "NI", NLD: "NL", NOR: "NO", NPL: "NP",
  NRU: "NR", NIU: "NU", NZL: "NZ", OMN: "OM", PAN: "PA", PER: "PE", PYF: "PF",
  PNG: "PG", PHL: "PH", PAK: "PK", POL: "PL", SPM: "PM", PCN: "PN", PRI: "PR",
  PSE: "PS", PRT: "PT", PLW: "PW", PRY: "PY", QAT: "QA", REU: "RE", ROU: "RO",
  SRB: "RS", RUS: "RU", RWA: "RW", SAU: "SA", SLB: "SB", SYC: "SC", SDN: "SD",
  SWE: "SE", SGP: "SG", SHN: "SH", SVN: "SI", SJM: "SJ", SVK: "SK", SLE: "SL",
  SMR: "SM", SEN: "SN", SOM: "SO", SUR: "SR", SSD: "SS", STP: "ST", SLV: "SV",
  SXM: "SX", SYR: "SY", SWZ: "SZ", TCA: "TC", TCD: "TD", ATF: "TF", TGO: "TG",
  THA: "TH", TJK: "TJ", TKL: "TK", TLS: "TL", TKM: "TM", TUN: "TN", TON: "TO",
  TUR: "TR", TTO: "TT", TUV: "TV", TWN: "TW", TZA: "TZ", UKR: "UA", UGA: "UG",
  UMI: "UM", USA: "US", URY: "UY", UZB: "UZ", VAT: "VA", VCT: "VC", VEN: "VE",
  VGB: "VG", VIR: "VI", VNM: "VN", VUT: "VU", WLF: "WF", WSM: "WS", YEM: "YE",
  MYT: "YT", ZAF: "ZA", ZMB: "ZM", ZWE: "ZW",
  // ICAO 9303 / travel-document exceptions
  D: "DE",
  GBD: "GB",
  GBN: "GB",
  GBO: "GB",
  GBP: "GB",
  GBS: "GB",
  UNA: "UN",
  UNO: "UN",
  XKX: "XK",
  RKS: "XK",
};

/** Passport NATIONALITY adjectives and “Republic of …” phrases → ISO2. */
const NATIONALITY_PHRASE_TO_ISO2: Record<string, string> = {
  iraq: "IQ",
  iraqi: "IQ",
  iraqian: "IQ",
  iraki: "IQ",
  iraklı: "IQ",
  irakli: "IQ",
  turkish: "TR",
  turk: "TR",
  german: "DE",
  deutsche: "DE",
  french: "FR",
  francaise: "FR",
  british: "GB",
  english: "GB",
  american: "US",
  russian: "RU",
  chinese: "CN",
  egyptian: "EG",
  syrian: "SY",
  jordanian: "JO",
  lebanese: "LB",
  palestinian: "PS",
  saudi: "SA",
  emirati: "AE",
  kuwaiti: "KW",
  qatari: "QA",
  bahraini: "BH",
  omani: "OM",
  yemeni: "YE",
  iranian: "IR",
  persian: "IR",
  libyan: "LY",
  tunisian: "TN",
  algerian: "DZ",
  moroccan: "MA",
  sudanese: "SD",
  somali: "SO",
  kenyan: "KE",
  nigerian: "NG",
  ghanaian: "GH",
  indian: "IN",
  pakistani: "PK",
  bangladeshi: "BD",
  afghan: "AF",
  uzbek: "UZ",
  kazakh: "KZ",
  azerbaijani: "AZ",
  georgian: "GE",
  armenian: "AM",
  ukrainian: "UA",
  polish: "PL",
  italian: "IT",
  spanish: "ES",
  portuguese: "PT",
  dutch: "NL",
  belgian: "BE",
  swiss: "CH",
  austrian: "AT",
  swedish: "SE",
  norwegian: "NO",
  danish: "DK",
  finnish: "FI",
  greek: "GR",
  bulgarian: "BG",
  romanian: "RO",
  hungarian: "HU",
  czech: "CZ",
  slovak: "SK",
  croatian: "HR",
  serbian: "RS",
  bosnian: "BA",
  albanian: "AL",
  korean: "KR",
  japanese: "JP",
  vietnamese: "VN",
  thai: "TH",
  indonesian: "ID",
  malaysian: "MY",
  filipino: "PH",
  brazilian: "BR",
  mexican: "MX",
  argentine: "AR",
  argentinian: "AR",
  colombian: "CO",
  chilean: "CL",
  peruvian: "PE",
  canadian: "CA",
  australian: "AU",
  newzealander: "NZ",
  southafrican: "ZA",
  israeli: "IL",
  palestinianauthority: "PS",
};

function foldPhrase(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en-US")
    .replace(/[^a-z]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function iso2FromIso3(code: string | null | undefined): string | null {
  const folded = (code ?? "").trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (folded.length < 1 || folded.length > 3) return null;
  return ISO3_TO_ISO2[folded] ?? null;
}

export function iso2FromNationalityPhrase(value: string | null | undefined): string | null {
  const folded = foldPhrase(value ?? "");
  if (!folded) return null;
  const stripped = folded
    .replace(/^(the|el|la|le|der|die|das)\s+/, "")
    .replace(/^republic of(?: the)?\s+/, "")
    .replace(/^islamic republic of(?: the)?\s+/, "")
    .replace(/^kingdom of(?: the)?\s+/, "")
    .replace(/^state of(?: the)?\s+/, "")
    .trim();
  const compact = stripped.replace(/\s+/g, "");
  return NATIONALITY_PHRASE_TO_ISO2[stripped] ?? NATIONALITY_PHRASE_TO_ISO2[compact] ?? null;
}
