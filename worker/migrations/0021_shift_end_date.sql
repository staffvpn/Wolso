-- A vacancy can now span several consecutive days (posted once, not as N
-- separate shift rows) — end_date is the last day, NULL/equal to date means
-- a single-day shift exactly like before this migration.
ALTER TABLE shifts ADD COLUMN end_date TEXT;
