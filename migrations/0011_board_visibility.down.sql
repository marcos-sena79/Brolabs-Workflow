DROP INDEX IF EXISTS idx_boards_share_token;
ALTER TABLE boards DROP COLUMN IF EXISTS share_token_created_by;
ALTER TABLE boards DROP COLUMN IF EXISTS share_token_expires_at;
ALTER TABLE boards DROP COLUMN IF EXISTS share_token;
ALTER TABLE boards DROP COLUMN IF EXISTS visibility;
