-- 0016_task_public (down)
DROP INDEX IF EXISTS idx_task_public_comments_rate;
DROP INDEX IF EXISTS idx_task_public_comments_task_id;
DROP TABLE IF EXISTS task_public_comments;

DROP INDEX IF EXISTS idx_task_public_links_token;
DROP INDEX IF EXISTS idx_task_public_links_task_id;
DROP TABLE IF EXISTS task_public_links;
