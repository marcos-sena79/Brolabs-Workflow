-- Estimativas próprias de Épico/História/Tarefa zeradas na migration UP não
-- podem ser recuperadas (foram descartadas por decisão de produto).
--
-- Restaura o comportamento anterior do Realizado: volta a somar em logged_hours
-- as horas dos worklogs automáticos de sub-tarefa e remove a marca "source".
WITH auto_logs AS (
  SELECT
    t.id,
    COALESCE(SUM((wl->>'hours')::float), 0) AS hours
  FROM tasks t
  CROSS JOIN LATERAL jsonb_array_elements(t.worklogs) AS wl
  WHERE wl->>'source' = 'subtask'
  GROUP BY t.id
)
UPDATE tasks t
SET
  logged_hours = ROUND((COALESCE(t.logged_hours, 0) + a.hours)::numeric, 1)::float,
  worklogs = (
    SELECT COALESCE(
      jsonb_agg(
        CASE WHEN wl->>'source' = 'subtask' THEN wl - 'source' - 'subtaskId' ELSE wl END
        ORDER BY ord
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(t.worklogs) WITH ORDINALITY AS e(wl, ord)
  )
FROM auto_logs a
WHERE a.id = t.id;
