-- Per-driver portal section permissions.
-- GPS stays closed until a partner grants it.
-- Existing drivers keep the U-ETDS access they already use. A partner can remove it.
-- Does not change fleet assignment, GPS devices, or U-ETDS notifications.

ALTER TABLE partner_drivers
  ADD COLUMN portal_permissions JSONB NOT NULL
  DEFAULT '{"uetdsNew": true, "uetdsList": true}'::jsonb;

ALTER TABLE partner_drivers
  ADD CONSTRAINT partner_drivers_portal_permissions_obj_chk
  CHECK (jsonb_typeof(portal_permissions) = 'object');

COMMENT ON COLUMN partner_drivers.portal_permissions IS
  'Driver portal section grants. Missing keys are off. GPS device grant includes the existing device section, including immobilizer. Default keeps current U-ETDS access.';
