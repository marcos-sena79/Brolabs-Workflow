import { IssueType, Task } from '../types';

export interface TaskHierarchyNode {
  id: string;
  boardId: string;
  issueType: string;
  parentId?: string | null;
}

const parentTypeByChild: Partial<Record<IssueType, IssueType>> = {
  story: 'epic',
  task: 'story',
  bug: 'bug',
};

const childTypeByParent: Partial<Record<IssueType, IssueType>> = {
  epic: 'story',
  story: 'task',
  bug: 'bug',
};

export const getAllowedParentType = (childType: IssueType): IssueType | null =>
  parentTypeByChild[childType] || null;

export const getAllowedChildType = (parentType: IssueType): IssueType | null =>
  childTypeByParent[parentType] || null;

export const isValidParentType = (childType: string, parentType: string): boolean =>
  (parentTypeByChild as Record<string, string | undefined>)[childType] === parentType;

export const canSetTaskParent = (
  child: TaskHierarchyNode,
  parent: TaskHierarchyNode,
  tasks: TaskHierarchyNode[]
): boolean => {
  if (child.id === parent.id || child.boardId !== parent.boardId) return false;
  if (!isValidParentType(child.issueType, parent.issueType)) return false;
  if (child.issueType === 'bug' && parent.parentId) return false;

  const visited = new Set<string>();
  let ancestor: TaskHierarchyNode | undefined = parent;
  while (ancestor) {
    if (ancestor.id === child.id || visited.has(ancestor.id)) return false;
    visited.add(ancestor.id);
    ancestor = ancestor.parentId ? tasks.find((task) => task.id === ancestor?.parentId) : undefined;
  }

  return true;
};

export const canChangeTaskIssueType = (
  task: Pick<Task, 'id' | 'boardId' | 'issueType' | 'parentId'> & { subtasks?: Task['subtasks'] },
  nextIssueType: IssueType,
  tasks: TaskHierarchyNode[]
): boolean => {
  if (task.issueType === nextIssueType) return true;
  if (task.issueType === 'task' && nextIssueType !== 'task' && task.subtasks?.length) return false;

  const updatedTask = { ...task, issueType: nextIssueType };
  const updatedTasks = tasks.map((candidate) =>
    candidate.id === task.id ? { ...candidate, ...updatedTask } : candidate
  );
  if (!updatedTasks.some((candidate) => candidate.id === task.id)) updatedTasks.push(updatedTask);

  const parent = updatedTask.parentId
    ? updatedTasks.find((candidate) => candidate.id === updatedTask.parentId)
    : undefined;
  if (updatedTask.parentId && (!parent || !canSetTaskParent(updatedTask, parent, updatedTasks))) return false;

  return updatedTasks
    .filter((candidate) => candidate.parentId === updatedTask.id)
    .every((child) => canSetTaskParent(child, updatedTask, updatedTasks));
};
