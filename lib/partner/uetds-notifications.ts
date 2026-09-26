import type { UetdsListFilters } from "@/lib/uetds/list-policy";
import "server-only";

import {
  getUetdsNotification,
  listUetdsNotifications,
  type UetdsNotificationDetail,
  type UetdsNotificationListItem,
} from "@/lib/uetds/notifications";

export type PartnerUetdsNotificationListItem = UetdsNotificationListItem;
export type PartnerUetdsNotificationDetail = UetdsNotificationDetail;

export async function listPartnerUetdsNotifications(
  partnerId: string,
  search = "",
  filters?: UetdsListFilters,
): Promise<PartnerUetdsNotificationListItem[]> {
  if (!partnerId) {
    return [];
  }
  return listUetdsNotifications({ partnerId, query: search, filters });
}

export async function getPartnerUetdsNotification(
  partnerId: string,
  notificationId: string,
): Promise<PartnerUetdsNotificationDetail | null> {
  if (!partnerId || !notificationId) {
    return null;
  }
  return getUetdsNotification({ id: notificationId, partnerId });
}
