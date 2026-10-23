import React from 'react';
import {
  Clock,
  CheckSquare,
  MessageSquare,
  Calendar,
  Play,
  Pause,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Ban,
  Link2,
  CheckCircle2,
  Archive,
} from 'lucide-react';
import { Task } from '../types';
import { useAgile } from '../context/AgileContext';
import { IssueTypeIcon, PriorityIcon } from './AgileIcons';
import { formatHours, formatDate, isOverdue, isTaskDone } from '../utils/agileHelpers';

interface TaskCardProps {
  task: Task;
  onOpenModal: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onOpenModal }) => {
  const {
    tasks,
    currentBoard,
    members,
    moveTask,
    activeTimer,
    startTimer,
    pauseTimer,
    archiveTask,
    can,
    colorForTag,
  } = useAgile();

  const assignee = members.find((m) => m.id === task.assigneeId);
  const epic = currentBoard.epics?.find((e) => e.id === task.epicId);

  // Subtasks progress
  const totalSubtasks = task.subtasks?.length || 0;
  const completedSubtasks = task.subtasks?.filter((s) => s.completed).length || 0;

  // Time tracking ratio & overrun
  const estimated = task.estimatedHours || 0;
  const logged = task.loggedHours || 0;
  const isOverrun = estimated > 0 && logged > estimated;
  const overrunHours = isOverrun ? Number((logged - estimated).toFixed(1)) : 0;
  const timePercent = estimated > 0 ? Math.min(100, Math.round((logged / estimated) * 100)) : 0;

  // Dependencies & Blockers calculations
  const dependencies = task.dependencies || [];
  const blockers = dependencies.filter((d) => d.type === 'is_blocked_by');
  const unresolvedBlockers = blockers
    .map((d) => {
      const target = tasks.find((t) => t.id === d.targetTaskId);
      return { link: d, task: target };
    })
    .filter((item) => item.task && !isTaskDone(currentBoard, item.task.statusId));
  const isBlocked = unresolvedBlockers.length > 0;
  const blocksOthers = dependencies.filter((d) => d.type === 'blocks');

  const isCurrentDone = isTaskDone(currentBoard, task.statusId);
  const taskOverdue = isOverdue(task.dueDate, isCurrentDone);

  // Active timer on this specific task
  const isTimerActiveOnThisTask = activeTimer?.taskId === task.id;

  // Column movement helpers
  const currentColumnIndex = currentBoard.columns.findIndex((c) => c.id === task.statusId);
  const canMoveLeft = currentColumnIndex > 0;
  const canMoveRight = currentColumnIndex < currentBoard.columns.length - 1;

  const handleMoveLeft = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canMoveLeft) {
      moveTask(task.id, currentBoard.columns[currentColumnIndex - 1].id);
    }
  };

  const handleMoveRight = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canMoveRight) {
      moveTask(task.id, currentBoard.columns[currentColumnIndex + 1].id);
    }
  };

  const handleTimerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isTimerActiveOnThisTask) {
      if (activeTimer.isRunning) {
        pauseTimer();
      } else {
        startTimer(task.id);
      }
    } else {
      startTimer(task.id);
    }
  };

  const handleArchiveClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Arquivar a tarefa ${task.key}? Ela sairá do quadro ativa.`)) {
      archiveTask(task.id).catch(() => {});
    }
  };

  return (
    <div
      onClick={onOpenModal}
      className={`group relative bg-white dark:bg-slate-800 rounded-lg p-3.5 border shadow-2xs hover:shadow-md transition-all cursor-pointer ${
        isBlocked
          ? 'border-rose-300 dark:border-rose-800/90 hover:border-rose-400 bg-rose-50/20 dark:bg-rose-950/15'
          : 'border-slate-200 dark:border-slate-700/80 hover:border-indigo-400 dark:hover:border-indigo-500'
      } ${
        isTimerActiveOnThisTask ? 'ring-2 ring-emerald-500/50 bg-emerald-50/20' : ''
      }`}
    >
      {/* Top Bar: Issue Type, Key, Priority & Quick Timer */}
      <div className="flex items-center justify-between gap-1 mb-2">
        <div className="flex items-center gap-1.5">
          <IssueTypeIcon type={task.issueType} className="w-3.5 h-3.5" />
          <span className="font-mono text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            {task.key}
          </span>
          {task.storyPoints ? (
            <span
              className="text-[10px] font-mono px-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              title={`${task.storyPoints} Story Points`}
            >
              {task.storyPoints}pt
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Quick Timer Button */}
          <button
            onClick={handleTimerClick}
            title={
              isTimerActiveOnThisTask
                ? activeTimer?.isRunning
                  ? 'Pausar cronômetro'
                  : 'Retomar cronômetro'
                : 'Iniciar cronômetro nesta tarefa'
            }
            className={`p-1 rounded transition-colors ${
              isTimerActiveOnThisTask
                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300'
                : 'text-slate-400 hover:text-emerald-600 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-60 group-hover:opacity-100'
            }`}
          >
            {isTimerActiveOnThisTask && activeTimer?.isRunning ? (
              <Pause className="w-3 h-3" />
            ) : (
              <Play className="w-3 h-3" />
            )}
          </button>

          {/* Quick Archive Button */}
          {can('canEditTask', task.boardId) && (
            <button
              onClick={handleArchiveClick}
              title="Arquivar tarefa"
              className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Archive className="w-3 h-3" />
            </button>
          )}

          <PriorityIcon priority={task.priority} className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Epic Tag */}
      {epic && (
        <div className="mb-1.5">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded border inline-block truncate max-w-full"
            style={{
              borderColor: `${epic.color}40`,
              backgroundColor: `${epic.color}15`,
              color: epic.color,
            }}
          >
            {epic.name}
          </span>
        </div>
      )}

      {/* Task Title */}
      <h4 className="text-xs font-semibold text-slate-900 dark:text-slate-100 line-clamp-2 leading-relaxed mb-2">
        {task.title}
      </h4>

      {/* Tag Chips (item 2.2 — cor vem do catálogo global) */}
      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2 -mt-1">
          {task.tags.slice(0, 3).map((tag) => {
            const color = colorForTag(tag);
            return (
              <span
                key={tag}
                className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full border truncate max-w-[90px]"
                style={{
                  borderColor: `${color}55`,
                  backgroundColor: `${color}18`,
                  color,
                }}
                title={tag}
              >
                {tag}
              </span>
            );
          })}
          {task.tags.length > 3 && (
            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 dark:bg-slate-700/70 dark:text-slate-300">
              +{task.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Dependency Badges */}
      {(isBlocked || blocksOthers.length > 0 || (blockers.length > 0 && !isBlocked)) && (
        <div className="mb-2.5 flex flex-wrap gap-1.5 items-center">
          {isBlocked && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800"
              title={`Bloqueada por: ${unresolvedBlockers.map((b) => `${b.task?.key} (${b.task?.title})`).join(', ')}`}
            >
              <Ban className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="truncate max-w-[190px]">
                Bloqueada por {unresolvedBlockers.map((b) => b.task?.key).join(', ')}
              </span>
            </div>
          )}

          {!isBlocked && blockers.length > 0 && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
              title="Todas as tarefas bloqueadoras foram concluídas!"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Blocker liberado</span>
            </div>
          )}

          {blocksOthers.length > 0 && (
            <div
              className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              title={`Esta tarefa bloqueia: ${blocksOthers.map((b) => { const target = tasks.find(t => t.id === b.targetTaskId); return target ? `${target.key} (${target.title})` : ''; }).filter(Boolean).join(', ')}`}
            >
              <Link2 className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
              <span>Bloqueia {blocksOthers.length} {blocksOthers.length === 1 ? 'tarefa' : 'tarefas'}</span>
            </div>
          )}
        </div>
      )}

      {/* Subtasks Progress */}
      {totalSubtasks > 0 && (
        <div className="mb-2.5 bg-slate-50 dark:bg-slate-900/40 p-1.5 rounded-md border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
            <span className="flex items-center gap-1">
              <CheckSquare className="w-3 h-3 text-slate-400" />
              Sub-tarefas
            </span>
            <span className="font-mono font-medium">
              {completedSubtasks}/{totalSubtasks}
            </span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                completedSubtasks === totalSubtasks ? 'bg-emerald-500' : 'bg-indigo-500'
              }`}
              style={{ width: `${Math.round((completedSubtasks / totalSubtasks) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Time Tracking Progress (Estimado vs Realizado) */}
      {(estimated > 0 || logged > 0) && (
        <div className="mb-2.5 bg-slate-50 dark:bg-slate-900/40 p-1.5 rounded-md border border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between text-[10px] mb-1">
            <span className="flex items-center gap-1 text-slate-500">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>Horas</span>
            </span>
            <div className="flex items-center gap-1 font-mono">
              <span className={isOverrun ? 'text-rose-600 font-semibold' : 'text-slate-700 dark:text-slate-200'}>
                {formatHours(logged)}
              </span>
              <span className="text-slate-400">/</span>
              <span className="text-slate-500">{formatHours(estimated)}</span>
              {isOverrun && (
                <span
                  className="text-[9px] font-bold text-rose-600 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-1 py-0.2 rounded"
                  title={`Excedido em +${overrunHours}h`}
                >
                  +{overrunHours}h
                </span>
              )}
            </div>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 h-1 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                isOverrun ? 'bg-rose-500' : 'bg-emerald-500'
              }`}
              style={{ width: `${timePercent}%` }}
            />
          </div>
        </div>
      )}

      {/* Card Footer: Assignee, Due Date, Comments & Column Navigation Arrows */}
      <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[11px]">
        {/* Left: Assignee */}
        <div className="flex items-center gap-1.5">
          {assignee ? (
            <img
              src={assignee.avatar}
              alt={assignee.name}
              title={`Responsável: ${assignee.name} (${assignee.role})`}
              className="w-5 h-5 rounded-full object-cover border border-slate-200 dark:border-slate-700"
            />
          ) : (
            <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[9px] text-slate-500">
              ?
            </span>
          )}

          {/* Due date */}
          {task.dueDate && (
            <span
              className={`flex items-center gap-1 text-[10px] ${
                taskOverdue
                  ? 'text-rose-600 dark:text-rose-400 font-semibold'
                  : 'text-slate-400'
              }`}
              title={taskOverdue ? 'Tarefa atrasada!' : `Prazo: ${formatDate(task.dueDate)}`}
            >
              <Calendar className="w-3 h-3" />
              <span>{formatDate(task.dueDate).slice(0, 5)}</span>
            </span>
          )}
        </div>

        {/* Right: Comments & Column Quick Shift */}
        <div className="flex items-center gap-1.5">
          {task.comments && task.comments.length > 0 && (
            <span className="flex items-center gap-0.5 text-slate-400 text-[10px]" title="Comentários">
              <MessageSquare className="w-3 h-3" />
              <span>{task.comments.length}</span>
            </span>
          )}

          {/* Quick Column Shift Buttons */}
          <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5 bg-slate-100 dark:bg-slate-700/80 rounded p-0.5">
            {canMoveLeft && (
              <button
                onClick={handleMoveLeft}
                title={`Mover para ${currentBoard.columns[currentColumnIndex - 1]?.title}`}
                className="p-0.5 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300"
              >
                <ArrowLeft className="w-3 h-3" />
              </button>
            )}
            {canMoveRight && (
              <button
                onClick={handleMoveRight}
                title={`Mover para ${currentBoard.columns[currentColumnIndex + 1]?.title}`}
                className="p-0.5 hover:bg-white dark:hover:bg-slate-600 rounded text-slate-600 dark:text-slate-300"
              >
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
