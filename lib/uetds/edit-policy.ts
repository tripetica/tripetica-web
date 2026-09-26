import { istanbulLocalToUtcMs } from "@/lib/booking/istanbul-time";
import { joinUetdsDateTime } from "@/lib/uetds/trip-time";

/** Tripetica safety lead. Ministry rule is 60 minutes; we never operate on the exact boundary. */
export const UETDS_EDIT_SAFE_LEAD_MS = 61 * 60 * 1000;

export type UetdsEditWindow = {
  remainingMs: number | null;
  remainingMinutes: number | null;
  canChangeStart: boolean;
  canAddNewPassenger: boolean;
  canRemoveExistingPassenger: boolean;
  canChangePassengerCount: boolean;
  /** V15 has no yolcuGuncelle. Official correction is cancel-by-ref then add. */
  canCorrectExistingPassengerViaMinistry: boolean;
};

export function uetdsRemainingUntilStartMs(
  startDate: string,
  startTime: string,
  nowUtcMs: number,
) {
  const startUtc = istanbulLocalToUtcMs(joinUetdsDateTime(startDate, startTime));
  if (!Number.isFinite(startUtc)) {
    return Number.NaN;
  }
  return startUtc - nowUtcMs;
}

export function evaluateUetdsEditWindow(
  startDate: string,
  startTime: string,
  nowUtcMs: number,
): UetdsEditWindow {
  const remainingMs = uetdsRemainingUntilStartMs(startDate, startTime, nowUtcMs);
  const open = Number.isFinite(remainingMs) && remainingMs > UETDS_EDIT_SAFE_LEAD_MS;
  return {
    remainingMs: Number.isFinite(remainingMs) ? remainingMs : null,
    remainingMinutes: Number.isFinite(remainingMs) ? remainingMs / 60_000 : null,
    canChangeStart: open,
    canAddNewPassenger: open,
    canRemoveExistingPassenger: open,
    canChangePassengerCount: open,
    canCorrectExistingPassengerViaMinistry: true,
  };
}

export function uetdsDateInputValue(value: string) {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

export function uetdsTimeInputValue(value: string) {
  const match = value.trim().match(/^(\d{2}:\d{2})/);
  return match?.[1] ?? "";
}

export function isUetdsNewStartSafe(startDate: string, startTime: string, nowUtcMs: number) {
  const remainingMs = uetdsRemainingUntilStartMs(startDate, startTime, nowUtcMs);
  return Number.isFinite(remainingMs) && remainingMs > UETDS_EDIT_SAFE_LEAD_MS;
}

/** New-passenger 61-minute check uses the start Ministry will have when yolcuEkle runs. */
export function effectiveUetdsStartForNewPassenger(input: {
  originalStartDate: string;
  originalStartTime: string;
  finalStartDate: string;
  finalStartTime: string;
  seferUpdateSonucKodu?: number | null;
}) {
  if (input.seferUpdateSonucKodu != null && input.seferUpdateSonucKodu !== 0) {
    return { startDate: input.originalStartDate, startTime: input.originalStartTime };
  }
  return { startDate: input.finalStartDate, startTime: input.finalStartTime };
}

export function foldUetdsSearchPlate(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}

export function formatUetdsSnapshotDateTime(date: string, time: string) {
  const day = date.trim();
  const clock = time.trim();
  if (!day || !clock) {
    return "";
  }
  const [year, month, dayNum] = day.split("-");
  if (!year || !month || !dayNum) {
    return `${day} ${clock}`;
  }
  return `${dayNum}.${month}.${year} ${clock}`;
}

export const UETDS_V15_FLEET_MUTATIONS = {
  cancelPersonnel: "personelIptal",
  addPersonnel: "personelEkle",
  updateVehicle: "seferGuncelle",
  summary: "bildirimOzeti",
  timeWindowMs: null,
  driverSequence: ["personelIptal", "personelEkle"],
} as const;

export const UETDS_V15_PASSENGER_MUTATIONS = {
  add: "yolcuEkle",
  addMany: "yolcuEkleCoklu",
  cancelByIdentity: "yolcuIptal",
  cancelByRef: "yolcuIptalUetdsYolcuRefNoIle",
  query: "yolcuBildirimSorgula",
  summary: "bildirimOzeti",
  /** Public SOAP has no in-place passenger update. */
  update: null,
  /**
   * Default SOAP correction for non-allowlisted firms.
   * Allowlisted firms (Kamu portal UNET ids) use portal Güncelle instead
   * and must not call this sequence for EDITED_EXISTING.
   */
  correctionSequence: ["yolcuIptalUetdsYolcuRefNoIle", "yolcuEkle"],
  portalInPlaceUpdate: "kamuYolcuGuncelle",
} as const;
