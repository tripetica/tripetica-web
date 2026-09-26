import { normalizeUetdsFare } from "@/lib/uetds/fare";
import "server-only";
import { canonicalMinistryPlate } from "@/lib/uetds/ministry-plate";

import { purposeForTripKind, type UetdsDraft, type UetdsPassengerDraft } from "@/lib/uetds/draft";
import { normalizeUetdsPurposeText } from "@/lib/uetds/form-language";
import { normalizeUetdsPersonName } from "@/lib/uetds/passenger-name";
import { officialUetdsCountryByCode } from "@/lib/uetds/official-locations";
import { uetdsMinistryYerText, type UetdsLocation } from "@/lib/uetds/location";
import { UETDS_SOAP_ACTIONS } from "@/lib/uetds/ministry-env";
import { callUetdsTestSoap, soapField, soapUserXml } from "@/lib/uetds/ministry-soap";

export type UetdsMutationResult = {
  operation: string;
  sonucKodu: number | null;
  sonucMesaji: string;
  reference?: string;
};

function dateTime(date: string) {
  return `${date}T00:00:00`;
}

function countryCode(value: string) {
  return officialUetdsCountryByCode(value)?.code ?? value.trim().toUpperCase();
}

function genderCode(value: string) {
  return value === "female" ? "K" : value === "male" ? "E" : "";
}

function locationCodes(location: UetdsLocation) {
  return {
    ulke: location.countryCode || "TR",
    il: Number(location.provinceCode) || 0,
    ilce: Number(location.districtOrAirportCode) || 0,
    yer: uetdsMinistryYerText(location),
  };
}

function seferFields(input: { draft: UetdsDraft; plate: string }) {
  return `<ariziSeferBilgileriInput>
      ${soapField("aracPlaka", canonicalMinistryPlate(input.plate))}
      ${soapField("seferAciklama", normalizeUetdsPurposeText(input.draft.purpose.trim() || purposeForTripKind(input.draft.tripKind)))}
      ${soapField("hareketTarihi", dateTime(input.draft.startDate))}
      ${soapField("hareketSaati", input.draft.startTime)}
      ${soapField("firmaSeferNo", input.draft.reservationId?.trim() || "")}
      ${soapField("seferBitisTarihi", dateTime(input.draft.endDate))}
      ${soapField("seferBitisSaati", input.draft.endTime)}
    </ariziSeferBilgileriInput>`;
}

export async function mutateUetdsSeferGuncelle(input: {
  username: string;
  password: string;
  seferReferansNo: string;
  draft: UetdsDraft;
  plate: string;
}): Promise<UetdsMutationResult> {
  const result = await callUetdsTestSoap({
    operation: "seferGuncelle",
    soapAction: UETDS_SOAP_ACTIONS.seferGuncelle,
    username: input.username,
    password: input.password,
    innerXml: `${soapUserXml(input.username, input.password)}
      ${soapField("guncellenecekSeferReferansNo", input.seferReferansNo)}
      ${seferFields({ draft: input.draft, plate: input.plate })}`,
  });
  return {
    operation: "seferGuncelle",
    sonucKodu: result.sonucKodu,
    sonucMesaji: result.sonucMesaji,
    reference: result.values.uetdsseferreferansno,
  };
}

export async function mutateUetdsSeferGrupGuncelle(input: {
  username: string;
  password: string;
  seferReferansNo: string;
  grupReferansNo: string;
  draft: UetdsDraft;
}): Promise<UetdsMutationResult> {
  if (normalizeUetdsFare(input.draft.fare) === null) throw new Error("uetds_invalid_fare");
  const origin = locationCodes(input.draft.originLocation);
  const destination = locationCodes(input.draft.destinationLocation);
  const result = await callUetdsTestSoap({
    operation: "seferGrupGuncelle",
    soapAction: UETDS_SOAP_ACTIONS.seferGrupGuncelle,
    username: input.username,
    password: input.password,
    innerXml: `${soapUserXml(input.username, input.password)}
      ${soapField("uetdsSeferReferansNo", input.seferReferansNo)}
      ${soapField("grupId", input.grupReferansNo)}
      <seferGrupBilgileriInput>
        ${soapField("grupAciklama", normalizeUetdsPurposeText(input.draft.purpose.trim() || purposeForTripKind(input.draft.tripKind)))}
        ${soapField("baslangicUlke", origin.ulke)}
        ${soapField("baslangicIl", origin.il)}
        ${soapField("baslangicIlce", origin.ilce)}
        ${soapField("baslangicYer", origin.yer)}
        ${soapField("bitisUlke", destination.ulke)}
        ${soapField("bitisIl", destination.il)}
        ${soapField("bitisIlce", destination.ilce)}
        ${soapField("bitisYer", destination.yer)}
        ${soapField("grupAdi", input.draft.groupName.trim() || purposeForTripKind(input.draft.tripKind) || "Grup")}
        ${soapField("grupUcret", normalizeUetdsFare(input.draft.fare) ?? "")}
      </seferGrupBilgileriInput>`,
  });
  return {
    operation: "seferGrupGuncelle",
    sonucKodu: result.sonucKodu,
    sonucMesaji: result.sonucMesaji,
    reference: result.values.uetdsgruprefno,
  };
}

export async function mutateUetdsYolcuEkle(input: {
  username: string;
  password: string;
  seferReferansNo: string;
  grupReferansNo: string;
  passenger: UetdsPassengerDraft;
  seatNo: string;
}): Promise<UetdsMutationResult> {
  const result = await callUetdsTestSoap({
    operation: "yolcuEkle",
    soapAction: UETDS_SOAP_ACTIONS.yolcuEkle,
    username: input.username,
    password: input.password,
    innerXml: `${soapUserXml(input.username, input.password)}
      ${soapField("uetdsSeferReferansNo", input.seferReferansNo)}
      <seferYolcuBilgileriInput>
        ${soapField("uyrukUlke", countryCode(input.passenger.nationality))}
        ${soapField("tcKimlikPasaportNo", input.passenger.identityNumber.trim())}
        ${soapField("cinsiyet", genderCode(input.passenger.gender))}
        ${soapField("adi", normalizeUetdsPersonName(input.passenger.firstName))}
        ${soapField("soyadi", normalizeUetdsPersonName(input.passenger.lastName))}
        ${soapField("koltukNo", input.seatNo)}
        ${soapField("grupId", input.grupReferansNo)}
      </seferYolcuBilgileriInput>`,
  });
  return {
    operation: "yolcuEkle",
    sonucKodu: result.sonucKodu,
    sonucMesaji: result.sonucMesaji,
    reference: result.values.uetdsyolcurefno,
  };
}

export async function mutateUetdsYolcuIptalByRef(input: {
  username: string;
  password: string;
  seferReferansNo: string;
  yolcuReferansNo: string;
  reason: string;
}): Promise<UetdsMutationResult> {
  const result = await callUetdsTestSoap({
    operation: "yolcuIptalUetdsYolcuRefNoIle",
    soapAction: UETDS_SOAP_ACTIONS.yolcuIptalUetdsYolcuRefNoIle,
    username: input.username,
    password: input.password,
    innerXml: `${soapUserXml(input.username, input.password)}
      ${soapField("uetdsSeferReferansNo", input.seferReferansNo)}
      ${soapField("uetdsYolcuReferansNo", input.yolcuReferansNo)}
      ${soapField("iptalAciklama", input.reason.trim() || "Yolcu bilgisi duzeltme")}`,
  });
  return {
    operation: "yolcuIptalUetdsYolcuRefNoIle",
    sonucKodu: result.sonucKodu,
    sonucMesaji: result.sonucMesaji,
    reference: input.yolcuReferansNo,
  };
}

export async function queryUetdsYolcuBildirim(input: {
  username: string;
  password: string;
  seferReferansNo: string;
  seferYolcuRefNo: string;
}) {
  const result = await callUetdsTestSoap({
    operation: "yolcuBildirimSorgula",
    soapAction: UETDS_SOAP_ACTIONS.yolcuBildirimSorgula,
    username: input.username,
    password: input.password,
    innerXml: `${soapUserXml(input.username, input.password)}
      ${soapField("uetdsSeferReferansNo", input.seferReferansNo)}
      ${soapField("seferYolcuRefNo", input.seferYolcuRefNo)}`,
  });
  return {
    operation: "yolcuBildirimSorgula",
    sonucKodu: result.sonucKodu,
    sonucMesaji: result.sonucMesaji,
    reference: result.values.seferyolcurefno || input.seferYolcuRefNo,
    durum: result.values.durum || "",
    firstName: result.values.yolcuadi || "",
    lastName: result.values.yolcusoyadi || "",
    nationality: result.values.ulkekodu || result.values.uyrukulke || "",
  };
}

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") || parts[0] || "",
  };
}

/** Official V15 personelIptal: iptalPersonelInput.personelTCKimlikPasaportNo + uetdsSeferReferansNo. */
export async function mutateUetdsPersonelIptal(input: {
  username: string;
  password: string;
  seferReferansNo: string;
  nationalId: string;
  reason: string;
}): Promise<UetdsMutationResult> {
  const result = await callUetdsTestSoap({
    operation: "personelIptal",
    soapAction: UETDS_SOAP_ACTIONS.personelIptal,
    username: input.username,
    password: input.password,
    innerXml: `${soapUserXml(input.username, input.password)}
      <iptalPersonelInput>
        ${soapField("personelTCKimlikPasaportNo", input.nationalId.trim())}
        ${soapField("iptalAciklama", input.reason.trim() || "Sofor degisikligi")}
        ${soapField("uetdsSeferReferansNo", input.seferReferansNo)}
      </iptalPersonelInput>`,
  });
  return {
    operation: "personelIptal",
    sonucKodu: result.sonucKodu,
    sonucMesaji: result.sonucMesaji,
  };
}

/** Official V15 personelEkle on an existing sefer. Does not create a new sefer. */
export async function mutateUetdsPersonelEkle(input: {
  username: string;
  password: string;
  seferReferansNo: string;
  nationalId: string;
  fullName: string;
}): Promise<UetdsMutationResult> {
  const driverName = splitName(input.fullName);
  const result = await callUetdsTestSoap({
    operation: "personelEkle",
    soapAction: UETDS_SOAP_ACTIONS.personelEkle,
    username: input.username,
    password: input.password,
    innerXml: `${soapUserXml(input.username, input.password)}
      ${soapField("uetdsSeferReferansNo", input.seferReferansNo)}
      <seferPersonelBilgileriInput>
        ${soapField("turKodu", 0)}
        ${soapField("uyrukUlke", "TR")}
        ${soapField("tcKimlikPasaportNo", input.nationalId.trim())}
        ${soapField("cinsiyet", "E")}
        ${soapField("adi", normalizeUetdsPersonName(driverName.firstName))}
        ${soapField("soyadi", normalizeUetdsPersonName(driverName.lastName))}
      </seferPersonelBilgileriInput>`,
  });
  return {
    operation: "personelEkle",
    sonucKodu: result.sonucKodu,
    sonucMesaji: result.sonucMesaji,
  };
}

export async function mutateUetdsSeferIptal(input: {
  username: string;
  password: string;
  seferReferansNo: string;
  reason: string;
}): Promise<UetdsMutationResult> {
  const result = await callUetdsTestSoap({
    operation: "seferIptal",
    soapAction: UETDS_SOAP_ACTIONS.seferIptal,
    username: input.username,
    password: input.password,
    innerXml: `${soapUserXml(input.username, input.password)}
      ${soapField("uetdsSeferReferansNo", input.seferReferansNo)}
      ${soapField("iptalAciklama", input.reason.trim() || "İptal")}`,
  });
  return {
    operation: "seferIptal",
    sonucKodu: result.sonucKodu,
    sonucMesaji: result.sonucMesaji,
  };
}
