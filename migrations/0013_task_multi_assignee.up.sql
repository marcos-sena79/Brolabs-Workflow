-- Onda 2 — Item 1: múltiplos responsáveis por tarefa
-- assignee_ids = fonte de verdade (JSON array); assignee_id mantém o 1º (compat/rollback)

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_ids JSONB;

UPDATE tasks
SET assignee_ids = CASE
  WHEN assignee_id IS NULL OR assignee_id = '' THEN '[]'::jsonb
  ELSE to_jsonb(ARRAY[assignee_id])
END
WHERE assignee_ids IS NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assignee_ids ON tasks USING GIN (assignee_ids);
