-- Bookkeeping for the two automatic bot reminders (see lib/reminders.ts,
-- fired by the cron trigger in wrangler.toml). Without a record of what
-- was already sent, an hourly job re-sends the same nudge every hour —
-- which is how a helpful reminder turns into the reason someone blocks
-- the bot.
--
-- signup_reminded_at: set once, ever. Someone who registered and never
-- filled in their profile gets exactly one nudge, not a campaign.
--
-- pending_reminded_at: the employer one repeats, because unanswered
-- applicants are a recurring situation rather than a one-off — but only
-- after a cooldown (see PENDING_REMINDER_COOLDOWN_DAYS).
ALTER TABLE workers ADD COLUMN signup_reminded_at TEXT;
ALTER TABLE companies ADD COLUMN signup_reminded_at TEXT;
ALTER TABLE companies ADD COLUMN pending_reminded_at TEXT;
