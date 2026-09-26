// Official UAB U-ETDS Arızi V15 §D — "WEB SERVİS TEST ENTEGRASYONU İÇİN ÖRNEK BİLGİLER"
// https://uetds.uab.gov.tr/teknik-dokuman
// These are ministry TEST-sandbox fixtures, not live SEARCH TRAVEL vehicles.

export const UETDS_OFFICIAL_TEST_USERNAME = "999999";
export const UETDS_OFFICIAL_TEST_ARAC_PLAKA = "06TARIFESIZ123";

export function isOfficialUetdsTestUsername(username: string) {
  return username.trim() === UETDS_OFFICIAL_TEST_USERNAME;
}

export function resolveUetdsTestAracPlaka(input: {
  testUsername: string;
  fleetPlate: string;
}) {
  if (isOfficialUetdsTestUsername(input.testUsername)) {
    return UETDS_OFFICIAL_TEST_ARAC_PLAKA;
  }
  return input.fleetPlate.trim();
}
