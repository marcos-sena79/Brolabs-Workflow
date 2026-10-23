-- Anexos de tarefas (item 2.1).
CREATE TABLE IF NOT EXISTS task_attachments (
  id VARCHAR(100) PRIMARY KEY,
  task_id VARCHAR(100) NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  board_id VARCHAR(100) NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  uploader_id VARCHAR(100) REFERENCES members(id) ON DELETE SET NULL,
  original_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_attachments_task ON task_attachments(task_id);
