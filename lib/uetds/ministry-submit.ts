import { normalizeUetdsFare } from "@/lib/uetds/fare";
import "server-only";
import { verifyUetdsMinistryNotification } from "@/lib/uetds/verify-ministry";
import type { UetdsFinalVerification } from "@/lib/uetds/final-verification";
import { canonicalMinistryPlate } from "@/lib/uetds/ministry-plate";

import { purposeForTripKind, type UetdsDraft, type UetdsPassengerDraft } from "@/lib/uetds/draft";
import { normalizeUetdsPurposeText } from "@/lib/uetds/form-language";
import { normalizeUetdsPersonName } from "@/lib/uetds/passenger-name";
import { officialUetdsCountryByCode } from "@/lib/uetds/official-locations";
import { isOfficialUetdsLocationReady, uetdsMinistryYerText, type UetdsLocation } from "@/lib/uetds/location";
import { resolveUetdsMinistryRuntime, UETDS_SOAP_ACTIONS } from "@/lib/uetds/ministry-env";
import { callUetdsTestSoap, soapField, soapUserXml } from "@/lib/uetds/ministry-soap";

export type UetdsMinistryStageResult = {
  stage: "sefer" | "personel" | "grup" | "yolcu";
  sonucKodu: number | null;
  sonucMesaji: string;
  reference?: string;
};

export type UetdsMinistrySubmission = {
  status: "submitted" | "partial" | "failed";
  finalVerification?: UetdsFinalVerification;
  env: "test" | "live";
  seferReferansNo: string | null;
  grupReferansNo: string | null;
  passengerRefs: Array<{ index: number; reference: string | null; sonucKodu: number | null; sonucMesaji: string }>;
  stages: UetdsMinistryStageResult[];
  message: string;
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

function splitName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" ") || parts[0] || "",
  };
}

export function canBuildMinistryPayload(input: {
  draft: UetdsDraft;
  plate: string;
  driverNationalId: string | null;
  driverFullName: string;
}) {
  return Boolean(
    input.plate.trim() &&
      input.driverNationalId?.trim() &&
      input.draft.startDate &&
      input.draft.startTime &&
      input.draft.endDate &&
      input.draft.endTime &&
      isOfficialUetdsLocationReady(input.draft.originLocation) &&
      isOfficialUetdsLocationReady(input.draft.destinationLocation),
  );
}

export async function submitUetdsTestNotification(input: {
  username: string;
  password: string;
  draft: UetdsDraft;
  plate: string;
  driverNationalId: string;
  driverFullName: string;
}): Promise<UetdsMinistrySubmission> {
  if (normalizeUetdsFare(input.draft.fare) === null) throw new Error("uetds_invalid_fare");
  const ministryEnv = resolveUetdsMinistryRuntime();
  if (!ministryEnv) {
    throw new Error("uetds_live_blocked");
  }
  const stages: UetdsMinistryStageResult[] = [];
  const userXml = soapUserXml(input.username, input.password);
  const firmaSeferNo = input.draft.reservationId?.trim() || `TRP-${Date.now()}`;
  const sefer = await callUetdsTestSoap({
    operation: "seferEkle",
    soapAction: UETDS_SOAP_ACTIONS.seferEkle,
    username: input.username,
    password: input.password,
    innerXml: `${userXml}<ariziSeferBilgileriInput>
      ${soapField("aracPlaka", canonicalMinistryPlate(input.plate))}
      ${soapField("seferAciklama", normalizeUetdsPurposeText(input.draft.purpose.trim() || purposeForTripKind(input.draft.tripKind)))}
      ${soapField("hareketTarihi", dateTime(input.draft.startDate))}
      ${soapField("hareketSaati", input.draft.startTime)}
      ${soapField("firmaSeferNo", firmaSeferNo)}
      ${soapField("seferBitisTarihi", dateTime(input.draft.endDate))}
      ${soapField("seferBitisSaati", input.draft.endTime)}
    </ariziSeferBilgileriInput>`,
  });
  const seferRef = sefer.values.uetdsseferreferansno ?? "";
  stages.push({
    stage: "sefer",
    sonucKodu: sefer.sonucKodu,
    sonucMesaji: sefer.sonucMesaji,
    reference: seferRef || undefined,
  });
  if (sefer.sonucKodu !== 0 || !seferRef) {
    return {
      status: "failed",
      env: ministryEnv,
      seferReferansNo: seferRef || null,
      grupReferansNo: null,
      passengerRefs: [],
      stages,
      message: sefer.sonucMesaji || "Sefer bildirimi gönderilemedi.",
    };
  }

  const driverName = splitName(input.driverFullName);
  const personel = await callUetdsTestSoap({
    operation: "personelEkle",
    soapAction: UETDS_SOAP_ACTIONS.personelEkle,
    username: input.username,
    password: input.password,
    innerXml: `${userXml}
      ${soapField("uetdsSeferReferansNo", seferRef)}
      <seferPersonelBilgileriInput>
        ${soapField("turKodu", 0)}
        ${soapField("uyrukUlke", "TR")}
        ${soapField("tcKimlikPasaportNo", input.driverNationalId.trim())}
        ${soapField("cinsiyet", "E")}
        ${soapField("adi", normalizeUetdsPersonName(driverName.firstName))}
        ${soapField("soyadi", normalizeUetdsPersonName(driverName.lastName))}
      </seferPersonelBilgileriInput>`,
  });
  stages.push({
    stage: "personel",
    sonucKodu: personel.sonucKodu,
    sonucMesaji: personel.sonucMesaji,
  });
  if (personel.sonucKodu !== 0) {
    return {
      status: "partial",
      env: ministryEnv,
      seferReferansNo: seferRef,
      grupReferansNo: null,
      passengerRefs: [],
      stages,
      message: personel.sonucMesaji || "Şoför bildirimi tamamlanamadı.",
    };
  }

  const origin = locationCodes(input.draft.originLocation);
  const destination = locationCodes(input.draft.destinationLocation);
  const grup = await callUetdsTestSoap({
    operation: "seferGrupEkle",
    soapAction: UETDS_SOAP_ACTIONS.seferGrupEkle,
    username: input.username,
    password: input.password,
    innerXml: `${userXml}
      ${soapField("uetdsSeferReferansNo", seferRef)}
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
  const grupRef = grup.values.uetdsgruprefno ?? "";
  stages.push({
    stage: "grup",
    sonucKodu: grup.sonucKodu,
    sonucMesaji: grup.sonucMesaji,
    reference: grupRef || undefined,
  });
  if (grup.sonucKodu !== 0 || !grupRef) {
    return {
      status: "partial",
      env: ministryEnv,
      seferReferansNo: seferRef,
      grupReferansNo: grupRef || null,
      passengerRefs: [],
      stages,
      message: grup.sonucMesaji || "Grup bildirimi tamamlanamadı.",
    };
  }

  const passengerRefs: UetdsMinistrySubmission["passengerRefs"] = [];
  for (const [index, passenger] of input.draft.passengers.entries()) {
    const yolcu = await callUetdsTestSoap({
      operation: "yolcuEkle",
      soapAction: UETDS_SOAP_ACTIONS.yolcuEkle,
      username: input.username,
      password: input.password,
      innerXml: `${userXml}
        ${soapField("uetdsSeferReferansNo", seferRef)}
        <seferYolcuBilgileriInput>
          ${soapField("uyrukUlke", countryCode(passenger.nationality))}
          ${soapField("tcKimlikPasaportNo", passenger.identityNumber.trim())}
          ${soapField("cinsiyet", genderCode(passenger.gender))}
          ${soapField("adi", normalizeUetdsPersonName(passenger.firstName))}
          ${soapField("soyadi", normalizeUetdsPersonName(passenger.lastName))}
          ${soapField("koltukNo", String(index + 1))}
          ${soapField("grupId", grupRef)}
        </seferYolcuBilgileriInput>`,
    });
    passengerRefs.push({
      index,
      reference: yolcu.values.uetdsyolcurefno ?? null,
      sonucKodu: yolcu.sonucKodu,
      sonucMesaji: yolcu.sonucMesaji,
    });
  }
  const failedPassengers = passengerRefs.filter((item) => item.sonucKodu !== 0);
  stages.push({
    stage: "yolcu",
    sonucKodu: failedPassengers.length ? 88 : 0,
    sonucMesaji: failedPassengers[0]?.sonucMesaji ?? "",
  });
  if (failedPassengers.length > 0) {
    return {
      status: "partial",
      env: ministryEnv,
      seferReferansNo: seferRef,
      grupReferansNo: grupRef,
      passengerRefs,
      stages,
      message: failedPassengers[0]?.sonucMesaji || "Bazı yolcular bildirilemedi.",
    };
  }
  const finalVerification = await verifyUetdsMinistryNotification({
    username: input.username, password: input.password, environment: ministryEnv,
    expected: { seferReference: seferRef, plate: input.plate, groupCount: 1, personnelCount: 1, passengerCount: input.draft.passengers.length },
  });
  return {
    finalVerification,
    status: finalVerification.result === "verified" ? "submitted" : "partial",
    env: ministryEnv,
    seferReferansNo: seferRef,
    grupReferansNo: grupRef,
    passengerRefs,
    stages,
    message: finalVerification.result !== "verified"
      ? "Bildirim Bakanlığa gönderildi ancak nihai U-ETDS doğrulaması tamamlanamadı. Lütfen bildirimi kontrol edin."
      : ministryEnv === "live"
        ? "U-ETDS bildirimi Bakanlık tarafından doğrulandı."
        : "U-ETDS TEST bildirimi başarıyla gönderildi.",
  };
}

export function passengerIdentityPresent(passenger: UetdsPassengerDraft) {
  return Boolean(passenger.identityNumber.trim());
}
