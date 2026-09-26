-- Link partner fleet records to a central U-ETDS carrier company.
-- NULL means Tripetica will not submit a notification for that driver/vehicle.
-- Existing rows stay NULL. No carrier is hard-coded.

ALTER TABLE partner_drivers
  ADD COLUMN IF NOT EXISTS uetds_company_id UUID REFERENCES uetds_companies (id);

ALTER TABLE partner_vehicles
  ADD COLUMN IF NOT EXISTS uetds_company_id UUID REFERENCES uetds_companies (id);

CREATE INDEX IF NOT EXISTS partner_drivers_uetds_company_id_idx
  ON partner_drivers (uetds_company_id);

CREATE INDEX IF NOT EXISTS partner_vehicles_uetds_company_id_idx
  ON partner_vehicles (uetds_company_id);

COMMENT ON COLUMN partner_drivers.uetds_company_id IS
  'Carrier used for future U-ETDS notifications. NULL = do not notify through Tripetica.';
COMMENT ON COLUMN partner_vehicles.uetds_company_id IS
  'Carrier whose authority document covers this vehicle for future U-ETDS notifications. NULL = do not notify through Tripetica.';
