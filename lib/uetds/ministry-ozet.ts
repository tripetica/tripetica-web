import "server-only";

import { UETDS_SOAP_ACTIONS } from "@/lib/uetds/ministry-env";
import {
  parseUetdsBildirimOzetiXml,
  type UetdsOzetPassenger,
  type UetdsOzetPersonnel,
} from "@/lib/uetds/ministry-ozet-parse";
import { callUetdsTestSoap, soapField, soapUserXml } from "@/lib/uetds/ministry-soap";

export type UetdsBildirimOzeti = {
  seferReference: string | null;
  seferStatusCode: number | null;
  seferStatus: string | null;
  groupCount: number;
  groups: Array<{ reference: string; fare: string }>;
  sonucKodu: number | null;
  sonucMesaji: string;
  bildirilenYolcuSayisi: number | null;
  iptalYolcuSayisi: number | null;
  sonYolcuBildirimTarihi: string | null;
  aracPlaka: string | null;
  passengers: UetdsOzetPassenger[];
  personnel: UetdsOzetPersonnel[];
  activeCount: number;
  activePersonnelCount: number;
};

export async function queryUetdsTestBildirimOzeti(input: {
  username: string;
  password: string;
  seferReferansNo: string;
}): Promise<UetdsBildirimOzeti> {
  const result = await callUetdsTestSoap({
    operation: "bildirimOzeti",
    soapAction: UETDS_SOAP_ACTIONS.bildirimOzeti,
    username: input.username,
    password: input.password,
    keepXml: true,
    timeoutMs: 15_000,
    innerXml: `${soapUserXml(input.username, input.password)}
      ${soapField("uetdsSeferReferansNo", input.seferReferansNo)}`,
  });
  const parsed = parseUetdsBildirimOzetiXml(result.xml || result.rawSafe);
  return {
    sonucKodu: result.sonucKodu,
    sonucMesaji: result.sonucMesaji,
    ...parsed,
  };
}

export function ozetWithoutSecrets(ozet: UetdsBildirimOzeti) {
  return {
    sonucKodu: ozet.sonucKodu,
    bildirilenYolcuSayisi: ozet.bildirilenYolcuSayisi,
    iptalYolcuSayisi: ozet.iptalYolcuSayisi,
    sonYolcuBildirimTarihi: ozet.sonYolcuBildirimTarihi,
    aracPlaka: ozet.aracPlaka,
    activeCount: ozet.activeCount,
    activePersonnelCount: ozet.activePersonnelCount,
    passengers: ozet.passengers.map((item) => ({
      reference: item.reference,
      firstName: item.firstName,
      lastName: item.lastName,
      nationality: item.nationality,
      gender: item.gender,
      durum: item.durum,
      active: item.active,
    })),
    personnel: ozet.personnel.map((item) => ({
      firstName: item.firstName,
      lastName: item.lastName,
      durum: item.durum,
      active: item.active,
    })),
  };
}

export { parseUetdsBildirimOzetiXml };
