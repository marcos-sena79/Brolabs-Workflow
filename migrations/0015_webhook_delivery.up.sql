-- 0015_webhook_delivery (S2, item 5): motor de entrega server-side de webhooks
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS notify_on_mention BOOLEAN DEFAULT TRUE;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS notify_on_assignment BOOLEAN DEFAULT TRUE;
ALTER TABLE integrations ADD COLUMN IF NOT EXISTS member_handles JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS response_status INT;
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS error TEXT;
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS payload TEXT;
ALTER TABLE webhook_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_webhook_outbox ON webhook_logs(created_at) WHERE status = 'pending';
