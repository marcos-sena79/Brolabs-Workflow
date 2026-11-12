import { describe, expect, it } from 'vitest';
import { migratedTaskRelations, nextTaskKey } from '../src/server/taskMigration';

describe('nextTaskKey', () => {
  it('uses the destination prefix and the next available number', () => {
    expect(nextTaskKey('ENG', ['ENG-101', 'ENG-104', 'OTHER-300'])).toBe('ENG-105');
    expect(nextTaskKey('OPS', [])).toBe('OPS-101');
  });
});

describe('migratedTaskRelations', () => {
  const sourceBoard = { epics: [{ id: 'epic-source', name: ' Plataforma ' }] };
  const targetBoard = { epics: [{ id: 'epic-target', name: 'plataforma' }] };

  it('maps an epic by name and keeps a parent already on the destination board', () => {
    expect(
      migratedTaskRelations(
        { epicId: 'epic-source', parentId: 'parent-target' },
        sourceBoard,
        targetBoard,
        true
      )
    ).toEqual({ epicId: 'epic-target', parentId: 'parent-target' });
  });

  it('clears board-specific links without a destination equivalent', () => {
    expect(
      migratedTaskRelations(
        { epicId: 'epic-source', parentId: 'parent-source' },
        sourceBoard,
        { epics: [] },
        false
      )
    ).toEqual({ epicId: null, parentId: null });
  });
});
