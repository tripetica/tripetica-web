-- Standard partner logins are owners. A missing row in partner_menu_denials
-- means that standard menu is open. Rows already stored here are explicit
-- closures and are not deleted or rewritten. Extra users that already have
-- partner_user_grants keep those grants. This does not grant ops or system
-- roles and does not change subscriptions or fleet access.

CREATE TABLE partner_menu_denials (
  partner_id UUID NOT NULL REFERENCES partners (id) ON DELETE CASCADE,
  tab TEXT NOT NULL,
  PRIMARY KEY (partner_id, tab),
  CONSTRAINT partner_menu_denials_tab_chk CHECK (tab IN (
    'jobs',
    'accepted',
    'drivers',
    'vehicles',
    'gps',
    'uetds',
    'edevlet',
    'profile',
    'billing',
    'users'
  ))
);

COMMENT ON TABLE partner_menu_denials IS
  'Standard partner menus closed from the operations panel. No row means the menu stays open for the partner owner.';

REVOKE ALL ON TABLE partner_menu_denials FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_dev_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_menu_denials TO tripetica_dev_app;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tripetica_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE partner_menu_denials TO tripetica_app;
  END IF;
END
$$;

UPDATE partner_users AS candidate
   SET is_owner = TRUE
 WHERE candidate.is_owner = FALSE
   AND NOT EXISTS (
     SELECT 1
       FROM partner_user_grants granted
      WHERE granted.user_id = candidate.id
   )
   AND NOT EXISTS (
     SELECT 1
       FROM partner_users owner
      WHERE owner.partner_id = candidate.partner_id
        AND owner.is_owner = TRUE
   )
   AND candidate.id = (
     SELECT first_user.id
       FROM partner_users first_user
      WHERE first_user.partner_id = candidate.partner_id
      ORDER BY first_user.created_at, first_user.id
      LIMIT 1
   );
