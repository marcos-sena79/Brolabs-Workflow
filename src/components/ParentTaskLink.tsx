import React from 'react';
import { CornerLeftUp } from 'lucide-react';
import { Task } from '../types';
import { IssueTypeIcon } from './AgileIcons';
import { getIssueTypeLabel } from '../utils/agileHelpers';

interface ParentTaskLinkProps {
  parent: Pick<Task, 'id' | 'key' | 'title' | 'issueType'>;
  onOpen: (taskId: string) => void;
  /** 'sm' = cards/linhas; 'md' = cabeçalho do modal. */
  size?: 'sm' | 'md';
}

const SIZE_CLASSES = {
  sm: { text: 'text-[10px]', icon: 'w-3 h-3' },
  md: { text: 'text-xs', icon: 'w-3.5 h-3.5' },
};

/** Link compacto para o card pai (Tarefa → História, História → Épico, Sub-bug → Bug). */
export const ParentTaskLink: React.FC<ParentTaskLinkProps> = ({ parent, onOpen, size = 'sm' }) => {
  const s = SIZE_CLASSES[size];
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(parent.id);
      }}
      title={`${getIssueTypeLabel(parent.issueType)} pai: ${parent.key} — ${parent.title}`}
      className={`group/parent inline-flex items-center gap-1 min-w-0 max-w-full ${s.text} text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors`}
    >
      <CornerLeftUp className={`${s.icon} shrink-0 text-slate-400 group-hover/parent:text-indigo-500`} />
      <IssueTypeIcon type={parent.issueType} className={`${s.icon} shrink-0`} />
      <span className="font-mono font-semibold shrink-0">{parent.key}</span>
      <span className="truncate group-hover/parent:underline">{parent.title}</span>
    </button>
  );
};
