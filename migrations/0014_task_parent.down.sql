-- Rollback 2A: remove o vínculo de história pai (dados de tarefa permanecem)

DROP INDEX IF EXISTS idx_tasks_parent_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS parent_id;
