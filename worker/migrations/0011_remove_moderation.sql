-- Vacancies now publish immediately (no admin approval queue) — flip any
-- shift still waiting on the old review step over to active so it becomes
-- visible in the feed.
UPDATE shifts SET status = 'active' WHERE status = 'pending_review';

-- The moderation flag ("below minimum wage" / "new employer") was only ever
-- read by the moderation queue UI, which is gone.
ALTER TABLE shifts DROP COLUMN moderation_flag_label;
ALTER TABLE shifts DROP COLUMN moderation_flag_tone;

-- The complaints table backed the "Жалобы" tab in the same admin page and
-- was never written to by any app-facing route (no "report user" feature
-- exists) — dropping it along with the moderation UI that read it.
DROP TABLE complaints;
