import { IssueType, Priority } from '../types';

export const formatHours = (hours: number): string => {
  if (hours === 0) return '0h';
  if (Number.isInteger(hours)) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
};

export const getPriorityLabel = (priority: Priority): string => {
  switch (priority) {
    case 'urgent':
      return 'Urgente';
    case 'high':
      return 'Alta';
    case 'medium':
      return 'Média';
    case 'low':
      return 'Baixa';
    case 'lowest':
      return 'Muito Baixa';
  }
};

export const getPriorityColor = (priority: Priority): { bg: string; text: string; border: string } => {
  switch (priority) {
    case 'urgent':
      return { bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-300 dark:border-rose-800' };
    case 'high':
      return { bg: 'bg-orange-500/10', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-800' };
    case 'medium':
      return { bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-300 dark:border-amber-800' };
    case 'low':
      return { bg: 'bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-800' };
    case 'lowest':
      return { bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400', border: 'border-slate-300 dark:border-slate-800' };
  }
};

export const getIssueTypeLabel = (type: IssueType): string => {
  switch (type) {
    case 'story':
      return 'História';
    case 'task':
      return 'Tarefa';
    case 'bug':
      return 'Bug';
    case 'epic':
      return 'Épico';
  }
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '-';
  try {
    const [year, month, day] = dateString.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateString;
  }
};

export const formatRelativeTime = (isoString: string): string => {
  try {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Agora mesmo';
    if (diffMin < 60) return `Há ${diffMin} min`;
    if (diffHour < 24) return `Há ${diffHour}h`;
    if (diffDay === 1) return 'Ontem';
    return `Há ${diffDay} dias`;
  } catch {
    return 'Recentemente';
  }
};

export const isOverdue = (dueDate: string, isDone: boolean): boolean => {
  if (isDone || !dueDate) return false;
  const today = new Date().toISOString().split('T')[0];
  return dueDate < today;
};
