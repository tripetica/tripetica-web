import { formatUtcToIstanbulLocal, istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";

export type ShareHistoryPreset = "today" | "yesterday" | "3d" | "week" | "range";

export type ShareEventKind =
  | "started"
  | "first_fix"
  | "stream_lost"
  | "stream_resumed"
  | "stopped"
  | "permission_denied"
  | "vehicle_changed";

const DAY_MS = 24 * 60 * 60 * 1000;

export function istanbulDayStart(now = new Date()) {
  const local = formatUtcToIstanbulLocal(now.getTime());
  const day = local.slice(0, 10);
  return istanbulLocalToUtcMs(`${day}T00:00`);
}

export function shareHistoryWindow(input: {
  preset: ShareHistoryPreset;
  fromRaw?: string | null;
  toRaw?: string | null;
  now?: Date;
}): { from: Date; to: Date; fromLocal: string; toLocal: string } | { error: "range" } {
  const now = input.now ?? new Date();
  const today = istanbulDayStart(now);
  if (input.preset === "today") return span(today, today + DAY_MS);
  if (input.preset === "yesterday") return span(today - DAY_MS, today);
  if (input.preset === "3d") return span(today - 2 * DAY_MS, today + DAY_MS);
  if (input.preset === "week") {
    const weekday = istanbulWeekday(now);
    const mondayOffset = weekday === 0 ? 6 : weekday - 1;
    return span(today - mondayOffset * DAY_MS, today + DAY_MS);
  }
  const fromMs = input.fromRaw ? istanbulLocalToUtcMs(input.fromRaw) : Number.NaN;
  const toMs = input.toRaw ? istanbulLocalToUtcMs(input.toRaw) : Number.NaN;
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) return { error: "range" };
  const fromDay = istanbulDayStart(new Date(fromMs));
  const toDay = istanbulDayStart(new Date(toMs)) + DAY_MS;
  if (toDay - fromDay > 366 * DAY_MS) return { error: "range" };
  return span(fromDay, toDay);
}

function span(fromMs: number, toMs: number) {
  return {
    from: new Date(fromMs),
    to: new Date(toMs),
    fromLocal: formatUtcToIstanbulLocal(fromMs),
    toLocal: formatUtcToIstanbulLocal(toMs - 60_000),
  };
}

function istanbulWeekday(now: Date) {
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Istanbul", weekday: "short" }).format(now);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
}

export function shareEventPresentation(kind: string): { icon: string; label: string } | null {
  if (kind === "started") return { icon: "▶", label: "Konum paylaşımı başlatıldı" };
  if (kind === "first_fix") return { icon: "✓", label: "Konum alınmaya başlandı" };
  if (kind === "stream_lost") return { icon: "⚠", label: "Konum akışı kesildi" };
  if (kind === "stream_resumed") return { icon: "✓", label: "Konum akışı yeniden başladı" };
  if (kind === "stopped") return { icon: "■", label: "Konum paylaşımı durduruldu" };
  if (kind === "permission_denied") return { icon: "⚠", label: "Konum izni reddedildi" };
  if (kind === "vehicle_changed") return { icon: "⚠", label: "Araç kaydı değişti" };
  if (kind === "subscription_closed") return { icon: "■", label: "Mobil GPS aboneliği kapatıldı" };
  if (kind === "access_revoked") return { icon: "■", label: "Konum paylaşım yetkisi kalktı" };
  return null;
}

export function formatShareEventTime(iso: string) {
  return new Intl.DateTimeFormat("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}
