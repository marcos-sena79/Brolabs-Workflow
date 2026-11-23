import type { Board, Sprint, Task } from '../types';
import { getTodoColumnId, isTaskDone } from './agileHelpers';

export const BACKLOG_COLUMN_ID = 'col-backlog';

/** Sprint ativa do board (no máximo uma). */
export function getActiveSprint(sprints: Sprint[], boardId: string): Sprint | undefined {
  return sprints.find((s) => s.boardId === boardId && s.status === 'active');
}

/** Sprints do board ordenadas: ativa, planejadas (por início) e concluídas (mais recentes primeiro). */
export function sortBoardSprints(sprints: Sprint[], boardId: string): Sprint[] {
  const rank = { active: 0, planned: 1, completed: 2 } as const;
  return sprints
    .filter((s) => s.boardId === boardId)
    .sort((a, b) => {
      if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
      if (a.status === 'completed') {
        return String(b.completedAt || b.endDate).localeCompare(String(a.completedAt || a.endDate));
      }
      return (a.startDate || a.createdAt).localeCompare(b.startDate || b.createdAt);
    });
}

/**
 * Em qual sprint a tarefa está (null = backlog).
 * Tarefas antigas sem sprintId que já saíram da coluna Backlog contam na sprint ativa.
 */
export function getTaskSprintId(task: Pick<Task, 'sprintId' | 'statusId'>, activeSprintId?: string): string | null {
  if (task.sprintId) return task.sprintId;
  if (task.statusId !== BACKLOG_COLUMN_ID && activeSprintId) return activeSprintId;
  return null;
}

/**
 * Ajuste de sprint ao mudar a coluna de uma tarefa no quadro:
 * sair do Backlog puxa para a sprint ativa; voltar ao Backlog tira da sprint ativa.
 * Retorna undefined quando a sprint não muda.
 */
export function sprintIdForStatusChange(
  task: Pick<Task, 'sprintId' | 'statusId'>,
  targetStatusId: string,
  activeSprintId?: string
): string | null | undefined {
  const current = getTaskSprintId(task, activeSprintId);
  if (targetStatusId === BACKLOG_COLUMN_ID) {
    return current && current === activeSprintId ? null : undefined;
  }
  if (activeSprintId && current !== activeSprintId) return activeSprintId;
  return undefined;
}

/** Sprint padrão de uma tarefa nova criada numa coluna. */
export function sprintIdForNewTask(statusId: string, activeSprintId?: string): string | null {
  return statusId !== BACKLOG_COLUMN_ID && activeSprintId ? activeSprintId : null;
}

/** Nome sugerido para a próxima sprint ("Sprint 3" depois de "Sprint 2"). */
export function suggestNextSprintName(boardSprints: Sprint[]): string {
  const numbers = boardSprints
    .map((s) => s.name.match(/(\d+)\s*$/)?.[1] ?? s.name.match(/(\d+)/)?.[1])
    .filter((n): n is string => Boolean(n))
    .map((n) => parseInt(n, 10));
  const next = numbers.length > 0 ? Math.max(...numbers) + 1 : boardSprints.length + 1;
  return `Sprint ${next}`;
}

const DAY_MS = 86400000;
const toIsoDate = (d: Date) => d.toISOString().split('T')[0];

/** Datas sugeridas: começa no dia seguinte ao fim da última sprint (ou hoje) e dura 14 dias. */
export function suggestNextSprintDates(boardSprints: Sprint[], today = new Date()): { startDate: string; endDate: string } {
  const lastEnd = boardSprints
    .filter((s) => s.status !== 'completed' && /^\d{4}-\d{2}-\d{2}$/.test(s.endDate))
    .map((s) => s.endDate)
    .sort()
    .pop();
  const start = lastEnd ? new Date(new Date(`${lastEnd}T00:00:00Z`).getTime() + DAY_MS) : today;
  return { startDate: toIsoDate(start), endDate: toIsoDate(new Date(start.getTime() + 13 * DAY_MS)) };
}

export interface SprintValidationInput {
  name?: string;
  startDate?: string;
  endDate?: string;
}

/** Valida campos editáveis da sprint; retorna mensagem de erro ou null. */
export function validateSprintFields(input: SprintValidationInput): string | null {
  if (input.name !== undefined && !input.name.trim()) return 'Informe o nome da sprint.';
  if (input.startDate && input.endDate && input.endDate < input.startDate) {
    return 'A data de término deve ser igual ou posterior à data de início.';
  }
  return null;
}

/**
 * Plano de encerramento: tarefas concluídas ficam na sprint (histórico);
 * as demais vão para o destino (outra sprint ou backlog) na coluna Backlog.
 */
export function planSprintCompletion(
  board: Board,
  sprintTasks: Pick<Task, 'id' | 'statusId'>[]
): { doneIds: string[]; carryOverIds: string[] } {
  const doneIds: string[] = [];
  const carryOverIds: string[] = [];
  for (const t of sprintTasks) {
    (isTaskDone(board, t.statusId) ? doneIds : carryOverIds).push(t.id);
  }
  return { doneIds, carryOverIds };
}

/** Coluna para a qual as tarefas em Backlog vão ao iniciar a sprint. */
export function startSprintColumnId(board: Board): string {
  return getTodoColumnId(board);
}
