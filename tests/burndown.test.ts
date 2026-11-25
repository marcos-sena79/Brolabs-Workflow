import { describe, expect, it } from 'vitest';
import type { Task } from '../src/types';
import { buildSprintBurndown, datedLoggedHours } from '../src/utils/burndown';

type T = Pick<Task, 'issueType' | 'estimatedHours' | 'loggedHours' | 'subtasks' | 'worklogs'>;

const wl = (date: string, hours: number, extra: Partial<Task['worklogs'][number]> = {}) => ({
  id: `wl-${date}-${hours}`,
  taskId: 't',
  memberId: 'm',
  hours,
  date,
  comment: '',
  createdAt: `${date}T10:00:00.000Z`,
  ...extra,
});

const sub = (id: string, est: number, logged: number) => ({
  id,
  taskId: 't',
  title: id,
  completed: logged > 0,
  estimatedHours: est,
  loggedHours: logged,
});

const task = (over: Partial<T>): T => ({
  issueType: 'task',
  estimatedHours: 0,
  loggedHours: 0,
  subtasks: [],
  worklogs: [],
  ...over,
});

const sprint = { startDate: '2026-11-02', endDate: '2026-11-06', status: 'active' as const, completedAt: null };

describe('datedLoggedHours', () => {
  it('usa a data do worklog manual e a da conclusão da sub-tarefa', () => {
    const t = task({
      loggedHours: 2,
      subtasks: [sub('s1', 4, 3)],
      worklogs: [wl('2026-11-03', 2), wl('2026-11-04', 3, { source: 'subtask', subtaskId: 's1' })],
    });
    expect(datedLoggedHours(t, '2026-11-06')).toEqual([
      { date: '2026-11-03', hours: 2 },
      { date: '2026-11-04', hours: 3 },
    ]);
  });

  it('horas sem worklog caem na data de fallback', () => {
    const t = task({ loggedHours: 5, worklogs: [wl('2026-11-03', 2)] });
    expect(datedLoggedHours(t, '2026-11-05')).toEqual([
      { date: '2026-11-03', hours: 2 },
      { date: '2026-11-05', hours: 3 },
    ]);
  });
});

describe('buildSprintBurndown', () => {
  it('sem data de início não há burndown', () => {
    expect(buildSprintBurndown({ ...sprint, startDate: '' }, [])).toBeNull();
  });

  it('ideal linear até zero e restante real até hoje', () => {
    const tasks = [
      task({ subtasks: [sub('a', 6, 0), sub('b', 4, 0)], loggedHours: 3, worklogs: [wl('2026-11-02', 1), wl('2026-11-04', 2)] }),
      task({ issueType: 'bug', estimatedHours: 2 }),
    ];
    const b = buildSprintBurndown(sprint, tasks, '2026-11-04')!;
    expect(b.totalEstimated).toBe(12);
    expect(b.totalLogged).toBe(3);
    expect(b.remaining).toBe(9);
    expect(b.lastActualDate).toBe('2026-11-04');
    expect(b.points.map((p) => p.ideal)).toEqual([12, 9, 6, 3, 0]);
    expect(b.points.map((p) => p.remaining)).toEqual([11, 11, 9, null, null]);
  });

  it('lançamentos fora do período contam no primeiro e no último dia', () => {
    const tasks = [task({ subtasks: [sub('a', 10, 0)], loggedHours: 5, worklogs: [wl('2026-10-30', 2), wl('2026-11-09', 3)] })];
    const b = buildSprintBurndown(sprint, tasks, '2026-11-20')!;
    expect(b.points[0].loggedOnDay).toBe(2);
    expect(b.points[4].loggedOnDay).toBe(3);
    expect(b.points[4].remaining).toBe(5);
  });

  it('sprint concluída para na data de conclusão; restante nunca fica negativo', () => {
    const tasks = [task({ subtasks: [sub('a', 2, 0)], loggedHours: 4, worklogs: [wl('2026-11-02', 4)] })];
    const b = buildSprintBurndown(
      { ...sprint, status: 'completed', completedAt: '2026-11-03T18:00:00.000Z' },
      tasks,
      '2026-11-20'
    )!;
    expect(b.lastActualDate).toBe('2026-11-03');
    expect(b.points.map((p) => p.remaining)).toEqual([0, 0, null, null, null]);
  });

  it('sem término usa 14 dias; antes do início não há pontos reais', () => {
    const b = buildSprintBurndown({ ...sprint, endDate: '' }, [], '2026-11-01')!;
    expect(b.points).toHaveLength(14);
    expect(b.lastActualDate).toBeNull();
    expect(b.points.every((p) => p.remaining === null)).toBe(true);
  });

  it('lançamento datado depois de hoje conta em hoje, e o total bate com o gráfico', () => {
    const tasks = [task({ subtasks: [sub('a', 10, 0)], loggedHours: 4, worklogs: [wl('2026-11-03', 1), wl('2026-11-05', 3)] })];
    const b = buildSprintBurndown(sprint, tasks, '2026-11-04')!;
    expect(b.points[2].loggedOnDay).toBe(3);
    expect(b.points[2].remaining).toBe(b.remaining);
    expect(b.remaining).toBe(6);
  });
});

describe('datas em horário local', () => {
  it('conclusão de sub-tarefa usa o dia local do createdAt, não o date em UTC', () => {
    const createdAt = new Date(2026, 10, 3, 23, 30).toISOString();
    const t = task({
      subtasks: [sub('s1', 4, 2)],
      worklogs: [wl('2026-11-04', 2, { source: 'subtask', subtaskId: 's1', createdAt })],
    });
    expect(datedLoggedHours(t, '2026-11-06')).toEqual([{ date: '2026-11-03', hours: 2 }]);
  });

  it('sprint concluída à noite para no dia local da conclusão', () => {
    const completedAt = new Date(2026, 10, 3, 23, 0).toISOString();
    const b = buildSprintBurndown({ ...sprint, status: 'completed', completedAt }, [], '2026-11-20')!;
    expect(b.lastActualDate).toBe('2026-11-03');
  });
});
