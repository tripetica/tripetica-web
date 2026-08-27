-- Transfer pricing rules (versioned, editable) and applied quote snapshot.
-- reservation_searches is owned by postgres; ADD COLUMN requires that owner.
-- transfer_pricing_rules can be created/seeded by tripetica_app.
CREATE TABLE IF NOT EXISTS transfer_pricing_rules (
  version TEXT PRIMARY KEY,
  service_type TEXT NOT NULL DEFAULT 'transfer',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  rules JSONB NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS transfer_pricing_rules_set_updated_at ON transfer_pricing_rules;
CREATE TRIGGER transfer_pricing_rules_set_updated_at
  BEFORE UPDATE ON transfer_pricing_rules
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS transfer_pricing_rules_one_active_per_service
  ON transfer_pricing_rules (service_type)
  WHERE is_active;

ALTER TABLE reservation_searches
  ADD COLUMN IF NOT EXISTS selected_pickup_province_code TEXT,
  ADD COLUMN IF NOT EXISTS selected_pickup_district_code TEXT,
  ADD COLUMN IF NOT EXISTS applied_pickup_province_code TEXT,
  ADD COLUMN IF NOT EXISTS applied_pickup_district_code TEXT,
  ADD COLUMN IF NOT EXISTS selected_dropoff_province_code TEXT,
  ADD COLUMN IF NOT EXISTS selected_dropoff_district_code TEXT,
  ADD COLUMN IF NOT EXISTS applied_dropoff_province_code TEXT,
  ADD COLUMN IF NOT EXISTS applied_dropoff_district_code TEXT,
  ADD COLUMN IF NOT EXISTS applied_transfer_quote JSONB,
  ADD COLUMN IF NOT EXISTS applied_transfer_pricing_version TEXT;

INSERT INTO transfer_pricing_rules (version, service_type, is_active, notes, rules)
VALUES (
  'transfer-pricing.v1',
  'transfer',
  TRUE,
  'Verified transfer opening, distance, district, region and time rules.',
  '{
    "version": "transfer-pricing.v1",
    "serviceType": "transfer",
    "openingFees": [
      {"maxKmInclusive": 15, "feeEur": "25"},
      {"maxKmInclusive": 30, "feeEur": "23"},
      {"maxKmInclusive": null, "feeEur": "15"}
    ],
    "distanceBands": [
      {"fromKmExclusive": 0, "toKmInclusive": 60, "rateEurPerKm": "0.55"},
      {"fromKmExclusive": 60, "toKmInclusive": 90, "rateEurPerKm": "0.60"},
      {"fromKmExclusive": 90, "toKmInclusive": 120, "rateEurPerKm": "0.65"},
      {"fromKmExclusive": 120, "toKmInclusive": 160, "rateEurPerKm": "0.70"},
      {"fromKmExclusive": 160, "toKmInclusive": 220, "rateEurPerKm": "0.80"},
      {"fromKmExclusive": 220, "toKmInclusive": 300, "rateEurPerKm": "0.90"},
      {"fromKmExclusive": 300, "toKmInclusive": 400, "rateEurPerKm": "1.00"},
      {"fromKmExclusive": 400, "toKmInclusive": null, "rateEurPerKm": "1.10"}
    ],
    "regionFees": [
      {"provinceCode": "istanbul", "feeEur": "0"},
      {"provinceCode": "other", "feeEur": "50"},
      {"provinceCode": "yalova", "feeEur": "90"},
      {"provinceCode": "bursa", "feeEur": "90"},
      {"provinceCode": "antalya", "feeEur": "0"}
    ],
    "districtFees": [
      {"districtCode": "adalar", "feeEur": "0"},
      {"districtCode": "arnavutkoy", "feeEur": "0"},
      {"districtCode": "atasehir", "feeEur": "6"},
      {"districtCode": "avcilar", "feeEur": "10"},
      {"districtCode": "bagcilar", "feeEur": "7"},
      {"districtCode": "bahcelievler", "feeEur": "7"},
      {"districtCode": "bakirkoy", "feeEur": "8"},
      {"districtCode": "basaksehir", "feeEur": "9"},
      {"districtCode": "bayrampasa", "feeEur": "8"},
      {"districtCode": "besiktas", "feeEur": "0"},
      {"districtCode": "beykoz", "feeEur": "15"},
      {"districtCode": "beylikduzu", "feeEur": "10"},
      {"districtCode": "beyoglu", "feeEur": "0"},
      {"districtCode": "buyukcekmece", "feeEur": "10"},
      {"districtCode": "catalca", "feeEur": "20"},
      {"districtCode": "cekmekoy", "feeEur": "15"},
      {"districtCode": "esenler", "feeEur": "8"},
      {"districtCode": "esenyurt", "feeEur": "10"},
      {"districtCode": "eyupsultan", "feeEur": "8"},
      {"districtCode": "fatih", "feeEur": "2"},
      {"districtCode": "gaziosmanpasa", "feeEur": "8"},
      {"districtCode": "gungoren", "feeEur": "8"},
      {"districtCode": "kadikoy", "feeEur": "7"},
      {"districtCode": "kagithane", "feeEur": "9"},
      {"districtCode": "kartal", "feeEur": "10"},
      {"districtCode": "kucukcekmece", "feeEur": "10"},
      {"districtCode": "maltepe", "feeEur": "7"},
      {"districtCode": "pendik", "feeEur": "10"},
      {"districtCode": "sancaktepe", "feeEur": "15"},
      {"districtCode": "sariyer", "feeEur": "15"},
      {"districtCode": "silivri", "feeEur": "20"},
      {"districtCode": "sultanbeyli", "feeEur": "15"},
      {"districtCode": "sultangazi", "feeEur": "10"},
      {"districtCode": "sile", "feeEur": "40"},
      {"districtCode": "sisli", "feeEur": "0"},
      {"districtCode": "tuzla", "feeEur": "15"},
      {"districtCode": "umraniye", "feeEur": "8"},
      {"districtCode": "uskudar", "feeEur": "7"},
      {"districtCode": "zeytinburnu", "feeEur": "3"}
    ],
    "timeSurcharges": [
      {"districtCode": "kartal", "startLocal": "13:00", "endLocal": "21:00", "feeEur": "15"},
      {"districtCode": "maltepe", "startLocal": "13:00", "endLocal": "21:00", "feeEur": "15"},
      {"districtCode": "pendik", "startLocal": "13:00", "endLocal": "21:00", "feeEur": "15"},
      {"districtCode": "sancaktepe", "startLocal": "13:00", "endLocal": "21:00", "feeEur": "15"},
      {"districtCode": "sultanbeyli", "startLocal": "13:00", "endLocal": "21:00", "feeEur": "15"},
      {"districtCode": "tuzla", "startLocal": "13:00", "endLocal": "21:00", "feeEur": "15"},
      {"districtCode": "atasehir", "startLocal": "13:00", "endLocal": "21:00", "feeEur": "5"},
      {"districtCode": "kadikoy", "startLocal": "13:00", "endLocal": "21:00", "feeEur": "5"},
      {"districtCode": "umraniye", "startLocal": "13:00", "endLocal": "21:00", "feeEur": "5"},
      {"districtCode": "uskudar", "startLocal": "13:00", "endLocal": "21:00", "feeEur": "5"}
    ]
  }'::jsonb
)
ON CONFLICT (version) DO NOTHING;

REVOKE ALL ON TABLE transfer_pricing_rules FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE transfer_pricing_rules TO tripetica_app;
