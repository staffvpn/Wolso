-- Bot broadcasts sent from the dashboard. The recipient list is resolved
-- once, when the broadcast is created, and stored here as a JSON array of
-- telegram ids: sending happens in batches across several requests (a
-- single Worker request can't sit through thousands of Telegram calls),
-- and re-resolving the audience per batch would let the list shift
-- underneath the cursor and double-send or skip people.
CREATE TABLE broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT NOT NULL,
  audience TEXT NOT NULL,
  city TEXT,
  recipients TEXT NOT NULL DEFAULT '[]',
  total INTEGER NOT NULL DEFAULT 0,
  cursor INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_broadcasts_created ON broadcasts(created_at);
