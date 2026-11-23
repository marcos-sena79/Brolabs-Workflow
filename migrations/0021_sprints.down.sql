-- Os boards.sprint_* já espelham a sprint ativa; basta remover a estrutura nova.
DROP INDEX IF EXISTS idx_tasks_sprint_id;
ALTER TABLE tasks DROP COLUMN IF EXISTS sprint_id;
DROP TABLE IF EXISTS sprints;
