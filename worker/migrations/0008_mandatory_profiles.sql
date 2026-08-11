-- Mandatory profile fields for both sides, plus swipeable portfolio/gallery
-- photos. Photos are D1 BLOBs — same reasoning as worker_documents (no R2,
-- it needs a billing subscription even on the free tier) — but served
-- publicly and unauthenticated via routes/media.ts, since profile photos
-- are meant to be seen by the other side while swiping, not gated like the
-- verification documents are.

ALTER TABLE workers ADD COLUMN bio TEXT NOT NULL DEFAULT '';
ALTER TABLE workers ADD COLUMN birthdate TEXT; -- ISO date, YYYY-MM-DD
ALTER TABLE workers ADD COLUMN skills TEXT NOT NULL DEFAULT ''; -- free text, not checkboxes
ALTER TABLE workers ADD COLUMN smoking TEXT; -- 'yes' | 'no'
ALTER TABLE workers ADD COLUMN alcohol TEXT; -- 'yes' | 'no'
ALTER TABLE workers ADD COLUMN avatar_data BLOB;
ALTER TABLE workers ADD COLUMN avatar_content_type TEXT;

CREATE TABLE worker_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  worker_id INTEGER NOT NULL REFERENCES workers(id) ON DELETE CASCADE,
  file_data BLOB NOT NULL,
  content_type TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_worker_photos_worker ON worker_photos(worker_id);

ALTER TABLE companies ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE companies ADD COLUMN founded_year INTEGER;
ALTER TABLE companies ADD COLUMN avatar_data BLOB;
ALTER TABLE companies ADD COLUMN avatar_content_type TEXT;

CREATE TABLE company_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  file_data BLOB NOT NULL,
  content_type TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_company_photos_company ON company_photos(company_id);
