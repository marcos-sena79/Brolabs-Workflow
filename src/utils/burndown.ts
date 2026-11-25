import type { Sprint, Task } from '../types';
import { getTaskHours, isManualWorklog } from './agileHelpers';

export interface BurndownPoint {
  /** Dia (AAAA-MM-DD) */
  date: string;
  /** Horas restantes pela queima ideal (linear até zero no último dia) */
  ideal: number;
  /** Horas restantes reais ao fim do dia; null para dias ainda não decorridos */
  remaining: number | null;
  /** Horas realizadas lançadas no dia */
  loggedOnDay: number;
}

export interface SprintBurndown {
  points: BurndownPoint[];
  totalEstimated: number;
  totalLogged: number;
  remaining: number;
  /** Último dia com dado real (hoje, término ou conclusão) — null se a sprint ainda não começou */
  lastActualDate: string | null;
}

const DAY_MS = 86400000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const round1 = (n: number) => Math.round(n * 10) / 10;
const toDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
const toIso = (d: Date) => d.toISOString().split('T')[0];
const dayOf = (value: string | null | undefined) => (value ? String(value).slice(0, 10) : '');
const pad2 = (n: number) => String(n).padStart(2, '0');
/** Dia local de um timestamp ISO (evita que ações após 21h em UTC-3 caiam no dia seguinte). */
const localDayOf = (value: string | null | undefined) => {
  if (!value) return '';
  const raw = String(value);
  if (raw.length <= 10) return raw.slice(0, 10);
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.slice(0, 10);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
};

/** Duração padrão quando a sprint não tem data de término. */
export const DEFAULT_SPRINT_DAYS = 14;

type BurndownTask = Pick<Task, 'issueType' | 'estimatedHours' | 'loggedHours' | 'subtasks' | 'worklogs'>;

/**
 * Horas realizadas de um card distribuídas por dia:
 * worklogs manuais pela data lançada; sub-tarefas pela data do registro de conclusão.
 * O que não tiver data cai em `fallbackDate`.
 */
export function datedLoggedHours(task: BurndownTask, fallbackDate: string): Array<{ date: string; hours: number }> {
  const entries: Array<{ date: string; hours: number }> = [];
  const worklogs = task.worklogs || [];

  for (const wl of worklogs) {
    if (isManualWorklog(wl) && wl.hours > 0) {
      entries.push({ date: dayOf(wl.date) || dayOf(wl.createdAt) || fallbackDate, hours: wl.hours });
    }
  }
  for (const st of task.subtasks || []) {
    if (!(st.loggedHours > 0)) continue;
    const completion = worklogs.filter((wl) => wl.source === 'subtask' && wl.subtaskId === st.id).pop();
    // O registro automático grava `date` em UTC; o createdAt convertido para o dia local é mais fiel
    entries.push({ date: localDayOf(completion?.createdAt) || dayOf(completion?.date) || fallbackDate, hours: st.loggedHours });
  }

  // Horas do Realizado sem worklog correspondente (dados legados)
  const total = getTaskHours(task).loggedHours;
  const dated = entries.reduce((acc, e) => acc + e.hours, 0);
  if (total - dated > 0.05) entries.push({ date: fallbackDate, hours: round1(total - dated) });
  return entries;
}

/**
 * Burndown em horas: restante = estimado da sprint − realizado acumulado até o dia.
 * O escopo é o estimado atual das tarefas da sprint (não há histórico de escopo).
 * Retorna null se a sprint não tem data de início.
 */
export function buildSprintBurndown(
  sprint: Pick<Sprint, 'startDate' | 'endDate' | 'status' | 'completedAt'>,
  sprintTasks: BurndownTask[],
  today: string = toIso(new Date())
): SprintBurndown | null {
  if (!DATE_RE.test(sprint.startDate)) return null;
  const start = sprint.startDate;
  const end =
    DATE_RE.test(sprint.endDate) && sprint.endDate >= start
      ? sprint.endDate
      : toIso(new Date(toDate(start).getTime() + (DEFAULT_SPRINT_DAYS - 1) * DAY_MS));

  const days: string[] = [];
  for (let t = toDate(start).getTime(); t <= toDate(end).getTime(); t += DAY_MS) days.push(toIso(new Date(t)));

  const cutoff = sprint.status === 'completed' && sprint.completedAt ? localDayOf(sprint.completedAt) : today;
  const lastActualDate = cutoff < start ? null : cutoff > end ? end : cutoff;
  const fallbackDate = lastActualDate || start;

  const totalEstimated = round1(sprintTasks.reduce((acc, t) => acc + getTaskHours(t).estimatedHours, 0));

  // Realizado por dia; antes do início conta no 1º dia, depois do último dia com dado real
  // conta nele (assim o total dos cards bate com o último ponto do gráfico)
  const upperDay = lastActualDate || end;
  const loggedByDay = new Map<string, number>();
  let totalLogged = 0;
  for (const task of sprintTasks) {
    for (const { date, hours } of datedLoggedHours(task, fallbackDate)) {
      const day = date < start ? start : date > upperDay ? upperDay : date;
      loggedByDay.set(day, (loggedByDay.get(day) || 0) + hours);
      totalLogged += hours;
    }
  }

  let cumulative = 0;
  const lastIndex = Math.max(1, days.length - 1);
  const points: BurndownPoint[] = days.map((date, i) => {
    const loggedOnDay = round1(loggedByDay.get(date) || 0);
    cumulative += loggedOnDay;
    const isPast = lastActualDate !== null && date <= lastActualDate;
    return {
      date,
      ideal: round1(totalEstimated * (1 - i / lastIndex)),
      remaining: isPast ? round1(Math.max(0, totalEstimated - cumulative)) : null,
      loggedOnDay,
    };
  });

  totalLogged = round1(totalLogged);
  return {
    points,
    totalEstimated,
    totalLogged,
    remaining: round1(Math.max(0, totalEstimated - totalLogged)),
    lastActualDate,
  };
}
