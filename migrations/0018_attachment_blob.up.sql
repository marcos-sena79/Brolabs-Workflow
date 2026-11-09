ALTER TABLE task_attachments
  ADD COLUMN storage_provider VARCHAR(20) NOT NULL DEFAULT 'supabase'
  CHECK (storage_provider IN ('supabase', 'vercel_blob'));

CREATE TABLE attachment_uploads (
  id VARCHAR(100) PRIMARY KEY,
  task_id VARCHAR(100) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  board_id VARCHAR(100) NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  uploader_id VARCHAR(100) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL UNIQUE,
  mime_type VARCHAR(150) NOT NULL,
  size_bytes INT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_attachment_uploads_task ON attachment_uploads(task_id);

CREATE TABLE attachment_cleanup_queue (
  storage_provider VARCHAR(20) NOT NULL,
  storage_path TEXT NOT NULL,
  not_before TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (storage_provider, storage_path)
);

CREATE TABLE attachment_cleanup_cursors (
  storage_provider VARCHAR(20) PRIMARY KEY,
  state JSONB NOT NULL
);

CREATE FUNCTION queue_attachment_cleanup() RETURNS trigger AS $$
DECLARE
  provider TEXT;
BEGIN
  IF TG_TABLE_NAME = 'attachment_uploads' THEN
    provider := 'vercel_blob';
  ELSE
    provider := OLD.storage_provider;
  END IF;
  INSERT INTO attachment_cleanup_queue (storage_provider, storage_path, not_before)
  VALUES (provider, OLD.storage_path, NOW() + INTERVAL '24 hours')
  ON CONFLICT (storage_provider, storage_path)
  DO UPDATE SET not_before = GREATEST(attachment_cleanup_queue.not_before, EXCLUDED.not_before);
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER queue_deleted_attachment
AFTER DELETE ON task_attachments FOR EACH ROW EXECUTE FUNCTION queue_attachment_cleanup();
CREATE TRIGGER queue_deleted_upload
AFTER DELETE ON attachment_uploads FOR EACH ROW EXECUTE FUNCTION queue_attachment_cleanup();
