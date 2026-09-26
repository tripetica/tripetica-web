export const UETDS_NS = "http://uetds.unetws.udhb.gov.tr/";

export const UETDS_TEST_WSDL =
  "https://servis.turkiye.gov.tr/services/g2g/kdgm/test/uetdsarizi?wsdl";
export const UETDS_TEST_ENDPOINT =
  "https://servis.turkiye.gov.tr/services/g2g/kdgm/test/uetdsarizi";
export const UETDS_LIVE_WSDL =
  "https://servis.turkiye.gov.tr/services/g2g/kdgm/uetdsarizi?wsdl";
export const UETDS_LIVE_ENDPOINT =
  "https://servis.turkiye.gov.tr/services/g2g/kdgm/uetdsarizi";

function matchesOfficialUrl(value: string, endpoint: string) {
  return value.trim() === endpoint || value.trim() === `${endpoint}?wsdl`;
}

export function isTestUetdsUrl(url: string) {
  return matchesOfficialUrl(url, UETDS_TEST_ENDPOINT);
}

export function isLiveUetdsUrl(url: string) {
  return matchesOfficialUrl(url, UETDS_LIVE_ENDPOINT);
}

export type UetdsMinistryRuntime = "test" | "live";

export function isDevUetdsRuntime(
  env: Record<string, string | undefined> = process.env,
) {
  return env.NODE_ENV !== "production" && env.EXPECTED_DATABASE === "tripetica_dev";
}

export function isProductionUetdsRuntime(
  env: Record<string, string | undefined> = process.env,
) {
  return env.NODE_ENV === "production" && env.EXPECTED_DATABASE === "tripetica";
}

export function resolveUetdsMinistryRuntime(
  env: Record<string, string | undefined> = process.env,
): UetdsMinistryRuntime | null {
  if (isDevUetdsRuntime(env)) {
    return "test";
  }
  if (isProductionUetdsRuntime(env)) {
    return "live";
  }
  return null;
}

export function assertProductionUetdsLiveOnly(
  url: string,
  env: Record<string, string | undefined> = process.env,
) {
  if (!isProductionUetdsRuntime(env) || isDevUetdsRuntime(env)) {
    throw new Error("uetds_live_blocked");
  }
  if (isTestUetdsUrl(url) || !isLiveUetdsUrl(url)) {
    throw new Error("uetds_live_blocked");
  }
}

export function resolveUetdsMinistryEndpoint(
  env: Record<string, string | undefined> = process.env,
) {
  const runtime = resolveUetdsMinistryRuntime(env);
  if (runtime === "test") {
    return resolveDevUetdsTestEndpoint(env);
  }
  if (runtime === "live") {
    assertProductionUetdsLiveOnly(UETDS_LIVE_ENDPOINT, env);
    return UETDS_LIVE_ENDPOINT;
  }
  throw new Error("uetds_live_blocked");
}

export function assertDevUetdsTestOnly(
  url: string,
  env: Record<string, string | undefined> = process.env,
) {
  if (!isDevUetdsRuntime(env)) {
    throw new Error("uetds_dev_only");
  }
  if (isLiveUetdsUrl(url) || !isTestUetdsUrl(url)) {
    throw new Error("uetds_live_blocked");
  }
}

export function resolveDevUetdsTestEndpoint(
  env: Record<string, string | undefined> = process.env,
) {
  assertDevUetdsTestOnly(UETDS_TEST_ENDPOINT, env);
  return UETDS_TEST_ENDPOINT;
}

export const UETDS_SOAP_ACTIONS = {
  seferEkle: `${UETDS_NS}uetdsytsarizi/seferEkle`,
  personelEkle: `${UETDS_NS}uetdsytsarizi/personelEkle`,
  personelIptal: `${UETDS_NS}uetdsytsarizi/personelIptal`,
  seferGrupEkle: `${UETDS_NS}uetdsytsarizi/seferGrupEkle`,
  yolcuEkle: `${UETDS_NS}uetdsytsarizi/yolcuEkle`,
  yolcuEkleCoklu: `${UETDS_NS}uetdsytsarizi/yolcuEkleCoklu`,
  seferDetayCiktisiAl: `${UETDS_NS}uetdsytsarizi/seferDetayCiktisiAl`,
  seferGuncelle: `${UETDS_NS}uetdsytsarizi/seferGuncelle`,
  seferIptal: `${UETDS_NS}uetdsytsarizi/seferIptal`,
  seferGrupGuncelle: `${UETDS_NS}uetdsytsarizi/seferGrupGuncelle`,
  yolcuIptalUetdsYolcuRefNoIle: `${UETDS_NS}uetdsytsarizi/yolcuIptalUetdsYolcuRefNoIle`,
  yolcuBildirimSorgula: `${UETDS_NS}uetdsytsarizi/yolcuBildirimSorgula`,
  bildirimOzeti: `${UETDS_NS}uetdsytsarizi/bildirimOzeti`,
} as const;
