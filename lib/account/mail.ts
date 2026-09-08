import "server-only";

import { sendAccountSmtpMail, appBaseUrl, type OutboundMailResult } from "@/lib/mail/smtp";

/**
 * Outbound customer-account email (verification, etc.).
 * Uses Namecheap Private Email SMTP when ACCOUNT_EMAIL_PROVIDER=smtp.
 * Does not invent credentials — unset/incomplete config fails delivery.
 */

export type AccountMailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type AccountMailResult = OutboundMailResult;

const DEFAULT_FROM = "Tripetica <noreply@tripetica.com>";

function accountMailFrom() {
  const raw = (process.env.ACCOUNT_EMAIL_FROM ?? "").trim();
  return raw || DEFAULT_FROM;
}

export async function sendAccountMail(
  message: AccountMailMessage,
): Promise<AccountMailResult> {
  return sendAccountSmtpMail(
    {
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      from: accountMailFrom(),
    },
    {
      logPrefix: "[account-mail]",
      providerEnvName: "ACCOUNT_EMAIL_PROVIDER",
      defaultFrom: accountMailFrom(),
    },
  );
}

export function accountAppBaseUrl() {
  return appBaseUrl();
}
