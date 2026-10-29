-- 0017_github_commits (down)
DROP INDEX IF EXISTS idx_github_deliveries_received;
DROP TABLE IF EXISTS github_deliveries;

DROP INDEX IF EXISTS idx_task_commits_task;
DROP TABLE IF EXISTS task_commits;

DROP TABLE IF EXISTS github_settings;
