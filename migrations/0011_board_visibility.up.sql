-- Item 1.2 — Board público/privado
ALTER TABLE boards ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'private';
ALTER TABLE boards ADD COLUMN IF NOT EXISTS share_token VARCHAR(64);
ALTER TABLE boards ADD COLUMN IF NOT EXISTS share_token_expires_at TIMESTAMPTZ;
ALTER TABLE boards ADD COLUMN IF NOT EXISTS share_token_created_by VARCHAR(100);
CREATE UNIQUE INDEX IF NOT EXISTS idx_boards_share_token ON boards(share_token) WHERE share_token IS NOT NULL;
