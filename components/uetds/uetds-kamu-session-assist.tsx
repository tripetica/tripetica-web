"use client";

import { useActionState, useState } from "react";
import { type UetdsFormCopy } from "@/lib/uetds/copy";
import {
  bindKamuPortalSessionAction,
  type KamuSessionBindState,
} from "@/lib/uetds/kamu-portal/session-actions";
import { KAMU_PORTAL_HOME } from "@/lib/uetds/kamu-portal/html";

type Props = {
  copy: UetdsFormCopy;
  locale: string;
  /** Allowlisted firm edit: show assist before/without a failed submit. */
  required: boolean;
  /** Session/auth errors from the last update attempt. */
  errorActive: boolean;
};

export function UetdsKamuSessionAssist({ copy, locale, required, errorActive }: Props) {
  const [bindOpen, setBindOpen] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [state, action, pending] = useActionState(
    bindKamuPortalSessionAction,
    { ok: false, error: null, message: null, probe: null } satisfies KamuSessionBindState,
  );

  if (!required && !errorActive) {
    return null;
  }

  function openKamuPortal() {
    setPopupBlocked(false);
    // Do not pass "noopener" to window.open: many browsers then return null even when
    // the tab opened, which made the previous handler look like a no-op.
    const popup = window.open(KAMU_PORTAL_HOME, "_blank");
    if (!popup) {
      setPopupBlocked(true);
    }
  }

  return (
    <div className="uetds-kamu-session-assist" style={{ marginTop: "0.75rem" }}>
      <p className={errorActive ? "ops-form-error" : "uetds-form-info"}>{copy.editKamuSessionRequired}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <button type="button" className="ops-btn-primary" onClick={openKamuPortal}>
          {copy.kamuLoginOpen}
        </button>
        <a
          className="ops-btn-secondary"
          href={KAMU_PORTAL_HOME}
          target="_blank"
          rel="noopener noreferrer"
        >
          {copy.kamuLoginFallback}
        </a>
        <button type="button" className="ops-btn-secondary" onClick={() => setBindOpen((value) => !value)}>
          {copy.kamuSessionBind}
        </button>
      </div>
      {popupBlocked ? <p className="ops-form-error">{copy.kamuPopupBlocked}</p> : null}
      {bindOpen ? (
        <form action={action} style={{ marginTop: "0.5rem" }}>
          <input type="hidden" name="locale" value={locale} />
          <p className="ops-muted">{copy.kamuSessionBindHint}</p>
          <textarea
            name="cookieHeader"
            rows={3}
            className="ops-input"
            autoComplete="off"
            spellCheck={false}
            placeholder="Cookie: …"
            required
          />
          <button type="submit" className="ops-btn-primary" disabled={pending} style={{ marginTop: "0.5rem" }}>
            {copy.kamuSessionBind}
          </button>
          {state.message ? (
            <p className={state.ok ? "uetds-eligible" : "ops-form-error"}>{state.message}</p>
          ) : null}
          {state.probe ? (
            <p className="ops-muted" style={{ fontSize: "0.85rem" }}>
              probe: status={state.probe.status} host={state.probe.finalHost} path=
              {state.probe.finalPath} html={state.probe.htmlLength}b loginWall=
              {String(state.probe.loginWall)} firmSelect={String(state.probe.firmSelect)} authShell=
              {String(state.probe.authenticatedShell)}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}
