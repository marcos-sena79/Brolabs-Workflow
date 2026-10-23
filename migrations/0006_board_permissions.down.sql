DROP INDEX IF EXISTS idx_board_members_member;
DROP TABLE IF EXISTS board_members;
ALTER TABLE members DROP COLUMN IF EXISTS system_role;
