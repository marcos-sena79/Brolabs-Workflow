import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  canChangeTaskIssueType,
  canSetTaskParent,
  getAllowedChildType,
  getAllowedParentType,
} from '../src/utils/taskHierarchy';
import { IssueType } from '../src/types';

interface Node {
  id: string;
  boardId: string;
  issueType: IssueType;
  parentId?: string | null;
}

const node = (
  id: string,
  issueType: IssueType,
  parentId: string | null = null,
  boardId = 'board-1'
): Node => ({
  id,
  boardId,
  issueType,
  parentId,
});

describe('card hierarchy rules', () => {
  it('maps each card type to its permitted parent and child category', () => {
    expect(getAllowedParentType('story')).toBe('epic');
    expect(getAllowedParentType('task')).toBe('story');
    expect(getAllowedParentType('bug')).toBe('bug');
    expect(getAllowedParentType('epic')).toBeNull();
    expect(getAllowedChildType('epic')).toBe('story');
    expect(getAllowedChildType('story')).toBe('task');
    expect(getAllowedChildType('bug')).toBe('bug');
    expect(getAllowedChildType('task')).toBeNull();
  });

  it('allows only valid parent types on the same board', () => {
    const epic = node('epic', 'epic');
    const story = node('story', 'story');
    const task = node('task', 'task');
    expect(canSetTaskParent(story, epic, [epic, story])).toBe(true);
    expect(canSetTaskParent(task, story, [epic, story, task])).toBe(true);
    expect(canSetTaskParent(epic, story, [epic, story])).toBe(false);
    expect(canSetTaskParent(node('task-2', 'task', null, 'board-2'), story, [story])).toBe(false);
  });

  it('allows one bug child level and rejects deeper nesting and cycles', () => {
    const rootBug = node('bug-1', 'bug');
    const subBug = node('bug-2', 'bug', 'bug-1');
    const nestedBug = node('bug-3', 'bug');
    expect(canSetTaskParent(subBug, rootBug, [rootBug, subBug])).toBe(true);
    expect(canSetTaskParent(nestedBug, subBug, [rootBug, subBug, nestedBug])).toBe(false);
    expect(canSetTaskParent(rootBug, rootBug, [rootBug])).toBe(false);
    expect(canSetTaskParent(rootBug, subBug, [rootBug, subBug])).toBe(false);
  });

  it('blocks issue type changes that invalidate a parent or child', () => {
    const epic = node('epic', 'epic');
    const story = node('story', 'story', 'epic');
    const task = node('task', 'task', 'story');
    expect(canChangeTaskIssueType(story, 'task', [epic, story, task])).toBe(false);
    expect(canChangeTaskIssueType(task, 'bug', [epic, story, task])).toBe(false);
    const unparentedTask = node('task-2', 'task');
    expect(canChangeTaskIssueType(unparentedTask, 'bug', [unparentedTask])).toBe(true);
  });

  it('keeps task subtasks from being hidden by changing the card type', () => {
    const taskWithSubtasks = {
      ...node('task-3', 'task'),
      subtasks: [{ id: 'sub-1', taskId: 'task-3', title: 'Sub', completed: false, estimatedHours: 1, loggedHours: 0 }],
    };
    expect(canChangeTaskIssueType(taskWithSubtasks, 'bug', [taskWithSubtasks])).toBe(false);
  });
});

describe('migration 0019_task_hierarchy', () => {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const up = fs.readFileSync(path.join(migrationsDir, '0019_task_hierarchy.up.sql'), 'utf8');

  it('clears invalid parent links without deleting cards', () => {
    expect(up).toMatch(/UPDATE tasks AS child/i);
    expect(up).toMatch(/SET parent_id = NULL/i);
    expect(up).toMatch(/child\.board_id <> parent\.board_id/i);
    expect(up).toMatch(/child\.issue_type = 'bug'.*parent\.parent_id IS NULL/is);
    expect(up).not.toMatch(/DELETE FROM tasks/i);
  });
});
