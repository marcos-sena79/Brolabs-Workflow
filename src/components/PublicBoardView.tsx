import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Eye, Globe, MessageSquare, CheckSquare2, CalendarDays, User, Inbox, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import { PublicBoardData, PublicTask, Priority, IssueType } from '../types';
import { IssueTypeIcon, PriorityIcon } from './AgileIcons';

type LoadStatus = 'loading' | 'ready' | 'notfound';

const isOverdue = (dueDate: string): boolean => {
  if (!dueDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dueDate < today;
};

const PublicTaskCard: React.FC<{ task: PublicTask }> = ({ task }) => {
  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;
  const overdue = isOverdue(task.dueDate);

  return (
    <div className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200/80 dark:border-slate-700/70 shadow-xs space-y-1.5 select-none">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <IssueTypeIcon type={task.issueType as IssueType} className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">{task.key}</span>
          <PriorityIcon priority={task.priority as Priority} className="w-3.5 h-3.5 shrink-0" />
        </div>
        {task.storyPoints > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 shrink-0">
            {task.storyPoints}pt
          </span>
        )}
      </div>

      <p className="text-xs font-medium text-slate-800 dark:text-slate-100 leading-snug">{task.title}</p>

      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700/70 dark:text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {totalSubtasks > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">
              <CheckSquare2 className="w-3 h-3" />
              Subtarefas
            </span>
            <span className="font-mono font-semibold">
              {completedSubtasks}/{totalSubtasks}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className={`h-full rounded-full ${completedSubtasks === totalSubtasks ? 'bg-emerald-500' : 'bg-indigo-500'}`}
              style={{ width: `${Math.round((completedSubtasks / totalSubtasks) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2.5 pt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
        {task.assigneeName && (
          <span className="inline-flex items-center gap-1 truncate" title={task.assigneeName}>
            <User className="w-3 h-3" />
            <span className="truncate max-w-[90px]">{task.assigneeName}</span>
          </span>
        )}
        {task.dueDate && (
          <span className={`inline-flex items-center gap-1 ${overdue ? 'text-rose-600 dark:text-rose-400 font-semibold' : ''}`}>
            <CalendarDays className="w-3 h-3" />
            {task.dueDate.slice(0, 10)}
          </span>
        )}
        {task.commentsCount > 0 && (
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {task.commentsCount}
          </span>
        )}
      </div>
    </div>
  );
};

export const PublicBoardView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicBoardData | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');

  useEffect(() => {
    let cancelled = false;
    if (!token) {
      setStatus('notfound');
      return;
    }
    setStatus('loading');
    api
      .getPublicBoard(token)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('notfound');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === 'loading') {
    return (
      <div className="flex flex-col h-dvh bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <header className="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 sm:px-6 py-3">
          <div className="h-5 w-56 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
        </header>
        <div className="flex-1 min-h-0 overflow-x-auto p-4 sm:p-6">
          <div className="flex items-start gap-4 min-w-max h-full">
            {[0, 1, 2].map((i) => (
              <div key={i} className="shrink-0 w-[82vw] max-w-xs sm:w-80 rounded-xl bg-slate-200/60 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/80 p-3 space-y-3">
                <div className="h-4 w-28 rounded bg-slate-300/70 dark:bg-slate-700 animate-pulse" />
                <div className="h-20 rounded-lg bg-slate-300/50 dark:bg-slate-800 animate-pulse" />
                <div className="h-20 rounded-lg bg-slate-300/50 dark:bg-slate-800 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (status === 'notfound' || !data) {
    return (
      <div className="flex flex-col h-dvh bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 items-center justify-center gap-3 px-6">
        <ShieldAlert className="w-10 h-10 text-slate-400" />
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Link inválido ou desativado</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md">
          Este quadro não está mais disponível publicamente. Peça ao administrador do quadro um novo link.
        </p>
        <Link
          to="/login"
          className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Ir para o login
        </Link>
      </div>
    );
  }

  const { board, tasks } = data;

  return (
    <div className="flex flex-col h-dvh w-full bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans antialiased">
      {/* Header público */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 sm:px-6 py-3 shrink-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            <Eye className="w-3 h-3" />
            Visualização pública — somente leitura
          </span>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 truncate">
            {board.key && <span className="font-mono text-slate-500 dark:text-slate-400 mr-1.5">{board.key}</span>}
            {board.name}
          </h1>
          {board.sprintName && (
            <span className="text-xs text-slate-500 dark:text-slate-400 truncate">Sprint: {board.sprintName}</span>
          )}
          <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Globe className="w-3 h-3" />
            Brolabs Workflow
          </span>
        </div>
        {board.sprintGoal && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{board.sprintGoal}</p>
        )}
      </header>

      {/* Colunas somente leitura */}
      <div className="flex-1 min-h-0 overflow-x-auto p-3 sm:p-4 lg:p-6">
        <div className="flex items-start gap-4 min-w-max h-full">
          {board.columns.map((column) => {
            const columnTasks = tasks.filter((t) => t.statusId === column.id);
            return (
              <div
                key={column.id}
                className="snap-start shrink-0 w-[82vw] max-w-xs sm:w-80 sm:max-w-none flex flex-col rounded-xl bg-slate-200/60 dark:bg-slate-900/90 border border-slate-200/90 dark:border-slate-800/80 max-h-full"
              >
                <div className="p-3 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full ring-1 ring-slate-900/10 dark:ring-white/20"
                      style={{ backgroundColor: column.accentColor }}
                    />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      {column.title}
                    </h3>
                    <span className="text-[11px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {columnTasks.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                  {columnTasks.map((task) => (
                    <PublicTaskCard key={task.id} task={task} />
                  ))}
                  {columnTasks.length === 0 && (
                    <div className="py-8 text-center border-2 border-dashed border-slate-300/60 dark:border-slate-800 rounded-lg">
                      <p className="text-[11px] text-slate-400">Nenhuma tarefa nesta coluna</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {tasks.length === 0 && board.columns.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-24 px-8 text-center">
              <Inbox className="w-8 h-8 text-slate-400" />
              <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Quadro sem tarefas</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
