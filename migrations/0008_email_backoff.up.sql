-- Backoff de reenvio do outbox de e-mails (item 3.1).
ALTER TABLE email_notifications ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ;
