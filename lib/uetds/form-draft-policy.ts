export const UETDS_FORM_DRAFT_TTL_MS = 12 * 60 * 60 * 1000;

export type UetdsFormDraftActor = {
  type: "partner" | "ops";
  userId: string;
  partnerId: string | null;
};

export type UetdsFormDraftRow = {
  actorType: "partner" | "ops";
  actorUserId: string;
  partnerId: string | null;
  createdAtMs: number;
};

export function uetdsFormDraftScopeKey(reservationId: string | null | undefined) {
  return reservationId?.trim() || "manual";
}

export function isUetdsFormDraftExpired(createdAtMs: number, nowUtcMs = Date.now()) {
  return nowUtcMs >= createdAtMs + UETDS_FORM_DRAFT_TTL_MS;
}

export function canAccessUetdsFormDraft(
  row: UetdsFormDraftRow,
  actor: UetdsFormDraftActor,
) {
  if (row.actorType !== actor.type || row.actorUserId !== actor.userId) {
    return false;
  }
  if (actor.type === "partner") {
    return Boolean(actor.partnerId && row.partnerId === actor.partnerId);
  }
  return row.partnerId == null;
}

export function shouldDeleteUetdsFormDraftAfterMinistry(status: string | null | undefined) {
  return status === "submitted";
}

export function isForbiddenDraftPayloadKey(key: string) {
  return /password|credential|username|file|image|pdf|base64|document|upload|sifre/i.test(key);
}
