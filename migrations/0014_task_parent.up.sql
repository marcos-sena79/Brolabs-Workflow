-- História pai (Onda 2 — item 2A): vinculação tarefa → história
-- parent_id referencia tasks.id (sem FK explícita: ids são gerados no cliente)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks (parent_id);
