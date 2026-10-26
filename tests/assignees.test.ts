import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  normalizeAssigneeIds,
  taskAssigneeIds,
  primaryAssigneeId,
  taskHasAssignee,
} from '../src/utils/taskAssignees';
import { taskCreateSchema, taskUpdateSchema } from '../src/server/validation';

describe('normalizeAssigneeIds (Item 1 — Onda 2)', () => {
  it('deduplica, remove vazios e não-strings preservando a ordem', () => {
    expect(normalizeAssigneeIds(['mem-2', 'mem-1', 'mem-2', '', '  ', 42 as unknown as string, 'mem-3'])).toEqual([
      'mem-2',
      'mem-1',
      'mem-3',
    ]);
  });

  it('usa o fallback quando o input não é array', () => {
    expect(normalizeAssigneeIds(undefined, ['mem-9'])).toEqual(['mem-9']);
    expect(normalizeAssigneeIds('mem-1', ['mem-9'])).toEqual(['mem-9']);
    expect(normalizeAssigneeIds(null)).toEqual([]);
  });

  it('aceita array vazio como lista vazia (não cai no fallback)', () => {
    expect(normalizeAssigneeIds([], ['mem-9'])).toEqual([]);
  });

  it('remove espaços nas pontas dos ids', () => {
    expect(normalizeAssigneeIds([' mem-1 ', 'mem-1'])).toEqual(['mem-1']);
  });
});

describe('taskAssigneeIds / primaryAssigneeId / taskHasAssignee', () => {
  it('prefere a lista; cai para assigneeId legada', () => {
    expect(taskAssigneeIds({ assigneeId: 'mem-1', assigneeIds: ['mem-2', 'mem-3'] })).toEqual(['mem-2', 'mem-3']);
    expect(taskAssigneeIds({ assigneeId: 'mem-1' })).toEqual(['mem-1']);
    expect(taskAssigneeIds({ assigneeId: '', assigneeIds: [] })).toEqual([]);
    expect(taskAssigneeIds(null)).toEqual([]);
  });

  it('primary é o primeiro da lista (ou a legada)', () => {
    expect(primaryAssigneeId({ assigneeId: 'mem-9', assigneeIds: ['mem-2', 'mem-3'] })).toBe('mem-2');
    expect(primaryAssigneeId({ assigneeId: 'mem-9' })).toBe('mem-9');
    expect(primaryAssigneeId({ assigneeIds: [] })).toBe('');
  });

  it('taskHasAssignee casa com qualquer um dos N (filtro "minhas tarefas")', () => {
    const task = { assigneeId: 'mem-1', assigneeIds: ['mem-1', 'mem-2'] };
    expect(taskHasAssignee(task, 'mem-2')).toBe(true);
    expect(taskHasAssignee(task, 'mem-3')).toBe(false);
    expect(taskHasAssignee(task, null)).toBe(false);
    expect(taskHasAssignee(task, undefined)).toBe(false);
  });
});

describe('schemas de task com assigneeIds (validação)', () => {
  const baseCreate = {
    id: 'task-1',
    key: 'ENG-1',
    boardId: 'board-1',
    title: 'Tarefa',
    issueType: 'task',
    priority: 'medium',
    statusId: 'col-backlog',
  };

  it('taskCreateSchema aceita lista de responsáveis', () => {
    const parsed = taskCreateSchema.parse({ ...baseCreate, assigneeIds: ['mem-1', 'mem-2'] });
    expect(parsed.assigneeIds).toEqual(['mem-1', 'mem-2']);
  });

  it('taskCreateSchema rejeita assigneeIds que não é array', () => {
    expect(() => taskCreateSchema.parse({ ...baseCreate, assigneeIds: 'mem-1' })).toThrow();
  });

  it('taskUpdateSchema aceita lista vazia e opcional', () => {
    expect(taskUpdateSchema.parse({ title: 'Novo', assigneeIds: [] }).assigneeIds).toEqual([]);
    expect(taskUpdateSchema.parse({ title: 'Novo' }).assigneeIds).toBeUndefined();
  });

  it('taskUpdateSchema rejeita id vazio na lista', () => {
    expect(() => taskUpdateSchema.parse({ title: 'Novo', assigneeIds: [''] })).toThrow();
  });
});

describe('migração 0013_task_multi_assignee (up e down)', () => {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const up = fs.readFileSync(path.join(migrationsDir, '0013_task_multi_assignee.up.sql'), 'utf8');
  const down = fs.readFileSync(path.join(migrationsDir, '0013_task_multi_assignee.down.sql'), 'utf8');

  it('up: cria a coluna JSONB assignee_ids', () => {
    expect(up).toMatch(/ALTER TABLE tasks ADD COLUMN IF NOT EXISTS assignee_ids JSONB/i);
  });

  it('up: backfill preserva o responsável atual (1º)', () => {
    expect(up).toMatch(/UPDATE tasks/i);
    expect(up).toMatch(/to_jsonb\(ARRAY\[assignee_id\]\)/i);
    expect(up).toMatch(/assignee_id IS NULL OR assignee_id = ''/i);
  });

  it('up: índice GIN para buscas por responsável', () => {
    expect(up).toMatch(/USING GIN \(assignee_ids\)/i);
  });

  it('down: remove apenas a coluna e o índice (assignee_id permanece)', () => {
    expect(down).toMatch(/DROP COLUMN IF EXISTS assignee_ids/i);
    expect(down).toMatch(/DROP INDEX IF EXISTS idx_tasks_assignee_ids/i);
    expect(down).not.toMatch(/DROP COLUMN IF EXISTS assignee_id(?!s)/i);
  });
});
