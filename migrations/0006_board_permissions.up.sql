-- Permissões de acesso por board (item 5.1).
ALTER TABLE members ADD COLUMN IF NOT EXISTS system_role VARCHAR(20) NOT NULL DEFAULT 'member';

CREATE TABLE IF NOT EXISTS board_members (
  board_id VARCHAR(100) NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  member_id VARCHAR(100) NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'editor',
  permissions JSONB NOT NULL DEFAULT '{}',
  invited_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, member_id)
);
CREATE INDEX IF NOT EXISTS idx_board_members_member ON board_members(member_id);

-- Backfill não-quebrador: todos os membros atuais viram editor (mesmo acesso de antes).
-- O membro mais antigo vira owner de todos os quadros existentes.
INSERT INTO board_members (board_id, member_id, role, permissions)
SELECT b.id, m.id,
       CASE WHEN m.id = (SELECT id FROM members ORDER BY created_at, id LIMIT 1)
            THEN 'owner' ELSE 'editor' END,
       '{}'::jsonb
FROM boards b CROSS JOIN members m
ON CONFLICT DO NOTHING;
