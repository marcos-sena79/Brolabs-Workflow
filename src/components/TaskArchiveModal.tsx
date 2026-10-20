import React, { useEffect } from 'react';
import { X, ArchiveRestore, Trash2, Archive } from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { IssueTypeIcon, PriorityIcon } from './AgileIcons';
import { formatHours } from '../utils/agileHelpers';

export const TaskArchiveModal: React.FC = () => {
  const {
    isTaskArchiveOpen,
    setIsTaskArchiveOpen,
    archivedTasks,
    isArchivedTasksLoading,
    fetchArchivedTasks,
    unarchiveTask,
    deleteTask,
    members,
    currentBoard,
  } = useAgile();

  useEffect(() => {
    if (isTaskArchiveOpen) {
      fetchArchivedTasks();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTaskArchiveOpen, currentBoard.id]);

  if (!isTaskArchiveOpen) return null;

  const memberName = (id: string) => members.find((m) => m.id === id)?.name || id;
  const columnName = (statusId: string) =>
    currentBoard.columns.find((c) => c.id === statusId)?.title || statusId;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-3xl my-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <Archive className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Arquivo de Tarefas
              </h3>
              <p className="text-[11px] text-slate-400">
                {currentBoard.name} — restaure ou exclua permanentemente tarefas arquivadas
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsTaskArchiveOpen(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* List */}
        {isArchivedTasksLoading ? (
          <div className="py-10 text-center text-xs text-slate-400">Carregando arquivo…</div>
        ) : archivedTasks.length === 0 ? (
          <div className="py-10 text-center space-y-2">
            <Archive className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Nenhuma tarefa arquivada neste quadro
            </p>
            <p className="text-[11px] text-slate-400">
              Arquive tarefas concluídas ou obsoletas para mantê-las fora do fluxo ativo.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {archivedTasks.map((task) => (
              <div
                key={task.id}
                className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 flex items-center gap-3 flex-wrap"
              >
                <div className="flex items-center gap-1.5 shrink-0">
                  <IssueTypeIcon type={task.issueType} className="w-4 h-4" />
                  <PriorityIcon priority={task.priority} className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      {task.key}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {task.title}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {columnName(task.statusId)} · {memberName(task.assigneeId)} ·{' '}
                    {formatHours(task.loggedHours)} registradas
                    {task.archivedAt &&
                      ` · arquivada em ${new Date(task.archivedAt).toLocaleDateString('pt-BR')}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-auto">
                  <button
                    onClick={() => unarchiveTask(task.id)}
                    className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors"
                    title="Restaurar para o quadro"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" />
                    Restaurar
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Excluir permanentemente a tarefa ${task.key}? Esta ação não pode ser desfeita.`)) {
                        deleteTask(task.id);
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                    title="Excluir permanentemente"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
