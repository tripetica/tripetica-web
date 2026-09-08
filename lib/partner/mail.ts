import "server-only";

import { sendAccountSmtpMail, type OutboundMailResult } from "@/lib/mail/smtp";

const DEFAULT_FROM = "Tripetica <noreply@tripetica.com>";

function partnerMailFrom() {
  const raw = (process.env.ACCOUNT_EMAIL_FROM ?? "").trim();
  return raw || DEFAULT_FROM;
}

export async function sendPartnerMail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<OutboundMailResult> {
  return sendAccountSmtpMail(
    {
      to: input.to,
      subject: input.subject,
      text: input.text,
      from: partnerMailFrom(),
    },
    {
      logPrefix: "[partner-mail]",
      providerEnvName: "ACCOUNT_EMAIL_PROVIDER",
      defaultFrom: partnerMailFrom(),
    },
  );
}
