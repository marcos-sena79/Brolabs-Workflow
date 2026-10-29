DROP INDEX IF EXISTS idx_webhook_outbox;

ALTER TABLE webhook_logs DROP COLUMN IF EXISTS created_at;
ALTER TABLE webhook_logs DROP COLUMN IF EXISTS payload;
ALTER TABLE webhook_logs DROP COLUMN IF EXISTS error;
ALTER TABLE webhook_logs DROP COLUMN IF EXISTS next_attempt_at;
ALTER TABLE webhook_logs DROP COLUMN IF EXISTS attempts;
ALTER TABLE webhook_logs DROP COLUMN IF EXISTS response_status;

ALTER TABLE integrations DROP COLUMN IF EXISTS member_handles;
ALTER TABLE integrations DROP COLUMN IF EXISTS notify_on_assignment;
ALTER TABLE integrations DROP COLUMN IF EXISTS notify_on_mention;
