-- Whether the bot can still reach each account. There is no way to ask
-- Telegram "is this person still subscribed" in bulk: you find out either
-- when a send fails, or from a my_chat_member update the moment someone
-- blocks or unblocks. Both write here, so the dashboard can show who has
-- gone dark instead of leaving notifications to silently vanish.
--
-- Values: 'active' (a send went through), 'blocked' (user blocked/stopped
-- the bot), 'deleted' (Telegram account deactivated), 'unreachable' (bot
-- has no chat with them — never pressed Start), 'unknown' (no signal yet).
ALTER TABLE workers ADD COLUMN bot_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE workers ADD COLUMN bot_status_at TEXT;
ALTER TABLE companies ADD COLUMN bot_status TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE companies ADD COLUMN bot_status_at TEXT;
