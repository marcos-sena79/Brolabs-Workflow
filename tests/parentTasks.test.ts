import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  taskCreateSchema,
  taskUpdateSchema,
  boardUpdateSchema,
} from '../src/server/validation';

const baseCreate = {
  id: 'task-1',
  key: 'ENG-1',
  boardId: 'board-1',
  title: 'Tarefa',
  issueType: 'task',
  priority: 'medium',
  statusId: 'col-backlog',
};

describe('parentId — História pai (Onda 2, 2A)', () => {
  it('taskCreateSchema aceita parentId', () => {
    const parsed = taskCreateSchema.parse({ ...baseCreate, parentId: 'task-story-9' });
    expect(parsed.parentId).toBe('task-story-9');
  });

  it('taskCreateSchema rejeita parentId vazio', () => {
    expect(() => taskCreateSchema.parse({ ...baseCreate, parentId: '' })).toThrow();
  });

  it('taskUpdateSchema aceita string (vincular)', () => {
    expect(taskUpdateSchema.parse({ parentId: 'task-story-1' }).parentId).toBe('task-story-1');
  });

  it('taskUpdateSchema aceita null (limpar vínculo)', () => {
    expect(taskUpdateSchema.parse({ parentId: null }).parentId).toBeNull();
  });

  it('taskUpdateSchema rejeita parentId não-string', () => {
    expect(() => taskUpdateSchema.parse({ parentId: 42 })).toThrow();
  });

  it('taskUpdateSchema sem parentId continua válido (delta parcial)', () => {
    expect(taskUpdateSchema.parse({ title: 'Novo' }).parentId).toBeUndefined();
  });
});

describe('migração 0014_task_parent (up e down)', () => {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const up = fs.readFileSync(path.join(migrationsDir, '0014_task_parent.up.sql'), 'utf8');
  const down = fs.readFileSync(path.join(migrationsDir, '0014_task_parent.down.sql'), 'utf8');

  it('up: cria a coluna parent_id', () => {
    expect(up).toMatch(/ALTER TABLE tasks ADD COLUMN IF NOT EXISTS parent_id VARCHAR\(100\)/i);
  });

  it('up: índice em parent_id', () => {
    expect(up).toMatch(/CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks \(parent_id\)/i);
  });

  it('down: remove índice e coluna, sem tocar em outras colunas', () => {
    expect(down).toMatch(/DROP INDEX IF EXISTS idx_tasks_parent_id/i);
    expect(down).toMatch(/DROP COLUMN IF EXISTS parent_id/i);
    expect(down).not.toMatch(/DROP COLUMN IF EXISTS (assignee|epic|status)/i);
  });
});

describe('epicSchema preserva key/description (regressão do catálogo)', () => {
  it('boardUpdateSchema mantém key e description dos épicos', () => {
    const parsed = boardUpdateSchema.parse({
      epics: [
        { id: 'epic-9', key: 'EP-9', name: 'Autenticação', color: '#6366f1', description: 'MFA' },
      ],
    });
    expect(parsed.epics?.[0]?.key).toBe('EP-9');
    expect(parsed.epics?.[0]?.description).toBe('MFA');
    expect(parsed.epics?.[0]?.name).toBe('Autenticação');
  });

  it('boardUpdateSchema rejeita épico sem nome', () => {
    expect(() => boardUpdateSchema.parse({ epics: [{ id: 'epic-9', key: 'EP-9' }] })).toThrow();
  });

  it('boardUpdateSchema aceita descrição longa de épico (regressão do 400 no PUT do board)', () => {
    const long = 'x'.repeat(2000);
    const parsed = boardUpdateSchema.parse({
      epics: [{ id: 'epic-long', key: 'EP-L', name: 'Épico longo', description: long }],
    });
    expect(parsed.epics?.[0]?.description?.length).toBe(2000);
  });
});
