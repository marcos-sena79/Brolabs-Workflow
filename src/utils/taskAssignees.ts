// Múltiplos responsáveis por tarefa — Onda 2, Item 1 (regra D1)
// Fonte única de verdade: assigneeIds (lista). assigneeId é o 1º (compat).

export interface AssigneeLike {
  assigneeId?: string;
  assigneeIds?: string[];
}

export function normalizeAssigneeIds(input: unknown, fallback: string[] = []): string[] {
  const base = Array.isArray(input) ? input : fallback;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of base) {
    if (typeof value !== 'string') continue;
    const id = value.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function taskAssigneeIds(task: AssigneeLike | null | undefined): string[] {
  if (!task) return [];
  if (Array.isArray(task.assigneeIds)) return task.assigneeIds;
  return task.assigneeId ? [task.assigneeId] : [];
}

export function primaryAssigneeId(task: AssigneeLike): string {
  const ids = taskAssigneeIds(task);
  return ids[0] || task.assigneeId || '';
}

export function taskHasAssignee(task: AssigneeLike, memberId: string | null | undefined): boolean {
  if (!memberId) return false;
  return taskAssigneeIds(task).includes(memberId);
}
