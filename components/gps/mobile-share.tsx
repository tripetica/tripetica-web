"use client";

import { useEffect, useRef } from "react";
import { PartnerShareButton } from "@/components/partner/share-button";
import { mobileShareStatusCopy } from "@/lib/gps/mobile-share-labels";
import { type Locale } from "@/lib/i18n/config";
import {
  bindMobileShareOwner,
  useMobileShareRuntime,
  type MobileShareSnapshot,
} from "@/components/gps/mobile-share-runtime";

export type MobileShareView = MobileShareSnapshot;

function useShareOwner(initial: MobileShareSnapshot | null) {
  const shareRef = useRef(initial);
  shareRef.current = initial;
  useEffect(() => bindMobileShareOwner(shareRef.current), []);
}

export function PartnerMobileShareRuntime({ initial }: { initial: MobileShareSnapshot | null }) {
  useShareOwner(initial);
  return null;
}

export function MobileShareOwner({ initial }: { initial: MobileShareSnapshot | null }) {
  useShareOwner(initial);
  return null;
}

function clock(iso: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    dateStyle: "short",
    timeStyle: "medium",
  }).format(new Date(iso));
}

export function MobileGpsShare({
  title,
  locale,
  initial,
}: {
  title: string;
  locale: Locale;
  initial: MobileShareSnapshot;
}) {
  const { identity } = useMobileShareRuntime();
  const share = identity ?? initial;
  const status = mobileShareStatusCopy(locale);
  return (
    <section className="gps-section">
      <MobileShareOwner initial={initial} />
      <h2>{title}</h2>
      <p>{share.driverName}{share.plate ? <> · <span className="ltr-isolate" dir="ltr">{share.plate}</span></> : ""}</p>
      <PartnerShareButton locale={locale} />
      <p>{status.lastFix}: <span className="ltr-isolate" dir="ltr">{clock(share.lastFixAt)}</span> · {status.accuracy}: <span className="ltr-isolate" dir="ltr">{share.accuracyM == null ? "—" : `${Math.round(share.accuracyM)} m`}</span></p>
      <p className="gps-inline-note">{status.permissionNote}</p>
    </section>
  );
}
