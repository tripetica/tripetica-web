-- Temporary partner email verification challenges (register + email change).
-- Not a partner approval/status field. Does not rewrite booking or partner auth.

CREATE TABLE partner_email_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purpose TEXT NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  code_salt TEXT NOT NULL,
  user_id UUID REFERENCES partner_users (id),
  ip TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT partner_email_challenges_purpose_chk
    CHECK (purpose IN ('register', 'email_change')),
  CONSTRAINT partner_email_challenges_email_chk
    CHECK (char_length(email) BETWEEN 3 AND 254),
  CONSTRAINT partner_email_challenges_attempts_chk
    CHECK (attempt_count >= 0)
);

CREATE INDEX partner_email_challenges_email_purpose_idx
  ON partner_email_challenges (email, purpose, created_at DESC);

CREATE INDEX partner_email_challenges_user_open_idx
  ON partner_email_challenges (user_id, purpose, created_at DESC)
  WHERE user_id IS NOT NULL AND consumed_at IS NULL;

COMMENT ON TABLE partner_email_challenges IS
  'Hashed one-time email access codes. Separate from partners.status / ops approval.';
