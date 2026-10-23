-- Bloco de notas + uso de IA (item 4.1)
CREATE TABLE IF NOT EXISTS notes (
  id VARCHAR(100) PRIMARY KEY,
  board_id VARCHAR(100) NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  member_id VARCHAR(100) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Sem título',
  content TEXT NOT NULL DEFAULT '',
  pinned BOOLEAN NOT NULL DEFAULT false,
  ai_generated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notes_board ON notes(board_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS ai_usage (
  id BIGSERIAL PRIMARY KEY,
  member_id VARCHAR(100) REFERENCES members(id) ON DELETE CASCADE,
  action VARCHAR(40) NOT NULL,
  input_chars INT,
  output_chars INT,
  status VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_member ON ai_usage(member_id, created_at);
