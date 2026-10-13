import React, { useState } from 'react';
import {
  Plus,
  Filter,
  Users,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Layers,
  ArrowUpDown,
  Search,
  UserCheck,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { TaskCard } from './TaskCard';
import { Task } from '../types';

export const KanbanBoard: React.FC = () => {
  const {
    currentBoard,
    filteredBoardTasks,
    boardTasks,
    filters,
    setFilters,
    members,
    currentUser,
    setSelectedTaskModalId,
    setIsCreateModalOpen,
    createTask,
    moveTask,
  } = useAgile();

  // Column quick add state
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null);
  const [quickAddTitle, setQuickAddTitle] = useState('');

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);

  // Swimlane grouping
  const [groupBy, setGroupBy] = useState<'none' | 'assignee' | 'epic' | 'priority'>('none');

  const hasActiveFilters =
    filters.searchQuery ||
    filters.selectedAssigneeId !== 'all' ||
    filters.selectedPriority !== 'all' ||
    filters.selectedIssueType !== 'all' ||
    filters.selectedEpicId !== 'all' ||
    filters.onlyMyTasks;

  const handleClearFilters = () => {
    setFilters({
      searchQuery: '',
      selectedAssigneeId: 'all',
      selectedPriority: 'all',
      selectedIssueType: 'all',
      selectedEpicId: 'all',
      onlyMyTasks: false,
    });
  };

  const handleQuickAddSubmit = (columnId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddTitle.trim()) return;

    createTask({
      title: quickAddTitle.trim(),
      description: '',
      issueType: 'task',
      priority: 'medium',
      statusId: columnId,
      assigneeId: currentUser.id,
      estimatedHours: 4,
      storyPoints: 2,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    });

    setQuickAddTitle('');
    setQuickAddColumnId(null);
  };

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('text/plain', taskId);
    setDraggedTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumnId(null);
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (taskId) {
      moveTask(taskId, columnId);
    }
    setDraggedTaskId(null);
    setDragOverColumnId(null);
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-slate-100/70 dark:bg-slate-950 overflow-hidden">
      {/* Top Filter Bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 py-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Quick Assignee Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1">
              Responsáveis:
            </span>

            <button
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  selectedAssigneeId: prev.selectedAssigneeId === 'all' ? 'all' : 'all',
                  onlyMyTasks: false,
                }))
              }
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                filters.selectedAssigneeId === 'all' && !filters.onlyMyTasks
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              Todos ({boardTasks.length})
            </button>

            {/* "Somente minhas tarefas" */}
            <button
              onClick={() =>
                setFilters((prev) => ({
                  ...prev,
                  onlyMyTasks: !prev.onlyMyTasks,
                  selectedAssigneeId: 'all',
                }))
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                filters.onlyMyTasks
                  ? 'bg-indigo-600 text-white'
                  : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Minhas Tarefas
            </button>

            {members.map((m) => {
              const count = boardTasks.filter((t) => t.assigneeId === m.id).length;
              const isSelected = filters.selectedAssigneeId === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() =>
                    setFilters((prev) => ({
                      ...prev,
                      selectedAssigneeId: isSelected ? 'all' : m.id,
                      onlyMyTasks: false,
                    }))
                  }
                  title={`${m.name} (${m.role})`}
                  className={`flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full text-xs font-medium border transition-all ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-500/20'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  }`}
                >
                  <img src={m.avatar} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                  <span className="text-[11px] truncate max-w-[80px]">{m.name.split(' ')[0]}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Group By & Filter Clear */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-500">
              <Layers className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[11px]">Agrupar:</span>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="none">Padrão</option>
                <option value="assignee">Por Responsável</option>
                <option value="priority">Por Prioridade</option>
                <option value="epic">Por Épico</option>
              </select>
            </div>

            {hasActiveFilters && (
              <button
                onClick={handleClearFilters}
                className="flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400 font-medium hover:underline px-2 py-1 rounded bg-rose-50 dark:bg-rose-950/40"
              >
                <RotateCcw className="w-3 h-3" />
                Limpar Filtros
              </button>
            )}
          </div>
        </div>

        {/* Secondary Filter Row: Priority, Type, Epic */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800/80 text-xs">
          {/* Issue Type */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px]">Tipo:</span>
            <select
              value={filters.selectedIssueType}
              onChange={(e) => setFilters((prev) => ({ ...prev, selectedIssueType: e.target.value }))}
              className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-slate-700 dark:text-slate-300"
            >
              <option value="all">Todos os Tipos</option>
              <option value="story">Histórias</option>
              <option value="task">Tarefas</option>
              <option value="bug">Bugs</option>
              <option value="epic">Épicos</option>
            </select>
          </div>

          {/* Priority */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px]">Prioridade:</span>
            <select
              value={filters.selectedPriority}
              onChange={(e) => setFilters((prev) => ({ ...prev, selectedPriority: e.target.value }))}
              className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-slate-700 dark:text-slate-300"
            >
              <option value="all">Todas as Prioridades</option>
              <option value="urgent">Urgente</option>
              <option value="high">Alta</option>
              <option value="medium">Média</option>
              <option value="low">Baixa</option>
            </select>
          </div>

          {/* Epic */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400 text-[11px]">Épico:</span>
            <select
              value={filters.selectedEpicId}
              onChange={(e) => setFilters((prev) => ({ ...prev, selectedEpicId: e.target.value }))}
              className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 text-slate-700 dark:text-slate-300"
            >
              <option value="all">Todos os Épicos</option>
              {currentBoard.epics?.map((ep) => (
                <option key={ep.id} value={ep.id}>
                  {ep.key}: {ep.name}
                </option>
              ))}
            </select>
          </div>

          <span className="text-[11px] text-slate-400 ml-auto">
            Exibindo <span className="font-semibold text-slate-700 dark:text-slate-200">{filteredBoardTasks.length}</span> de{' '}
            {boardTasks.length} tarefas
          </span>
        </div>
      </div>

      {/* Kanban Columns Canvas */}
      <div className="flex-1 overflow-x-auto p-4 lg:p-6">
        <div className="flex items-start gap-4 min-w-max h-full">
          {currentBoard.columns.map((column) => {
            const columnTasks = filteredBoardTasks.filter((t) => t.statusId === column.id);
            const isWipExceeded = column.wipLimit && columnTasks.length > column.wipLimit;
            const isDragOver = dragOverColumnId === column.id;

            return (
              <div
                key={column.id}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
                className={`w-72 sm:w-80 flex flex-col rounded-xl bg-slate-200/60 dark:bg-slate-900/90 border transition-all max-h-[calc(100vh-185px)] ${
                  isDragOver
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 dark:bg-indigo-950/20'
                    : isWipExceeded
                    ? 'border-amber-300 dark:border-amber-800'
                    : 'border-slate-200/90 dark:border-slate-800/80'
                }`}
              >
                {/* Column Header */}
                <div className="p-3 border-b border-slate-200/70 dark:border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: column.accentColor }}
                    />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      {column.title}
                    </h3>
                    <span
                      className={`text-[11px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                        isWipExceeded
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {columnTasks.length}
                      {column.wipLimit ? ` / ${column.wipLimit}` : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {isWipExceeded && (
                      <span
                        title="Limite de trabalho em progresso (WIP) excedido!"
                        className="text-amber-500"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </span>
                    )}
                    <button
                      onClick={() => setQuickAddColumnId(column.id)}
                      className="p-1 hover:bg-slate-300/70 dark:hover:bg-slate-800 rounded text-slate-500 hover:text-slate-800 transition-colors"
                      title="Adicionar tarefa rápida nesta coluna"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Column Cards Scroll Area */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5">
                  {columnTasks.map((task) => (
                    <div
                      key={task.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      className="cursor-grab active:cursor-grabbing"
                    >
                      <TaskCard
                        task={task}
                        onOpenModal={() => setSelectedTaskModalId(task.id)}
                      />
                    </div>
                  ))}

                  {columnTasks.length === 0 && (
                    <div className="py-8 text-center border-2 border-dashed border-slate-300/60 dark:border-slate-800 rounded-lg">
                      <p className="text-[11px] text-slate-400">Nenhuma tarefa nesta coluna</p>
                      <button
                        onClick={() => setQuickAddColumnId(column.id)}
                        className="mt-1 text-xs text-indigo-600 font-semibold hover:underline"
                      >
                        + Criar aqui
                      </button>
                    </div>
                  )}

                  {/* Inline Quick Add Input */}
                  {quickAddColumnId === column.id && (
                    <form
                      onSubmit={(e) => handleQuickAddSubmit(column.id, e)}
                      className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-indigo-400 shadow-sm space-y-2"
                    >
                      <textarea
                        autoFocus
                        rows={2}
                        value={quickAddTitle}
                        onChange={(e) => setQuickAddTitle(e.target.value)}
                        placeholder="O que precisa ser feito? Pressione Enter para criar..."
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleQuickAddSubmit(column.id, e);
                          }
                        }}
                        className="w-full text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 bg-transparent resize-none focus:outline-none"
                      />
                      <div className="flex justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setQuickAddColumnId(null)}
                          className="px-2 py-1 text-[11px] text-slate-500 hover:text-slate-700"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-2xs"
                        >
                          Adicionar
                        </button>
                      </div>
                    </form>
                  )}
                </div>

                {/* Column Footer: Quick add button */}
                <div className="p-2 border-t border-slate-200/50 dark:border-slate-800/60">
                  <button
                    onClick={() => setQuickAddColumnId(column.id)}
                    className="w-full py-1.5 px-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-300/50 dark:hover:bg-slate-800/60 rounded-md transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Tarefa</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
