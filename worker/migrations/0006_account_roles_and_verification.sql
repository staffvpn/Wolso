-- One Telegram account = one permanent role (worker or employer), chosen
-- once at onboarding. Only staff with the switchUserRole permission can
-- flip it later (see admin/users.ts).
CREATE TABLE telegram_accounts (
  telegram_id INTEGER PRIMARY KEY,
  active_role TEXT NOT NULL CHECK(active_role IN ('worker', 'employer')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Companies must pass moderation before they can publish vacancies.
-- Separate from `status` (active/suspended — block/unblock), this tracks
-- whether staff have reviewed the employer at all. Starts 'incomplete' —
-- a brand-new company has nothing worth reviewing yet; it flips to
-- 'pending_review' automatically once the mandatory profile fields are
-- filled in (see routes/employer.ts), which is what actually puts it in
-- the moderation queue.
ALTER TABLE companies ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'incomplete';

-- New permission: only staff who have it can move a user between the
-- worker/employer roles.
UPDATE roles SET permissions = json_set(permissions, '$.switchUserRole', 'yes') WHERE id IN ('owner', 'admin');
UPDATE roles SET permissions = json_set(permissions, '$.switchUserRole', 'no') WHERE id IN ('moderator', 'support');
