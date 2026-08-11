-- Store uploaded documents directly in D1 instead of R2 — R2 requires
-- enabling a billing subscription (even for the free tier), which isn't
-- available to every operator. D1 rows cap out at 2MB, so uploads are
-- capped smaller than that server-side.
ALTER TABLE worker_documents ADD COLUMN file_data BLOB;
ALTER TABLE worker_documents ADD COLUMN content_type TEXT;
