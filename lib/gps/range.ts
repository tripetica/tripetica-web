import {
  formatUtcToIstanbulLocal,
  istanbulLocalToUtcMs,
} from "@/lib/booking/istanbul-time";
import { GPS_ROUTE_MAX_SPAN_MS } from "@/lib/gps/contract";

export function readGpsRange(
  fromRaw: string | undefined,
  toRaw: string | undefined,
  now = new Date(),
) {
  const defaultFrom = now.getTime() - 24 * 60 * 60 * 1000;
  const fromMs = fromRaw ? istanbulLocalToUtcMs(fromRaw) : defaultFrom;
  const toMs = toRaw ? istanbulLocalToUtcMs(toRaw) + 60_000 : now.getTime();
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) {
    return { error: "range" as const };
  }
  if (toMs - fromMs > GPS_ROUTE_MAX_SPAN_MS) {
    return { error: "range" as const };
  }
  return {
    from: new Date(fromMs),
    to: new Date(toMs),
    fromLocal: fromRaw || formatUtcToIstanbulLocal(fromMs),
    toLocal: toRaw || formatUtcToIstanbulLocal(toMs),
  };
}
