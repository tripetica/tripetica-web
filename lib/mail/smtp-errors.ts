const TRANSIENT_SMTP_MARKERS = [
  "econnreset",
  "etimedout",
  "econnrefused",
  "epipe",
  "socket hang up",
  "connection timeout",
  "connection closed",
  "greeting never received",
];

export function isTransientSmtpError(error: unknown) {
  const detail = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return TRANSIENT_SMTP_MARKERS.some((marker) => detail.includes(marker));
}
