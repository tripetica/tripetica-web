export const UETDS_ACTIVE_NOTIFICATION_STATUSES = [
  "submitted",
  "partial",
  "updating",
  "updated",
  "partial_update",
  "update_error",
] as const;

export function isActiveUetdsNotificationStatus(status: string | null | undefined) {
  return UETDS_ACTIVE_NOTIFICATION_STATUSES.includes(
    status as (typeof UETDS_ACTIVE_NOTIFICATION_STATUSES)[number],
  );
}

export function uetdsReservationNotifyPath(input: {
  panel: "ops" | "partner";
  reservationId: string;
  existingId?: string | null;
}) {
  if (input.existingId) {
    return `/${input.panel}/uetds/notifications/${input.existingId}?editMethod=1`;
  }
  return `/${input.panel}/uetds/notifications/new?reservation=${input.reservationId}`;
}
