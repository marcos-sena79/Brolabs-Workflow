import React, { useState } from 'react';
import {
  ListTodo,
  Plus,
  Play,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
  Calendar,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { formatHours, formatDate } from '../utils/agileHelpers';
import { IssueTypeIcon, PriorityIcon } from './AgileIcons';

export const BacklogView: React.FC = () => {
  const {
    currentBoard,
    boardTasks,
    members,
    setSelectedTaskModalId,
    setIsCreateModalOpen,
    moveTask,
    currentUser,
    createTask,
  } = useAgile();

  const [quickTitle, setQuickTitle] = useState('');
  const [isSprintOpen, setIsSprintOpen] = useState(true);
  const [isBacklogOpen, setIsBacklogOpen] = useState(true);

  // Divide between active sprint tasks and backlog items
  const sprintTasks = boardTasks.filter((t) => t.statusId !== 'col-backlog');
  const backlogTasks = boardTasks.filter((t) => t.statusId === 'col-backlog');

  const sprintPoints = sprintTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
  const sprintHours = sprintTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);

  const backlogPoints = backlogTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
  const backlogHours = backlogTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);

  const handleQuickAdd = (targetStatus: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    createTask({
      title: quickTitle.trim(),
      description: '',
      issueType: 'story',
      priority: 'medium',
      statusId: targetStatus,
      assigneeId: currentUser.id,
      estimatedHours: 4,
      storyPoints: 2,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    });
    setQuickTitle('');
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100/60 dark:bg-slate-950 p-6 space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <ListTodo className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Backlog & Planejamento de Sprints
              </h2>
              <p className="text-xs text-slate-500">
                Organização do backlog de produto, refinamento de requisitos e dimensionamento de escopo
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Criar Item de Backlog</span>
        </button>
      </div>

      {/* SPRINT ATIVO SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div
          onClick={() => setIsSprintOpen(!isSprintOpen)}
          className="p-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            {isSprintOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                {currentBoard.sprintName} (Sprint Ativo)
              </span>
              <span className="text-[11px] text-slate-400 ml-2">
                {currentBoard.sprintStartDate} até {currentBoard.sprintEndDate}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">
              {sprintPoints} pts
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {formatHours(sprintHours)} est.
            </span>
            <span className="text-slate-400 text-[11px]">({sprintTasks.length} tarefas)</span>
          </div>
        </div>

        {isSprintOpen && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {sprintTasks.map((task) => {
              const assignee = members.find((m) => m.id === task.assigneeId);
              const col = currentBoard.columns.find((c) => c.id === task.statusId);
              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskModalId(task.id)}
                  className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center justify-between gap-4 cursor-pointer transition-colors text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <IssueTypeIcon type={task.issueType} className="w-4 h-4 shrink-0" />
                    <span className="font-mono font-bold text-slate-500 text-[11px] shrink-0">{task.key}</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{task.title}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <PriorityIcon priority={task.priority} />
                    <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
                      {task.storyPoints}pt · {formatHours(task.estimatedHours)}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      {col?.title}
                    </span>
                    <img
                      src={assignee?.avatar}
                      alt={assignee?.name}
                      title={assignee?.name}
                      className="w-5 h-5 rounded-full object-cover"
                    />
                  </div>
                </div>
              );
            })}

            {sprintTasks.length === 0 && (
              <p className="text-xs text-slate-400 italic p-6 text-center">
                Nenhuma tarefa alocada neste sprint. Mova itens do backlog abaixo.
              </p>
            )}
          </div>
        )}
      </div>

      {/* BACKLOG DE PRODUTO SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div
          onClick={() => setIsBacklogOpen(!isBacklogOpen)}
          className="p-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            {isBacklogOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Backlog de Produto (Fila Futura)
              </span>
              <span className="text-[11px] text-slate-400 ml-2">Demandas aguardando priorização</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
              {backlogPoints} pts
            </span>
            <span className="text-slate-400 text-[11px]">({backlogTasks.length} itens)</span>
          </div>
        </div>

        {isBacklogOpen && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {backlogTasks.map((task) => {
              const assignee = members.find((m) => m.id === task.assigneeId);
              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskModalId(task.id)}
                  className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex items-center justify-between gap-4 cursor-pointer transition-colors text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <IssueTypeIcon type={task.issueType} className="w-4 h-4 shrink-0" />
                    <span className="font-mono font-bold text-slate-500 text-[11px] shrink-0">{task.key}</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200 truncate">{task.title}</span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => moveTask(task.id, 'col-todo')}
                      className="px-2.5 py-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 rounded transition-colors"
                    >
                      Puxar para Sprint
                    </button>
                    <span className="font-mono text-slate-400 text-[11px]">{formatHours(task.estimatedHours)}</span>
                  </div>
                </div>
              );
            })}

            {/* Quick Add into Backlog */}
            <form onSubmit={(e) => handleQuickAdd('col-backlog', e)} className="p-3 flex gap-2">
              <input
                type="text"
                placeholder="+ Criar item rápido no backlog e teclar Enter..."
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                className="flex-1 text-xs px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!quickTitle.trim()}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-md shadow-2xs"
              >
                Adicionar
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
