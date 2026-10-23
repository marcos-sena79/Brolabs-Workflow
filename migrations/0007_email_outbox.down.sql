DROP INDEX IF EXISTS idx_email_outbox;
ALTER TABLE email_notifications DROP COLUMN IF EXISTS member_id;
ALTER TABLE email_notifications DROP COLUMN IF EXISTS sent_at;
ALTER TABLE email_notifications DROP COLUMN IF EXISTS last_error;
ALTER TABLE email_notifications DROP COLUMN IF EXISTS attempts;
ALTER TABLE email_notifications DROP COLUMN IF EXISTS created_at;
ALTER TABLE email_notifications ALTER COLUMN status SET DEFAULT 'sent';
