-- Everyone used to start at a flat 5.0 — an unearned perfect score that
-- made a brand-new account look identical to someone with a real track
-- record. Start at 0 instead: the UI shows "нет оценок" until an actual
-- review lands and the average is recomputed from real reviews.
-- SQLite can't alter a column default in place, so the default only
-- changes for tables recreated later; what matters here is resetting the
-- accounts that never earned their 5.0.

UPDATE workers SET rating = 0
WHERE id NOT IN (SELECT DISTINCT worker_id FROM applications WHERE employer_rating IS NOT NULL);

UPDATE companies SET rating = 0, reviews_count = 0
WHERE id NOT IN (SELECT DISTINCT s.company_id FROM applications a JOIN shifts s ON s.id = a.shift_id WHERE a.rating IS NOT NULL);
