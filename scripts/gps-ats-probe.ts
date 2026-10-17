import { loadDevelopmentEnv } from "./load-env";

loadDevelopmentEnv();

async function main() {
  const { assertAtsWorkerWithheld } = await import("../lib/gps/ats-worker-guard");
  const { resolveAtsDistrict } = await import("../lib/gps/ats-district");
  const { getPool } = await import("../lib/db/postgres");
  const { formatAtsKonumZamani } = await import("../lib/uetds/ats-soap");
  const { postAtsKonumBildir } = await import("../lib/uetds/ats-post");
  const { loadUetdsMinistryCredentials } = await import("../lib/uetds/ministry-credentials");
  const { UETDS_TEST_ENDPOINT, resolveUetdsMinistryEndpoint, resolveUetdsMinistryRuntime } = await import("../lib/uetds/ministry-env");

  assertAtsWorkerWithheld(process.env);
  if (process.env.ATS_MINISTRY_DISPATCH !== "allow-test") {
    throw new Error("ats_probe_withheld");
  }
  const runtime = resolveUetdsMinistryRuntime();
  const endpoint = resolveUetdsMinistryEndpoint();
  if (runtime !== "test" || endpoint !== UETDS_TEST_ENDPOINT) {
    throw new Error("ats_probe_blocked");
  }

  const pool = getPool();
  const company = await pool.query<{ id: string }>(
    `SELECT id FROM uetds_companies WHERE short_name = 'SEARCH TRAVEL' AND status = 'active'`,
  );
  if (company.rows.length !== 1) {
    throw new Error("ats_probe_company");
  }
  const companyId = company.rows[0]?.id;
  if (!companyId) {
    throw new Error("ats_probe_company");
  }
  const credentials = await loadUetdsMinistryCredentials(companyId);
  if (!credentials || credentials.env !== "test") {
    throw new Error("ats_probe_test_credentials");
  }
  const vehicle = await pool.query<{ plate: string; uetds_company_id: string | null }>(
    `SELECT plate, uetds_company_id FROM partner_vehicles WHERE id = $1`,
    ["1f2546e8-dc09-4206-8f36-29ded7069ba9"],
  );
  const fleetPlate = vehicle.rows[0]?.plate.replace(/\s+/g, "").toUpperCase() ?? "";
  if (fleetPlate !== "34EGP847" || vehicle.rows[0]?.uetds_company_id !== companyId) {
    throw new Error("ats_probe_vehicle");
  }
  const plate = (process.env.ATS_PROBE_PLATE ?? fleetPlate).replace(/\s+/g, "").toUpperCase();
  const point = await pool.query<{ latitude: number; longitude: number; recorded_at: Date }>(
    `SELECT latitude, longitude, recorded_at
     FROM gps_positions
     WHERE device_id = $1
     ORDER BY recorded_at DESC
     LIMIT 1`,
    ["399933e8-94d2-4115-bd69-060aa881a22a"],
  );
  const latest = point.rows[0] ?? null;
  const latestDistrict = latest ? resolveAtsDistrict(latest.latitude, latest.longitude) : { ok: false as const, reason: "unresolved" as const };
  const usingDevice = Boolean(latest && latestDistrict.ok);
  const latitude = usingDevice && latest ? latest.latitude : 41.034;
  const longitude = usingDevice && latest ? latest.longitude : 28.675;
  const recordedAt = usingDevice && latest ? latest.recorded_at : new Date();
  const district = usingDevice && latestDistrict.ok
    ? latestDistrict
    : resolveAtsDistrict(latitude, longitude);
  if (!district.ok) {
    throw new Error("ats_probe_district");
  }
  const result = await postAtsKonumBildir({
    username: credentials.username,
    password: credentials.password,
    plate,
    latitude,
    longitude,
    ilKodu: district.ilKodu,
    ilceMernisKodu: district.ilceMernisKodu,
    konumZamani: formatAtsKonumZamani(recordedAt),
  });
  console.log(JSON.stringify({
    endpoint: "test",
    plate,
    fleetPlate,
    coordinateSource: usingDevice ? "device" : "catalog-control",
    ilKodu: district.ilKodu,
    ilceMernisKodu: district.ilceMernisKodu,
    konumZamani: formatAtsKonumZamani(recordedAt),
    sonucKodu: result.sonucKodu,
    sonucMesaji: result.sonucMesaji,
    fault: result.rawSafe.includes("Fault") || result.rawSafe.includes("fault"),
  }));
  await pool.end();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "ats_probe_failed";
  console.error(message);
  process.exit(1);
});
