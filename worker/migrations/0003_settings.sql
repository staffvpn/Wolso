-- Simple key/value store for small platform-wide toggles (e.g. two-factor
-- requirement) — not worth a dedicated table each.
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO settings (key, value) VALUES ('two_factor_required', 'true');
