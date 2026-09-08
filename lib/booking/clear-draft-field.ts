import { type Locale } from "@/lib/i18n/config";

export type DraftClearField =
  | "pickup"
  | "dropoff"
  | "localDateTime"
  | "durationHours"
  | "tourCode";

export async function persistDraftFieldClear(
  locale: Locale,
  field: DraftClearField,
) {
  try {
    await fetch("/api/booking/draft/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale, [field]: true }),
    });
  } catch {
    // State is already cleared; missing draft is fine.
  }
}
