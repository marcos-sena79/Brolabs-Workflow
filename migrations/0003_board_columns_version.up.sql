-- Lock otimista para edição de colunas do board (item 1.1).
ALTER TABLE boards ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
