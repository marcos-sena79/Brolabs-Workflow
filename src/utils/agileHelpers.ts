import { Board, IssueType, Priority, Task, WorkLog } from '../types';

/** Worklog de horas lançadas manualmente (não o registro automático de sub-tarefa concluída). */
export const isManualWorklog = (wl: Pick<WorkLog, 'source'>): boolean => wl.source !== 'subtask';
import { taskHasAssignee } from './taskAssignees';

export interface TaskHours {
  estimatedHours: number;
  loggedHours: number;
}

/**
 * Só Bug aceita estimativa digitada. Épico, História e Tarefa têm a estimativa
 * calculada exclusivamente a partir das sub-tarefas (e dos cards filhos).
 */
export const hasManualEstimate = (issueType: IssueType | string | undefined): boolean => issueType === 'bug';

/** Estimativa própria válida do card (0 para tipos calculados). */
export const getOwnEstimate = (task: Pick<Task, 'issueType' | 'estimatedHours'>): number =>
  hasManualEstimate(task.issueType) ? task.estimatedHours || 0 : 0;

type HoursInput = Pick<Task, 'issueType' | 'estimatedHours' | 'loggedHours' | 'subtasks'>;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Horas do card no seu próprio nível (sem somar cards filhos):
 * - Estimado = Σ sub-tarefas (+ estimativa própria, só para Bug)
 * - Realizado = horas lançadas manualmente no card + Σ realizado das sub-tarefas
 * Use para totais de quadro/relatórios, onde cada card já entra na soma.
 */
export const getTaskHours = (task: HoursInput): TaskHours => {
  return (task.subtasks || []).reduce(
    (hours, subtask) => ({
      estimatedHours: round1(hours.estimatedHours + (subtask.estimatedHours || 0)),
      loggedHours: round1(hours.loggedHours + (subtask.loggedHours || 0)),
    }),
    {
      estimatedHours: getOwnEstimate(task),
      loggedHours: task.loggedHours || 0,
    }
  );
};

export const getTaskHoursForMember = (task: Task, memberId: string): TaskHours => {
  const memberOwnsTask = taskHasAssignee(task, memberId);
  return (task.subtasks || []).reduce(
    (hours, subtask) => {
      if (!taskHasAssignee(subtask, memberId)) return hours;
      return {
        estimatedHours: round1(hours.estimatedHours + (subtask.estimatedHours || 0)),
        loggedHours: round1(hours.loggedHours + (subtask.loggedHours || 0)),
      };
    },
    {
      estimatedHours: memberOwnsTask ? getOwnEstimate(task) : 0,
      loggedHours: memberOwnsTask ? task.loggedHours || 0 : 0,
    }
  );
};

export interface RollupHours extends TaskHours {
  /** Estimativa própria (só Bug) e horas lançadas manualmente no próprio card. */
  own: TaskHours;
  /** Soma das sub-tarefas do próprio card. */
  subtasks: TaskHours;
  /** Soma dos cards filhos (História → Tarefas, Épico → Histórias…), já consolidados. */
  children: TaskHours & { count: number };
}

type RollupInput = HoursInput & Pick<Task, 'id' | 'parentId'>;

/**
 * Horas consolidadas na hierarquia: o card + suas sub-tarefas + todos os
 * descendentes (via parentId). Use para exibir Épico/História/Tarefa.
 */
export const getRollupHours = (task: RollupInput, allTasks: RollupInput[]): RollupHours => {
  const childrenOf = new Map<string, RollupInput[]>();
  for (const t of allTasks) {
    if (!t.parentId) continue;
    const list = childrenOf.get(t.parentId) || [];
    list.push(t);
    childrenOf.set(t.parentId, list);
  }

  const visited = new Set<string>();
  const walk = (node: RollupInput): TaskHours => {
    if (visited.has(node.id)) return { estimatedHours: 0, loggedHours: 0 };
    visited.add(node.id);
    const own = getTaskHours(node);
    return (childrenOf.get(node.id) || []).reduce((acc, child) => {
      const h = walk(child);
      return {
        estimatedHours: round1(acc.estimatedHours + h.estimatedHours),
        loggedHours: round1(acc.loggedHours + h.loggedHours),
      };
    }, own);
  };

  visited.add(task.id);
  const directChildren = (childrenOf.get(task.id) || []).filter((c) => c.id !== task.id);
  const children = directChildren.reduce(
    (acc, child) => {
      const h = walk(child);
      return {
        estimatedHours: round1(acc.estimatedHours + h.estimatedHours),
        loggedHours: round1(acc.loggedHours + h.loggedHours),
        count: acc.count,
      };
    },
    { estimatedHours: 0, loggedHours: 0, count: directChildren.length }
  );

  const subtasks = (task.subtasks || []).reduce(
    (acc, s) => ({
      estimatedHours: round1(acc.estimatedHours + (s.estimatedHours || 0)),
      loggedHours: round1(acc.loggedHours + (s.loggedHours || 0)),
    }),
    { estimatedHours: 0, loggedHours: 0 }
  );
  const own = { estimatedHours: getOwnEstimate(task), loggedHours: task.loggedHours || 0 };

  return {
    estimatedHours: round1(own.estimatedHours + subtasks.estimatedHours + children.estimatedHours),
    loggedHours: round1(own.loggedHours + subtasks.loggedHours + children.loggedHours),
    own,
    subtasks,
    children,
  };
};

/**
 * Ids dos cards raiz + todos os descendentes (via parentId), sem repetição.
 * Útil para somar `getTaskHours` (nível próprio) de uma árvore sem contar em dobro.
 */
export const collectSubtreeIds = (rootIds: string[], allTasks: Pick<Task, 'id' | 'parentId'>[]): Set<string> => {
  const ids = new Set<string>();
  const queue = [...rootIds];
  while (queue.length) {
    const id = queue.shift()!;
    if (ids.has(id)) continue;
    ids.add(id);
    for (const t of allTasks) if (t.parentId === id && !ids.has(t.id)) queue.push(t.id);
  }
  return ids;
};

/** Id da coluna de conclusão do quadro (fallback 'col-done' para dados legados). */
export const getDoneColumnId = (board: Board): string =>
  board.columns.find((c) => c.isDone)?.id ?? 'col-done';

/** Verifica se um statusId representa "concluído" no quadro dado. */
export const isTaskDone = (board: Board, statusId: string): boolean => {
  if (statusId === getDoneColumnId(board)) return true;
  const col = board.columns.find((c) => c.id === statusId);
  return col?.title.toLowerCase().includes('concluíd') ?? false;
};

/** Id da coluna padrão de "A Fazer" (segunda coluna, fallback 'col-todo'). */
export const getTodoColumnId = (board: Board): string =>
  board.columns[1]?.id ?? board.columns[0]?.id ?? 'col-todo';

export const formatHours = (hours: number): string => {
  if (hours === 0) return '0h';
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
};

export const getPriorityLabel = (priority: Priority): string => {
  switch (priority) {
    case 'urgent':
      return 'Urgente';
    case 'high':
      return 'Alta';
    case 'medium':
      return 'Média';
    case 'low':
      return 'Baixa';
    case 'lowest':
      return 'Muito Baixa';
  }
};

export const getPriorityColor = (priority: Priority): { bg: string; text: string; border: string } => {
  switch (priority) {
    case 'urgent':
      return { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-300 dark:border-rose-800' };
    case 'high':
      return { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-800' };
    case 'medium':
      return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-800' };
    case 'low':
      return { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-800' };
    case 'lowest':
      return { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-300 dark:border-slate-800' };
  }
};

export const getIssueTypeLabel = (type: IssueType): string => {
  switch (type) {
    case 'story':
      return 'História';
    case 'task':
      return 'Tarefa';
    case 'bug':
      return 'Bug';
    case 'epic':
      return 'Épico';
  }
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
};

export const formatRelativeTime = (isoString: string): string => {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Agora mesmo';
    if (diffMin < 60) return `Há ${diffMin} min`;
    if (diffHour < 24) return `Há ${diffHour}h`;
    if (diffDay === 1) return 'Ontem';
    return `Há ${diffDay} dias`;
  } catch {
    return 'Recentemente';
  }
};

export const isOverdue = (dueDate: string, isDone: boolean): boolean => {
  if (isDone || !dueDate) return false;
  const today = new Date().toISOString().split('T')[0];
  return dueDate < today;
};
