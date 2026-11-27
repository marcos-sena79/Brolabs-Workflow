-- Restaura os vínculos de Épico removidos pela migration UP (se o card ainda
-- não ganhou outro vínculo) e descarta o backup.
UPDATE tasks AS t
SET epic_id = b.epic_id
FROM epic_link_cleanup_backup AS b
WHERE b.task_id = t.id
  AND t.epic_id IS NULL;

DROP TABLE IF EXISTS epic_link_cleanup_backup;
