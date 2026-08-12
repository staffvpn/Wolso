-- Experience used to be a whole-years-only number with no way to remove a
-- row once added. Switching to months (so people can enter e.g. "8 месяцев"
-- instead of rounding to a year) and adding delete support on the client.
ALTER TABLE worker_positions RENAME COLUMN years TO months;
UPDATE worker_positions SET months = months * 12;
