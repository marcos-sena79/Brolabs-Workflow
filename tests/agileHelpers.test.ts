import { describe, expect, it } from 'vitest';
import { Task } from '../src/types';
import {
  getRollupHours,
  getTaskHours,
  getTaskHoursForMember,
  hasManualEstimate,
  isManualWorklog,
} from '../src/utils/agileHelpers';

const base = (over: Partial<Task>): Task => ({
  id: 'x',
  key: 'ENG-0',
  boardId: 'board-1',
  title: 'Item',
  description: '',
  issueType: 'task',
  priority: 'medium',
  statusId: 'col-todo',
  assigneeId: 'member-1',
  assigneeIds: ['member-1'],
  reporterId: 'member-1',
  estimatedHours: 0,
  loggedHours: 0,
  storyPoints: 0,
  dueDate: '',
  createdAt: '',
  updatedAt: '',
  subtasks: [],
  worklogs: [],
  comments: [],
  tags: [],
  ...over,
});

const task: Task = base({
  id: 'task-1',
  key: 'ENG-1',
  title: 'Tarefa',
  // estimativa própria legada: deve ser IGNORADA para tarefa
  estimatedHours: 5,
  // horas lançadas manualmente
  loggedHours: 2,
  subtasks: [
    {
      id: 'subtask-1',
      taskId: 'task-1',
      title: 'Concluída',
      completed: true,
      assigneeId: 'member-2',
      estimatedHours: 3,
      loggedHours: 2.5,
    },
    {
      id: 'subtask-2',
      taskId: 'task-1',
      title: 'Pendente',
      completed: false,
      assigneeIds: ['member-2', 'member-3'],
      estimatedHours: 4,
      loggedHours: 1,
    },
  ],
});

describe('estimativa calculada a partir das sub-tarefas', () => {
  it('só Bug aceita estimativa manual', () => {
    expect(hasManualEstimate('bug')).toBe(true);
    expect(hasManualEstimate('task')).toBe(false);
    expect(hasManualEstimate('story')).toBe(false);
    expect(hasManualEstimate('epic')).toBe(false);
  });

  it('tarefa: estimado = Σ sub-tarefas (ignora valor próprio); realizado = manual + sub-tarefas', () => {
    expect(getTaskHours(task)).toEqual({ estimatedHours: 7, loggedHours: 5.5 });
    expect(task.estimatedHours).toBe(5);
  });

  it('bug mantém a estimativa própria', () => {
    expect(getTaskHours({ ...task, issueType: 'bug' })).toEqual({ estimatedHours: 12, loggedHours: 5.5 });
  });

  it('atribui horas por membro sem a estimativa própria da tarefa', () => {
    expect(getTaskHoursForMember(task, 'member-1')).toEqual({ estimatedHours: 0, loggedHours: 2 });
    expect(getTaskHoursForMember(task, 'member-2')).toEqual({ estimatedHours: 7, loggedHours: 3.5 });
    expect(getTaskHoursForMember(task, 'member-3')).toEqual({ estimatedHours: 4, loggedHours: 1 });
    expect(getTaskHoursForMember(task, 'member-4')).toEqual({ estimatedHours: 0, loggedHours: 0 });
  });
});

describe('consolidação na hierarquia (Épico → História → Tarefa → Sub-tarefas)', () => {
  const epic = base({ id: 'epic-1', issueType: 'epic', estimatedHours: 40, loggedHours: 1 });
  const story = base({ id: 'story-1', issueType: 'story', parentId: 'epic-1', estimatedHours: 10, loggedHours: 0.5 });
  const task2 = base({
    id: 'task-2',
    parentId: 'story-1',
    subtasks: [{ id: 's3', taskId: 'task-2', title: 'S3', completed: false, estimatedHours: 2, loggedHours: 0 }],
  });
  const task1 = { ...task, parentId: 'story-1' };
  const other = base({ id: 'other', issueType: 'story', estimatedHours: 99, loggedHours: 99 });
  const all = [epic, story, task1, task2, other];

  it('tarefa soma só as próprias sub-tarefas', () => {
    const r = getRollupHours(task1, all);
    expect(r.estimatedHours).toBe(7);
    expect(r.loggedHours).toBe(5.5);
    expect(r.children.count).toBe(0);
  });

  it('história soma as tarefas filhas + horas manuais da própria história', () => {
    const r = getRollupHours(story, all);
    expect(r.estimatedHours).toBe(9); // 7 + 2 (estimativa própria 10 ignorada)
    expect(r.loggedHours).toBe(6); // 0.5 manual + 5.5 da tarefa 1
    expect(r.children).toEqual({ estimatedHours: 9, loggedHours: 5.5, count: 2 });
    expect(r.own).toEqual({ estimatedHours: 0, loggedHours: 0.5 });
  });

  it('épico soma toda a árvore + horas manuais do épico', () => {
    const r = getRollupHours(epic, all);
    expect(r.estimatedHours).toBe(9);
    expect(r.loggedHours).toBe(7);
  });

  it('não entra em loop com ciclo de parentId', () => {
    const a = base({ id: 'a', issueType: 'story', parentId: 'b', loggedHours: 1 });
    const b = base({ id: 'b', issueType: 'story', parentId: 'a', loggedHours: 1 });
    expect(getRollupHours(a, [a, b]).loggedHours).toBe(2);
  });
});

describe('worklogs', () => {
  it('registro automático de sub-tarefa não é manual', () => {
    expect(isManualWorklog({ source: 'subtask' })).toBe(false);
    expect(isManualWorklog({ source: 'manual' })).toBe(true);
    expect(isManualWorklog({})).toBe(true);
  });
});
