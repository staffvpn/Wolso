-- Removes verification entirely: employer moderation-by-INN gate, worker
-- document/med-book verification. The only thing standing between anyone
-- and browsing cards is now the mandatory profile (see 0008) — no review
-- step, no approval queue for accounts.

DROP TABLE worker_documents;

ALTER TABLE companies DROP COLUMN verification_status;
ALTER TABLE companies DROP COLUMN inn;
ALTER TABLE companies DROP COLUMN verified;

UPDATE roles SET permissions = json_remove(permissions, '$.verifyDocuments');
