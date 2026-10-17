import { UETDS_ATS_SOAP_ACTIONS } from "@/lib/uetds/ministry-env";

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function soapUserXml(username: string, password: string) {
  return `<wsuser><kullaniciAdi>${xmlEscape(username)}</kullaniciAdi><sifre>${xmlEscape(password)}</sifre></wsuser>`;
}

function soapField(name: string, value: string | number) {
  return `<${name}>${xmlEscape(String(value))}</${name}>`;
}

export { UETDS_ATS_SOAP_ACTIONS };

export type AtsKonumInput = {
  username: string;
  password: string;
  plate: string;
  latitude: number;
  longitude: number;
  ilKodu: number;
  ilceMernisKodu: number;
  konumZamani: string;
};

export type AtsArizaInput = {
  username: string;
  password: string;
  plate: string;
  arizaBaslangicTarihi: string;
  aciklama: string;
};

const KONUM_ZAMANI = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/;

export function formatAtsKonumZamani(instant: Date, timeZone = "Europe/Istanbul") {
  if (!Number.isFinite(instant.getTime())) {
    throw new Error("ats_gnss_time");
  }
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const text = `${read("day")}/${read("month")}/${read("year")} ${read("hour")}:${read("minute")}:${read("second")}`;
  if (!KONUM_ZAMANI.test(text)) {
    throw new Error("ats_gnss_time");
  }
  return text;
}

function coordinate(value: number) {
  if (!Number.isFinite(value)) {
    throw new Error("ats_coordinate");
  }
  return String(value);
}

export function atsKonumBildirInnerXml(input: AtsKonumInput) {
  if (!KONUM_ZAMANI.test(input.konumZamani)) {
    throw new Error("ats_gnss_time");
  }
  return `${soapUserXml(input.username, input.password)}
<konumEkleInput>
${soapField("boylam", coordinate(input.longitude))}
${soapField("enlem", coordinate(input.latitude))}
${soapField("ilKodu", input.ilKodu)}
${soapField("ilceMernisKodu", input.ilceMernisKodu)}
${soapField("konumZamani", input.konumZamani)}
${soapField("plaka", input.plate)}
</konumEkleInput>`;
}

export function atsArizaBildirInnerXml(input: AtsArizaInput) {
  return `${soapUserXml(input.username, input.password)}
${soapField("plaka", input.plate)}
${soapField("arizaBaslangicTarihi", input.arizaBaslangicTarihi)}
${soapField("aciklama", input.aciklama)}`;
}

/** V15 does not define which GPS conditions are an ATS fault. The fault date string is unconstrained; callers send the konum timestamp so the circular's clock is included. */
export function atsAutomaticFaultReportEnabled() {
  return false;
}
