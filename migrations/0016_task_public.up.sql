-- 0016_task_public (Onda 2, item 3): link público por tarefa + comentários de visitante
CREATE TABLE IF NOT EXISTS task_public_links (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_task_public_links_task_id ON task_public_links(task_id);
CREATE INDEX IF NOT EXISTS idx_task_public_links_token ON task_public_links(token);

CREATE TABLE IF NOT EXISTS task_public_comments (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES task_public_links(id) ON DELETE CASCADE,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  visitor_name TEXT NOT NULL,
  body TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  removed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_task_public_comments_task_id ON task_public_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_public_comments_rate ON task_public_comments(ip_hash, created_at);
