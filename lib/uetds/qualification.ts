export type QualificationDocument = {
  type: string;
  status: "valid" | "invalid";
  number: string | null;
  expiresOn: string | null;
};

export type DriverQualificationView = {
  state: "not-queried" | "verified" | "unverified";
  documents: QualificationDocument[];
  srcReady: boolean;
  verifiedAt: string | null;
  attemptedAt: string | null;
  latestFailed: boolean;
};

export type QualificationOutcome =
  | {
    status: "verified";
    documents: QualificationDocument[];
    srcReady: boolean;
    sonucKodu: number;
  }
  | {
    status: "unverified";
    sonucKodu: number | null;
  };

const TYPE_RE = /(?:SRC|ÜDY|UDY|ODY)\s*\d+/i;
const CANCELLED_RE = /İPTAL|IPTAL|GEÇERSİZ|GECERSIZ|SONA ER/;

export function isTurkishIdentityNumber(value: string) {
  if (!/^[1-9]\d{10}$/.test(value)) return false;
  const digits = [...value].map((item) => Number(item));
  const odd = digits[0]! + digits[2]! + digits[4]! + digits[6]! + digits[8]!;
  const even = digits[1]! + digits[3]! + digits[5]! + digits[7]!;
  const tenth = (((odd * 7) - even) % 10 + 10) % 10;
  if (digits[9] !== tenth) return false;
  const eleventh = digits.slice(0, 10).reduce((sum, item) => sum + item, 0) % 10;
  return digits[10] === eleventh;
}

export function qualificationSrcReady(documents: readonly QualificationDocument[]) {
  return documents.some((document) => document.status === "valid" && /^SRC[12]$/i.test(document.type));
}

function isoDate(value: string) {
  const dotted = /^(\d{2})[./](\d{2})[./](\d{4})$/.exec(value);
  if (dotted) return `${dotted[3]}-${dotted[2]}-${dotted[1]}`;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return iso ? value : null;
}

export function parseQualificationDocument(raw: string, today: string): QualificationDocument | null {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return null;
  const folded = text.toLocaleUpperCase("tr-TR");
  const typeMatch = TYPE_RE.exec(folded);
  const type = (typeMatch?.[0] ?? text).replace(/\s+/g, "");
  const dated = text.match(/\d{2}[./]\d{2}[./]\d{4}|\d{4}-\d{2}-\d{2}/);
  const expiresOn = dated ? isoDate(dated[0]) : null;
  const numbered = text.match(/(?:NO|BELGE)\s*[:.]?\s*([A-Z0-9-]{3,})/i);
  const number = numbered?.[1] ?? null;
  const expired = Boolean(expiresOn && expiresOn < today);
  const cancelled = CANCELLED_RE.test(folded);
  return {
    type,
    status: expired || cancelled ? "invalid" : "valid",
    number,
    expiresOn,
  };
}

export function qualificationOutcomeFromXml(xml: string, today: string): QualificationOutcome {
  const fault = /<(?:[\w]+:)?faultstring\b/i.test(xml);
  const codeText = /<(?:[\w]+:)?sonucKodu[^>]*>([^<]*)<\//i.exec(xml)?.[1]?.trim() ?? "";
  const sonucKodu = /^-?\d+$/.test(codeText) ? Number(codeText) : null;
  if (fault || sonucKodu !== 0) {
    return { status: "unverified", sonucKodu };
  }
  const documents = [...xml.matchAll(/<(?:[\w]+:)?belgeListesi[^>]*>([^<]*)<\//gi)]
    .map((item) => parseQualificationDocument(item[1] ?? "", today))
    .filter((item): item is QualificationDocument => Boolean(item));
  return {
    status: "verified",
    documents,
    srcReady: qualificationSrcReady(documents),
    sonucKodu: 0,
  };
}
