DROP INDEX IF EXISTS idx_tasks_board_archived;
ALTER TABLE tasks DROP COLUMN IF EXISTS archived_at;
ALTER TABLE tasks DROP COLUMN IF EXISTS archived_by;
