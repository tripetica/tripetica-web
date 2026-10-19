import { iso2FromIso3 } from "@/lib/geo/iso3166-alpha3";

const WEIGHTS = [7, 3, 1];

export type MrzDocument = {
  documentNumber: string;
  issuingState: string;
  nationality: string;
  lastName: string;
  firstName: string;
  sex: "male" | "female" | "";
  birthDate: string;
  expiryDate: string;
  checksumsValid: boolean;
  raw: string[];
};

function charValue(char: string) {
  if (char >= "0" && char <= "9") return char.charCodeAt(0) - 48;
  if (char >= "A" && char <= "Z") return char.charCodeAt(0) - 55;
  return 0;
}

export function mrzCheckDigit(value: string) {
  let sum = 0;
  for (let i = 0; i < value.length; i++) {
    sum += charValue(value[i]!) * WEIGHTS[i % 3]!;
  }
  return String(sum % 10);
}

export function mrzCheckOk(value: string, digit: string) {
  return digit >= "0" && digit <= "9" && mrzCheckDigit(value) === digit;
}

function mrzName(field: string) {
  const [surname = "", given = ""] = field.split("<<");
  const words = (part: string) => part.replace(/</g, " ").replace(/\s+/g, " ").trim();
  return { lastName: words(surname), firstName: words(given) };
}

function mrzSex(char: string): MrzDocument["sex"] {
  if (char === "F") return "female";
  if (char === "M") return "male";
  return "";
}

function compactLine(line: string) {
  return line.toUpperCase().replace(/[^A-Z0-9<]/g, "");
}

function candidateLines(source: string) {
  return source
    .split(/\r?\n/)
    .map((line) => compactLine(line))
    .filter((line) => line.length >= 28 && /[A-Z0-9]/.test(line) && line.includes("<"));
}

function parseTd3(line1: string, line2: string): MrzDocument | null {
  if (line1.length !== 44 || line2.length !== 44) return null;
  if (line1[0] !== "P") return null;
  const names = mrzName(line1.slice(5));
  const number = line2.slice(0, 9);
  const numberCheck = line2[9]!;
  const nationality = line2.slice(10, 13);
  const birth = line2.slice(13, 19);
  const birthCheck = line2[19]!;
  const sex = mrzSex(line2[20]!);
  const expiry = line2.slice(21, 27);
  const expiryCheck = line2[27]!;
  const optional = line2.slice(28, 42);
  const optionalCheck = line2[42]!;
  const composite = line2[43]!;
  const compositePayload = `${number}${numberCheck}${birth}${birthCheck}${expiry}${expiryCheck}${optional}${optionalCheck}`;
  const checksumsValid =
    mrzCheckOk(number, numberCheck)
    && mrzCheckOk(birth, birthCheck)
    && mrzCheckOk(expiry, expiryCheck)
    && mrzCheckOk(compositePayload, composite);
  return {
    documentNumber: number.replace(/</g, "").trim(),
    issuingState: line1.slice(2, 5).replace(/</g, ""),
    nationality: nationality.replace(/</g, ""),
    lastName: names.lastName,
    firstName: names.firstName,
    sex,
    birthDate: birth,
    expiryDate: expiry,
    checksumsValid,
    raw: [line1, line2],
  };
}

function parseTd2(line1: string, line2: string): MrzDocument | null {
  if (line1.length !== 36 || line2.length !== 36) return null;
  if (!/^[AIP]/.test(line1)) return null;
  const names = mrzName(line1.slice(5));
  const number = line2.slice(0, 9);
  const numberCheck = line2[9]!;
  const nationality = line2.slice(10, 13);
  const birth = line2.slice(13, 19);
  const birthCheck = line2[19]!;
  const sex = mrzSex(line2[20]!);
  const expiry = line2.slice(21, 27);
  const expiryCheck = line2[27]!;
  const checksumsValid = mrzCheckOk(number, numberCheck) && mrzCheckOk(birth, birthCheck) && mrzCheckOk(expiry, expiryCheck);
  return {
    documentNumber: number.replace(/</g, "").trim(),
    issuingState: line1.slice(2, 5).replace(/</g, ""),
    nationality: nationality.replace(/</g, ""),
    lastName: names.lastName,
    firstName: names.firstName,
    sex,
    birthDate: birth,
    expiryDate: expiry,
    checksumsValid,
    raw: [line1, line2],
  };
}

function parseTd1(line1: string, line2: string, line3: string): MrzDocument | null {
  if (line1.length !== 30 || line2.length !== 30 || line3.length !== 30) return null;
  if (!/^[AIP]/.test(line1)) return null;
  const number = line1.slice(5, 14);
  const numberCheck = line1[14]!;
  const names = mrzName(line3);
  const nationality = line2.slice(15, 18);
  const birth = line2.slice(0, 6);
  const birthCheck = line2[6]!;
  const sex = mrzSex(line2[7]!);
  const expiry = line2.slice(8, 14);
  const expiryCheck = line2[14]!;
  const checksumsValid = mrzCheckOk(number, numberCheck) && mrzCheckOk(birth, birthCheck) && mrzCheckOk(expiry, expiryCheck);
  return {
    documentNumber: number.replace(/</g, "").trim(),
    issuingState: line1.slice(2, 5).replace(/</g, ""),
    nationality: nationality.replace(/</g, ""),
    lastName: names.lastName,
    firstName: names.firstName,
    sex,
    birthDate: birth,
    expiryDate: expiry,
    checksumsValid,
    raw: [line1, line2, line3],
  };
}

function fit(line: string, length: number) {
  return line.length >= length - 2 ? line.padEnd(length, "<").slice(0, length) : "";
}

export function parseMrzDocuments(source: string): MrzDocument[] {
  const lines = candidateLines(source);
  const found: MrzDocument[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < lines.length; i++) {
    const a = lines[i]!;
    const b = lines[i + 1];
    const c = lines[i + 2];
    if (a[0] !== "P" && a[0] !== "I" && a[0] !== "A") continue;
    const parsed = b && a.length >= 42 && b.length >= 42
      ? parseTd3(fit(a, 44), fit(b, 44))
      : b && a.length >= 34 && a.length <= 40 && b.length >= 34 && b.length <= 40
        ? parseTd2(fit(a, 36), fit(b, 36))
        : b && c && a.length <= 32
          ? parseTd1(fit(a, 30), fit(b, 30), fit(c, 30))
          : null;
    if (!parsed || (!parsed.lastName && !parsed.firstName && !parsed.documentNumber)) continue;
    const key = parsed.raw.join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(parsed);
  }
  return found;
}

export function mrzNationalityIso2(code: string) {
  return iso2FromIso3(code);
}
