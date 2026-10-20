-- Preferências por membro (tema, som). Item 3.3/5.4 da Onda 1.
ALTER TABLE members ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
