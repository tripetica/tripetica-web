import "server-only";

import nodemailer from "nodemailer";

const globalForMail = globalThis as typeof globalThis & {
  tripeticaSmtpTransports?: Map<string, nodemailer.Transporter>;
};

function smtpTransports() {
  if (!globalForMail.tripeticaSmtpTransports) {
    globalForMail.tripeticaSmtpTransports = new Map();
  }
  return globalForMail.tripeticaSmtpTransports;
}

/**
 * SMTP transport helpers.
 * Account mail uses SMTP_* + ACCOUNT_EMAIL_FROM.
 * Reservation mail uses RESERVATION_SMTP_* + RESERVATION_EMAIL_FROM.
 */

export type OutboundMailAttachment = {
  filename: string;
  content: Buffer;
  contentType?: string;
};

export type OutboundMailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  from?: string;
  messageId?: string;
  attachments?: OutboundMailAttachment[];
};

export type OutboundMailResult =
  | { ok: true; delivered: true }
  | { ok: false; error: string };

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
};

function parseSecureFlag(
  secureEnv: string,
  port: number,
): boolean {
  const normalized = secureEnv.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  return port === 465;
}

function readSmtpConfigFromEnv(input: {
  hostKey: string;
  portKey: string;
  secureKey: string;
  userKey: string;
  passKey: string;
  defaultPort: number;
}):
  | { ok: true; config: SmtpConfig }
  | { ok: false; missing: string[] } {
  const host = (process.env[input.hostKey] ?? "").trim();
  const user = (process.env[input.userKey] ?? "").trim();
  const pass = process.env[input.passKey] ?? "";
  const portRaw = (process.env[input.portKey] ?? "").trim();
  const port = portRaw ? Number(portRaw) : input.defaultPort;
  const missing: string[] = [];
  if (!host) missing.push(input.hostKey);
  if (!user) missing.push(input.userKey);
  if (!pass) missing.push(input.passKey);
  if (!Number.isFinite(port) || port <= 0) {
    missing.push(input.portKey);
  }
  if (missing.length > 0) {
    return { ok: false, missing };
  }
  const secure = parseSecureFlag(process.env[input.secureKey] ?? "", port);
  return {
    ok: true,
    config: { host, port, user, pass, secure },
  };
}

/** Account verification mail (noreply@tripetica.com). */
export function readAccountSmtpConfig():
  | { ok: true; config: SmtpConfig }
  | { ok: false; missing: string[] } {
  return readSmtpConfigFromEnv({
    hostKey: "SMTP_HOST",
    portKey: "SMTP_PORT",
    secureKey: "SMTP_SECURE",
    userKey: "SMTP_USER",
    passKey: "SMTP_PASS",
    defaultPort: 465,
  });
}

/** Reservation confirmation + payment confirmation mail. */
export function readReservationSmtpConfig():
  | { ok: true; config: SmtpConfig }
  | { ok: false; missing: string[] } {
  return readSmtpConfigFromEnv({
    hostKey: "RESERVATION_SMTP_HOST",
    portKey: "RESERVATION_SMTP_PORT",
    secureKey: "RESERVATION_SMTP_SECURE",
    userKey: "RESERVATION_SMTP_USER",
    passKey: "RESERVATION_SMTP_PASS",
    defaultPort: 465,
  });
}

export function reservationMailFromAddress() {
  const raw = (process.env.RESERVATION_EMAIL_FROM ?? "").trim();
  return raw || "Tripetica | Reservation <reservation@tripetica.com>";
}

function isSmtpProviderEnabled(providerEnvName: string) {
  const provider = (process.env[providerEnvName] ?? "").trim().toLowerCase();
  return provider === "smtp";
}

async function deliverSmtpMail(
  message: OutboundMailMessage,
  smtp: SmtpConfig,
  options: {
    logPrefix: string;
    defaultFrom: string;
  },
): Promise<OutboundMailResult> {
  try {
    const key = JSON.stringify([smtp.host, smtp.port, smtp.secure, smtp.user]);
    let transporter = smtpTransports().get(key);
    if (!transporter) {
      transporter = nodemailer.createTransport({
        pool: true,
        maxConnections: 2,
        maxMessages: 50,
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
        socketTimeout: 60_000,
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: {
          user: smtp.user,
          pass: smtp.pass,
        },
      });
      smtpTransports().set(key, transporter);
    }

    await transporter.sendMail({
      from: message.from || options.defaultFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      messageId: message.messageId,
      attachments: message.attachments?.map((item) => ({
        filename: item.filename,
        content: item.content,
        contentType: item.contentType,
      })),
    });

    return { ok: true, delivered: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`${options.logPrefix} SMTP send failed`, detail);
    return { ok: false, error: "smtp_send_failed" };
  }
}

export function closeSmtpTransports() {
  for (const transporter of smtpTransports().values()) {
    transporter.close();
  }
  smtpTransports().clear();
}

export async function sendAccountSmtpMail(
  message: OutboundMailMessage,
  options: {
    logPrefix: string;
    providerEnvName: string;
    defaultFrom: string;
  },
): Promise<OutboundMailResult> {
  if (!isSmtpProviderEnabled(options.providerEnvName)) {
    const current = (process.env[options.providerEnvName] ?? "").trim();
    if (!current) {
      console.error(
        `${options.logPrefix} ${options.providerEnvName} unset — mail not sent. Set ${options.providerEnvName}=smtp plus SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS.`,
        { to: message.to, subject: message.subject },
      );
      return { ok: false, error: "provider_unset" };
    }
    console.error(
      `${options.logPrefix} provider "${current}" is not supported (use smtp)`,
    );
    return { ok: false, error: "provider_not_implemented" };
  }

  const smtp = readAccountSmtpConfig();
  if (!smtp.ok) {
    console.error(
      `${options.logPrefix} SMTP config incomplete — missing:`,
      smtp.missing.join(", "),
    );
    return { ok: false, error: "smtp_config_incomplete" };
  }

  return deliverSmtpMail(message, smtp.config, {
    logPrefix: options.logPrefix,
    defaultFrom: options.defaultFrom,
  });
}

export async function sendReservationSmtpMail(
  message: OutboundMailMessage,
  options: {
    logPrefix: string;
    defaultFrom?: string;
  },
): Promise<OutboundMailResult> {
  const smtp = readReservationSmtpConfig();
  if (!smtp.ok) {
    console.error(
      `${options.logPrefix} reservation SMTP config incomplete — missing:`,
      smtp.missing.join(", "),
    );
    return { ok: false, error: "smtp_config_incomplete" };
  }

  return deliverSmtpMail(message, smtp.config, {
    logPrefix: options.logPrefix,
    defaultFrom: options.defaultFrom ?? reservationMailFromAddress(),
  });
}

export function appBaseUrl() {
  const raw = (process.env.APP_BASE_URL ?? "").trim().replace(/\/+$/, "");
  return raw || "http://127.0.0.1:3000";
}
