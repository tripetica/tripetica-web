import { officialUetdsNationalityCode } from "@/lib/uetds/official-locations";
import { normalizeUetdsExtractedPersonName } from "@/lib/uetds/passenger-name";
import { parseMrzDocuments, type MrzDocument } from "@/lib/uetds/mrz";

export type PassportHint = {
  firstName?: string;
  lastName?: string;
  nationality?: string;
  identityNumber?: string;
  gender?: "male" | "female";
  source: "visual" | "mrz";
  checksumsValid?: boolean;
};

function letters(value: string) {
  return value.replace(/[^A-Za-z]/g, "").toUpperCase();
}

function compactId(value: string | undefined) {
  return (value ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

function labeledValue(source: string, labels: string) {
  const match = source.match(new RegExp(`(?:^|[\\n\\r])\\s*(?:${labels})\\s*[:#]\\s*(\\S[^\\n]{0,79})`, "imu"));
  return match?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function parseGender(value: string): "male" | "female" | undefined {
  const folded = value.trim().toLocaleLowerCase("tr-TR");
  if (/^(f|female|kadin|kadın|k|w|woman)$/i.test(folded)) return "female";
  if (/^(m|male|erkek|e|man)$/i.test(folded)) return "male";
  return undefined;
}

export function extractVisualPassportHints(source: string): PassportHint[] {
  const blocks = source.split(/\n{2,}/);
  const hints: PassportHint[] = [];
  for (const block of [source, ...blocks]) {
    const lastName = labeledValue(block, "surname|family\\s*name|soyad(?:ı|i)?");
    const firstName = labeledValue(block, "given\\s*names?|first\\s*name|ad(?!\\s*soyad)|isim");
    const nationality = labeledValue(block, "nationality|citizenship|uyruk|ülke|ulke|country\\s*code|country");
    const identityNumber = labeledValue(block, "passport\\s*(?:no|number|numarası|numarasi)?|pasaport\\s*(?:no|numarası|numarasi)?|document\\s*(?:no|number)");
    const gender = parseGender(labeledValue(block, "sex|gender|cinsiyet"));
    if (!lastName && !firstName && !nationality && !identityNumber && !gender) continue;
    hints.push({
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      nationality: nationality || undefined,
      identityNumber: identityNumber.replace(/[^A-Za-z0-9]/g, "") || undefined,
      gender,
      source: "visual",
    });
  }
  const unique: PassportHint[] = [];
  for (const hint of hints) {
    if (unique.some((item) =>
      item.firstName === hint.firstName
      && item.lastName === hint.lastName
      && item.identityNumber === hint.identityNumber
      && item.nationality === hint.nationality
    )) continue;
    unique.push(hint);
  }
  return unique;
}

function hintFromMrz(document: MrzDocument): PassportHint {
  return {
    firstName: document.firstName || undefined,
    lastName: document.lastName || undefined,
    nationality: document.nationality || undefined,
    identityNumber: document.documentNumber || undefined,
    gender: document.sex || undefined,
    source: "mrz",
    checksumsValid: document.checksumsValid,
  };
}

export function namesCompatible(left?: string, right?: string) {
  const a = letters(left ?? "");
  const b = letters(right ?? "");
  if (!a || !b) return true;
  return a === b || a.startsWith(b) || b.startsWith(a);
}

function preferName(
  current: string | undefined,
  incoming: string | undefined,
  mode: "visual" | "complete" | "keep",
) {
  const currentName = current?.trim() ?? "";
  const incomingName = incoming?.trim() ?? "";
  if (!incomingName) return current || undefined;
  if (!currentName) return incomingName;
  if (mode === "keep") return currentName;
  if (mode === "visual") return incomingName;
  if (namesCompatible(currentName, incomingName)) return incomingName;
  return currentName;
}

function matchHint(passenger: { firstName?: string; lastName?: string; identityNumber?: string }, hint: PassportHint) {
  const passengerId = compactId(passenger.identityNumber);
  const hintId = compactId(hint.identityNumber);
  if (passengerId && hintId && (passengerId === hintId || passengerId.startsWith(hintId) || hintId.startsWith(passengerId))) {
    return 3;
  }
  const nameScore =
    (namesCompatible(passenger.firstName, hint.firstName) ? 1 : 0)
    + (namesCompatible(passenger.lastName, hint.lastName) ? 1 : 0);
  return nameScore;
}

type PassengerFields = {
  firstName?: string;
  lastName?: string;
  nationality?: string | null;
  identityNumber?: string;
  gender?: "male" | "female" | "";
};

function applyHint(
  passenger: PassengerFields,
  hint: PassportHint,
  options: { fillOnlyMissingIdentity: boolean; nameMode: "visual" | "complete" | "keep" },
) {
  passenger.firstName = preferName(passenger.firstName, hint.firstName ? normalizeUetdsExtractedPersonName(hint.firstName) : undefined, options.nameMode);
  passenger.lastName = preferName(passenger.lastName, hint.lastName ? normalizeUetdsExtractedPersonName(hint.lastName) : undefined, options.nameMode);
  if (!passenger.nationality && hint.nationality) {
    passenger.nationality = officialUetdsNationalityCode(hint.nationality) ?? undefined;
  }
  if ((passenger.gender !== "male" && passenger.gender !== "female") && hint.gender) {
    passenger.gender = hint.gender;
  }
  const currentId = compactId(passenger.identityNumber);
  const incomingId = compactId(hint.identityNumber);
  if (incomingId && (!currentId || currentId === "11111111111")) {
    passenger.identityNumber = incomingId;
  }
}

export function applyPassportDocumentFacts<T extends PassengerFields>(passengers: T[] | undefined, sourceText: string): T[] {
  const rows = passengers ?? [];
  if (!rows.length) return rows;
  const visual = extractVisualPassportHints(sourceText);
  const mrz = parseMrzDocuments(sourceText).map(hintFromMrz);
  return rows.map((passenger, index) => {
    if (!passenger.nationality) {
      passenger.nationality = officialUetdsNationalityCode(passenger.nationality) ?? undefined;
    }
    const visuals = visual
      .map((hint) => ({ hint, score: matchHint(passenger, hint) }))
      .sort((left, right) => right.score - left.score);
    const mrzs = mrz
      .map((hint) => ({ hint, score: matchHint(passenger, hint) }))
      .sort((left, right) => right.score - left.score);
    const visualHint = visuals[0] && (visuals[0].score > 0 || visual.length === 1 && rows.length === 1 || visual.length === rows.length)
      ? (visual.length === rows.length ? visual[index] : visuals[0]?.hint)
      : undefined;
    const mrzHint = mrzs[0] && (mrzs[0].score > 0 || mrz.length === 1 && rows.length === 1 || mrz.length === rows.length)
      ? (mrz.length === rows.length ? mrz[index] : mrzs[0]?.hint)
      : undefined;

    if (visualHint) {
      applyHint(passenger, visualHint, { fillOnlyMissingIdentity: true, nameMode: "visual" });
    }
    if (mrzHint) {
      const visualConflictsMrz =
        Boolean(visualHint?.firstName && mrzHint.firstName && !namesCompatible(visualHint.firstName, mrzHint.firstName))
        || Boolean(visualHint?.lastName && mrzHint.lastName && !namesCompatible(visualHint.lastName, mrzHint.lastName));
      if (!visualConflictsMrz) {
        applyHint(passenger, mrzHint, {
          fillOnlyMissingIdentity: true,
          nameMode: mrzHint.checksumsValid === false ? "keep" : "complete",
        });
      } else if (!passenger.nationality && mrzHint.nationality) {
        passenger.nationality = officialUetdsNationalityCode(mrzHint.nationality) ?? passenger.nationality ?? undefined;
      }
    }
    if (!passenger.nationality) {
      const codes = [...visual, ...mrz]
        .map((hint) => officialUetdsNationalityCode(hint.nationality ?? "") ?? undefined)
        .filter((code): code is string => Boolean(code));
      if (codes.length === 1) passenger.nationality = codes[0];
    }
    return passenger;
  });
}
