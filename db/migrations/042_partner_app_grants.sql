-- Production app-role grants for partner fleet/email tables created without GRANT.
-- Additive and idempotent. Does not copy DEV data or rewrite booking/ops auth.

REVOKE ALL ON TABLE partner_drivers FROM PUBLIC;
REVOKE ALL ON TABLE partner_vehicles FROM PUBLIC;
REVOKE ALL ON TABLE partner_email_challenges FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_drivers TO tripetica_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_vehicles TO tripetica_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_email_challenges TO tripetica_app;
