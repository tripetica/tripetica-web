/**
 * Browser deep-links into Kamu UAB_TARIFESIZ for assisted e-Devlet edits.
 *
 * Research (HAR + live portal):
 * - `index` is the session-local position of a sefer in the current sefer list HTML
 *   after the logged-in firm’s sefer query — not Firma Sefer Numarası, not ministry sefer ref.
 * - `grupIndex` is the position of a group within that sefer’s group list (usually 0).
 * - `yolcuIndex` is the passenger row position on yolcuListesi for that sefer/grup.
 * None of these can be derived offline from Tripetica data without an authenticated
 * Kamu session that returns the matching list HTML.
 *
 * Therefore this helper never invents index/grupIndex/yolcuIndex. The furthest
 * reliable unauthenticated deep-link is seferListesi; the user finds the trip by
 * Firma Sefer Numarası (Tripetica reservation id / TRP-…) after e-Devlet login.
 */

import { kamuSeferListesiUrl } from "@/lib/uetds/kamu-portal/html";

export type KamuEditDeepLinkStage =
  | "guncelle"
  | "yolcuListesi"
  | "seferGrup"
  | "seferListesi"
  | "seferSorgulama";

export type KamuEditDeepLink = {
  /** Furthest stage we can open without guessing session-local indexes. */
  stage: KamuEditDeepLinkStage;
  url: string;
  /** SOAP firmaSeferNo Tripetica sent (reservation UUID or TRP-…). */
  firmaSeferNo: string | null;
  ministrySeferRef: string | null;
  plate: string | null;
  /** True only when URL targets a verified sefer/passenger — never true offline. */
  matchedSefer: boolean;
};

export function resolveKamuEditDeepLink(input: {
  firmaSeferNo?: string | null;
  ministrySeferRef?: string | null;
  plate?: string | null;
}): KamuEditDeepLink {
  const firmaSeferNo = input.firmaSeferNo?.trim() || null;
  const ministrySeferRef = input.ministrySeferRef?.trim() || null;
  const plate = input.plate?.replace(/\s+/g, "").toUpperCase() || null;

  return {
    // Without an authenticated sefer-list HTML match we must not append index=.
    stage: "seferListesi",
    url: kamuSeferListesiUrl(),
    firmaSeferNo,
    ministrySeferRef,
    plate,
    matchedSefer: false,
  };
}

export function kamuEditDeepLinkFirmaHint(link: KamuEditDeepLink): string | null {
  return link.firmaSeferNo || link.ministrySeferRef || link.plate || null;
}
