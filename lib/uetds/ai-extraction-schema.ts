import { countryIso2FromName, mergeExtractedDraft, type UetdsExtractedDraft } from "@/lib/uetds/extract";
import { purposeForTripKind, type UetdsDraft, type UetdsTripKind } from "@/lib/uetds/draft";
import { normalizeUetdsFare } from "@/lib/uetds/fare";
import { normalizeUetdsPurposeText } from "@/lib/uetds/form-language";
import { repairUetdsExtractedPersonNames } from "@/lib/uetds/passenger-name";
import { preferUetdsPlaceQuery } from "@/lib/uetds/place-query";
import { resolveOfficialUetdsLocation } from "@/lib/uetds/official-locations";
import { applyUetdsAiExtractionTripTimes } from "@/lib/uetds/trip-time";

export const AI_EXTRACTION_MAX_TEXT = 30_000;
export const AI_EXTRACTION_MAX_PASSENGERS = 60;
export const AI_MISSING_PASSENGER_IDENTITY = "11111111111";
export type AiUetdsExtractedDraft = UetdsExtractedDraft & { tripKind?: UetdsTripKind };
export type AiExtractionErrorCode = "invalid" | "too-large" | "unsupported-type" | "unavailable" | "model-unavailable" | "timeout" | "busy" | "failed";
export class AiExtractionError extends Error {
  constructor(public readonly code: AiExtractionErrorCode) { super(code); }
}

type NullableField = { type: string[]; description: string; maxLength: number; enum?: (string | null)[] };
const field = (description: string, maxLength = 300): NullableField => ({ type: ["string", "null"], description, maxLength });
const tripFields = {
  origin: field(
    "Pickup place identity for Google Places / U-ETDS. Priority when the source lists several parts: (1) airport name + IATA when present (e.g. Istanbul Airport (IST) or İstanbul Havalimanı) — never replace with a street/terminal fragment like Terminal Caddesi No:1; (2) hotel/facility/POI name (e.g. Antusa Design Hotel, The Conforium Hotel İstanbul); (3) full street address only when no airport/hotel/POI name exists; (4) never output only a bare city/province (e.g. not only İstanbul). Prefer Turkish wording for place names when the source is foreign, but do not invent missing address details or ministry il/ilçe codes.",
  ),
  destination: field(
    "Dropoff place identity for Google Places / U-ETDS. Same priority as origin: airport name+IATA > hotel/facility/POI name > full street address > never bare city/province. Example: Antusa Design Hotel, Alemdar, Divan Yolu Cd. No:38… → Antusa Design Hotel (not Divanyolu Cd. No:38). Sabiha / SAW stays the airport identity, not Pendik street text. Prefer Turkish wording when needed; never invent ministry il/ilçe codes.",
  ),
  startDate: field("YYYY-MM-DD only when year, month and day are explicit and unambiguous. Otherwise null.", 10),
  startTime: field("HH:mm local source time only when explicit. Do not infer from a flight or add a timezone.", 5),
  endDate: field("YYYY-MM-DD only with an explicit, complete end date including year; otherwise null.", 10),
  endTime: field("HH:mm only with explicit end time. Never calculate a duration.", 5),
  tripKind: { ...field("Explicit service type only: transfer, tour, charter or other.", 10), enum: ["transfer", "tour", "charter", "other", null] },
  purpose: field("Service description in natural Turkish. Translate foreign purpose text (e.g. Airport Transfer → Havalimanı Transferi); never invent a description.", 500),
  fare: field("Explicit nonnegative group/transport fee as a decimal string without currency. Never infer or calculate.", 30),
  flightCode: field("Flight code explicitly present in the source; otherwise null.", 20),
};
const passengerFields = {
  firstName: field(
    "Given name(s) ONLY — not the full name. When the source shows passport GIVEN NAMES / SURNAME (or equivalent), prefer those structured fields. Never put the entire full name here while leaving lastName null/empty. Multi-word given names stay here (e.g. Elton Portela). Never translate into Turkish. Output English ASCII letters A-Z/a-z only (Højris→Hojris, Müller→Muller, Şahin→Sahin); spaces OK. Non-Latin scripts → English ASCII transliteration (Алексей → Aleksey).",
    100,
  ),
  lastName: field(
    "Surname ONLY. Include surname particles with the surname (da, de, do, dos, das, del, van, von, bin, al, …) — e.g. da Silva, van Beethoven. When the source shows passport SURNAME / GIVEN NAMES, prefer those structured fields. Never leave lastName null/empty when a multi-word full name is present in the source. Never translate into Turkish. Output English ASCII letters A-Z/a-z only (Østergaard→Ostergaard, Louens stays Louens); spaces OK. Non-Latin scripts → English ASCII transliteration (Иванов → Ivanov).",
    100,
  ),
  nationality: {
    type: ["string"],
    description:
      "Passenger nationality/citizenship, preferably ISO 3166-1 alpha-2. Use an explicit source value when present. If missing, always infer the single most likely country by jointly weighing given name/surname plus any visible phone numbers, dialing country/area codes, source language, and other nationality-relevant clues; do not ignore those clues, do not treat any one indirect signal as definitive citizenship, and if no extra clues exist fall back to name-only inference. Never leave blank for an identified passenger and never use trip destination alone as nationality.",
    maxLength: 80,
  },
  identityNumber: field("Exact explicit identity/passport number. Null if absent or unreadable; never fabricate or complete digits.", 40),
  gender: {
    type: ["string"],
    description:
      "Passenger sex/gender: male or female only. Use an explicit source value when present. If missing, always infer the most likely gender from the passenger's given name and surname; never leave blank for an identified passenger.",
    maxLength: 6,
    enum: ["male", "female"],
  },
};
export const UETDS_AI_EXTRACTION_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    ...tripFields,
    passengers: { type: "array", maxItems: AI_EXTRACTION_MAX_PASSENGERS, items: {
      type: "object", additionalProperties: false, properties: passengerFields, required: Object.keys(passengerFields),
    } },
  },
  required: [...Object.keys(tripFields), "passengers"],
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AiExtractionError("failed");
  return value as Record<string, unknown>;
}
function readFields(value: Record<string, unknown>, fields: Record<string, NullableField>) {
  const result: Record<string, string | null> = {};
  for (const [key, rule] of Object.entries(fields)) {
    const item = value[key];
    const allowsNull = rule.type.includes("null");
    if (item === null) {
      if (!allowsNull) throw new AiExtractionError("failed");
      result[key] = null;
      continue;
    }
    if (typeof item !== "string" || item.length > rule.maxLength) throw new AiExtractionError("failed");
    if (rule.enum && !rule.enum.includes(item)) throw new AiExtractionError("failed");
    const trimmed = item.trim();
    if (!trimmed && !allowsNull) throw new AiExtractionError("failed");
    result[key] = trimmed || null;
  }
  return result;
}
function fullDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : undefined;
}
const time = (value: string | null) => value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;

/** Validate the strict structured response, then omit unknown values from the canonical prefill. */
export function mapAiUetdsExtraction(raw: unknown): AiUetdsExtractedDraft {
  const value = record(raw);
  if (Object.keys(value).some(key => !UETDS_AI_EXTRACTION_SCHEMA.required.includes(key)) || !Array.isArray(value.passengers) || value.passengers.length > AI_EXTRACTION_MAX_PASSENGERS) throw new AiExtractionError("failed");
  const trip = readFields(value, tripFields);
  const tripKind = trip.tripKind as UetdsTripKind | null;
  // The canonical form has no flight-code field: retain explicit flight information in its description.
  const purposeParts = [
    trip.purpose ? normalizeUetdsPurposeText(trip.purpose) : (tripKind ? purposeForTripKind(tripKind) : ""),
    trip.flightCode ? `Uçuş: ${trip.flightCode}` : "",
  ].filter(Boolean);
  const purpose = purposeParts.join(" · ");
  return {
    origin: trip.origin ? preferUetdsPlaceQuery(trip.origin) || undefined : undefined,
    destination: trip.destination ? preferUetdsPlaceQuery(trip.destination) || undefined : undefined,
    startDate: fullDate(trip.startDate), startTime: time(trip.startTime),
    endDate: fullDate(trip.endDate), endTime: time(trip.endTime),
    tripKind: tripKind || undefined, purpose: purpose || undefined,
    fare: trip.fare ? normalizeUetdsFare(trip.fare) ?? undefined : undefined,
    passengers: value.passengers.map(item => {
      const row = record(item);
      if (Object.keys(row).some(key => !(key in passengerFields))) throw new AiExtractionError("failed");
      const p = readFields(row, passengerFields);
      const names = repairUetdsExtractedPersonNames({
        firstName: p.firstName,
        lastName: p.lastName,
      });
      return {
        firstName: names.firstName,
        lastName: names.lastName,
        nationality: countryIso2FromName(p.nationality) || undefined,
        // Identity numbers stay exact; never transliterate or translate.
        identityNumber: p.identityNumber || AI_MISSING_PASSENGER_IDENTITY,
        gender: (p.gender || undefined) as "male" | "female" | undefined,
      };
    }),
  };
}

/** Reuse the existing conflict/row rules; only extracted locations enter the official resolver. */
export function mergeAiUetdsExtraction(
  current: UetdsDraft,
  extracted: AiUetdsExtractedDraft,
  nowUtcMs = Date.now(),
) {
  const incoming = {
    ...extracted,
    passengers: extracted.passengers?.map((passenger, index) => ({
      ...passenger,
      // An application placeholder must never replace an existing document number.
      identityNumber: passenger.identityNumber === AI_MISSING_PASSENGER_IDENTITY && current.passengers[index]?.identityNumber.trim()
        ? undefined : passenger.identityNumber,
    })),
  };
  const merged = mergeExtractedDraft(current, incoming);
  extracted.passengers?.forEach((passenger, index) => {
    const row = merged.draft.passengers[index];
    if (!row) return;
    if (!passenger.gender && (row.provenance.gender === "missing" || row.provenance.gender === "suggested")) {
      row.gender = "";
      row.provenance.gender = "missing";
    }
    if (passenger.identityNumber === AI_MISSING_PASSENGER_IDENTITY && !current.passengers[index]?.identityNumber.trim()) {
      row.provenance.identityNumber = "suggested";
    }
  });
  for (const key of ["origin", "destination"] as const) {
    if (merged.draft[key] !== current[key]) {
      const location = resolveOfficialUetdsLocation({ placeName: merged.draft[key], formattedAddress: merged.draft[key] });
      merged.draft[key === "origin" ? "originLocation" : "destinationLocation"] = location;
      merged.draft[key === "origin" ? "originReview" : "destinationReview"] = location.review;
    }
  }
  if (extracted.tripKind && extracted.tripKind !== current.tripKind) {
    // Service-type choices have no dedicated provenance slot; require explicit conflict approval.
    merged.conflicts.push({ path: "tripKind", label: "tripKind", current: current.tripKind, incoming: extracted.tripKind });
  }
  // Deterministic trip-time post-process: never leave missing/too-short times to model guessing.
  const times = applyUetdsAiExtractionTripTimes(merged.draft, nowUtcMs);
  if (
    times.startDate !== merged.draft.startDate ||
    times.startTime !== merged.draft.startTime ||
    times.endDate !== merged.draft.endDate ||
    times.endTime !== merged.draft.endTime
  ) {
    merged.draft.startDate = times.startDate;
    merged.draft.startTime = times.startTime;
    merged.draft.endDate = times.endDate;
    merged.draft.endTime = times.endTime;
    if (times.startFromFallback) {
      merged.draft.fieldProvenance.startDate = "suggested";
      merged.draft.fieldProvenance.startTime = "suggested";
      merged.draft.endManual = false;
    }
    if (times.endAdjusted) {
      merged.draft.fieldProvenance.endDate = "suggested";
      merged.draft.fieldProvenance.endTime = "suggested";
      if (!times.startFromFallback && !merged.draft.endManual) {
        merged.draft.endManual = false;
      }
    }
  }
  return merged;
}
