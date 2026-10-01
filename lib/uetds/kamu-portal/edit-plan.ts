/**
 * Fail-closed plan for updating an existing Kamu sefer group and its passengers.
 * Trip rows follow the observed sefer-list table. Group and passenger edit
 * screens are not guessed here, and nothing in this module submits a form.
 */

export const PORTAL_MISSING_DOCUMENT = "11111111111";

export type PortalSeferRow = {
  /** Current list position. Not a trip identity. */
  index: number;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  plate: string;
  /** Sefer tokens read from this row, excluding the row index, clock, and plate. */
  seferNumbers: string[];
};

export type PortalTripTarget = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  plate: string;
  seferNumber: string;
};

export type PortalTripIdentity = {
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  plate: string;
  seferNumber: string;
  ministrySeferNumber: string;
};

export type PortalTripMatch =
  | { ok: true; identity: PortalTripIdentity; listPosition: number }
  | { ok: false; error: "trip_not_found" | "ambiguous_trip_match" | "trip_number_missing" | "trip_number_mismatch" };

export type PortalLocation = {
  provinceName: string;
  districtName: string;
  placeName: string;
};

export type PortalGroupDiff = {
  pickup_changed: boolean;
  dropoff_changed: boolean;
  changedFields: string[];
};

export type PortalPassengerIdentity = {
  index: number;
  nationality: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  gender: string;
};

export type PortalPassengerReplacement = {
  oldIndex: number;
  newIndex: number;
  match: {
    nationality: string;
    documentNumber: string;
    firstName: string;
    lastName: string;
    gender: string;
  };
  next: {
    nationality: string;
    documentNumber: string;
    firstName: string;
    lastName: string;
    gender: string;
  };
};

export type PortalListedPassenger = {
  index: number;
  nationality: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  gender?: string;
};

export type PortalPassengerMatch =
  | { ok: true; index: number }
  | { ok: false; error: "passenger_not_found" | "ambiguous_passenger_match" };

export function normalizePortalPlate(value: string) {
  return value.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
}

export function normalizePortalDate(value: string) {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const dotted = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dotted) return `${dotted[1]}/${dotted[2]}/${dotted[3]}`;
  return trimmed;
}

export function normalizePortalTime(value: string) {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "";
  return `${match[1]!.padStart(2, "0")}:${match[2]}`;
}

/** Trim and drop spacing only. Hyphens and digits stay. */
export function normalizePortalSeferNumber(value: string) {
  return value.trim().replace(/\s+/g, "").toLocaleUpperCase("tr-TR");
}

const SEFER_STATUS = /^(GECERLI|GEÇERLI|IPTAL|İPTAL|AKTIF|AKTİF|-|—)$/u;

function portalSeferTokens(cells: string[], index: number, plate: string) {
  const tokens: string[] = [];
  for (const cell of cells) {
    for (const part of cell.split(/\s+/)) {
      const token = normalizePortalSeferNumber(part);
      if (token.length < 3 || token === String(index) || token === plate) continue;
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(token) || /^\d{2}:\d{2}$/.test(token)) continue;
      if (SEFER_STATUS.test(token)) continue;
      if (!tokens.includes(token)) tokens.push(token);
    }
    // A ministry sefer number can be shown with spaces inside one cell.
    const digits = cell.replace(/\D/g, "");
    if (digits.length >= 10 && !tokens.includes(digits)) tokens.push(digits);
  }
  return tokens;
}

function isFirmaSeferToken(token: string, tokens: string[]) {
  if (/^TRP-\d+$/.test(token)) return true;
  return tokens.some((item) => /^TRP-\d+$/.test(item) && item.replace(/\D/g, "") === token);
}

function clockGlue(date: string, time: string) {
  return `${date.replace(/\D/g, "")}${time.replace(/\D/g, "")}`;
}

function isClockGlueToken(token: string, row: PortalSeferRow) {
  return token === clockGlue(row.startDate, row.startTime) || token === clockGlue(row.endDate, row.endTime);
}

function sameClock(row: PortalSeferRow, target: PortalTripTarget) {
  return (
    row.startDate === normalizePortalDate(target.startDate) &&
    row.startTime === normalizePortalTime(target.startTime) &&
    row.endDate === normalizePortalDate(target.endDate) &&
    row.endTime === normalizePortalTime(target.endTime) &&
    row.plate === normalizePortalPlate(target.plate)
  );
}

export function portalSeferRowFromCells(index: number, cells: string[]): PortalSeferRow | null {
  if (!Number.isFinite(index) || cells.length < 4) return null;
  const start = cells[1]!.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
  const end = cells[2]!.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})/);
  if (!start || !end) return null;
  const plate = normalizePortalPlate(cells[3]!);
  return {
    index,
    startDate: start[1]!,
    startTime: start[2]!,
    endDate: end[1]!,
    endTime: end[2]!,
    plate,
    seferNumbers: portalSeferTokens(cells, index, plate),
  };
}

/** Keep one row per portal index. Later copies replace earlier copies of the same index. */
export function mergePortalSeferRows(rows: PortalSeferRow[]): PortalSeferRow[] {
  const seen = new Map<number, PortalSeferRow>();
  for (const row of rows) seen.set(row.index, row);
  return [...seen.values()];
}

export function parsePortalSeferRows(html: string): PortalSeferRow[] {
  const rows: PortalSeferRow[] = [];
  const seen = new Set<number>();
  const re = /<tr[\s\S]*?<\/tr>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const tr = match[0];
    const indexMatch = tr.match(/asama=grupListesi[^"'&\s]*&amp;index=(\d+)|asama=grupListesi[^"'&\s]*&index=(\d+)/i);
    if (!indexMatch) continue;
    const index = Number(indexMatch[1] ?? indexMatch[2]);
    if (!Number.isFinite(index) || seen.has(index)) continue;
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
      cell[1]!.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    );
    const row = portalSeferRowFromCells(index, cells);
    if (!row) continue;
    seen.add(index);
    rows.push(row);
  }
  return rows;
}

export function matchPortalTrip(rows: PortalSeferRow[], target: PortalTripTarget): PortalTripMatch {
  const startDate = normalizePortalDate(target.startDate);
  const startTime = normalizePortalTime(target.startTime);
  const endDate = normalizePortalDate(target.endDate);
  const endTime = normalizePortalTime(target.endTime);
  const plate = normalizePortalPlate(target.plate);
  if (!startDate || !startTime || !endDate || !endTime || !plate) return { ok: false, error: "trip_not_found" };
  const hits = rows.filter((row) => sameClock(row, target));
  if (hits.length === 0) return { ok: false, error: "trip_not_found" };
  if (hits.length > 1) return { ok: false, error: "ambiguous_trip_match" };
  const seferNumber = normalizePortalSeferNumber(target.seferNumber);
  if (!seferNumber) return { ok: false, error: "trip_number_missing" };
  const row = hits[0]!;
  const tokens = row.seferNumbers ?? [];
  const ministryTokens = tokens.filter((item) => !isFirmaSeferToken(item, tokens) && !isClockGlueToken(item, row));
  const portalNumbers = ministryTokens.filter((item) => item === seferNumber);
  if (portalNumbers.length > 1) return { ok: false, error: "trip_number_mismatch" };
  if (portalNumbers.length === 1) {
    return {
      ok: true,
      listPosition: row.index,
      identity: {
        startDate,
        startTime,
        endDate,
        endTime,
        plate,
        seferNumber,
        ministrySeferNumber: portalNumbers[0]!,
      },
    };
  }
  // The sefer list column is Firma Sefer No (TRP-…). UETDS sefer no is the same
  // number Tripetica stored; a different 16-digit number on the row still rejects.
  const conflictingMinistryNumber = ministryTokens.some((item) => /^\d{16}$/.test(item));
  const firmaNumbers = tokens.filter((item) => /^TRP-\d+$/.test(item));
  if (conflictingMinistryNumber || firmaNumbers.length !== 1) return { ok: false, error: "trip_number_mismatch" };
  return {
    ok: true,
    listPosition: row.index,
    identity: {
      startDate,
      startTime,
      endDate,
      endTime,
      plate,
      seferNumber,
      ministrySeferNumber: seferNumber,
    },
  };
}

function samePlace(left: PortalLocation, right: PortalLocation) {
  return (
    left.provinceName.trim() === right.provinceName.trim() &&
    left.districtName.trim() === right.districtName.trim() &&
    left.placeName.trim() === right.placeName.trim()
  );
}

export function diffPortalGroup(input: { oldPickup: PortalLocation; newPickup: PortalLocation; oldDropoff: PortalLocation; newDropoff: PortalLocation }): PortalGroupDiff {
  const pickup_changed = !samePlace(input.oldPickup, input.newPickup);
  const dropoff_changed = !samePlace(input.oldDropoff, input.newDropoff);
  const changedFields = [
    ...(pickup_changed ? ["pickup"] : []),
    ...(dropoff_changed ? ["dropoff"] : []),
  ];
  return { pickup_changed, dropoff_changed, changedFields };
}

export function portalDocumentNumber(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : PORTAL_MISSING_DOCUMENT;
}

export type PassengerSyncStep =
  | { action: "skip" }
  | { action: "update"; yolcuIndex: number }
  | { action: "error"; error: "source_data_mismatch" | "ambiguous_passenger_match" };

/**
 * Compare one TARGET passenger with the ministry list that was just read.
 * A target already on the list is left untouched, even when its previous identity is gone.
 * Otherwise the existing source identity selects the in-place row.
 */
export function nextPassengerSyncStep(
  replacement: PortalPassengerReplacement,
  listed: PortalListedPassenger[],
): PassengerSyncStep {
  const present = matchExistingPassenger(listed, {
    index: replacement.newIndex,
    nationality: replacement.next.nationality,
    documentNumber: replacement.next.documentNumber,
    firstName: replacement.next.firstName,
    lastName: replacement.next.lastName,
    gender: replacement.next.gender,
  });
  if (present.ok) return { action: "skip" };
  if (present.error === "ambiguous_passenger_match") return { action: "error", error: present.error };
  const sourceIdentity: PortalPassengerIdentity = {
    index: replacement.oldIndex,
    nationality: replacement.match.nationality,
    documentNumber: replacement.match.documentNumber,
    firstName: replacement.match.firstName,
    lastName: replacement.match.lastName,
    gender: replacement.match.gender,
  };
  const direct = matchExistingPassenger(listed, sourceIdentity);
  const realDocument = normalizeDocument(sourceIdentity.documentNumber) !== PORTAL_MISSING_DOCUMENT && normalizeDocument(sourceIdentity.documentNumber).length > 0;
  const source = direct.ok || direct.error === "ambiguous_passenger_match" || !realDocument
    ? direct
    : matchExistingPassenger(listed, { ...sourceIdentity, documentNumber: PORTAL_MISSING_DOCUMENT });
  if (source.ok) return { action: "update", yolcuIndex: source.index };
  if (source.error === "ambiguous_passenger_match") return { action: "error", error: source.error };
  return { action: "error", error: "source_data_mismatch" };
}

export function planPassengerReplacements(oldRows: PortalPassengerIdentity[], newRows: PortalPassengerIdentity[]): PortalPassengerReplacement[] {
  const count = Math.min(oldRows.length, newRows.length);
  return oldRows.slice(0, count).map((oldRow, index) => {
    const next = newRows[index]!;
    return {
      oldIndex: oldRow.index,
      newIndex: next.index,
      match: {
        nationality: oldRow.nationality,
        documentNumber: oldRow.documentNumber,
        firstName: oldRow.firstName,
        lastName: oldRow.lastName,
        gender: oldRow.gender,
      },
      next: {
        nationality: next.nationality,
        documentNumber: portalDocumentNumber(next.documentNumber),
        firstName: next.firstName,
        lastName: next.lastName,
        gender: next.gender,
      },
    };
  });
}

function fold(value: string) {
  return value
    .trim()
    .replace(/İ/g, "I")
    .replace(/ı/g, "i")
    .toLocaleUpperCase("en-US")
    .replace(/\s+/g, " ");
}

function nameTokens(value: string) {
  return fold(value).split(" ").filter(Boolean);
}

/** Portal shows one full-name cell. Given-name words and the surname must be that cell, in order. */
function sameListedName(row: PortalListedPassenger, firstName: string, lastName: string) {
  const wanted = [...nameTokens(firstName), ...nameTokens(lastName)];
  const listed = nameTokens(`${row.firstName} ${row.lastName}`);
  return wanted.length >= 2 && listed.length === wanted.length && listed.every((token, index) => token === wanted[index]);
}

function normalizeDocument(value: string) {
  return value.replace(/\s+/g, "").toUpperCase();
}

export function matchExistingPassenger(rows: PortalListedPassenger[], oldRow: PortalPassengerIdentity): PortalPassengerMatch {
  const document = normalizeDocument(oldRow.documentNumber);
  const realDocument = document.length > 0 && document !== PORTAL_MISSING_DOCUMENT;
  if (realDocument) {
    const hits = rows.filter((row) => normalizeDocument(row.documentNumber) === document);
    if (hits.length === 1) return { ok: true, index: hits[0]!.index };
    if (hits.length === 0) return { ok: false, error: "passenger_not_found" };
    return { ok: false, error: "ambiguous_passenger_match" };
  }
  const nationality = fold(oldRow.nationality);
  const hits = rows.filter((row) => {
    const nameOk = sameListedName(row, oldRow.firstName, oldRow.lastName);
    const documentOk = document.length > 0 && normalizeDocument(row.documentNumber) === document;
    const nationalityOk = nationality.length > 0 && row.nationality.length > 0 && fold(row.nationality) === nationality;
    if (document && row.documentNumber && !documentOk) return false;
    if (nationality && row.nationality && !nationalityOk) return false;
    return nameOk && (documentOk || nationalityOk);
  });
  if (hits.length === 0) return { ok: false, error: "passenger_not_found" };
  const wantedGender = oldRow.gender === "female" ? "KADIN" : oldRow.gender === "male" ? "ERKEK" : "";
  const gendered = wantedGender
    ? hits.filter((row) => {
        const listed = fold(row.gender ?? "");
        return !listed || listed === wantedGender;
      })
    : hits;
  if (gendered.length === 1) return { ok: true, index: gendered[0]!.index };
  return { ok: false, error: "ambiguous_passenger_match" };
}
