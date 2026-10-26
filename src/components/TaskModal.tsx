import React, { useState } from 'react';
import {
  X,
  Trash2,
  Plus,
  Clock,
  CheckSquare,
  MessageSquare,
  Calendar,
  AlertCircle,
  Copy,
  Check,
  Send,
  Zap,
  Tag,
  Radio,
  Play,
  Pause,
  AtSign,
  Mail,
  GripVertical,
  ChevronUp,
  ChevronDown,
  Layers,
  Link2,
  Ban,
  ShieldAlert,
  CheckCircle2,
  ExternalLink,
  Archive,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { IssueType, Priority, Task, DependencyType } from '../types';
import { IssueTypeIcon, PriorityIcon } from './AgileIcons';
import { AttachmentSection } from './AttachmentSection';
import {
  formatHours,
  formatDate,
  formatRelativeTime,
  getPriorityLabel,
  getIssueTypeLabel,
  isTaskDone,
} from '../utils/agileHelpers';
import { taskAssigneeIds } from '../utils/taskAssignees';

export const TaskModal: React.FC = () => {
  const {
    tasks,
    selectedTaskModalId,
    setSelectedTaskModalId,
    currentBoard,
    members,
    currentUser,
    updateTask,
    moveTask,
    deleteTask,
    addSubtask,
    toggleSubtask,
    deleteSubtask,
    reorderSubtasks,
    addDependency,
    removeDependency,
    addWorklog,
    addComment,
    sendTestWebhook,
    activeTimer,
    colorForTag,
    tagCatalog,
    startTimer,
    pauseTimer,
    archiveTask,
    can,
  } = useAgile();

  const task = tasks.find((t) => t.id === selectedTaskModalId);

  // Local form states
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskHours, setNewSubtaskHours] = useState('1');
  const [newCommentText, setNewCommentText] = useState('');

  // Subtask drag-and-drop hierarchy state
  const [draggedSubtaskIndex, setDraggedSubtaskIndex] = useState<number | null>(null);
  const [dragOverSubtaskIndex, setDragOverSubtaskIndex] = useState<number | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'above' | 'below' | null>(null);

  // Worklog form state
  const [isLoggingWork, setIsLoggingWork] = useState(false);
  const [worklogHours, setWorklogHours] = useState('1');
  const [worklogDate, setWorklogDate] = useState(new Date().toISOString().split('T')[0]);
  const [worklogComment, setWorklogComment] = useState('');

  // Tag form state
  const [newTag, setNewTag] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);
  const [notificationSent, setNotificationSent] = useState(false);

  // Task Dependency form state
  const [isAddingDep, setIsAddingDep] = useState(false);
  const [newDepType, setNewDepType] = useState<DependencyType>('is_blocked_by');
  const [newDepTargetId, setNewDepTargetId] = useState('');

  if (!task) return null;

  const currentColumn = currentBoard.columns.find((c) => c.id === task.statusId);
  const assignee = members.find((m) => m.id === task.assigneeId);
  const reporter = members.find((m) => m.id === task.reporterId);
  const epic = currentBoard.epics?.find((e) => e.id === task.epicId);

  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;
  const subtaskPercent = totalSubtasks > 0 ? Math.round((completedSubtasks / totalSubtasks) * 100) : 0;

  const estimated = task.estimatedHours || 0;
  const logged = task.loggedHours || 0;
  const isOverrun = estimated > 0 && logged > estimated;
  const overrunHours = isOverrun ? Number((logged - estimated).toFixed(1)) : 0;

  // Dependencies calculations
  const taskDependencies = task.dependencies || [];
  const blockerLinks = taskDependencies.filter((d) => d.type === 'is_blocked_by');
  const blockedByTasks = blockerLinks.map((d) => {
    const target = tasks.find((t) => t.id === d.targetTaskId);
    const targetCol = currentBoard.columns.find((c) => c.id === target?.statusId);
    const targetAssignee = members.find((m) => m.id === target?.assigneeId);
    const isResolved = target ? isTaskDone(currentBoard, target.statusId) : false;
    return { link: d, task: target, column: targetCol, assignee: targetAssignee, isResolved };
  });
  const activeBlockersCount = blockedByTasks.filter((b) => !b.isResolved).length;

  const blockingOthersLinks = taskDependencies.filter((d) => d.type === 'blocks');
  const blockingTasks = blockingOthersLinks.map((d) => {
    const target = tasks.find((t) => t.id === d.targetTaskId);
    const targetCol = currentBoard.columns.find((c) => c.id === target?.statusId);
    const targetAssignee = members.find((m) => m.id === target?.assigneeId);
    const isResolved = isTaskDone(currentBoard, task.statusId);
    return { link: d, task: target, column: targetCol, assignee: targetAssignee, isResolved };
  });

  // Available tasks to link (exclude current task and already linked tasks)
  const currentLinkedIds = new Set(taskDependencies.map((d) => d.targetTaskId));
  const availableTasksForLinking = tasks.filter(
    (t) => t.id !== task.id && !currentLinkedIds.has(t.id)
  );

  const handleAddDependencySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepTargetId) return;
    addDependency(task.id, newDepTargetId, newDepType);
    setNewDepTargetId('');
    setIsAddingDep(false);
  };

  const handleCopyKey = () => {
    navigator.clipboard.writeText(task.key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleAddSubtaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    addSubtask(task.id, newSubtaskTitle.trim(), parseFloat(newSubtaskHours) || 1, taskAssigneeIds(task));
    setNewSubtaskTitle('');
    setNewSubtaskHours('1');
  };

  const handleSubtaskDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
    setDraggedSubtaskIndex(index);
  };

  const handleSubtaskDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const pos: 'above' | 'below' = e.clientY < midY ? 'above' : 'below';
    if (dragOverSubtaskIndex !== index || dragOverPosition !== pos) {
      setDragOverSubtaskIndex(index);
      setDragOverPosition(pos);
    }
  };

  const handleSubtaskDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSubtaskIndex === null || !task || !task.subtasks) {
      setDraggedSubtaskIndex(null);
      setDragOverSubtaskIndex(null);
      setDragOverPosition(null);
      return;
    }

    if (draggedSubtaskIndex === targetIndex) {
      setDraggedSubtaskIndex(null);
      setDragOverSubtaskIndex(null);
      setDragOverPosition(null);
      return;
    }

    let dest = targetIndex;
    if (dragOverPosition === 'below' && draggedSubtaskIndex < targetIndex) {
      dest = targetIndex;
    } else if (dragOverPosition === 'above' && draggedSubtaskIndex > targetIndex) {
      dest = targetIndex;
    } else if (dragOverPosition === 'below' && draggedSubtaskIndex > targetIndex) {
      dest = targetIndex + 1;
    } else if (dragOverPosition === 'above' && draggedSubtaskIndex < targetIndex) {
      dest = targetIndex > 0 ? targetIndex - 1 : 0;
    }

    const clampedDest = Math.max(0, Math.min(dest, task.subtasks.length - 1));

    if (clampedDest !== draggedSubtaskIndex) {
      reorderSubtasks(task.id, draggedSubtaskIndex, clampedDest);
    }

    setDraggedSubtaskIndex(null);
    setDragOverSubtaskIndex(null);
    setDragOverPosition(null);
  };

  const handleSubtaskDragEnd = () => {
    setDraggedSubtaskIndex(null);
    setDragOverSubtaskIndex(null);
    setDragOverPosition(null);
  };

  const handleAddWorklogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hrs = parseFloat(worklogHours);
    if (isNaN(hrs) || hrs <= 0) return;
    addWorklog(task.id, hrs, worklogDate, worklogComment.trim());
    setWorklogComment('');
    setWorklogHours('1');
    setIsLoggingWork(false);
  };

  const handleAddCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim()) return;
    addComment(task.id, newCommentText.trim());
    setNewCommentText('');
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newTag.trim()) {
      e.preventDefault();
      const clean = newTag.trim();
      if (!task.tags.includes(clean)) {
        updateTask(task.id, { tags: [...task.tags, clean] });
      }
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    updateTask(task.id, { tags: task.tags.filter((t) => t !== tagToRemove) });
  };

  const handleSendIntegrationAlert = async () => {
    await sendTestWebhook('slack');
    setNotificationSent(true);
    setTimeout(() => setNotificationSent(false), 3000);
  };

  const isTimerRunningOnThis = activeTimer?.taskId === task.id;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-5xl max-h-[96dvh] sm:max-h-[92vh] flex flex-col overflow-hidden my-auto">
        {/* Top Header */}
        <div className="px-3 sm:px-6 py-3 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 sm:gap-4 bg-slate-50/60 dark:bg-slate-900/80">
          <div className="flex items-center gap-3">
            {/* Issue Type selector */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700">
              <IssueTypeIcon type={task.issueType} className="w-4 h-4" />
              <select
                value={task.issueType}
                onChange={(e) => updateTask(task.id, { issueType: e.target.value as IssueType })}
                className="text-xs font-semibold bg-transparent border-none text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                <option value="story">História</option>
                <option value="task">Tarefa</option>
                <option value="bug">Bug</option>
                <option value="epic">Épico</option>
              </select>
            </div>

            {/* Key with copy */}
            <button
              onClick={handleCopyKey}
              className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Copiar chave da tarefa"
            >
              <span>{task.key}</span>
              {copiedKey ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Live Timer trigger inside modal */}
            <button
              onClick={() => {
                if (isTimerRunningOnThis) {
                  if (activeTimer.isRunning) pauseTimer();
                  else startTimer(task.id);
                } else {
                  startTimer(task.id);
                }
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                isTimerRunningOnThis
                  ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {isTimerRunningOnThis && activeTimer.isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Pausar Cronômetro</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Iniciar Cronômetro</span>
                </>
              )}
            </button>

            {/* Status Dropdown */}
            {can('canChangeStatus', task.boardId) ? (
              <select
                value={task.statusId}
                onChange={(e) => moveTask(task.id, e.target.value)}
                className="text-xs font-semibold px-3 py-1.5 rounded-md bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 focus:outline-none cursor-pointer"
              >
                {currentBoard.columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                {currentBoard.columns.find((c) => c.id === task.statusId)?.title || task.statusId}
              </span>
            )}

            {/* Delete button */}
            {can('canDeleteTask', task.boardId) && (
              <button
                onClick={() => {
                  if (confirm(`Excluir permanentemente a tarefa ${task.key}?`)) {
                    deleteTask(task.id);
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                title="Excluir tarefa"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            {/* Close modal */}
            <button
              onClick={() => setSelectedTaskModalId(null)}
              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body - 2 Columns (Content Left 65%, Sidebar Right 35%) */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
          {/* Main Left Content */}
          <div className="lg:col-span-8 p-4 sm:p-6 space-y-6">
            {/* Title (editable) */}
            <div>
              <input
                type="text"
                value={task.title}
                onChange={(e) => updateTask(task.id, { title: e.target.value })}
                className="w-full text-lg font-bold text-slate-900 dark:text-slate-100 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-indigo-500 focus:outline-none transition-colors py-1"
                placeholder="Título da tarefa..."
              />
            </div>

            {/* Description (editable) */}
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5">
                Descrição do Requisito
              </label>
              <textarea
                rows={4}
                value={task.description}
                onChange={(e) => updateTask(task.id, { description: e.target.value })}
                placeholder="Detalhes, critérios de aceitação, contexto técnico..."
                className="w-full text-xs text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700/80 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>

            {/* SUB-TAREFAS (SUBTASKS) */}
            {/* SUB-TAREFAS (SUBTASKS) */}
            <div className="bg-slate-50/50 dark:bg-slate-800/30 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Sub-tarefas ({completedSubtasks}/{totalSubtasks})
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {totalSubtasks > 1 && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-medium bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800/60">
                      <GripVertical className="w-3 h-3 text-indigo-500" />
                      Arraste para ordenar hierarquia
                    </span>
                  )}
                  <span className="text-[11px] font-mono text-slate-500">{subtaskPercent}% concluído</span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                  style={{ width: `${subtaskPercent}%` }}
                />
              </div>

              {/* Subtask list with Visual Drag-and-Drop Reordering */}
              <div className="space-y-1.5 pt-1">
                {task.subtasks && task.subtasks.length > 0 ? (
                  task.subtasks.map((sub, index) => {
                    const isDragging = draggedSubtaskIndex === index;
                    const isOver = dragOverSubtaskIndex === index && draggedSubtaskIndex !== null && draggedSubtaskIndex !== index;

                    return (
                      <div key={sub.id} className="relative">
                        {/* Visual drop insertion line indicators */}
                        {isOver && dragOverPosition === 'above' && (
                          <div className="absolute -top-1 left-1 right-1 h-1 bg-indigo-500 rounded-full z-20 shadow-md flex items-center justify-between pointer-events-none">
                            <span className="w-2.5 h-2.5 -ml-1 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                            <span className="w-2.5 h-2.5 -mr-1 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                          </div>
                        )}
                        {isOver && dragOverPosition === 'below' && (
                          <div className="absolute -bottom-1 left-1 right-1 h-1 bg-indigo-500 rounded-full z-20 shadow-md flex items-center justify-between pointer-events-none">
                            <span className="w-2.5 h-2.5 -ml-1 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                            <span className="w-2.5 h-2.5 -mr-1 rounded-full bg-indigo-600 border-2 border-white dark:border-slate-900" />
                          </div>
                        )}

                        <div
                          draggable
                          onDragStart={(e) => handleSubtaskDragStart(e, index)}
                          onDragOver={(e) => handleSubtaskDragOver(e, index)}
                          onDrop={(e) => handleSubtaskDrop(e, index)}
                          onDragEnd={handleSubtaskDragEnd}
                          className={`flex items-center justify-between p-2 rounded-lg transition-all duration-150 group select-none ${
                            isDragging
                              ? 'opacity-40 scale-[0.98] border-2 border-dashed border-indigo-500 bg-indigo-50/80 dark:bg-indigo-950/40 shadow-inner'
                              : isOver
                              ? 'bg-indigo-50/40 dark:bg-indigo-950/30 border border-indigo-400 dark:border-indigo-600 shadow-xs'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-xs'
                          }`}
                        >
                          {/* Drag handle & Hierarchy order rank & Checkbox & Title */}
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            {/* Grip handle */}
                            <div
                              className="p-1 -ml-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-grab active:cursor-grabbing rounded hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
                              title="Arraste para reordenar posição na hierarquia"
                            >
                              <GripVertical className="w-3.5 h-3.5" />
                            </div>

                            {/* Hierarchy Step Badge */}
                            <span
                              className="w-5 h-4.5 rounded bg-slate-100 dark:bg-slate-700/70 text-slate-500 dark:text-slate-400 text-[10px] font-mono font-bold flex items-center justify-center shrink-0 border border-slate-200/60 dark:border-slate-600/60"
                              title={`Ordem hierárquica #${index + 1}`}
                            >
                              #{index + 1}
                            </span>

                            {/* Checkbox */}
                            <input
                              type="checkbox"
                              checked={sub.completed}
                              onChange={() => toggleSubtask(task.id, sub.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer shrink-0"
                            />

                            {/* Subtask Title */}
                            <span
                              className={`text-xs ${
                                sub.completed
                                  ? 'line-through text-slate-400 dark:text-slate-500'
                                  : 'text-slate-800 dark:text-slate-200 font-medium'
                              } truncate`}
                            >
                              {sub.title}
                            </span>
                          </div>

                          {/* Hours badge, quick move up/down chevrons & delete */}
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {sub.estimatedHours > 0 && (
                              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                {sub.estimatedHours}h
                              </span>
                            )}

                            {/* Quick 1-click reorder buttons (accessible & mobile friendly) */}
                            <div className="flex items-center opacity-40 group-hover:opacity-100 transition-opacity">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (index > 0) reorderSubtasks(task.id, index, index - 1);
                                }}
                                disabled={index === 0}
                                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-20 disabled:hover:text-slate-400 rounded transition-colors"
                                title="Mover para cima na hierarquia"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (index < (task.subtasks?.length || 1) - 1) {
                                    reorderSubtasks(task.id, index, index + 1);
                                  }
                                }}
                                disabled={index === (task.subtasks?.length || 1) - 1}
                                className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-20 disabled:hover:text-slate-400 rounded transition-colors"
                                title="Mover para baixo na hierarquia"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                            </div>

            {/* Archive button */}
            {can('canEditTask', task.boardId) && (
              <button
                onClick={() => {
                  if (confirm(`Arquivar a tarefa ${task.key}? Ela sairá do quadro ativa.`)) {
                    archiveTask(task.id).catch(() => {});
                  }
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                title="Arquivar tarefa"
              >
                <Archive className="w-4 h-4" />
              </button>
            )}

            {/* Delete button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteSubtask(task.id, sub.id);
                              }}
                              className="p-1 text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity rounded"
                              title="Remover sub-tarefa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-3 text-xs text-slate-400 dark:text-slate-500 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                    Nenhuma sub-tarefa cadastrada. Adicione itens abaixo para organizar a hierarquia de entrega.
                  </div>
                )}
              </div>

              {/* Add subtask form */}
              <form onSubmit={handleAddSubtaskSubmit} className="flex gap-2 pt-1">
                <input
                  type="text"
                  placeholder="Nova sub-tarefa..."
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  className="flex-1 text-xs px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  placeholder="Horas"
                  title="Horas estimadas para sub-tarefa"
                  value={newSubtaskHours}
                  onChange={(e) => setNewSubtaskHours(e.target.value)}
                  className="w-16 text-xs px-2 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 text-center font-mono"
                />
                <button
                  type="submit"
                  disabled={!newSubtaskTitle.trim()}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded-md shadow-2xs transition-colors shrink-0"
                >
                  <Plus className="w-3.5 h-3.5 inline mr-1" />
                  Adicionar
                </button>
              </form>
            </div>

            {/* DEPENDÊNCIAS E BLOQUEIOS */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Dependências e Bloqueios ({taskDependencies.length})
                  </span>
                  {activeBlockersCount > 0 && (
                    <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                      {activeBlockersCount} {activeBlockersCount === 1 ? 'bloqueio ativo' : 'bloqueios ativos'}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddingDep(!isAddingDep)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isAddingDep ? 'Fechar' : 'Vincular Dependência'}
                </button>
              </div>

              {/* Active blocker warning banner */}
              {activeBlockersCount > 0 && (
                <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2 text-xs text-rose-800 dark:text-rose-200">
                  <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Esta tarefa possui impedimento ativo:</span>
                    <p className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                      {activeBlockersCount === 1
                        ? 'Existe 1 tarefa bloqueadora pendente. Conclua ou desbloqueie a dependência antes de avançar esta entrega.'
                        : `Existem ${activeBlockersCount} tarefas bloqueadoras pendentes. Conclua as dependências antes de avançar esta entrega.`}
                    </p>
                  </div>
                </div>
              )}

              {/* Add Dependency Form */}
              {isAddingDep && (
                <form
                  onSubmit={handleAddDependencySubmit}
                  className="p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800 space-y-2.5"
                >
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200">
                    <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Adicionar Vínculo de Dependência</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Tipo de Relação
                      </label>
                      <select
                        value={newDepType}
                        onChange={(e) => setNewDepType(e.target.value as DependencyType)}
                        className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="is_blocked_by">Esta tarefa é bloqueada por...</option>
                        <option value="blocks">Esta tarefa bloqueia...</option>
                      </select>
                    </div>

                    <div className="sm:col-span-7">
                      <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Tarefa Alvo no Quadro
                      </label>
                      <select
                        value={newDepTargetId}
                        onChange={(e) => setNewDepTargetId(e.target.value)}
                        required
                        className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Selecione uma tarefa...</option>
                        {availableTasksForLinking.map((t) => {
                          const col = currentBoard.columns.find((c) => c.id === t.statusId);
                          return (
                            <option key={t.id} value={t.id}>
                              [{t.key}] {t.title.length > 40 ? `${t.title.substring(0, 40)}...` : t.title} ({col?.title || t.statusId})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 italic">
                      💡 Vínculo bidirecional: a relação recíproca é atualizada automaticamente em ambas as tarefas.
                    </p>
                    <div className="flex gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsAddingDep(false)}
                        className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!newDepTargetId}
                        className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded shadow-xs flex items-center gap-1"
                      >
                        <Link2 className="w-3.5 h-3.5" />
                        Vincular
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {/* Group 1: Bloqueada por */}
              <div className="space-y-2">
                <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <Ban className="w-3 h-3 text-rose-500" />
                  <span>É bloqueada por ({blockedByTasks.length})</span>
                </div>

                {blockedByTasks.length > 0 ? (
                  <div className="space-y-1.5">
                    {blockedByTasks.map(({ link, task: target, column: targetCol, assignee: targetAssignee, isResolved }) => {
                      if (!target) return null;
                      return (
                        <div
                          key={link.id}
                          className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 text-xs transition-colors ${
                            isResolved
                              ? 'bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                              : 'bg-rose-50/30 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Key button (clickable to navigate) */}
                            <button
                              type="button"
                              onClick={() => setSelectedTaskModalId(target.id)}
                              className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 shrink-0"
                              title={`Abrir detalhes de ${target.key}`}
                            >
                              <span>{target.key}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </button>

                            {/* Status badge */}
                            {targetCol && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.2 rounded shrink-0 border"
                                style={{
                                  borderColor: `${targetCol.accentColor}50`,
                                  backgroundColor: `${targetCol.accentColor}15`,
                                  color: targetCol.accentColor,
                                }}
                              >
                                {targetCol.title}
                              </span>
                            )}

                            {/* Title */}
                            <span className="truncate text-slate-800 dark:text-slate-200" title={target.title}>
                              {target.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Resolution badge */}
                            {isResolved ? (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 rounded-full">
                                <CheckCircle2 className="w-3 h-3" />
                                Liberada
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-950/80 px-2 py-0.5 rounded-full">
                                <Ban className="w-3 h-3" />
                                Bloqueando
                              </span>
                            )}

                            {/* Assignee */}
                            {targetAssignee && (
                              <img
                                src={targetAssignee.avatar}
                                alt={targetAssignee.name}
                                title={`Responsável: ${targetAssignee.name}`}
                                className="w-5 h-5 rounded-full object-cover"
                              />
                            )}

                            {/* Remove dependency button */}
                            <button
                              type="button"
                              onClick={() => removeDependency(task.id, target.id)}
                              title="Remover vínculo de dependência"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-1">
                    Nenhum impedimento cadastrado. Esta tarefa não depende de outros itens para ser executada.
                  </p>
                )}
              </div>

              {/* Group 2: Bloqueia */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <Link2 className="w-3 h-3 text-amber-500" />
                  <span>Bloqueia ({blockingTasks.length})</span>
                </div>

                {blockingTasks.length > 0 ? (
                  <div className="space-y-1.5">
                    {blockingTasks.map(({ link, task: target, column: targetCol, assignee: targetAssignee, isResolved }) => {
                      if (!target) return null;
                      return (
                        <div
                          key={link.id}
                          className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Key button (clickable to navigate) */}
                            <button
                              type="button"
                              onClick={() => setSelectedTaskModalId(target.id)}
                              className="font-mono text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-0.5 shrink-0"
                              title={`Abrir detalhes de ${target.key}`}
                            >
                              <span>{target.key}</span>
                              <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                            </button>

                            {/* Status badge */}
                            {targetCol && (
                              <span
                                className="text-[10px] font-semibold px-1.5 py-0.2 rounded shrink-0 border"
                                style={{
                                  borderColor: `${targetCol.accentColor}50`,
                                  backgroundColor: `${targetCol.accentColor}15`,
                                  color: targetCol.accentColor,
                                }}
                              >
                                {targetCol.title}
                              </span>
                            )}

                            {/* Title */}
                            <span className="truncate text-slate-800 dark:text-slate-200" title={target.title}>
                              {target.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {isTaskDone(currentBoard, task.statusId)
                                ? 'Liberada para prosseguir'
                                : 'Aguardando entrega desta tarefa'}
                            </span>

                            {/* Assignee */}
                            {targetAssignee && (
                              <img
                                src={targetAssignee.avatar}
                                alt={targetAssignee.name}
                                title={`Responsável: ${targetAssignee.name}`}
                                className="w-5 h-5 rounded-full object-cover"
                              />
                            )}

                            {/* Remove dependency button */}
                            <button
                              type="button"
                              onClick={() => removeDependency(task.id, target.id)}
                              title="Remover vínculo de dependência"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-1">
                    Esta tarefa não está bloqueando outras entregas no momento.
                  </p>
                )}
              </div>
            </div>

            {/* APONTAMENTOS DE HORAS (WORKLOGS) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Histórico de Apontamentos de Horas ({task.worklogs?.length || 0})
                  </span>
                </div>
                <button
                  onClick={() => setIsLoggingWork(!isLoggingWork)}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isLoggingWork ? 'Fechar Formulário' : 'Registrar Horas'}
                </button>
              </div>

              {/* Collapsible Worklog form */}
              {isLoggingWork && (
                <form
                  onSubmit={handleAddWorklogSubmit}
                  className="p-3 bg-indigo-50/40 dark:bg-indigo-950/20 rounded-lg border border-indigo-200 dark:border-indigo-800/80 space-y-2.5"
                >
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-0.5">
                        Horas Trabalhadas
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        min="0.1"
                        required
                        value={worklogHours}
                        onChange={(e) => setWorklogHours(e.target.value)}
                        className="w-full text-xs font-mono px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        placeholder="Ex: 2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-0.5">
                        Data do Trabalho
                      </label>
                      <input
                        type="date"
                        required
                        value={worklogDate}
                        onChange={(e) => setWorklogDate(e.target.value)}
                        className="w-full text-xs px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-0.5">
                      Descrição da Atividade
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Refatoração da autenticação e correção de testes unitários"
                      value={worklogComment}
                      onChange={(e) => setWorklogComment(e.target.value)}
                      className="w-full text-xs px-3 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLoggingWork(false)}
                      className="px-2.5 py-1 text-xs text-slate-500 hover:text-slate-700"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-xs"
                    >
                      Salvar Apontamento
                    </button>
                  </div>
                </form>
              )}

              {/* Worklogs List */}
              <div className="space-y-2">
                {task.worklogs && task.worklogs.length > 0 ? (
                  task.worklogs.map((wl) => {
                    const author = members.find((m) => m.id === wl.memberId);
                    return (
                      <div
                        key={wl.id}
                        className="p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700/60 flex items-start justify-between gap-3 text-xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <img
                            src={author?.avatar}
                            alt={author?.name}
                            className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {author?.name || 'Membro'}
                              </span>
                              <span className="text-[10px] text-slate-400">{formatDate(wl.date)}</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-300 text-xs mt-0.5">{wl.comment}</p>
                          </div>
                        </div>

                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded text-xs shrink-0">
                          +{formatHours(wl.hours)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">
                    Nenhum apontamento de horas registrado ainda. Use "Registrar Horas" ou o cronômetro.
                  </p>
                )}
              </div>
            </div>

            <AttachmentSection task={task} />

            {/* COMENTÁRIOS */}
            <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Comentários ({task.comments?.length || 0})
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  <Mail className="w-3 h-3" />
                  <span>Alertas por email ativos</span>
                </div>
              </div>

              <div className="space-y-3">
                {task.comments?.map((comment) => {
                  const author = members.find((m) => m.id === comment.authorId);
                  const parts = comment.text.split(/(@[a-zA-Z0-9_\u00C0-\u00FF.-]+)/g);
                  return (
                    <div key={comment.id} className="flex gap-2.5 text-xs">
                      <img
                        src={author?.avatar}
                        alt={author?.name}
                        className="w-6 h-6 rounded-full object-cover shrink-0 mt-0.5"
                      />
                      <div className="flex-1 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-lg border border-slate-200 dark:border-slate-700/60">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {author?.name || 'Usuário'}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {formatRelativeTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                          {parts.map((part, idx) => {
                            if (part.startsWith('@')) {
                              return (
                                <span
                                  key={idx}
                                  className="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded font-bold bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-mono text-[11px]"
                                >
                                  {part}
                                </span>
                              );
                            }
                            return part;
                          })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add comment box with @mention quick-buttons */}
              <div className="space-y-2 pt-2">
                <form onSubmit={handleAddCommentSubmit} className="flex gap-2">
                  <img
                    src={currentUser.avatar}
                    alt={currentUser.name}
                    className="w-6 h-6 rounded-full object-cover shrink-0 mt-1"
                  />
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Adicionar comentário (digite @membro para alertar por email)..."
                      className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!newCommentText.trim()}
                      className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      Enviar
                    </button>
                  </div>
                </form>

                {/* Quick Mention Toolbar */}
                <div className="flex items-center gap-1.5 flex-wrap pl-8 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                    <AtSign className="w-3 h-3 text-indigo-500" /> Mencionar rápido:
                  </span>
                  {members.map((m) => {
                    const firstName = m.name.split(' ')[0];
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setNewCommentText((prev) => (prev ? `${prev} @${firstName} ` : `@${firstName} `));
                        }}
                        className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 hover:text-indigo-600 dark:hover:text-indigo-400 text-slate-600 dark:text-slate-300 transition-colors text-[10px] font-medium"
                      >
                        @{firstName}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setNewCommentText((prev) => (prev ? `${prev} @equipe ` : `@equipe `));
                    }}
                    className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/50 hover:text-purple-600 dark:hover:text-purple-400 text-slate-600 dark:text-slate-300 transition-colors text-[10px] font-medium"
                  >
                    @equipe
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Sidebar Details */}
          <div className="lg:col-span-4 p-4 sm:p-6 bg-slate-50/50 dark:bg-slate-900/40 space-y-5">
            {/* TIME TRACKING SUMMARY WIDGET */}
            <div className="bg-white dark:bg-slate-800 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-indigo-600" />
                Gestão de Tempo (Est. x Real)
              </span>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400">Estimado</span>
                  <div className="flex items-center gap-1 font-mono font-semibold">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={task.estimatedHours}
                      onChange={(e) => updateTask(task.id, { estimatedHours: parseFloat(e.target.value) || 0 })}
                      className="w-16 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                    />
                    <span>h</span>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400">Realizado</span>
                  <p className={`font-mono font-bold ${isOverrun ? 'text-rose-600' : 'text-slate-800 dark:text-slate-100'}`}>
                    {formatHours(logged)}
                  </p>
                </div>
              </div>

              {isOverrun ? (
                <div className="p-2 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>Estouro de +{overrunHours}h acima do planejado!</span>
                </div>
              ) : (
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400">
                  Saldo disponível: {formatHours(Math.max(0, estimated - logged))}
                </div>
              )}
            </div>

            {/* DETAILS FIELDS */}
            <div className="space-y-3.5 text-xs">
              {/* Assignees (Item 1 — múltiplos responsáveis, D1: sem limite de modelo) */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Responsáveis
                </label>
                <div className="space-y-1.5">
                  {taskAssigneeIds(task).length === 0 && (
                    <div className="text-[10px] text-slate-400">Sem responsável — adicione abaixo.</div>
                  )}
                  {taskAssigneeIds(task).map((id) => {
                    const m = members.find((x) => x.id === id);
                    if (!m) return null;
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60"
                      >
                        <img src={m.avatar} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                        <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">
                          {m.name} ({m.role})
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateTask(task.id, {
                              assigneeIds: taskAssigneeIds(task).filter((x) => x !== id),
                            })
                          }
                          className="text-slate-400 hover:text-rose-500"
                          title="Remover responsável"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <select
                    value=""
                    onChange={(e) => {
                      if (!e.target.value) return;
                      updateTask(task.id, { assigneeIds: [...taskAssigneeIds(task), e.target.value] });
                    }}
                    className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="">+ Adicionar responsável</option>
                    {members
                      .filter((m) => !taskAssigneeIds(task).includes(m.id))
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.role})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Prioridade
                </label>
                <select
                  value={task.priority}
                  onChange={(e) => updateTask(task.id, { priority: e.target.value as Priority })}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="lowest">Muito Baixa</option>
                  <option value="low">Baixa</option>
                  <option value="medium">Média</option>
                  <option value="high">Alta</option>
                  <option value="urgent">Urgente</option>
                </select>
              </div>

              {/* Epic */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Épico / Módulo
                </label>
                <select
                  value={task.epicId || ''}
                  onChange={(e) => updateTask(task.id, { epicId: e.target.value || undefined })}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  <option value="">Sem Épico</option>
                  {currentBoard.epics?.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      {ep.key}: {ep.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Story Points */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Story Points
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={task.storyPoints || ''}
                    onChange={(e) => updateTask(task.id, { storyPoints: parseInt(e.target.value) || 0 })}
                    className="w-full text-xs font-mono px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Data Limite (Prazo)
                  </label>
                  <input
                    type="date"
                    value={task.dueDate || ''}
                    onChange={(e) => updateTask(task.id, { dueDate: e.target.value })}
                    className="w-full text-xs px-2.5 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Marcadores (Tags)
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {task.tags?.map((t) => {
                    const color = colorForTag(t);
                    return (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border"
                        style={{
                          borderColor: `${color}55`,
                          backgroundColor: `${color}18`,
                          color,
                        }}
                      >
                        {t}
                        <button
                          onClick={() => handleRemoveTag(t)}
                          className="hover:opacity-70 opacity-60 font-bold"
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
                <input
                  type="text"
                  placeholder="Adicionar tag e teclar Enter..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  onKeyDown={handleAddTag}
                  className="w-full text-xs px-2.5 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {(() => {
                  const suggestions = tagCatalog
                    .filter((s) => !s.orphan && !task.tags?.some((t) => t.toLowerCase() === s.name.toLowerCase()))
                    .slice(0, 8);
                  if (suggestions.length === 0) return null;
                  return (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {suggestions.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => updateTask(task.id, { tags: [...(task.tags || []), s.name] })}
                          className="text-[10px] px-1.5 py-0.5 rounded-full border hover:opacity-75"
                          style={{
                            borderColor: `${s.color}55`,
                            backgroundColor: `${s.color}14`,
                            color: s.color,
                          }}
                          title={`Adicionar "${s.name}"`}
                        >
                          + {s.name}
                        </button>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Communication Dispatch Button */}
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={handleSendIntegrationAlert}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                >
                  <Radio className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{notificationSent ? 'Disparo Enviado!' : 'Notificar nos Canais'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
