import React from 'react';
import {
  Bookmark,
  CheckSquare,
  AlertCircle,
  Zap,
  ArrowUp,
  ArrowDown,
  Equal,
  ChevronsUp,
} from 'lucide-react';
import { IssueType, Priority } from '../types';

export const IssueTypeIcon: React.FC<{ type: IssueType; className?: string }> = ({
  type,
  className = 'w-4 h-4',
}) => {
  switch (type) {
    case 'story':
      return (
        <span title="História de Usuário" className="inline-flex items-center">
          <Bookmark className={`${className} text-emerald-500 fill-emerald-500/20`} />
        </span>
      );
    case 'task':
      return (
        <span title="Tarefa" className="inline-flex items-center">
          <CheckSquare className={`${className} text-blue-500`} />
        </span>
      );
    case 'bug':
      return (
        <span title="Bug" className="inline-flex items-center">
          <AlertCircle className={`${className} text-rose-500`} />
        </span>
      );
    case 'epic':
      return (
        <span title="Épico" className="inline-flex items-center">
          <Zap className={`${className} text-purple-500 fill-purple-500/20`} />
        </span>
      );
  }
};

export const PriorityIcon: React.FC<{ priority: Priority; className?: string }> = ({
  priority,
  className = 'w-3.5 h-3.5',
}) => {
  switch (priority) {
    case 'urgent':
      return (
        <span title="Urgente" className="inline-flex items-center">
          <ChevronsUp className={`${className} text-rose-600`} />
        </span>
      );
    case 'high':
      return (
        <span title="Alta" className="inline-flex items-center">
          <ArrowUp className={`${className} text-orange-500`} />
        </span>
      );
    case 'medium':
      return (
        <span title="Média" className="inline-flex items-center">
          <Equal className={`${className} text-amber-500`} />
        </span>
      );
    case 'low':
      return (
        <span title="Baixa" className="inline-flex items-center">
          <ArrowDown className={`${className} text-blue-400`} />
        </span>
      );
    case 'lowest':
      return (
        <span title="Muito Baixa" className="inline-flex items-center">
          <ArrowDown className={`${className} text-slate-400 opacity-60`} />
        </span>
      );
  }
};
