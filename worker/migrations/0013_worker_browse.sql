-- Lets an employer swipe through workers directly (not tied to any one
-- vacancy), filtered by the positions they say they're hiring for. A left
-- swipe ("pass") needs to be remembered so the same person doesn't keep
-- reappearing every time the employer reopens the deck.
CREATE TABLE company_worker_passes (
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (company_id, worker_id)
);
