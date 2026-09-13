-- Transfer pricing v2: opening >30 15→20; progressive km 0–160 +0.05 EUR/km.
-- Additive. Does not rewrite 003 / v1. Previous active row stays for rollback.
-- Location, district, and time fees are copied from the previous active rule.

INSERT INTO transfer_pricing_rules (version, service_type, is_active, notes, rules)
SELECT
  'transfer-pricing.v2',
  'transfer',
  FALSE,
  'Transfer opening and progressive km tariff v2. Location and time fees copied from previous active rule.',
  jsonb_build_object(
    'version', 'transfer-pricing.v2',
    'serviceType', 'transfer',
    'openingFees', $opening$
      [
        {"maxKmInclusive": 15, "feeEur": "25"},
        {"maxKmInclusive": 30, "feeEur": "23"},
        {"maxKmInclusive": null, "feeEur": "20"}
      ]
    $opening$::jsonb,
    'distanceBands', $bands$
      [
        {"fromKmExclusive": 0, "toKmInclusive": 60, "rateEurPerKm": "0.60"},
        {"fromKmExclusive": 60, "toKmInclusive": 90, "rateEurPerKm": "0.65"},
        {"fromKmExclusive": 90, "toKmInclusive": 120, "rateEurPerKm": "0.70"},
        {"fromKmExclusive": 120, "toKmInclusive": 160, "rateEurPerKm": "0.75"},
        {"fromKmExclusive": 160, "toKmInclusive": 220, "rateEurPerKm": "0.80"},
        {"fromKmExclusive": 220, "toKmInclusive": 300, "rateEurPerKm": "0.90"},
        {"fromKmExclusive": 300, "toKmInclusive": 400, "rateEurPerKm": "1.00"},
        {"fromKmExclusive": 400, "toKmInclusive": null, "rateEurPerKm": "1.10"}
      ]
    $bands$::jsonb,
    'regionFees', COALESCE(
      src.rules -> 'regionFees',
      $region$
        [
          {"provinceCode": "istanbul", "feeEur": "0"},
          {"provinceCode": "other", "feeEur": "50"},
          {"provinceCode": "yalova", "feeEur": "90"},
          {"provinceCode": "bursa", "feeEur": "90"},
          {"provinceCode": "antalya", "feeEur": "0"}
        ]
      $region$::jsonb
    ),
    'districtFees', COALESCE(src.rules -> 'districtFees', '[]'::jsonb),
    'timeSurcharges', COALESCE(src.rules -> 'timeSurcharges', '[]'::jsonb)
  )
FROM (
  SELECT rules
  FROM transfer_pricing_rules
  WHERE service_type = 'transfer'
    AND version IS DISTINCT FROM 'transfer-pricing.v2'
  ORDER BY is_active DESC, updated_at DESC, created_at DESC
  LIMIT 1
) AS src
ON CONFLICT (version) DO NOTHING;

UPDATE transfer_pricing_rules
SET is_active = FALSE
WHERE service_type = 'transfer'
  AND is_active
  AND version IS DISTINCT FROM 'transfer-pricing.v2';

UPDATE transfer_pricing_rules
SET is_active = TRUE
WHERE service_type = 'transfer'
  AND version = 'transfer-pricing.v2';
