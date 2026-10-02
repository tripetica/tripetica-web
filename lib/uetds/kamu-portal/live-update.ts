/**
 * Real Kamu group and passenger update after a matched sefer.
 * Links and field names come from the live UAB_TARIFESIZ pages:
 * Grup Listesi, yeniGrup?grupIndex, Yolcu Listesi, yeniYolcu?yolcuIndex.
 * Yeni Yolcu (flush) and iptal links are never followed.
 */

import {
  matchPortalTrip,
  nextPassengerSyncStep,
  normalizePortalSeferNumber,
  parsePortalSeferRows,
  planPassengerReplacements,
  portalDocumentNumber,
  type PortalLocation,
  type PortalPassengerIdentity,
  type PortalTripTarget,
} from "@/lib/uetds/kamu-portal/edit-plan";
import { hasYolcuUpdatedFlash } from "@/lib/uetds/kamu-portal/html";

export type PortalEditPlan = {
  oldPickup: PortalLocation;
  newPickup: PortalLocation;
  oldDropoff: PortalLocation;
  newDropoff: PortalLocation;
  oldPassengers: PortalPassengerIdentity[];
  newPassengers: PortalPassengerIdentity[];
};

export type PortalGroupRow = {
  grupIndex: number;
  name: string;
  pickup: string;
  dropoff: string;
  editHref: string;
  passengerHref: string;
};

export type PortalUpdatePage = {
  url(): Promise<string>;
  html(): Promise<string>;
  goto(url: string): Promise<void>;
  saveGroupForm?(input: { pickup: PortalLocation | null; dropoff: PortalLocation | null; identityConfirmed?: boolean }): Promise<boolean>;
  savePassengerForm?(input: {
    yolcuIndex: number;
    nationality: string;
    documentNumber: string;
    firstName: string;
    lastName: string;
    gender: string;
  }): Promise<boolean>;
};

const BASE = "https://kamu.turkiye.gov.tr/UAB_TARIFESIZ?page=tarifesiz-yolcu-tasimaciligi-islemleri";

function fold(value: string) {
  return value.trim().toLocaleUpperCase("tr-TR").replace(/\s+/g, " ");
}

function cellText(html: string) {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function hrefOf(rowHtml: string, marker: RegExp) {
  const links = [...rowHtml.matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const hit = links.find((link) => marker.test(link[1] ?? "") && /Güncelle|Yolcu Listesi/i.test(cellText(link[2] ?? "")));
  return (hit?.[1] ?? "").replace(/&amp;/g, "&");
}

function placeSegments(cell: string) {
  return cell
    .replace(/\u00a0/g, " ")
    .replace(/[／∕⁄]/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function isPlaceCell(cell: string) {
  const parts = placeSegments(cell);
  return parts.length >= 2 && parts.every((part) => /\p{L}/u.test(part));
}

function columnHeaderMap(cells: string[]) {
  const folded = cells.map((cell) => fold(cell));
  const isTime = (cell: string) => /TAR[İI]H|SAAT/.test(cell);
  const pickup = folded.findIndex((cell) => /BAŞLANGIÇ|BASLANGIC/.test(cell) && !isTime(cell));
  const dropoff = folded.findIndex((cell) => /B[İI]T[İI][ŞS]|BITIS/.test(cell) && !isTime(cell));
  const description = folded.findIndex((cell) => /A[ÇC]IKLAMA/.test(cell));
  const name = description >= 0 ? description : folded.findIndex((cell) => /GRUP\s*ADI/.test(cell));
  if (pickup < 0 || dropoff < 0 || pickup === dropoff) return null;
  return { pickup, dropoff, name };
}

function locateGroupPlaces(cells: string[], headers: { pickup: number; dropoff: number; name: number } | null) {
  if (headers) {
    const pickup = cells[headers.pickup] ?? "";
    const dropoff = cells[headers.dropoff] ?? "";
    if (isPlaceCell(pickup) && isPlaceCell(dropoff)) {
      return { pickup, dropoff, name: headers.name >= 0 ? cells[headers.name] ?? "" : "" };
    }
  }
  const places = cells.filter(isPlaceCell);
  if (places.length !== 2) return null;
  const name = cells.find((cell) => cell.trim() && !isPlaceCell(cell) && !/Güncelle|Yolcu Listesi/i.test(cell)) ?? "";
  return { pickup: places[0] ?? "", dropoff: places[1] ?? "", name };
}

export function parsePortalGroupRows(html: string): PortalGroupRow[] {
  const rows: PortalGroupRow[] = [];
  const seen = new Set<string>();
  let headers: { pickup: number; dropoff: number; name: number } | null = null;
  for (const match of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const tr = match[0];
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cell) => cellText(cell[1] ?? ""));
    if (!/grupIndex=/i.test(tr)) {
      const header = columnHeaderMap(cells);
      if (header) headers = header;
      continue;
    }
    const editHref = hrefOf(tr, /asama=yeniGrup/i);
    const passengerHref = hrefOf(tr, /asama=yolcuListesi/i);
    if (!editHref || !passengerHref || /flush/i.test(editHref) || /flush/i.test(passengerHref)) continue;
    const indexMatch = editHref.match(/grupIndex=(\d+)/i);
    if (!indexMatch) continue;
    const grupIndex = Number(indexMatch[1]);
    if (!Number.isFinite(grupIndex)) continue;
    const located = locateGroupPlaces(cells, headers);
    if (!located) continue;
    const key = `${fold(located.pickup)}\n${fold(located.dropoff)}\n${editHref}`;
    if (seen.has(key)) continue;
    seen.add(key);
    rows.push({ grupIndex, name: located.name, pickup: located.pickup, dropoff: located.dropoff, editHref, passengerHref });
  }
  return rows;
}

export function parsePortalPassengerRows(html: string) {
  const rows = [];
  const seen = new Set<number>();
  for (const match of html.matchAll(/<tr[\s\S]*?<\/tr>/gi)) {
    const tr = match[0];
    const indexMatch = tr.match(/yolcuIndex=(\d+)/i);
    if (!indexMatch || /asama=yolcuIptali/i.test(tr) && !/asama=yeniYolcu/i.test(tr)) continue;
    if (!/asama=yeniYolcu/i.test(tr) || /flush/i.test(tr)) continue;
    const index = Number(indexMatch[1]);
    if (!Number.isFinite(index) || seen.has(index)) continue;
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cellText(cell[1] ?? ""));
    if (cells.length < 4) continue;
    seen.add(index);
    const fullName = cells[2] ?? "";
    const parts = fullName.split(" ").filter(Boolean);
    rows.push({
      index,
      nationality: cells[0] ?? "",
      documentNumber: cells[1] ?? "",
      firstName: parts[0] ?? "",
      lastName: parts.slice(1).join(" "),
      fullName,
      gender: cells[3] ?? "",
    });
  }
  return rows;
}

export function samePortalPlace(cell: string, location: PortalLocation) {
  const parts = placeSegments(cell).map((part) => fold(part));
  if (parts.length < 2) return false;
  const province = fold(location.provinceName);
  if (!province || parts[parts.length - 1] !== province) return false;
  const tokens = [fold(location.districtName), fold(location.placeName)].filter((token) => token && token !== province);
  const body = parts.slice(0, -1);
  return tokens.some((token) => body.includes(token));
}

export function portalPlaceShowsDistrict(cell: string, location: PortalLocation) {
  const parts = placeSegments(cell).map((part) => fold(part));
  const district = fold(location.districtName);
  const province = fold(location.provinceName);
  return parts.length >= 2 && Boolean(district) && parts[0] === district && parts[parts.length - 1] === province;
}

export function matchPortalGroups(rows: PortalGroupRow[], pickup: PortalLocation, dropoff: PortalLocation) {
  const hits = rows.filter((row) => samePortalPlace(row.pickup, pickup) && samePortalPlace(row.dropoff, dropoff));
  if (hits.length === 0) return { ok: false as const, error: "group_not_found" as const };
  if (hits.length > 1) return { ok: false as const, error: "ambiguous_group_match" as const };
  return { ok: true as const, group: hits[0]! };
}

/**
 * Which group to edit. Pickup and dropoff are not the group identity:
 * the sole group on an already verified trip is that group.
 * Target places are never used to choose it.
 */
export function resolvePortalGroupRow(
  rows: PortalGroupRow[],
  sourcePickup: PortalLocation,
  sourceDropoff: PortalLocation,
) {
  if (rows.length === 0) return { ok: false as const, error: "group_not_found" as const };
  if (rows.length === 1) return { ok: true as const, group: rows[0]! };
  const source = matchPortalGroups(rows, sourcePickup, sourceDropoff);
  if (source.ok) return source;
  return { ok: false as const, error: "ambiguous_group_match" as const };
}

/** Ministry CURRENT versus Tripetica TARGET. A side that already shows the target district is not written. */
export function portalGroupNeedsWrite(group: PortalGroupRow, targetPickup: PortalLocation, targetDropoff: PortalLocation) {
  return {
    pickup: !portalPlaceShowsDistrict(group.pickup, targetPickup),
    dropoff: !portalPlaceShowsDistrict(group.dropoff, targetDropoff),
  };
}

export function portalPlacesDiffer(left: PortalLocation, right: PortalLocation) {
  return fold(left.provinceName) !== fold(right.provinceName) || fold(left.districtName) !== fold(right.districtName);
}

function absolutePortalUrl(href: string) {
  if (href.startsWith("http")) return href;
  return new URL(href, "https://kamu.turkiye.gov.tr").toString();
}

export function groupListUrl(tripIndex: number) {
  return `${BASE}&asama=grupListesi&index=${tripIndex}`;
}

async function readSettled(page: PortalUpdatePage) {
  let last = "";
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const url = await page.url();
      const html = await page.html();
      return { url, html };
    } catch {
      last = "navigating";
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }
  throw new Error(last || "page_unreadable");
}

const GROUP_FORM_FIELDS = [
  { key: "startDate", label: /SEFER\s+BA[ŞS]LANGI[ÇC]\s+TAR[İI]H[İI]|BA[ŞS]LANGI[ÇC]\s+TAR[İI]H[İI]/, kind: "date" },
  { key: "startTime", label: /SEFER\s+BA[ŞS]LANGI[ÇC]\s+SAAT[İI]|BA[ŞS]LANGI[ÇC]\s+SAAT[İI]/, kind: "time" },
  { key: "endDate", label: /SEFER\s+B[İI]T[İI][ŞS]\s+TAR[İI]H[İI]|B[İI]T[İI][ŞS]\s+TAR[İI]H[İI]/, kind: "date" },
  { key: "endTime", label: /SEFER\s+B[İI]T[İI][ŞS]\s+SAAT[İI]|B[İI]T[İI][ŞS]\s+SAAT[İI]/, kind: "time" },
  { key: "plate", label: /ARA[ÇC]\s+PLAKA(?:\s+NUMARASI)?/, kind: "plate" },
  { key: "seferNumber", label: /F[İI]RMA\s+SEFER\s+NUMARASI/, kind: "sefer" },
] as const;

function groupFormVisibleText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<input\b[^>]*>/gi, (tag) => ` ${tag.match(/\bvalue=["']([^"']*)["']/i)?.[1] ?? ""} `)
    .replace(/<textarea\b[^>]*>([\s\S]*?)<\/textarea>/gi, " $1 ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("tr-TR");
}

function groupFormToken(rest: string, kind: "date" | "time" | "plate" | "sefer") {
  const window = rest.slice(0, 80);
  if (kind === "date") return window.match(/\d{2}[./]\d{2}[./]\d{4}|\d{4}-\d{2}-\d{2}/)?.[0] ?? "";
  if (kind === "time") return window.match(/\d{1,2}:\d{2}/)?.[0] ?? "";
  if (kind === "plate") return window.match(/\d{2}\s*[A-ZÇĞİÖŞÜ]{1,3}\s*\d{2,5}/)?.[0] ?? "";
  const firm = window.match(/TRP-\d+|\d{6,}/)?.[0];
  if (firm) return firm;
  return (window.match(/\d{2,4}(?:\s+\d{2,4}){2,}/)?.[0] ?? "").replace(/\s+/g, "");
}

function readGroupFormField(text: string, label: RegExp, kind: "date" | "time" | "plate" | "sefer") {
  const re = new RegExp(label.source, "g");
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    const value = groupFormToken(text.slice(match.index + match[0].length), kind);
    if (value) return value;
  }
  return "";
}

/** Opened-trip identity is Firma Sefer No, or the stored ministry sefer number. Clock and plate are not identity. */
export function groupFormIdentityVerdict(html: string, target: PortalTripTarget): "match" | "mismatch" | "absent" {
  const text = groupFormVisibleText(html);
  const titled = /GRUP\s+B[İI]LG[İI]LER[İI]\s+G[İI]R[İI][ŞS]\s+FORMU/.test(text);
  const present = GROUP_FORM_FIELDS.filter((field) => new RegExp(field.label.source).test(text));
  if (!titled && present.length < GROUP_FORM_FIELDS.length) return "absent";
  const firmaSeferNo = normalizePortalSeferNumber(target.firmaSeferNo ?? "");
  const seferNumber = normalizePortalSeferNumber(target.seferNumber);
  if (!firmaSeferNo && !seferNumber) return "mismatch";
  const readSefer = normalizePortalSeferNumber(readGroupFormField(text, /F[İI]RMA\s+SEFER\s+NUMARASI/, "sefer"));
  if (firmaSeferNo && readSefer === firmaSeferNo) return "match";
  if (seferNumber && readSefer === seferNumber) return "match";
  return "mismatch";
}

export function groupPageIsSameTrip(html: string, target: PortalTripTarget) {
  const form = groupFormIdentityVerdict(html, target);
  if (form === "match") return true;
  if (form === "mismatch") return false;
  const firmaSeferNo = normalizePortalSeferNumber(target.firmaSeferNo ?? "");
  const seferNumber = normalizePortalSeferNumber(target.seferNumber);
  const compact = html.toLocaleUpperCase("tr-TR").replace(/\s+/g, "");
  if (firmaSeferNo && compact.includes(firmaSeferNo)) return true;
  if (!seferNumber) return false;
  if (compact.includes(seferNumber)) return true;
  // Firma Sefer No (TRP-…) is a different column. A 16-digit UETDS sefer no must not be a different number.
  if (!/^\d{16}$/.test(seferNumber)) return false;
  const ministryNumbers = compact.match(/\d{16}/g) ?? [];
  return ministryNumbers.length === 0 || ministryNumbers.every((item) => item === seferNumber);
}

export function isDetachedNavigation(error: unknown) {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error ?? "");
  return /detach|destroyed|navigat|aborted|ERR_ABORTED|not_element/i.test(message);
}

export function passengerSaveSucceeded(input: { url: string; html: string; firstName: string; lastName: string }) {
  if (hasYolcuUpdatedFlash(input.html)) return true;
  if (!/asama=yolcuListesi/i.test(input.url) || /flush/i.test(input.url)) return false;
  const folded = input.html.toLocaleUpperCase("tr-TR");
  const first = input.firstName.trim().toLocaleUpperCase("tr-TR");
  const last = input.lastName.trim().toLocaleUpperCase("tr-TR");
  return Boolean(first && last && folded.includes(first) && folded.includes(last));
}

async function readUpdatePage(page: PortalUpdatePage) {
  try {
    return await readSettled(page);
  } catch (error) {
    if (!isDetachedNavigation(error)) throw error;
    return null;
  }
}

export async function runPortalUpdate(input: {
  page: PortalUpdatePage;
  tripIndex: number;
  tripTarget: PortalTripTarget;
  plan: PortalEditPlan;
  onPhase: (phase: string) => void;
}): Promise<{ phase: string; error: string | null; passengerStep: number | null }> {
  const { page, plan } = input;
  input.onPhase("group_list_ready");
  let tripIndex = input.tripIndex;
  await page.goto(groupListUrl(tripIndex));
  let groupPage = await readSettled(page);
  if (!/asama=grupListesi/i.test(groupPage.url) || !groupPageIsSameTrip(groupPage.html, input.tripTarget)) {
    await page.goto(`${BASE}&asama=seferListesi`);
    const listPage = await readSettled(page);
    const again = matchPortalTrip(parsePortalSeferRows(listPage.html), input.tripTarget);
    if (!again.ok) {
      const error = again.error === "trip_number_mismatch" || again.error === "trip_number_missing" ? again.error : "trip_identity_lost";
      return { phase: "group_list_ready", error, passengerStep: null };
    }
    tripIndex = again.listPosition;
    await page.goto(groupListUrl(tripIndex));
    groupPage = await readSettled(page);
  }
  if (!/asama=grupListesi/i.test(groupPage.url)) return { phase: "group_list_ready", error: "group_list_missing", passengerStep: null };
  if (!groupPageIsSameTrip(groupPage.html, input.tripTarget)) {
    return { phase: "group_list_ready", error: "trip_identity_lost", passengerStep: null };
  }
  const groups = parsePortalGroupRows(groupPage.html);
  const matched = resolvePortalGroupRow(groups, plan.oldPickup, plan.oldDropoff);
  if (!matched.ok) return { phase: "group_list_ready", error: matched.error, passengerStep: null };
  const group = matched.group;
  input.onPhase("group_compare");
  const needs = portalGroupNeedsWrite(group, plan.newPickup, plan.newDropoff);
  if (needs.pickup || needs.dropoff) {
    if (!page.saveGroupForm) return { phase: "group_compare", error: "group_update_unverified", passengerStep: null };
    await page.goto(absolutePortalUrl(group.editHref));
    const opened = await readSettled(page);
    if (/flush/i.test(opened.url) || /asama=(?:seferDetay|grupIptali|yolcuIptali|excelYukle|yeniYolcu)/i.test(opened.url)) {
      return { phase: "group_compare", error: "group_update_unverified", passengerStep: null };
    }
    const identity = groupFormIdentityVerdict(opened.html, input.tripTarget);
    if (identity === "mismatch" || (identity === "absent" && !groupPageIsSameTrip(opened.html, input.tripTarget))) {
      return { phase: "group_compare", error: "trip_identity_lost", passengerStep: null };
    }
    const saved = await page.saveGroupForm({
      pickup: needs.pickup ? plan.newPickup : null,
      dropoff: needs.dropoff ? plan.newDropoff : null,
      identityConfirmed: identity === "match",
    });
    if (!saved) return { phase: "group_compare", error: "group_update_unverified", passengerStep: null };
    input.onPhase("group_updated");
  } else {
    input.onPhase("group_unchanged");
  }
  input.onPhase("passenger_list_ready");
  await page.goto(absolutePortalUrl(group.passengerHref));
  const passengerPage = await readSettled(page);
  if (!/asama=yolcuListesi/i.test(passengerPage.url) || /flush/i.test(passengerPage.url)) {
    return { phase: "passenger_list_ready", error: "passenger_list_missing", passengerStep: null };
  }
  if (!groupPageIsSameTrip(passengerPage.html, input.tripTarget)) {
    return { phase: "passenger_list_ready", error: "trip_identity_lost", passengerStep: null };
  }
  let listUrl = passengerPage.url;
  let listed = parsePortalPassengerRows(passengerPage.html);
  const replacements = planPassengerReplacements(plan.oldPassengers, plan.newPassengers);
  for (const [offset, replacement] of replacements.entries()) {
    const step = offset + 1;
    const decision = nextPassengerSyncStep(replacement, listed);
    if (decision.action === "error") {
      const error = decision.error === "ambiguous_passenger_match" ? decision.error : "source_data_mismatch";
      return { phase: `passenger_${step}_matched`, error, passengerStep: step };
    }
    if (decision.action === "skip") {
      input.onPhase(`passenger_${step}_updated`);
      continue;
    }
    const found = { index: decision.yolcuIndex };
    input.onPhase(`passenger_${step}_matched`);
    const next = replacement.next;
    if (!page.savePassengerForm) return { phase: `passenger_${step}_matched`, error: "passenger_update_unverified", passengerStep: step };
    const editUrl = new URL(listUrl);
    editUrl.searchParams.set("asama", "yeniYolcu");
    editUrl.searchParams.set("yolcuIndex", String(found.index));
    editUrl.searchParams.delete("flush");
    if (!/[?&]yolcuIndex=\d+(?:&|$)/.test(editUrl.toString())) {
      return { phase: `passenger_${step}_matched`, error: "passenger_update_unverified", passengerStep: step };
    }
    await page.goto(editUrl.toString());
    const names = { firstName: next.firstName, lastName: next.lastName };
    let saved = false;
    try {
      saved = await page.savePassengerForm({
        yolcuIndex: found.index,
        nationality: next.nationality,
        documentNumber: portalDocumentNumber(next.documentNumber),
        firstName: next.firstName,
        lastName: next.lastName,
        gender: next.gender,
      });
    } catch (error) {
      if (!isDetachedNavigation(error)) throw error;
      const duringNavigation = await readUpdatePage(page);
      saved = Boolean(duringNavigation && passengerSaveSucceeded({ ...duringNavigation, ...names }));
    }
    if (!saved) return { phase: `passenger_${step}_updated`, error: "passenger_update_unverified", passengerStep: step };
    let verified = await readUpdatePage(page);
    if (verified && !/asama=yolcuListesi/i.test(verified.url)) {
      await page.goto(listUrl);
      verified = await readUpdatePage(page);
    }
    if (!verified || !passengerSaveSucceeded({ ...verified, ...names }) || !/asama=yolcuListesi/i.test(verified.url) || /flush/i.test(verified.url)) {
      return { phase: `passenger_${step}_updated`, error: "passenger_update_unverified", passengerStep: step };
    }
    if (!groupPageIsSameTrip(verified.html, input.tripTarget)) {
      return { phase: `passenger_${step}_updated`, error: "trip_identity_lost", passengerStep: step };
    }
    listUrl = verified.url;
    listed = parsePortalPassengerRows(verified.html);
    input.onPhase(`passenger_${step}_updated`);
  }
  input.onPhase("passengers_done");
  input.onPhase("update_flow_complete");
  return { phase: "update_flow_complete", error: null, passengerStep: null };
}
