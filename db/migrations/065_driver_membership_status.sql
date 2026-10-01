-- Independent from U-ETDS subscription enrollment, fee and periods.
ALTER TABLE partner_drivers
  ADD COLUMN membership_status TEXT NOT NULL DEFAULT 'standard'
  CONSTRAINT partner_drivers_membership_status_check CHECK (membership_status IN ('standard', 'gold'));
