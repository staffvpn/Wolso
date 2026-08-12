-- The employer closes out a specific hire once its shift day has passed
-- ("отработал, день прошёл, закрываем") — that's what actually gates both
-- sides' mandatory review now, not worker self-checkout.
ALTER TABLE applications ADD COLUMN closed_by_employer_at TEXT;
ALTER TABLE applications ADD COLUMN employer_rating INTEGER;
ALTER TABLE applications ADD COLUMN employer_review_tags TEXT;
ALTER TABLE applications ADD COLUMN employer_review_comment TEXT;
