-- Baseline: rollback é no-op proposital.
-- As tabelas do baseline podem conter dados de produção; nunca são dropadas por migration.
-- Rollbacks reais começam na 0002.
SELECT 1;
