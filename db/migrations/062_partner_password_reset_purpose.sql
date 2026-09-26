-- Allow partner email challenges to be issued for password reset.
-- Reuses partner_email_challenges (hashed OTP, TTL, attempts, consume).
-- Does not alter register or email_change behavior.

ALTER TABLE partner_email_challenges
  DROP CONSTRAINT partner_email_challenges_purpose_chk;

ALTER TABLE partner_email_challenges
  ADD CONSTRAINT partner_email_challenges_purpose_chk
  CHECK (purpose IN ('register', 'email_change', 'password_reset'));

COMMENT ON TABLE partner_email_challenges IS
  'One-time hashed email OTP challenges for partner register, email change, and password reset.';
