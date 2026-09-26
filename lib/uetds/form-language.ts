/**
 * Permanent Turkish / transliteration rules for U-ETDS notification forms.
 * Shared by Ops and Partner (AI extraction, chat/paste fill, PDF/image OCR, manual submit).
 *
 * Person names: transliterate to Latin; never translate.
 * Purpose / meaning-bearing text: translate to Turkish.
 * Pickup / dropoff: prefer airport/hotel/POI identity over street fragments; never reduce to bare city/province.
 * Identifiers (TCKN, passport, phone, plate, refs, dates, times): never rewrite for language.
 */

/** Appended to the Ops/Partner AI extraction instructions for every fill request. */
export const UETDS_FORM_LANGUAGE_AI_RULES = `U-ETDS ministry form language rules (always apply for Ops and Partner, including OCR, pasted text, reservation data, and later "fill the form" / "prepare notification" chat turns):
- Form language is Turkish for meaning-bearing fields.
- Passenger firstName/lastName: NEVER translate into Turkish. Keep the person's real name. If already Latin (including Turkish letters ÇĞİÖŞÜ), preserve it. If Cyrillic, Arabic, Persian, or another non-Latin script, transliterate to the closest Latin letters only (e.g. Алексей Иванов → Aleksey Ivanov). Do not ASCII-fold Turkish letters.
- firstName = given name(s) only; lastName = surname only. Never dump the entire full name into firstName while leaving lastName null/empty. Prefer passport structured GIVEN NAMES / SURNAME (or equivalent labeled fields) over free-text guessing when both exist. Keep surname particles with the surname (da/de/do/dos/das/del/van/von/bin/al/…), e.g. Elton Portela da Silva → firstName "Elton Portela", lastName "da Silva".
- purpose / service description: if foreign-language meaning text, TRANSLATE into natural Turkish (Airport Transfer → Havalimanı Transferi; Hotel Transfer → Otel Transferi; Hourly Chauffeur Service → Saatlik Şoförlü Araç Hizmeti). Transliteration is wrong here.
- origin / destination: return the primary place identity, not a street/door fragment. Priority: (1) airport name + IATA when present (Istanbul Airport (IST) / İstanbul Havalimanı — never Terminal Caddesi No:1); (2) hotel/facility/POI name (Antusa Design Hotel, The Conforium Hotel İstanbul — never only Divanyolu Cd. No:38); (3) full street address only when no airport/hotel/POI name exists; (4) never bare city/province only (e.g. not only İstanbul). Named airports keep existing U-ETDS airport handling. If free-text place wording must be written, use Turkish. Never invent ministry il/ilçe or airport codes.
- Never alter TCKN, passport numbers, phones, plates, dates, times, UETDS refs, group ids, or other official identifiers for language reasons.`;

const CYRILLIC: Record<string, string> = {
  А: "A", а: "a", Б: "B", б: "b", В: "V", в: "v", Г: "G", г: "g", Д: "D", д: "d",
  Е: "E", е: "e", Ё: "Yo", ё: "yo", Ж: "Zh", ж: "zh", З: "Z", з: "z", И: "I", и: "i",
  Й: "Y", й: "y", К: "K", к: "k", Л: "L", л: "l", М: "M", м: "m", Н: "N", н: "n",
  О: "O", о: "o", П: "P", п: "p", Р: "R", р: "r", С: "S", с: "s", Т: "T", т: "t",
  У: "U", у: "u", Ф: "F", ф: "f", Х: "Kh", х: "kh", Ц: "Ts", ц: "ts", Ч: "Ch", ч: "ch",
  Ш: "Sh", ш: "sh", Щ: "Shch", щ: "shch", Ъ: "", ъ: "", Ы: "Y", ы: "y", Ь: "", ь: "",
  Э: "E", э: "e", Ю: "Yu", ю: "yu", Я: "Ya", я: "ya",
  Ї: "Yi", ї: "yi", І: "I", і: "i", Є: "Ye", є: "ye", Ґ: "G", ґ: "g",
};

const ARABIC: Record<string, string> = {
  ا: "a", أ: "a", إ: "i", آ: "a", ب: "b", ت: "t", ث: "th", ج: "j", ح: "h", خ: "kh",
  د: "d", ذ: "dh", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z",
  ع: "a", غ: "gh", ف: "f", ق: "q", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "w",
  ي: "y", ى: "a", ة: "a", ء: "", ئ: "y", ؤ: "w", پ: "p", چ: "ch", ژ: "zh", گ: "g",
  ک: "k", ی: "y", ڤ: "v",
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4", "٥": "5", "٦": "6",
  "٧": "7", "٨": "8", "٩": "9",
};

const PURPOSE_PHRASES: Array<[RegExp, string]> = [
  [/^airport\s+transfer$/i, "Havalimanı Transferi"],
  [/^airport\s+pickup$/i, "Havalimanı Transferi"],
  [/^airport\s+drop[- ]?off$/i, "Havalimanı Transferi"],
  [/^hotel\s+transfer$/i, "Otel Transferi"],
  [/^city\s+transfer$/i, "Şehir Transferi"],
  [/^private\s+transfer$/i, "Özel Transfer"],
  [/^hourly\s+chauffeur(\s+service)?$/i, "Saatlik Şoförlü Araç Hizmeti"],
  [/^chauffeur(\s+service)?$/i, "Şoförlü Araç Hizmeti"],
  [/^point\s+to\s+point$/i, "Noktadan Noktaya Transfer"],
  [/^meet\s+and\s+greet$/i, "Karşılama Hizmeti"],
  [/^vip\s+transfer$/i, "VIP Transfer"],
  [/^transfer$/i, "Transfer"],
  [/^tour$/i, "Tur"],
  [/^charter$/i, "Tahsis"],
  [/^трансфер\s+в\s+аэропорт$/i, "Havalimanı Transferi"],
  [/^трансфер\s+из\s+аэропорта$/i, "Havalimanı Transferi"],
  [/^трансфер$/i, "Transfer"],
  [/^аэропортный\s+трансфер$/i, "Havalimanı Transferi"],
  [/^гостиничный\s+трансфер$/i, "Otel Transferi"],
  [/^نقل\s+المطار$/i, "Havalimanı Transferi"],
  [/^خدمة\s+النقل$/i, "Transfer"],
];

function mapScriptChars(value: string, table: Record<string, string>) {
  let out = "";
  for (const char of value) {
    out += table[char] ?? char;
  }
  return out;
}

/** Latinize non-Latin scripts in person names. Does not translate meaning or strip Turkish letters. */
export function transliterateUetdsPersonName(value: string) {
  let next = value;
  if (/[\u0400-\u04FF]/.test(next)) next = mapScriptChars(next, CYRILLIC);
  if (/[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(next)) {
    next = mapScriptChars(next, ARABIC);
  }
  return next;
}

/**
 * Deterministic Turkish purpose for common foreign phrases.
 * Unknown foreign text is left for AI fill; submit path must not invent translations.
 */
export function normalizeUetdsPurposeText(value: string) {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  for (const [pattern, turkish] of PURPOSE_PHRASES) {
    if (pattern.test(trimmed)) return turkish;
  }
  return trimmed;
}

export function purposeLooksForeign(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/[\u0400-\u04FF\u0600-\u06FF]/.test(trimmed)) return true;
  return /\b(airport|transfer|hotel|chauffeur|hourly|pickup|drop[- ]?off|meet\s+and\s+greet|point\s+to\s+point)\b/i.test(trimmed)
    && !/[çğıöşüÇĞİÖŞÜ]/.test(trimmed);
}
