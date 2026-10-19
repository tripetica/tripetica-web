import test from "node:test";
import assert from "node:assert/strict";
import { mrzCheckDigit, parseMrzDocuments } from "@/lib/uetds/mrz";

export function buildTd3(input: {
  issuing: string;
  lastName: string;
  firstName: string;
  number: string;
  nationality: string;
  birth: string;
  sex: "F" | "M";
  expiry: string;
}) {
  const line1 = `P<${input.issuing}${input.lastName.replace(/ /g, "<")}<<${input.firstName.replace(/ /g, "<")}`
    .padEnd(44, "<")
    .slice(0, 44);
  const number = input.number.padEnd(9, "<").slice(0, 9);
  const numberCheck = mrzCheckDigit(number);
  const birthCheck = mrzCheckDigit(input.birth);
  const expiryCheck = mrzCheckDigit(input.expiry);
  const optional = "<".repeat(14);
  const optionalCheck = mrzCheckDigit(optional);
  const composite = `${number}${numberCheck}${input.birth}${birthCheck}${input.expiry}${expiryCheck}${optional}${optionalCheck}`;
  const line2 = `${number}${numberCheck}${input.nationality}${input.birth}${birthCheck}${input.sex}${input.expiry}${expiryCheck}${optional}${optionalCheck}${mrzCheckDigit(composite)}`;
  assert.equal(line1.length, 44);
  assert.equal(line2.length, 44);
  return { line1, line2 };
}

test("TD3 checksums and multi-word given/surname parse", () => {
  const mrz = buildTd3({
    issuing: "IRQ",
    lastName: "MOHAMMED ALI",
    firstName: "ESRAA TALAL MOHAMMEDALI",
    number: "A10928831",
    nationality: "IRQ",
    birth: "080129",
    sex: "F",
    expiry: "340128",
  });
  const [document] = parseMrzDocuments(`${mrz.line1}\n${mrz.line2}`);
  assert.equal(document?.checksumsValid, true);
  assert.equal(document?.nationality, "IRQ");
  assert.equal(document?.documentNumber, "A10928831");
  assert.equal(document?.lastName, "MOHAMMED ALI");
  assert.equal(document?.firstName, "ESRAA TALAL MOHAMMEDALI");
  assert.equal(document?.sex, "female");
});

test("spaced OCR MRZ still parses", () => {
  const mrz = buildTd3({
    issuing: "DEU",
    lastName: "MUELLER",
    firstName: "ANNA",
    number: "C12X44567",
    nationality: "DEU",
    birth: "900101",
    sex: "F",
    expiry: "300101",
  });
  const spaced = `${mrz.line1.split("").join(" ")}\n${mrz.line2.split("").join(" ")}`;
  const [document] = parseMrzDocuments(spaced);
  assert.equal(document?.lastName, "MUELLER");
  assert.equal(document?.firstName, "ANNA");
  assert.equal(document?.nationality, "DEU");
});

test("a broken checksum is still parsed and marked invalid", () => {
  const mrz = buildTd3({
    issuing: "USA",
    lastName: "DOE",
    firstName: "JANE",
    number: "X99887766",
    nationality: "USA",
    birth: "850505",
    sex: "F",
    expiry: "290505",
  });
  const broken = `${mrz.line1}\n${mrz.line2.slice(0, 9)}1${mrz.line2.slice(10)}`;
  const [document] = parseMrzDocuments(broken);
  assert.equal(document?.lastName, "DOE");
  assert.equal(document?.checksumsValid, false);
});
