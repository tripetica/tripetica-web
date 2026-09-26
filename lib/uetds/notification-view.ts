export type UetdsNotificationListItem = {
  id: string;
  createdAt: string;
  startLabel: string;
  startTimestamp?: number | null;
  endTimestamp?: number | null;
  listClassification?: "active" | "completed" | "cancelled" | "other";
  endLabel: string;
  routeLabel: string;
  plate: string;
  driverName: string;
  passengerName: string;
  companyShortName: string;
  status: string;
  partnerId: string;
  ministryReference: string | null;
  finalVerificationResult?: "verified" | "final-verification-failed" | null;
};

export type UetdsNotificationDetail = UetdsNotificationListItem & {
  snapshotJson: string;
  reservationId: string | null;
  source: string;
  companyId: string | null;
  ministryEnv: string;
};
