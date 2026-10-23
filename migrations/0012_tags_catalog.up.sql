-- Item 2.2 — Catálogo global de etiquetas (tasks.tags JSONB segue como vínculo)
CREATE TABLE IF NOT EXISTS tags (
  id VARCHAR(100) PRIMARY KEY,
  name VARCHAR(60) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#64748b',
  created_by VARCHAR(100) REFERENCES members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_lower ON tags (lower(name));

-- Backfill: catálogo com todas as tags existentes em tasks
INSERT INTO tags (id, name, color)
SELECT 'tag-' || md5(lower(t)), t, '#64748b'
FROM (
  SELECT DISTINCT jsonb_array_elements_text(tasks.tags) AS t
  FROM tasks
) s
WHERE t IS NOT NULL AND length(trim(t)) > 0 AND length(trim(t)) <= 60
ON CONFLICT DO NOTHING;
