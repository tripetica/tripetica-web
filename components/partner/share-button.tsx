"use client";

import { mobileShareView } from "@/lib/gps/mobile-share-phase";
import { mobileShareLabel, mobileShareNote } from "@/lib/gps/mobile-share-labels";
import { pressMobileShare, useMobileShareRuntime } from "@/components/gps/mobile-share-runtime";
import { type Locale } from "@/lib/i18n/config";

export function PartnerShareButton({ locale }: { locale: Locale }) {
  const { state } = useMobileShareRuntime();
  const view = mobileShareView(state, Date.now());
  return (
    <div className="partner-share-control">
      <button
        type="button"
        className="ops-btn-secondary ops-push-button"
        disabled={view.action === "none"}
        onClick={() => void pressMobileShare()}
      >
        {mobileShareLabel(locale, view.label)}
      </button>
      {view.note ? <p className="partner-share-note">{mobileShareNote(locale, view.note)}</p> : null}
    </div>
  );
}
