-- To-Do do dia (item 2.4)
CREATE TABLE IF NOT EXISTS daily_todos (
  id VARCHAR(100) PRIMARY KEY,
  member_id VARCHAR(100) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  board_id VARCHAR(100) REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT false,
  due_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source_task_id VARCHAR(100) REFERENCES tasks(id) ON DELETE SET NULL,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_daily_todos_member_date ON daily_todos(member_id, due_date);
