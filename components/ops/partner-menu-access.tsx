"use client";

import { useActionState } from "react";
import { PARTNER_TABS, type PartnerTab } from "@/lib/partner/access";
import { updateOpsPartnerMenuAccessAction, type OpsPartnerFormState } from "@/lib/ops/partner-actions";
import { type OpsCopy } from "@/lib/ops/copy";
import { type Locale } from "@/lib/i18n/config";

type PartnerMenuAccessProps = {
  locale: Locale;
  partnerId: string;
  copy: OpsCopy;
  denied: readonly PartnerTab[];
  canManage: boolean;
};

export function PartnerMenuAccess({
  locale,
  partnerId,
  copy,
  denied,
  canManage,
}: PartnerMenuAccessProps) {
  const deniedSet = new Set(denied);
  const [state, action, pending] = useActionState<OpsPartnerFormState, FormData>(
    updateOpsPartnerMenuAccessAction,
    { error: null, ok: false },
  );

  return (
    <form action={action} className="ops-partner-editor">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="id" value={partnerId} />
      <fieldset className="ops-fieldset" disabled={!canManage || pending}>
        <legend>{copy.partnerMenuAccess}</legend>
        <p className="partner-field-hint">{copy.partnerMenuAccessLead}</p>
        {PARTNER_TABS.map((tab) => (
          <label key={tab} className="ops-check">
            <input type="checkbox" name="tab" value={tab} defaultChecked={!deniedSet.has(tab)} />
            {copy.partnerMenuLabels[tab]}
          </label>
        ))}
      </fieldset>
      {state.ok ? <p className="ops-form-ok">{copy.partnerMenuSaved}</p> : null}
      {state.error ? <p className="ops-form-error">{copy.partnerMenuFailed}</p> : null}
      {canManage ? (
        <button type="submit" className="ops-btn-primary" disabled={pending}>
          {pending ? copy.saving : copy.save}
        </button>
      ) : null}
    </form>
  );
}
