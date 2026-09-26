export type UetdsOzetPassenger = {
  reference: string | null;
  firstName: string;
  lastName: string;
  nationality: string;
  gender: string;
  durum: string;
  active: boolean;
};

export type UetdsOzetPersonnel = {
  firstName: string;
  lastName: string;
  nationalId: string;
  durum: string;
  active: boolean;
};

export function isActiveMinistryPassengerDurum(value: string) {
  const normalized = value.trim().toLocaleLowerCase("tr-TR");
  if (!normalized || normalized.includes("iptal")) {
    return false;
  }
  return normalized.includes("geçerli") || normalized.includes("gecerli");
}

function innerText(block: string, tag: string) {
  const match = block.match(new RegExp(`<(?:[A-Za-z0-9_]+:)?${tag}(?:\\s[^>]*)?>([^<]*)</(?:[A-Za-z0-9_]+:)?${tag}>`, "i"));
  return match?.[1]?.trim() || "";
}

function numberOrNull(value: string) {
  return /^-?\d+$/.test(value) ? Number(value) : null;
}

export function parseUetdsBildirimOzetiXml(xml: string) {
  const bildirilenYolcuSayisi = numberOrNull(innerText(xml, "bildirilenYolcuSayisi"));
  const iptalYolcuSayisi = numberOrNull(innerText(xml, "iptalYolcuSayisi"));
  const sonYolcuBildirimTarihi = innerText(xml, "sonYolcuBildirimTarihi") || null;
  const aracPlaka = innerText(xml, "aracPlaka") || null;
  const passengers: UetdsOzetPassenger[] = [];
  const blockRe = /<(?:[A-Za-z0-9_]+:)?ariziYolcuListesi(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?ariziYolcuListesi>/gi;
  let match: RegExpExecArray | null;
  while ((match = blockRe.exec(xml))) {
    const block = match[1] ?? "";
    const durum = innerText(block, "durumAciklama");
    passengers.push({
      reference: innerText(block, "uetdsBiletRefNo") || null,
      firstName: innerText(block, "adi"),
      lastName: innerText(block, "soyadi"),
      nationality: innerText(block, "ulkeKodu"),
      gender: innerText(block, "cinsiyet"),
      durum,
      active: isActiveMinistryPassengerDurum(durum),
    });
  }
  const personnel: UetdsOzetPersonnel[] = [];
  const personnelRe =
    /<(?:[A-Za-z0-9_]+:)?ariziPersonelListesi(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?ariziPersonelListesi>/gi;
  while ((match = personnelRe.exec(xml))) {
    const block = match[1] ?? "";
    const durum = innerText(block, "durumAciklama");
    personnel.push({
      firstName: innerText(block, "adi"),
      lastName: innerText(block, "soyadi"),
      nationalId: innerText(block, "tckimlikno"),
      durum,
      active: isActiveMinistryPassengerDurum(durum),
    });
  }
  // Trip metadata must come from the top level, not a passenger/group field.
  const tripXml = xml.replace(/<(?:[A-Za-z0-9_]+:)?(?:grupListesi|ariziYolcuListesi|ariziPersonelListesi)(?:\s[^>]*)?>[\s\S]*?<\/(?:[A-Za-z0-9_]+:)?(?:grupListesi|ariziYolcuListesi|ariziPersonelListesi)>/gi, "");
  const groups = [...xml.matchAll(/<(?:[A-Za-z0-9_]+:)?grupListesi(?:\s[^>]*)?>([\s\S]*?)<\/(?:[A-Za-z0-9_]+:)?grupListesi>/gi)]
    .map(match => ({ reference: innerText(match[1], "grupId"), fare: innerText(match[1], "ucret") }))
    .filter(group => /^\d+$/.test(group.reference));
  return {
    groups,
    seferReference: innerText(tripXml, "uetdsSeferReferansNo") || null,
    seferStatusCode: numberOrNull(innerText(tripXml, "seferDurumKodu")),
    seferStatus: innerText(tripXml, "seferDurumAciklama") || null,
    groupCount: groups.length,
    bildirilenYolcuSayisi,
    iptalYolcuSayisi,
    sonYolcuBildirimTarihi,
    aracPlaka,
    passengers,
    personnel,
    activeCount: passengers.filter((item) => item.active).length,
    activePersonnelCount: personnel.filter((item) => item.active).length,
  };
}
