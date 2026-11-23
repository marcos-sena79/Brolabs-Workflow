import { describe, expect, it } from 'vitest';
import type { Board, Sprint } from '../src/types';
import {
  getActiveSprint,
  getTaskSprintId,
  planSprintCompletion,
  sortBoardSprints,
  sprintIdForNewTask,
  sprintIdForStatusChange,
  suggestNextSprintDates,
  suggestNextSprintName,
  validateSprintFields,
} from '../src/utils/sprints';

const sprint = (over: Partial<Sprint>): Sprint => ({
  id: 's',
  boardId: 'b1',
  name: 'Sprint 1',
  goal: '',
  startDate: '',
  endDate: '',
  status: 'planned',
  createdAt: '2026-01-01T00:00:00.000Z',
  completedAt: null,
  ...over,
});

const board: Board = {
  id: 'b1',
  key: 'ENG',
  name: 'Eng',
  description: '',
  sprintName: '',
  sprintGoal: '',
  sprintStartDate: '',
  sprintEndDate: '',
  columns: [
    { id: 'col-backlog', title: 'Backlog', order: 0, accentColor: '' },
    { id: 'col-todo', title: 'A Fazer', order: 1, accentColor: '' },
    { id: 'col-done', title: 'Concluído', order: 2, accentColor: '', isDone: true },
  ],
  epics: [],
};

describe('getActiveSprint / sortBoardSprints', () => {
  const list = [
    sprint({ id: 'old', status: 'completed', completedAt: '2026-01-10T00:00:00.000Z' }),
    sprint({ id: 'newer', status: 'completed', completedAt: '2026-02-10T00:00:00.000Z' }),
    sprint({ id: 'p2', startDate: '2026-04-01' }),
    sprint({ id: 'p1', startDate: '2026-03-01' }),
    sprint({ id: 'act', status: 'active' }),
    sprint({ id: 'other', boardId: 'b2', status: 'active' }),
  ];

  it('acha a sprint ativa do board', () => {
    expect(getActiveSprint(list, 'b1')?.id).toBe('act');
    expect(getActiveSprint(list, 'b3')).toBeUndefined();
  });

  it('ordena ativa, planejadas por início e concluídas mais recentes primeiro', () => {
    expect(sortBoardSprints(list, 'b1').map((s) => s.id)).toEqual(['act', 'p1', 'p2', 'newer', 'old']);
  });
});

describe('getTaskSprintId', () => {
  it('usa o sprintId gravado', () => {
    expect(getTaskSprintId({ sprintId: 'p1', statusId: 'col-backlog' }, 'act')).toBe('p1');
  });
  it('tarefa legada fora do Backlog conta na sprint ativa', () => {
    expect(getTaskSprintId({ sprintId: null, statusId: 'col-todo' }, 'act')).toBe('act');
  });
  it('tarefa sem sprint na coluna Backlog fica no backlog', () => {
    expect(getTaskSprintId({ sprintId: null, statusId: 'col-backlog' }, 'act')).toBeNull();
    expect(getTaskSprintId({ statusId: 'col-todo' }, undefined)).toBeNull();
  });
});

describe('sprintIdForStatusChange', () => {
  it('sair do Backlog puxa para a sprint ativa', () => {
    expect(sprintIdForStatusChange({ sprintId: null, statusId: 'col-backlog' }, 'col-todo', 'act')).toBe('act');
    expect(sprintIdForStatusChange({ sprintId: 'p1', statusId: 'col-backlog' }, 'col-todo', 'act')).toBe('act');
  });
  it('voltar ao Backlog tira da sprint ativa', () => {
    expect(sprintIdForStatusChange({ sprintId: 'act', statusId: 'col-todo' }, 'col-backlog', 'act')).toBeNull();
  });
  it('não mexe em sprint planejada nem quando nada muda', () => {
    expect(sprintIdForStatusChange({ sprintId: 'p1', statusId: 'col-todo' }, 'col-backlog', 'act')).toBeUndefined();
    expect(sprintIdForStatusChange({ sprintId: 'act', statusId: 'col-todo' }, 'col-done', 'act')).toBeUndefined();
    expect(sprintIdForStatusChange({ sprintId: null, statusId: 'col-backlog' }, 'col-todo', undefined)).toBeUndefined();
  });
});

describe('sprintIdForNewTask', () => {
  it('nova tarefa fora do Backlog entra na sprint ativa', () => {
    expect(sprintIdForNewTask('col-todo', 'act')).toBe('act');
    expect(sprintIdForNewTask('col-backlog', 'act')).toBeNull();
    expect(sprintIdForNewTask('col-todo', undefined)).toBeNull();
  });
});

describe('sugestões para nova sprint', () => {
  it('incrementa o maior número no nome', () => {
    expect(suggestNextSprintName([sprint({ name: 'Sprint 24 - Core' }), sprint({ name: 'Sprint 3' })])).toBe('Sprint 25');
    expect(suggestNextSprintName([])).toBe('Sprint 1');
  });
  it('começa no dia seguinte ao fim da última sprint aberta e dura 14 dias', () => {
    expect(suggestNextSprintDates([sprint({ status: 'active', endDate: '2026-10-20' })])).toEqual({
      startDate: '2026-10-21',
      endDate: '2026-11-03',
    });
    expect(suggestNextSprintDates([], new Date('2026-11-23T12:00:00Z'))).toEqual({
      startDate: '2026-11-23',
      endDate: '2026-12-06',
    });
  });
});

describe('validateSprintFields', () => {
  it('exige nome e término após o início', () => {
    expect(validateSprintFields({ name: '  ' })).toMatch(/nome/);
    expect(validateSprintFields({ name: 'S', startDate: '2026-02-10', endDate: '2026-02-01' })).toMatch(/término/);
    expect(validateSprintFields({ name: 'S', startDate: '2026-02-10', endDate: '2026-02-10' })).toBeNull();
  });
});

describe('planSprintCompletion', () => {
  it('separa concluídas das pendentes', () => {
    const plan = planSprintCompletion(board, [
      { id: 'a', statusId: 'col-done' },
      { id: 'b', statusId: 'col-todo' },
      { id: 'c', statusId: 'col-backlog' },
    ]);
    expect(plan).toEqual({ doneIds: ['a'], carryOverIds: ['b', 'c'] });
  });
});
