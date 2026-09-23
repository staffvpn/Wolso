-- Когда именно заявку перевели в 'invited' — ни created_at (это момент
-- отклика, не приглашения — у прямых приглашений вообще нет отклика), ни
-- какая-то другая колонка это не хранили, а без точки отсчёта нельзя
-- посчитать «час прошёл с приглашения» и не с чем сверять переписку в
-- чате. invite_reminded_at — та же отметка, что у остальных cron-job'ов
-- в reminders.ts, только с часовым, а не многодневным окном.
ALTER TABLE applications ADD COLUMN invited_at TEXT;
ALTER TABLE applications ADD COLUMN invite_reminded_at TEXT;
