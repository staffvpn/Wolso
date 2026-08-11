-- Companies already have a status column (used for suspend/block); workers
-- were missing the equivalent, which POST /admin/users/seekers/:id/block
-- already assumed existed.
ALTER TABLE workers ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
