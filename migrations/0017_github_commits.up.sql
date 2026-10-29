-- 0017_github_commits (Onda 2, item 4): commits do GitHub atrelados à tarefa (D4: webhook + secret)
CREATE TABLE IF NOT EXISTS github_settings (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL,
  repo TEXT NOT NULL,
  secret_encrypted TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner, repo)
);

CREATE TABLE IF NOT EXISTS task_commits (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  sha TEXT NOT NULL,
  message TEXT NOT NULL,
  author TEXT,
  author_avatar TEXT,
  url TEXT,
  branch TEXT,
  repo_full_name TEXT,
  committed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (task_id, sha)
);

CREATE INDEX IF NOT EXISTS idx_task_commits_task ON task_commits(task_id, created_at DESC);

-- Anti-replay: cada delivery do GitHub é processada uma única vez
CREATE TABLE IF NOT EXISTS github_deliveries (
  delivery_id TEXT PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_github_deliveries_received ON github_deliveries(received_at);
