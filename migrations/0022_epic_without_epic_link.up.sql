-- Um card do tipo Épico não se vincula a outro Épico (campo epic_id).
-- Remove os vínculos existentes, guardando-os para permitir o rollback.

CREATE TABLE IF NOT EXISTS epic_link_cleanup_backup (
  task_id VARCHAR(100) PRIMARY KEY,
  epic_id VARCHAR(100) NOT NULL
);

INSERT INTO epic_link_cleanup_backup (task_id, epic_id)
SELECT id, epic_id
FROM tasks
WHERE issue_type = 'epic'
  AND epic_id IS NOT NULL
  AND epic_id <> ''
ON CONFLICT (task_id) DO NOTHING;

UPDATE tasks
SET epic_id = NULL
WHERE issue_type = 'epic'
  AND epic_id IS NOT NULL;
