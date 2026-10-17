import "server-only";

import { claimAlertDelivery } from "@/lib/gps/ats-fault-store";
import { reservationMailFromAddress, sendReservationSmtpMail } from "@/lib/mail/smtp";
import { sendOpsPushToActiveSubscriptions } from "@/lib/ops/push/send";

export const OPS_FAULT_EMAIL = "operation@tripetica.com";

export async function deliverFaultAlert(input: {
  kind: "gnss_outage" | "ats_error" | "repair_reminder" | "repair_overdue";
  sourceKey: string;
  slot: string;
  plate: string;
  title: string;
  body: string;
  href: string;
  dry?: boolean;
}) {
  if (input.dry) {
    return { delivered: false as const, reason: "dry" };
  }
  const panel = await claimAlertDelivery({
    channel: "panel",
    kind: input.kind,
    sourceKey: input.sourceKey,
    slot: input.slot,
    status: "sent",
    detail: "",
    plate: input.plate,
    title: input.title,
    body: input.body,
    href: input.href,
  });
  if (!panel) {
    return { delivered: false as const, reason: "duplicate" };
  }
  const push = await sendOpsPushToActiveSubscriptions({
    kind: "gps-fault",
    title: input.title,
    body: input.body.slice(0, 240),
    icon: "/icon.png",
    badge: "/icon.png",
    tag: `gps-fault-${input.kind}-${input.sourceKey}-${input.slot}`,
    url: input.href,
    requireInteraction: true,
  });
  await claimAlertDelivery({
    channel: "push",
    kind: input.kind,
    sourceKey: input.sourceKey,
    slot: input.slot,
    status: push.skipped || push.failed > 0 && push.sent === 0 ? "failed" : "sent",
    detail: push.skipped ? "vapid_missing" : `sent=${push.sent} failed=${push.failed}`,
    plate: input.plate,
    title: input.title,
    body: input.body,
    href: input.href,
  });
  const mail = await sendReservationSmtpMail(
    {
      to: OPS_FAULT_EMAIL,
      from: reservationMailFromAddress(),
      subject: input.title,
      text: input.body,
    },
    { logPrefix: "[gps-ats-fault]", defaultFrom: reservationMailFromAddress() },
  );
  await claimAlertDelivery({
    channel: "email",
    kind: input.kind,
    sourceKey: input.sourceKey,
    slot: input.slot,
    status: mail.ok ? "sent" : "failed",
    detail: mail.ok ? "" : mail.error,
    plate: input.plate,
    title: input.title,
    body: input.body,
    href: input.href,
  });
  return { delivered: true as const, email: mail.ok, pushSent: push.sent };
}
