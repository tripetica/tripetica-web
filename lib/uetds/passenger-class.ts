import { type UetdsDraft, type UetdsPassengerDraft } from "@/lib/uetds/draft";

export const UETDS_PASSENGER_KINDS = [
  "UNCHANGED_EXISTING",
  "EDITED_EXISTING",
  "REMOVED_EXISTING",
  "GENUINELY_NEW",
  "REMOVED_UNSENT_NEW",
] as const;

export type UetdsPassengerKind = (typeof UETDS_PASSENGER_KINDS)[number];

export type ClassifiedUetdsPassenger = {
  kind: UetdsPassengerKind;
  index: number;
  ministryReference: string | null;
  original: UetdsPassengerDraft | null;
  edited: UetdsPassengerDraft | null;
};

export function passengerFieldSignature(passenger: UetdsPassengerDraft) {
  return [
    passenger.nationality.trim().toUpperCase(),
    passenger.identityType,
    passenger.identityNumber.trim(),
    passenger.firstName.trim(),
    passenger.lastName.trim(),
    passenger.gender,
  ].join("|");
}

export function serverPassengerRefs(refs: unknown): Array<string | null> {
  if (!Array.isArray(refs)) {
    return [];
  }
  return refs.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return null;
    }
    const reference = (item as { reference?: unknown }).reference;
    return typeof reference === "string" && reference.trim() ? reference.trim() : null;
  });
}

export function passengerMinistryRef(
  passenger: UetdsPassengerDraft | null | undefined,
  fallback?: string | null,
) {
  const reference = passenger?.ministryReference?.trim() || fallback?.trim() || "";
  return reference || null;
}

export function isExistingMinistryPassenger(
  passenger: UetdsPassengerDraft,
  original: UetdsDraft,
  ministryRefs: Array<string | null> = [],
) {
  const reference = passengerMinistryRef(passenger);
  if (reference) {
    return original.passengers.some(
      (item, index) => passengerMinistryRef(item, ministryRefs[index]) === reference,
    );
  }
  return original.passengers.some((item) => item.key && item.key === passenger.key);
}

function findEditedMatch(
  current: UetdsPassengerDraft,
  ministryReference: string | null,
  edited: UetdsPassengerDraft[],
  used: Set<number>,
) {
  return edited.findIndex((next, index) => {
    if (used.has(index)) {
      return false;
    }
    const nextRef = passengerMinistryRef(next);
    if (ministryReference && nextRef && nextRef === ministryReference) {
      return true;
    }
    return Boolean(current.key) && current.key === next.key;
  });
}

export function classifyUetdsPassengers(
  original: UetdsDraft,
  edited: UetdsDraft,
  ministryRefs: Array<string | null>,
): ClassifiedUetdsPassenger[] {
  const classified: ClassifiedUetdsPassenger[] = [];
  const usedEdited = new Set<number>();
  const existingCount = original.passengers.length;

  for (let index = 0; index < existingCount; index += 1) {
    const current = original.passengers[index]!;
    const ministryReference = passengerMinistryRef(current, ministryRefs[index]);
    const matchIndex = findEditedMatch(current, ministryReference, edited.passengers, usedEdited);
    if (matchIndex < 0) {
      classified.push({
        kind: "REMOVED_EXISTING",
        index,
        ministryReference,
        original: current,
        edited: null,
      });
      continue;
    }
    usedEdited.add(matchIndex);
    const next = edited.passengers[matchIndex]!;
    classified.push({
      kind:
        passengerFieldSignature(current) === passengerFieldSignature(next)
          ? "UNCHANGED_EXISTING"
          : "EDITED_EXISTING",
      index,
      ministryReference,
      original: current,
      edited: next,
    });
  }

  edited.passengers.forEach((passenger, editedIndex) => {
    if (usedEdited.has(editedIndex)) {
      return;
    }
    classified.push({
      kind: "GENUINELY_NEW",
      index: existingCount + editedIndex,
      ministryReference: null,
      original: null,
      edited: passenger,
    });
  });
  return classified;
}

export function ministryListedActivePassengerCount(ozet: {
  passengers: Array<{ active: boolean }>;
}) {
  if (ozet.passengers.length === 0) {
    return null;
  }
  return ozet.passengers.filter((item) => item.active).length;
}

export function uetdsPassengerCountMismatch(input: {
  classified: ClassifiedUetdsPassenger[];
  ministryActiveCount: number | null;
  editedExistingCorrectionsSucceeded: boolean;
}) {
  const expected = expectedFinalPassengerCount(input.classified);
  const hasAddOrRemove = input.classified.some(
    (item) => item.kind === "GENUINELY_NEW" || item.kind === "REMOVED_EXISTING",
  );
  const hasEditedExisting = input.classified.some((item) => item.kind === "EDITED_EXISTING");
  if (input.ministryActiveCount == null) {
    if (hasEditedExisting && !hasAddOrRemove && input.editedExistingCorrectionsSucceeded) {
      return false;
    }
    return hasEditedExisting || hasAddOrRemove;
  }
  return input.ministryActiveCount !== expected;
}

export function expectedFinalPassengerCount(classified: ClassifiedUetdsPassenger[]) {
  const originalExisting = classified.filter(
    (item) =>
      item.kind === "UNCHANGED_EXISTING" ||
      item.kind === "EDITED_EXISTING" ||
      item.kind === "REMOVED_EXISTING",
  ).length;
  const removedExisting = classified.filter((item) => item.kind === "REMOVED_EXISTING").length;
  const genuinelyNew = classified.filter((item) => item.kind === "GENUINELY_NEW").length;
  return originalExisting - removedExisting + genuinelyNew;
}

export function applyUetdsPassengerCountWindow(
  original: UetdsDraft,
  edited: UetdsDraft,
  ministryRefs: Array<string | null>,
  allowCountChange: boolean,
): UetdsDraft["passengers"] {
  if (allowCountChange) {
    return edited.passengers.slice();
  }
  return original.passengers.map((current, index) => {
    const ministryReference = passengerMinistryRef(current, ministryRefs[index]);
    const matchIndex = findEditedMatch(current, ministryReference, edited.passengers, new Set());
    return matchIndex >= 0 ? edited.passengers[matchIndex]! : current;
  });
}
