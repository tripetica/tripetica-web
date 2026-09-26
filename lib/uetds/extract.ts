import { countries, normalizeIso2 } from "@/lib/geo/countries";
import {
  createPassengerDraft,
  ensurePassengerCount,
  identityTypeFromValue,
  type UetdsDraft,
  type UetdsFieldConflict,
  type UetdsFieldProvenance,
  type UetdsPassengerDraft,
} from "@/lib/uetds/draft";
import { normalizeUetdsPurposeText } from "@/lib/uetds/form-language";
import { normalizeUetdsPersonName } from "@/lib/uetds/passenger-name";

export type UetdsExtractedPassenger = {
  firstName?: string;
  lastName?: string;
  nationality?: string;
  nationalityProvenance?: UetdsFieldProvenance;
  identityNumber?: string;
  gender?: "" | "male" | "female";
};

export type UetdsExtractedDraft = {
  origin?: string;
  destination?: string;
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  groupName?: string;
  purpose?: string;
  fare?: string;
  passengerCount?: number;
  passengers?: UetdsExtractedPassenger[];
  imageOnly?: boolean;
};

const NATIONALITY_LABEL =
  /(?:uyruk|nationality|гражданство|nationalit[eé]|citizenship|الجنسية)\s*[:\-]?\s*([^\n,;]+)/i;
const PASSPORT_LABEL =
  /(?:pasaport|passport|паспорт|جواز)\s*(?:no|number|numarası|номер|رقم)?\s*[:\-#]?\s*([A-Z0-9][A-Z0-9\-]{4,14})/i;
const TC_LABEL = /(?:t\.?\s*c\.?\s*kimlik|national\s*id|kimlik\s*no)\s*[:\-#]?\s*(\d{11})/i;
const PAX_LABELED =
  /(?:pax|yolcu(?:\s*sayısı)?|passengers?|пассажир(?:ов|а)?|ركاب)\s*[:\-]?\s*(\d{1,2})\b/i;
const PAX_PREFIXED =
  /(?<![:\d])(\d{1,2})\s+(?:pax|yolcu|passengers?|пассажир(?:ов|а)?|ركاب)\b/i;
const DATE_LABEL =
  /(?:tarih|date|дата|التاريخ)\s*[:\-]?\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})/i;
const STANDALONE_DATE = /(?:^|\n)\s*(\d{1,2}[./-]\d{1,2}[./-]\d{2,4}|\d{4}-\d{2}-\d{2})\s*(?:\n|$)/;
const START_TIME_LABEL =
  /(?:alış\s*saati|biniş\s*saati|pickup\s*time|pick-up\s*time|start\s*time|время\s+(?:подачи|отправления)|وقت\s+الاستلام)\s*[:\-]?\s*(\d{1,2}[:.]\d{2})/i;
const END_TIME_LABEL =
  /(?:bırakma\s*saati|bırakış\s*saati|varış\s*saati|dropoff\s*time|drop-off\s*time|end\s*time|время\s+(?:высадки|прибытия)|وقت\s+التوصيل)\s*[:\-]?\s*(\d{1,2}[:.]\d{2})/i;
const TIME_LABEL = /(?:saat|time|час)\s*[:\-]?\s*(\d{1,2}[:.]\d{2})/i;
const FROM_LABEL =
  /(?:alış\s*yeri|alış\s*noktası|başlangıç|biniş|from|pick-?up(?!\s*time)(?:\s*(?:place|location|point))?|nereden|отправление|место\s+подачи|مكان\s+الاستلام)\s*[:\-]?\s*([^\n]{3,80})/i;
const TO_LABEL =
  /(?:bırakma\s*yeri|bırakış\s*yeri|varış(?:\s*noktası)?|to(?!\s*time)|drop-?off(?!\s*time)(?:\s*(?:place|location|point))?|nereye|назначение|destination|место\s+высадки|مكان\s+التوصيل)\s*[:\-]?\s*([^\n]{3,80})/i;
const NAME_LABEL = /(?:ad\s*soyad|name|имя|الاسم)\s*[:\-]?\s*([^\n]{3,80})/i;
const FIRST_LABEL = /(?:first\s*name|имя|الاسم\s+الأول)\s*[:\-]\s*([^\n,]{2,40})/i;
const LAST_LABEL = /(?:soyad|last\s*name|surname|фамилия|الكنية)\s*[:\-]\s*([^\n,]{2,40})/i;
const GENDER_LABEL = /(?:cinsiyet|gender|пол|الجنس)\s*[:\-]?\s*([^\n,]{2,20})/i;
const PURPOSE_LABEL = /(?:amaç|purpose|açıklama|description|цель|الوصف)\s*[:\-]\s*([^\n]{3,80})/i;
const GROUP_LABEL = /(?:grup|group|группа)\s*(?:adı|name|название)?\s*[:\-]\s*([^\n]{2,80})/i;
const NUMBERED_PASSENGER = /(?:^|\n)\s*(?:\d{1,2}[.)-]|yolcu\s*\d+|passenger\s*\d+)\s*[:\-]?\s*([A-Za-zÀ-ÿĞğİıÖöŞşÜüЁёА-я\u0600-\u06FF][A-Za-zÀ-ÿĞğİıÖöŞşÜüЁёА-я\u0600-\u06FF'’\-\s]{2,60})/gi;

function clip(value: string | undefined, max = 120) {
  return value?.replace(/\s+/g, " ").trim().slice(0, max) ?? "";
}

function fold(value: string) {
  return value.trim().toLocaleLowerCase("tr-TR");
}

export function countryIso2FromName(value: string | null | undefined): string | null {
  const direct = normalizeIso2(value);
  if (direct) {
    return direct;
  }
  const needle = fold(value ?? "");
  if (!needle) {
    return null;
  }
  for (const country of countries()) {
    const names = [
      country.iso2,
      country.names.tr,
      country.names.en,
      country.names.ru,
      country.names.ar,
      ...(country.aliases?.tr ?? []),
      ...(country.aliases?.en ?? []),
      ...(country.aliases?.ru ?? []),
    ];
    if (names.some((name) => fold(name) === needle)) {
      return country.iso2;
    }
  }
  return null;
}

function parseDate(value: string) {
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  const dotted = value.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!dotted) {
    return "";
  }
  const day = dotted[1].padStart(2, "0");
  const month = dotted[2].padStart(2, "0");
  const year = dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3];
  return `${year}-${month}-${day}`;
}

function parseTime(value: string) {
  const match = value.match(/^(\d{1,2})[:.](\d{2})$/);
  if (!match) {
    return "";
  }
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function parseGender(value: string): "" | "male" | "female" {
  const folded = fold(value);
  if (["erkek", "male", "m", "муж", "мужской"].includes(folded)) {
    return "male";
  }
  if (["kadın", "kadin", "female", "f", "жен", "женский"].includes(folded)) {
    return "female";
  }
  return "";
}

function splitPersonName(value: string) {
  const parts = clip(value).split(" ").filter(Boolean);
  if (parts.length < 2) {
    return { firstName: parts[0] ?? "", lastName: "" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function looksLikeLocation(value: string) {
  return /havaliman[ıi]|airport|otel|hotel|hilton|terminal/i.test(value);
}

function firstCapture(match: RegExpMatchArray | null) {
  return clip(match?.slice(1).find((value) => value?.trim()) ?? "");
}

function numberedPassengers(source: string): UetdsExtractedPassenger[] {
  const passengers: UetdsExtractedPassenger[] = [];
  for (const match of source.matchAll(NUMBERED_PASSENGER)) {
    const person = splitPersonName(match[1] ?? "");
    if (person.firstName || person.lastName) {
      passengers.push({
        firstName: person.firstName ? normalizeUetdsPersonName(person.firstName) : undefined,
        lastName: person.lastName ? normalizeUetdsPersonName(person.lastName) : undefined,
      });
    }
  }
  return passengers;
}

export function extractionHasStructuredFields(extracted: UetdsExtractedDraft | null | undefined) {
  if (!extracted) {
    return false;
  }
  return Boolean(
    extracted.origin ||
      extracted.destination ||
      extracted.startDate ||
      extracted.startTime ||
      extracted.endDate ||
      extracted.endTime ||
      extracted.groupName ||
      extracted.purpose ||
      extracted.fare ||
      extracted.passengerCount ||
      extracted.passengers?.some(
        (passenger) =>
          passenger.firstName ||
          passenger.lastName ||
          passenger.nationality ||
          passenger.identityNumber ||
          passenger.gender,
      ),
  );
}

export function extractUetdsFromText(text: string): UetdsExtractedDraft {
  const source = text.replace(/\u0000/g, " ").slice(0, 200_000);
  const extracted: UetdsExtractedDraft = {};
  const nationalityMatch = source.match(NATIONALITY_LABEL);
  const nationality = nationalityMatch ? countryIso2FromName(nationalityMatch[1]) : null;
  const passport = source.match(PASSPORT_LABEL)?.[1];
  const tc = source.match(TC_LABEL)?.[1];
  const pax = firstCapture(source.match(PAX_LABELED)) || firstCapture(source.match(PAX_PREFIXED));
  const date = parseDate(source.match(DATE_LABEL)?.[1] ?? source.match(STANDALONE_DATE)?.[1] ?? "");
  const startTime = parseTime(source.match(START_TIME_LABEL)?.[1] ?? "");
  const endTime = parseTime(source.match(END_TIME_LABEL)?.[1] ?? "");
  const genericTime = parseTime(source.match(TIME_LABEL)?.[1] ?? "");
  const origin = clip(source.match(FROM_LABEL)?.[1]);
  const destination = clip(source.match(TO_LABEL)?.[1]);
  const fullName = clip(source.match(NAME_LABEL)?.[1]);
  const firstName = clip(source.match(FIRST_LABEL)?.[1]);
  const lastName = clip(source.match(LAST_LABEL)?.[1]);
  const gender = parseGender(source.match(GENDER_LABEL)?.[1] ?? "");
  const purpose = clip(source.match(PURPOSE_LABEL)?.[1]);
  const groupName = clip(source.match(GROUP_LABEL)?.[1]);

  if (origin) {
    extracted.origin = origin;
  }
  if (destination) {
    extracted.destination = destination;
  }
  if (date) {
    extracted.startDate = date;
  }
  if (startTime || genericTime) {
    extracted.startTime = startTime || genericTime;
  }
  if (endTime) {
    extracted.endTime = endTime;
  }
  if (purpose) {
    extracted.purpose = normalizeUetdsPurposeText(purpose);
  }
  if (groupName) {
    extracted.groupName = groupName;
  }
  if (pax) {
    extracted.passengerCount = Math.min(20, Math.max(1, Number(pax)));
  }

  const listed = numberedPassengers(source);
  const person = fullName ? splitPersonName(fullName) : { firstName, lastName };
  const identityNumber = tc || passport || "";
  const firstPassenger: UetdsExtractedPassenger | null =
    person.firstName || person.lastName || nationality || identityNumber || gender
      ? {
          firstName: person.firstName || firstName
            ? normalizeUetdsPersonName(person.firstName || firstName || "")
            : undefined,
          lastName: person.lastName || lastName
            ? normalizeUetdsPersonName(person.lastName || lastName || "")
            : undefined,
          nationality: nationality ?? undefined,
          nationalityProvenance: nationality ? "document" : undefined,
          identityNumber: identityNumber || undefined,
          gender: gender || undefined,
        }
      : null;
  if (listed.length > 0) {
    extracted.passengers = listed.map((passenger, index) =>
      index === 0 && firstPassenger ? { ...passenger, ...firstPassenger } : passenger,
    );
  } else if (firstPassenger) {
    extracted.passengers = [firstPassenger];
  }
  return extracted;
}

function shouldOverwrite(
  current: string,
  incoming: string,
  provenance: UetdsFieldProvenance,
): "keep" | "apply" | "conflict" {
  const left = current.trim();
  const right = incoming.trim();
  if (!right) {
    return "keep";
  }
  if (!left) {
    return "apply";
  }
  if (fold(left) === fold(right)) {
    return "keep";
  }
  if (provenance === "reservation" || provenance === "user") {
    return "conflict";
  }
  return "apply";
}

function applyScalar(
  draft: UetdsDraft,
  field: keyof Pick<
    UetdsDraft,
    "origin" | "destination" | "startDate" | "startTime" | "endDate" | "endTime" | "groupName" | "purpose" | "fare"
  >,
  incoming: string | undefined,
  conflicts: UetdsFieldConflict[],
  label: string,
) {
  if (!incoming?.trim()) {
    return;
  }
  const decision = shouldOverwrite(draft[field], incoming, draft.fieldProvenance[field]);
  if (decision === "conflict") {
    conflicts.push({
      path: field,
      label,
      current: draft[field],
      incoming: incoming.trim(),
    });
    return;
  }
  if (decision === "apply") {
    draft[field] = incoming.trim();
    draft.fieldProvenance[field] = "document";
  }
}

function applyPassengerField(
  passenger: UetdsPassengerDraft,
  field: keyof Pick<UetdsPassengerDraft, "firstName" | "lastName" | "nationality" | "identityNumber" | "gender">,
  incoming: string | undefined,
  provenance: UetdsFieldProvenance,
  conflicts: UetdsFieldConflict[],
  path: string,
  label: string,
) {
  if (!incoming?.trim()) {
    return;
  }
  const decision = shouldOverwrite(String(passenger[field]), incoming, passenger.provenance[field === "identityNumber" ? "identityNumber" : field === "nationality" ? "nationality" : field]);
  if (decision === "conflict") {
    conflicts.push({
      path,
      label,
      current: String(passenger[field]),
      incoming: incoming.trim(),
    });
    return;
  }
  if (decision === "apply") {
    if (field === "gender") {
      passenger.gender = incoming === "male" || incoming === "female" ? incoming : "";
    } else if (field === "identityNumber") {
      passenger.identityNumber = incoming.trim();
      passenger.identityType = identityTypeFromValue(incoming);
    } else {
      passenger[field] = incoming.trim();
    }
    const provenanceKey =
      field === "identityNumber" ? "identityNumber" : field === "nationality" ? "nationality" : field;
    passenger.provenance[provenanceKey] = provenance;
  }
}

export function mergeExtractedDraft(
  current: UetdsDraft,
  extracted: UetdsExtractedDraft,
): { draft: UetdsDraft; conflicts: UetdsFieldConflict[] } {
  const draft: UetdsDraft = {
    ...current,
    fieldProvenance: { ...current.fieldProvenance },
    passengers: current.passengers.map((passenger) => ({
      ...passenger,
      provenance: { ...passenger.provenance },
    })),
  };
  const conflicts: UetdsFieldConflict[] = [];
  applyScalar(draft, "origin", extracted.origin, conflicts, "origin");
  applyScalar(draft, "destination", extracted.destination, conflicts, "destination");
  if (extracted.origin && draft.origin === extracted.origin.trim()) {
    draft.originLocation = {
      ...draft.originLocation,
      placeName: extracted.origin.trim(),
      review: true,
    };
  }
  if (extracted.destination && draft.destination === extracted.destination.trim()) {
    draft.destinationLocation = {
      ...draft.destinationLocation,
      placeName: extracted.destination.trim(),
      review: true,
    };
  }
  applyScalar(draft, "startDate", extracted.startDate, conflicts, "startDate");
  applyScalar(draft, "startTime", extracted.startTime, conflicts, "startTime");
  applyScalar(draft, "endDate", extracted.endDate, conflicts, "endDate");
  applyScalar(draft, "endTime", extracted.endTime, conflicts, "endTime");
  applyScalar(draft, "groupName", extracted.groupName, conflicts, "groupName");
  applyScalar(draft, "purpose", extracted.purpose, conflicts, "purpose");
  applyScalar(draft, "fare", extracted.fare, conflicts, "fare");

  if (extracted.origin && looksLikeLocation(extracted.origin) && !draft.originReview) {
    draft.originReview = true;
  }
  if (extracted.destination && looksLikeLocation(extracted.destination) && !draft.destinationReview) {
    draft.destinationReview = true;
  }

  const count = Math.max(
    extracted.passengerCount ?? 0,
    extracted.passengers?.length ?? 0,
    draft.passengers.length,
  );
  if (count > 0) {
    draft.passengers = ensurePassengerCount(draft.passengers, count);
  }
  (extracted.passengers ?? []).forEach((incoming, index) => {
    const passenger = draft.passengers[index] ?? createPassengerDraft();
    if (!draft.passengers[index]) {
      draft.passengers[index] = passenger;
    }
    applyPassengerField(
      passenger,
      "firstName",
      incoming.firstName,
      "document",
      conflicts,
      `passengers.${index}.firstName`,
      "firstName",
    );
    applyPassengerField(
      passenger,
      "lastName",
      incoming.lastName,
      "document",
      conflicts,
      `passengers.${index}.lastName`,
      "lastName",
    );
    applyPassengerField(
      passenger,
      "nationality",
      incoming.nationality,
      incoming.nationalityProvenance ?? "document",
      conflicts,
      `passengers.${index}.nationality`,
      "nationality",
    );
    applyPassengerField(
      passenger,
      "identityNumber",
      incoming.identityNumber,
      "document",
      conflicts,
      `passengers.${index}.identityNumber`,
      "identity",
    );
    applyPassengerField(
      passenger,
      "gender",
      incoming.gender,
      "document",
      conflicts,
      `passengers.${index}.gender`,
      "gender",
    );
  });
  return { draft, conflicts };
}

export function applyConflictChoice(
  draft: UetdsDraft,
  conflict: UetdsFieldConflict,
  choice: "current" | "incoming",
): UetdsDraft {
  if (choice === "current") {
    return draft;
  }
  const next = mergeExtractedDraft(draft, {});
  const extracted = conflictToExtracted(conflict);
  return mergeExtractedDraft(
    {
      ...next.draft,
      fieldProvenance: Object.fromEntries(
        Object.entries(next.draft.fieldProvenance).map(([key, value]) => [
          key,
          conflict.path === key ? "missing" : value,
        ]),
      ) as UetdsDraft["fieldProvenance"],
      passengers: next.draft.passengers.map((passenger, index) => {
        if (!conflict.path.startsWith(`passengers.${index}.`)) {
          return passenger;
        }
        const field = conflict.path.split(".")[2];
        return {
          ...passenger,
          provenance: {
            ...passenger.provenance,
            [field === "identityNumber" ? "identityNumber" : field]: "missing",
          },
        };
      }),
    },
    extracted,
  ).draft;
}

function conflictToExtracted(conflict: UetdsFieldConflict): UetdsExtractedDraft {
  if (conflict.path.startsWith("passengers.")) {
    const [, indexText, field] = conflict.path.split(".");
    const index = Number(indexText);
    const passengers: UetdsExtractedPassenger[] = [];
    passengers[index] = { [field]: conflict.incoming };
    return { passengers };
  }
  return { [conflict.path]: conflict.incoming } as UetdsExtractedDraft;
}
