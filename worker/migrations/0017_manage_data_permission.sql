-- New permission: hard-deleting individual records and bulk-clearing test
-- data (admin/data.ts, plus the new DELETE routes on users/vacancies).
-- Owner-only by default — this is irreversible, unlike blockUsers.
UPDATE roles SET permissions = json_set(permissions, '$.manageData', 'yes') WHERE id = 'owner';
UPDATE roles SET permissions = json_set(permissions, '$.manageData', 'no') WHERE id IN ('admin', 'moderator', 'support');
