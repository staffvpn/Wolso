-- chats.shift_id is ON DELETE SET NULL (not CASCADE), so every vacancy
-- deleted so far left its chat behind with a null shift — still listed for
-- both sides, pointing at a shift that no longer exists. The delete routes
-- now remove the chat explicitly; this clears the ones already stranded.
-- Every chat is created with a shift_id (see employer.ts), so a null one is
-- by definition an orphan rather than a legitimately shift-less chat.
DELETE FROM chats WHERE shift_id IS NULL;
