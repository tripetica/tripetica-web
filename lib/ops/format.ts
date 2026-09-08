import { formatDistanceKm } from "@/lib/booking/draft-view";
import { type Locale } from "@/lib/i18n/config";
import {
  formatIstanbulLocalDisplay,
  timestamptzToIstanbulLocal,
} from "@/lib/booking/istanbul-time";
import { formatDurationHours } from "@/lib/booking/catalog";

export function formatOpsDateTime(value: string | null, locale: Locale) {
  if (!value) {
    return "—";
  }
  const local = timestamptzToIstanbulLocal(value);
  if (!local) {
    return "—";
  }
  return formatIstanbulLocalDisplay(local, locale);
}

/** Formats stored duration hours with the same catalog km labels as booking. */
export function formatOpsDuration(
  hours: string | number | null | undefined,
  locale: Locale,
) {
  return formatDurationHours(hours, locale) ?? "—";
}

/** Formats stored route distance for ops views (pickup→dropoff km). */
export function formatOpsDistance(
  distanceKm: string | number | null | undefined,
  locale: Locale,
) {
  if (distanceKm === null || distanceKm === undefined || distanceKm === "") {
    return "";
  }
  const numeric = typeof distanceKm === "number" ? distanceKm : Number(distanceKm);
  if (!Number.isFinite(numeric)) {
    return String(distanceKm).trim();
  }
  return `${formatDistanceKm(numeric, locale)} km`;
}

export function formatOpsMoney(amount: string | null, currency: string | null) {
  if (amount === null || amount === "") {
    return "—";
  }
  if (!currency) {
    return amount;
  }
  return `${amount} ${currency}`;
}

export function dash(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "yes" : "no";
  }
  return String(value);
}

export function parsePage(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function parseQuery(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return (raw ?? "").trim();
}

export function pageCount(total: number, pageSize: number) {
  return Math.max(1, Math.ceil(total / pageSize));
}

export function fillCopy(template: string, vars: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? ""));
}
