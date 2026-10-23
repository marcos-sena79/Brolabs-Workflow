-- Outbox de e-mails (item 3.1) + escopo por usuário (item 3.2).
ALTER TABLE email_notifications ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE email_notifications ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;
ALTER TABLE email_notifications ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE email_notifications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE email_notifications ADD COLUMN IF NOT EXISTS member_id VARCHAR(100) REFERENCES members(id) ON DELETE SET NULL;
ALTER TABLE email_notifications ALTER COLUMN status SET DEFAULT 'pending';
CREATE INDEX IF NOT EXISTS idx_email_outbox ON email_notifications(created_at)
  WHERE status IN ('pending','failed');

-- Backfill: casa rows antigas com o membro pelo e-mail do destinatário.
UPDATE email_notifications en
SET member_id = m.id
FROM members m
WHERE LOWER(en.recipient_email) = LOWER(m.email)
  AND en.member_id IS NULL;
