-- One active draft reservation_search per browser session.
CREATE UNIQUE INDEX reservation_searches_one_active_draft_per_browser_session
  ON reservation_searches (browser_session_id)
  WHERE status = 'draft';
