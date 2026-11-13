import { describe, expect, it } from 'vitest';
import { Task } from '../src/types';
import { getTaskHours, getTaskHoursForMember } from '../src/utils/agileHelpers';

const task: Task = {
  id: 'task-1',
  key: 'ENG-1',
  boardId: 'board-1',
  title: 'Tarefa',
  description: '',
  issueType: 'task',
  priority: 'medium',
  statusId: 'col-todo',
  assigneeId: 'member-1',
  assigneeIds: ['member-1'],
  reporterId: 'member-1',
  estimatedHours: 5,
  loggedHours: 2,
  storyPoints: 0,
  dueDate: '',
  createdAt: '',
  updatedAt: '',
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
  worklogs: [],
  comments: [],
  tags: [],
};

describe('task hour rollups', () => {
  it('sums the task and every subtask without changing their completion status', () => {
    expect(getTaskHours(task)).toEqual({ estimatedHours: 12, loggedHours: 5.5 });
    expect(task.estimatedHours).toBe(5);
    expect(task.loggedHours).toBe(2);
  });

  it('attributes task hours to task assignees and subtask hours to subtask assignees', () => {
    expect(getTaskHoursForMember(task, 'member-1')).toEqual({ estimatedHours: 5, loggedHours: 2 });
    expect(getTaskHoursForMember(task, 'member-2')).toEqual({ estimatedHours: 7, loggedHours: 3.5 });
    expect(getTaskHoursForMember(task, 'member-3')).toEqual({ estimatedHours: 4, loggedHours: 1 });
    expect(getTaskHoursForMember(task, 'member-4')).toEqual({ estimatedHours: 0, loggedHours: 0 });
  });
});
