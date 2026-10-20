-- Arquivamento de tarefas (item 1.5).
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS archived_by VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_tasks_board_archived
  ON tasks(board_id, archived_at) WHERE archived_at IS NOT NULL;
