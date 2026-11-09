DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM task_attachments WHERE storage_provider = 'vercel_blob')
     OR EXISTS (SELECT 1 FROM attachment_uploads)
     OR EXISTS (SELECT 1 FROM attachment_cleanup_queue) THEN
    RAISE EXCEPTION 'Cannot revert while Blob attachments, pending uploads or cleanup work exist';
  END IF;
END;
$$;
DROP TRIGGER queue_deleted_attachment ON task_attachments;
DROP TRIGGER queue_deleted_upload ON attachment_uploads;
DROP FUNCTION queue_attachment_cleanup();
DROP TABLE attachment_cleanup_queue;
DROP TABLE attachment_cleanup_cursors;
DROP TABLE attachment_uploads;
ALTER TABLE task_attachments DROP COLUMN storage_provider;
