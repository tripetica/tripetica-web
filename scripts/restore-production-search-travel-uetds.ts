import { query } from "../lib/db/postgres";
import { parseUetdsCompanyInput } from "../lib/ops/uetds-company-fields";
import { saveOpsUetdsCompany } from "../lib/ops/uetds-companies";
import { foldUetdsSearchPlate } from "../lib/uetds/edit-policy";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

const SEARCH_TRAVEL_SHORT_NAME = "SEARCH TRAVEL";
const TARGET_DRIVER_FIRST = "RECEP";
const TARGET_DRIVER_LAST = "YILDIRIM";
const TARGET_VEHICLE_PLATE = "34EGP847";

function requiredEnv(name: string) {
  const value = process.env[name]?.trim() ?? "";
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function foldName(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleUpperCase("tr-TR");
}

async function main() {
  if (process.env.EXPECTED_DATABASE !== "tripetica") {
    throw new Error("Production SEARCH TRAVEL restore requires EXPECTED_DATABASE=tripetica");
  }
  if (process.env.NODE_ENV !== "production") {
    throw new Error("Production SEARCH TRAVEL restore requires NODE_ENV=production");
  }
  if (process.env.ALLOW_PRODUCTION_UETDS_COMPANY_RESTORE !== "yes") {
    throw new Error("Production SEARCH TRAVEL restore requires an explicit approval flag");
  }

  const fields = parseUetdsCompanyInput({
    shortName: SEARCH_TRAVEL_SHORT_NAME,
    legalName: requiredEnv("UETDS_COMPANY_LEGAL_NAME"),
    taxNumber: requiredEnv("UETDS_COMPANY_TAX_NUMBER"),
    authorityDocumentType: requiredEnv("UETDS_COMPANY_AUTH_TYPE"),
    authorityDocumentNumber: requiredEnv("UETDS_COMPANY_AUTH_NUMBER"),
    status: "active",
    liveUsername: requiredEnv("UETDS_LIVE_USERNAME"),
    livePassword: requiredEnv("UETDS_LIVE_PASSWORD"),
  });
  if (!fields) {
    throw new Error("SEARCH TRAVEL company fields are invalid");
  }

  const existing = await query<{ id: string }>(
    `SELECT id
     FROM uetds_companies
     WHERE upper(replace(short_name, ' ', '')) = 'SEARCHTRAVEL'
     ORDER BY created_at ASC
     LIMIT 1`,
  );
  const saved = await saveOpsUetdsCompany({
    id: existing.rows[0]?.id,
    fields,
  });
  if (!saved.ok) {
    throw new Error("SEARCH TRAVEL company restore failed");
  }

  const driverName = foldName(TARGET_DRIVER_FIRST).replace(/ /g, "");
  const lastName = foldName(TARGET_DRIVER_LAST).replace(/ /g, "");
  const driver = await query<{ id: string; uetds_company_id: string | null }>(
    `SELECT id, uetds_company_id
     FROM partner_drivers
     WHERE deleted_at IS NULL
       AND upper(replace(first_name, ' ', '')) = $1
       AND upper(replace(last_name, ' ', '')) = $2`,
    [driverName, lastName],
  );
  const vehicle = await query<{ id: string; uetds_company_id: string | null }>(
    `SELECT id, uetds_company_id
     FROM partner_vehicles
     WHERE deleted_at IS NULL
       AND replace(upper(plate), ' ', '') = $1`,
    [foldUetdsSearchPlate(TARGET_VEHICLE_PLATE)],
  );
  if (driver.rows.length !== 1 || vehicle.rows.length !== 1) {
    throw new Error(
      `deterministic fleet match mismatch driver=${driver.rows.length} vehicle=${vehicle.rows.length}`,
    );
  }
  if (driver.rows[0].uetds_company_id && driver.rows[0].uetds_company_id !== saved.id) {
    throw new Error("target driver is already linked to a different U-ETDS company");
  }
  if (vehicle.rows[0].uetds_company_id && vehicle.rows[0].uetds_company_id !== saved.id) {
    throw new Error("target vehicle is already linked to a different U-ETDS company");
  }
  if (!driver.rows[0].uetds_company_id) {
    await query(`UPDATE partner_drivers SET uetds_company_id = $1 WHERE id = $2 AND uetds_company_id IS NULL`, [
      saved.id,
      driver.rows[0].id,
    ]);
  }
  if (!vehicle.rows[0].uetds_company_id) {
    await query(`UPDATE partner_vehicles SET uetds_company_id = $1 WHERE id = $2 AND uetds_company_id IS NULL`, [
      saved.id,
      vehicle.rows[0].id,
    ]);
  }

  const verify = await query<{
    status: string;
    integration_status: string;
    has_live: boolean;
  }>(
    `SELECT status,
            integration_status,
            (live_username IS NOT NULL AND live_username <> '' AND live_password_sealed IS NOT NULL AND live_password_sealed <> '') AS has_live
     FROM uetds_companies
     WHERE id = $1`,
    [saved.id],
  );
  const company = verify.rows[0];
  if (!company || company.status !== "active" || company.integration_status !== "ready" || !company.has_live) {
    throw new Error("SEARCH TRAVEL company is not active/ready after restore");
  }

  console.log("search_travel_restore_ok");
  console.log(`company_existing=${Boolean(existing.rows[0]?.id)}`);
  console.log("driver_linked=1");
  console.log("vehicle_linked=1");
  console.log("company_status=active");
  console.log("company_integration=ready");
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "SEARCH TRAVEL restore failed");
  process.exitCode = 1;
});
