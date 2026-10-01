import {
  mergeAiUetdsExtraction,
  type AiUetdsExtractedDraft,
} from "@/lib/uetds/ai-extraction-schema";
import {
  type UetdsDraft,
  type UetdsPassengerDraft,
  type UetdsPassengerField,
  type UetdsTripField,
} from "@/lib/uetds/draft";

const TRIP_FIELDS: UetdsTripField[] = [
  "origin",
  "destination",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "groupName",
  "purpose",
  "fare",
  "driverId",
  "vehicleId",
];

const PASSENGER_FIELDS: UetdsPassengerField[] = [
  "nationality",
  "identityNumber",
  "firstName",
  "lastName",
  "gender",
];

export function cloneUetdsDraft(draft: UetdsDraft): UetdsDraft {
  return {
    ...draft,
    originLocation: { ...draft.originLocation },
    destinationLocation: { ...draft.destinationLocation },
    fieldProvenance: { ...draft.fieldProvenance },
    passengers: draft.passengers.map((passenger) => ({
      ...passenger,
      provenance: { ...passenger.provenance },
    })),
  };
}

function stampFilledProvenance(draft: UetdsDraft) {
  for (const field of TRIP_FIELDS) {
    if (String(draft[field] ?? "").trim()) {
      draft.fieldProvenance[field] = "document";
    }
  }
  for (const passenger of draft.passengers) {
    for (const field of PASSENGER_FIELDS) {
      if (String(passenger[field] ?? "").trim()) {
        passenger.provenance[field] = "document";
      }
    }
  }
}

/**
 * Original is the notified snapshot. Edited starts as a copy the form can change.
 * Neither is written to a new table; the Kamu step is a later task.
 */
export function prepareAiEditDrafts(source: UetdsDraft): { original: UetdsDraft; edited: UetdsDraft } {
  const original = cloneUetdsDraft(source);
  const edited = cloneUetdsDraft(source);
  stampFilledProvenance(edited);
  return { original, edited };
}

export function applyAiEditExtraction(
  edited: UetdsDraft,
  extracted: AiUetdsExtractedDraft,
  nowUtcMs: number,
) {
  return mergeAiUetdsExtraction(edited, extracted, nowUtcMs, {
    lockPassengerCount: true,
    preserveUntouchedTimes: true,
    replaceMissingDocument: true,
  });
}

export function passengerIdentity(passenger: UetdsPassengerDraft) {
  return `${passenger.firstName}|${passenger.lastName}|${passenger.gender}|${passenger.identityNumber}`;
}
