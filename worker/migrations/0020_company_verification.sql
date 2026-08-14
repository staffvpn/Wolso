ALTER TABLE companies ADD COLUMN inn TEXT;
ALTER TABLE companies ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE companies ADD COLUMN verification_reason TEXT;
ALTER TABLE companies ADD COLUMN verification_reviewed_by TEXT;
ALTER TABLE companies ADD COLUMN verification_reviewed_at TEXT;
ALTER TABLE companies ADD COLUMN ai_verification_summary TEXT;
ALTER TABLE companies ADD COLUMN ai_verification_checked_at TEXT;
UPDATE companies SET verification_status = 'approved'
  WHERE name != '' AND description != '' AND founded_year IS NOT NULL AND avatar_data IS NOT NULL;
