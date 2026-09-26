import "server-only";

import { query } from "@/lib/db/postgres";
import { isUuid } from "@/lib/ops/process-filters";
import { parseUetdsDraft, type UetdsDraft } from "@/lib/uetds/draft";
import {
  canAccessUetdsFormDraft,
  isUetdsFormDraftExpired,
  uetdsFormDraftScopeKey,
  type UetdsFormDraftActor,
} from "@/lib/uetds/form-draft-policy";
import { loadUetdsReservationContext } from "@/lib/uetds/reservation-context";

type DraftRow = {
  id: string;
  actor_type: "partner" | "ops";
  actor_user_id: string;
  partner_id: string | null;
  scope_key: string;
  payload: unknown;
  created_at: Date;
};

export async function cleanupExpiredUetdsFormDrafts() {
  await query(
    `DELETE FROM uetds_form_drafts
     WHERE created_at <= NOW() - INTERVAL '12 hours'`,
  );
}

function actorOk(actor: UetdsFormDraftActor) {
  if (!isUuid(actor.userId)) {
    return false;
  }
  if (actor.type === "partner") {
    return isUuid(actor.partnerId ?? "");
  }
  return actor.partnerId == null;
}

export async function loadUetdsFormDraft(input: {
  actor: UetdsFormDraftActor;
  reservationId?: string | null;
}): Promise<UetdsDraft | null> {
  if (!input.reservationId || !actorOk(input.actor)) {
    return null;
  }
  await cleanupExpiredUetdsFormDrafts();
  const scopeKey = uetdsFormDraftScopeKey(input.reservationId);
  const result = await query<DraftRow>(
    `SELECT id, actor_type, actor_user_id, partner_id, scope_key, payload, created_at
     FROM uetds_form_drafts
     WHERE actor_type = $1
       AND actor_user_id = $2
       AND scope_key = $3
       AND (
         ($1 = 'partner' AND partner_id = $4)
         OR ($1 = 'ops' AND partner_id IS NULL)
       )
     LIMIT 1`,
    [input.actor.type, input.actor.userId, scopeKey, input.actor.partnerId],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }
  if (
    !canAccessUetdsFormDraft(
      {
        actorType: row.actor_type,
        actorUserId: row.actor_user_id,
        partnerId: row.partner_id,
        createdAtMs: row.created_at.getTime(),
      },
      input.actor,
    )
  ) {
    return null;
  }
  if (isUetdsFormDraftExpired(row.created_at.getTime())) {
    await query(`DELETE FROM uetds_form_drafts WHERE id = $1`, [row.id]);
    return null;
  }
  return parseUetdsDraft(row.payload);
}

export async function saveUetdsFormDraft(input: {
  actor: UetdsFormDraftActor;
  draft: unknown;
}): Promise<{ ok: true } | { ok: false; error: "forbidden" | "invalid" }> {
  if (!actorOk(input.actor)) {
    return { ok: false, error: "forbidden" };
  }
  const draft = parseUetdsDraft(input.draft);
  if (!draft) {
    return { ok: false, error: "invalid" };
  }
  if (!draft.reservationId) {
    return { ok: true }; // Manual new forms are deliberately not persisted.
  }
  if (input.actor.type === "partner" && draft.reservationId) {
    const context = await loadUetdsReservationContext(draft.reservationId);
    if (!context || context.partnerId !== input.actor.partnerId) {
      return { ok: false, error: "forbidden" };
    }
  }
  await cleanupExpiredUetdsFormDrafts();
  const scopeKey = uetdsFormDraftScopeKey(draft.reservationId);
  await query(
    `INSERT INTO uetds_form_drafts (
       actor_type, actor_user_id, partner_id, reservation_id, scope_key, payload
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (actor_type, actor_user_id, scope_key)
     DO UPDATE SET
       payload = EXCLUDED.payload,
       reservation_id = EXCLUDED.reservation_id,
       partner_id = EXCLUDED.partner_id,
       updated_at = NOW()`,
    [
      input.actor.type,
      input.actor.userId,
      input.actor.type === "partner" ? input.actor.partnerId : null,
      draft.reservationId,
      scopeKey,
      JSON.stringify(draft),
    ],
  );
  return { ok: true };
}

export async function deleteUetdsFormDraft(input: {
  actor: UetdsFormDraftActor;
  reservationId?: string | null;
}) {
  if (!actorOk(input.actor)) {
    return;
  }
  const scopeKey = uetdsFormDraftScopeKey(input.reservationId);
  await query(
    `DELETE FROM uetds_form_drafts
     WHERE actor_type = $1
       AND actor_user_id = $2
       AND scope_key = $3
       AND (
         ($1 = 'partner' AND partner_id = $4)
         OR ($1 = 'ops' AND partner_id IS NULL)
       )`,
    [input.actor.type, input.actor.userId, scopeKey, input.actor.partnerId],
  );
}
