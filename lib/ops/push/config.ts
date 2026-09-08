import "server-only";

export type OpsPushVapidConfig = {
  publicKey: string;
  privateKey: string;
  subject: string;
};

export function readOpsPushVapidConfig(): OpsPushVapidConfig | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject =
    process.env.VAPID_SUBJECT?.trim() || "mailto:operation@tripetica.com";
  if (!publicKey || !privateKey) {
    return null;
  }
  return { publicKey, privateKey, subject };
}
