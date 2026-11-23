-- Sprints como entidade própria: um board passa a ter várias sprints
-- (planejadas, uma ativa e concluídas). Os campos boards.sprint_* continuam
-- existindo e espelham a sprint ativa, para compatibilidade com telas antigas.

CREATE TABLE IF NOT EXISTS sprints (
  id VARCHAR(100) PRIMARY KEY,
  board_id VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  goal TEXT NOT NULL DEFAULT '',
  start_date VARCHAR(50) NOT NULL DEFAULT '',
  end_date VARCHAR(50) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'active', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sprints_board_id ON sprints (board_id);

-- No máximo uma sprint ativa por board
CREATE UNIQUE INDEX IF NOT EXISTS uq_sprints_one_active_per_board
  ON sprints (board_id) WHERE status = 'active';

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS sprint_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint_id ON tasks (sprint_id);

-- A sprint única que cada board tinha vira a sprint ativa
INSERT INTO sprints (id, board_id, name, goal, start_date, end_date, status)
SELECT
  'sprint-' || b.id,
  b.id,
  COALESCE(NULLIF(TRIM(b.sprint_name), ''), 'Sprint 1'),
  COALESCE(b.sprint_goal, ''),
  COALESCE(b.sprint_start_date, ''),
  COALESCE(b.sprint_end_date, ''),
  'active'
FROM boards b
WHERE NOT EXISTS (SELECT 1 FROM sprints s WHERE s.board_id = b.id);

-- Antes, "estar na sprint" era "não estar na coluna Backlog"
UPDATE tasks t
SET sprint_id = s.id
FROM sprints s
WHERE s.board_id = t.board_id
  AND s.status = 'active'
  AND t.sprint_id IS NULL
  AND t.status_id <> 'col-backlog';
