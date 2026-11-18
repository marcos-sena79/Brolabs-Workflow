-- Estimado x Realizado passa a ser calculado a partir das sub-tarefas.
--
-- 1) Épico, História e Tarefa não têm mais estimativa própria: a estimativa é a
--    soma das sub-tarefas (e dos cards filhos). Decisão: descartar os valores
--    digitados anteriormente. Bug continua com estimativa manual.
UPDATE tasks
SET estimated_hours = 0
WHERE issue_type IN ('epic', 'story', 'task')
  AND COALESCE(estimated_hours, 0) <> 0;

-- 2) Corrige o Realizado duplicado: ao concluir uma sub-tarefa, as horas eram
--    gravadas em subtask.loggedHours E somadas em tasks.logged_hours (via um
--    worklog automático "Sub-tarefa concluída: ..."). Subtrai essas horas de
--    logged_hours e marca os worklogs automáticos com "source": "subtask", que
--    passam a ser apenas histórico.
WITH auto_logs AS (
  SELECT
    t.id,
    COALESCE(SUM((wl->>'hours')::float), 0) AS hours
  FROM tasks t
  CROSS JOIN LATERAL jsonb_array_elements(t.worklogs) AS wl
  WHERE wl->>'comment' LIKE 'Sub-tarefa concluída:%'
    AND COALESCE(wl->>'source', '') <> 'subtask'
  GROUP BY t.id
)
UPDATE tasks t
SET
  logged_hours = GREATEST(0, ROUND((COALESCE(t.logged_hours, 0) - a.hours)::numeric, 1)::float),
  worklogs = (
    SELECT COALESCE(
      jsonb_agg(
        CASE
          WHEN wl->>'comment' LIKE 'Sub-tarefa concluída:%'
            THEN wl || '{"source": "subtask"}'::jsonb
          ELSE wl
        END
        ORDER BY ord
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements(t.worklogs) WITH ORDINALITY AS e(wl, ord)
  )
FROM auto_logs a
WHERE a.id = t.id;
