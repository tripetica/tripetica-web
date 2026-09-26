import { formatUtcToIstanbulLocal, istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import { UETDS_ACTIVE_NOTIFICATION_STATUSES } from "@/lib/uetds/reservation-notification-state";
import type { UetdsNotificationListItem } from "@/lib/uetds/notification-view";

export type UetdsListFilters = {
  date: "all" | "today" | "tomorrow" | "yesterday" | "past" | "future";
  status: "active" | "completed" | "cancelled" | "archive" | "all";
  sort: "asc" | "desc";
};
export function parseUetdsListFilters(input: Record<string, unknown> = {}): UetdsListFilters {
  return {
    date: typeof input.date === "string" && ["today", "tomorrow", "yesterday", "past", "future"].includes(input.date) ? input.date as UetdsListFilters["date"] : "all",
    status: typeof input.status === "string" && ["completed", "cancelled", "archive", "all"].includes(input.status) ? input.status as UetdsListFilters["status"] : "active",
    sort: input.sort === "asc" ? "asc" : "desc",
  };
}
export function uetdsTripTimestamp(date: string, time: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const stamp = istanbulLocalToUtcMs(`${date}T${time}`);
  return Number.isFinite(stamp) && formatUtcToIstanbulLocal(stamp) === `${date}T${time}` ? stamp : null;
}
export const UETDS_ARCHIVE_AFTER_MS = 6 * 60 * 60 * 1000;
export const UETDS_RETENTION_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
export function isUetdsArchived(endTimestamp: number | null | undefined, now = Date.now()) {
  return endTimestamp != null && Number.isFinite(endTimestamp) && endTimestamp + UETDS_ARCHIVE_AFTER_MS <= now;
}
export function isUetdsRetentionExpired(endTimestamp: number | null | undefined, now = Date.now()) {
  return endTimestamp != null && Number.isFinite(endTimestamp) && endTimestamp < now - UETDS_RETENTION_AFTER_MS;
}
export function classifyUetdsListItem(item: UetdsNotificationListItem, now = Date.now()) {
  if (item.status === "cancelled") return "cancelled";
  if (["submitted", "updated"].includes(item.status) && item.endTimestamp != null && item.endTimestamp < now) return "completed";
  return (UETDS_ACTIVE_NOTIFICATION_STATUSES as readonly string[]).includes(item.status) ? "active" : "other";
}
export function filterUetdsList(items: UetdsNotificationListItem[], filters: UetdsListFilters, now = Date.now()) {
  const today = formatUtcToIstanbulLocal(now).slice(0, 10);
  const shift = (days: number) => new Date(Date.parse(`${today}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
  return items.filter(item => {
    const archived = isUetdsArchived(item.endTimestamp, now);
    if (filters.status === "archive" ? !archived : archived) return false;
    const classification = classifyUetdsListItem(item, now);
    if (filters.status !== "all" && filters.status !== "archive" && classification !== filters.status &&
        !(filters.status === "active" && classification === "completed")) return false;
    if (filters.date === "all") return true;
    if (item.startTimestamp == null) return false;
    const day = formatUtcToIstanbulLocal(item.startTimestamp).slice(0, 10);
    return filters.date === "today" ? day === today : filters.date === "tomorrow" ? day === shift(1) : filters.date === "yesterday" ? day === shift(-1) : filters.date === "past" ? day < today : day > today;
  }).sort((a, b) => {
    if (a.startTimestamp == null && b.startTimestamp != null) return 1;
    if (b.startTimestamp == null && a.startTimestamp != null) return -1;
    const delta = (a.startTimestamp ?? 0) - (b.startTimestamp ?? 0);
    return (filters.sort === "asc" ? delta : -delta) || Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id);
  }).slice(0, 100);
}
