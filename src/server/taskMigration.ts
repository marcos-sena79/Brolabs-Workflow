import type { Epic, Task } from '../types';

type BoardLinks = { epics: Array<Pick<Epic, 'id' | 'name'>> };

export function nextTaskKey(boardKey: string, existingTaskKeys: string[]): string {
  const prefix = boardKey || 'TSK';
  const existingKeys = new Set(existingTaskKeys);
  const highestNumber = existingTaskKeys.reduce((highest, taskKey) => {
    if (!taskKey.startsWith(`${prefix}-`)) return highest;
    const suffix = taskKey.slice(prefix.length + 1);
    if (!/^\d+$/.test(suffix)) return highest;
    return Math.max(highest, Number(suffix));
  }, 100);

  let nextNumber = highestNumber + 1;
  let key = `${prefix}-${nextNumber}`;
  while (existingKeys.has(key)) {
    nextNumber += 1;
    key = `${prefix}-${nextNumber}`;
  }
  return key;
}

export function migratedTaskRelations(
  task: Pick<Task, 'epicId' | 'parentId'>,
  sourceBoard: BoardLinks,
  targetBoard: BoardLinks,
  parentExistsOnTarget: boolean
): Pick<Task, 'epicId' | 'parentId'> {
  const sourceEpic = sourceBoard.epics.find((epic) => epic.id === task.epicId);
  const targetEpic = sourceEpic
    ? targetBoard.epics.find(
        (epic) => epic.name.trim().toLocaleLowerCase() === sourceEpic.name.trim().toLocaleLowerCase()
      )
    : undefined;

  return {
    epicId: targetEpic?.id ?? null,
    parentId: task.parentId && parentExistsOnTarget ? task.parentId : null,
  };
}
