-- Rollback Item 1: remove a lista; assignee_id (principal) permanece como estava

DROP INDEX IF EXISTS idx_tasks_assignee_ids;
ALTER TABLE tasks DROP COLUMN IF EXISTS assignee_ids;
