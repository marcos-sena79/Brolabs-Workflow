import React, { useMemo, useState } from 'react';
import {
  ListTodo,
  Plus,
  Play,
  ChevronDown,
  ChevronRight,
  Ban,
  Link2,
  Pencil,
  Trash2,
  Flag,
  CalendarPlus,
  History,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import type { Sprint, Task } from '../types';
import { formatHours, formatDate, getRollupHours, getTaskHours, isTaskDone } from '../utils/agileHelpers';
import {
  BACKLOG_COLUMN_ID,
  getTaskSprintId,
  suggestNextSprintDates,
  suggestNextSprintName,
} from '../utils/sprints';
import { IssueTypeIcon, PriorityIcon } from './AgileIcons';
import { CompleteSprintModal, SprintFormModal, SprintFormValues } from './SprintModals';

const BACKLOG_KEY = '__backlog__';

const formatRange = (s: Pick<Sprint, 'startDate' | 'endDate'>) => {
  if (!s.startDate && !s.endDate) return 'Sem datas definidas';
  const fmt = (d: string) => (d ? formatDate(d) : '?');
  return `${fmt(s.startDate)} até ${fmt(s.endDate)}`;
};

const STATUS_BADGE: Record<Sprint['status'], { label: string; className: string }> = {
  active: { label: 'Ativa', className: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300' },
  planned: { label: 'Planejada', className: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300' },
  completed: { label: 'Concluída', className: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400' },
};

export const BacklogView: React.FC = () => {
  const {
    tasks,
    currentBoard,
    boardTasks,
    boardSprints,
    activeSprint,
    members,
    setSelectedTaskModalId,
    setIsCreateModalOpen,
    currentUser,
    createTask,
    can,
    createSprint,
    updateSprint,
    deleteSprint,
    startSprint,
    completeSprint,
    moveTaskToSprint,
  } = useAgile();

  const [quickTitle, setQuickTitle] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [showCompleted, setShowCompleted] = useState(false);
  const [sprintForm, setSprintForm] = useState<{ mode: 'create' | 'edit'; sprint?: Sprint } | null>(null);
  const [completing, setCompleting] = useState<Sprint | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = can('canManageBoard');
  const canMove = can('canChangeStatus', currentBoard.id);

  const plannedSprints = boardSprints.filter((s) => s.status === 'planned');
  const completedSprints = boardSprints.filter((s) => s.status === 'completed');

  // Agrupa tarefas por sprint (BACKLOG_KEY = sem sprint)
  const tasksBySprint = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of boardTasks) {
      const key = getTaskSprintId(t, activeSprint?.id) ?? BACKLOG_KEY;
      const list = map.get(key);
      if (list) list.push(t);
      else map.set(key, [t]);
    }
    return map;
  }, [boardTasks, activeSprint?.id]);

  const listFor = (key: string) => tasksBySprint.get(key) || [];
  const backlogTasks = listFor(BACKLOG_KEY);

  const totals = (list: Task[]) => ({
    points: list.reduce((acc, t) => acc + (t.storyPoints || 0), 0),
    hours: list.reduce((acc, t) => acc + getTaskHours(t).estimatedHours, 0),
  });

  const isOpen = (key: string) => !collapsed[key];
  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));

  const runAction = async (fn: () => Promise<unknown>) => {
    setActionError(null);
    try {
      await fn();
    } catch (err: any) {
      setActionError(err?.message || 'Não foi possível concluir a ação');
    }
  };

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    createTask({
      title: quickTitle.trim(),
      description: '',
      issueType: 'story',
      priority: 'medium',
      statusId: BACKLOG_COLUMN_ID,
      sprintId: null,
      assigneeId: currentUser.id,
      estimatedHours: 0, // calculada pelas sub-tarefas
      storyPoints: 2,
      dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    });
    setQuickTitle('');
  };

  const openCreateSprint = () => setSprintForm({ mode: 'create' });

  const sprintFormInitial = (): SprintFormValues => {
    if (sprintForm?.sprint) {
      const s = sprintForm.sprint;
      return { name: s.name, goal: s.goal, startDate: s.startDate, endDate: s.endDate };
    }
    return { name: suggestNextSprintName(boardSprints), goal: '', ...suggestNextSprintDates(boardSprints) };
  };

  const handleSprintSubmit = async (values: SprintFormValues) => {
    if (sprintForm?.mode === 'edit' && sprintForm.sprint) {
      await updateSprint(sprintForm.sprint.id, values);
    } else {
      await createSprint(values);
    }
  };

  const handleDeleteSprint = (sprint: Sprint) => {
    const count = listFor(sprint.id).length;
    const msg =
      count > 0
        ? `Excluir "${sprint.name}"? ${count} tarefa(s) voltarão para o backlog.`
        : `Excluir "${sprint.name}"?`;
    if (!window.confirm(msg)) return;
    void runAction(() => deleteSprint(sprint.id));
  };

  /** Seletor "mover para" de cada tarefa (sprints abertas + backlog). */
  const renderMoveSelect = (task: Task, currentKey: string) => {
    if (!canMove) return null;
    const options = [
      ...(activeSprint ? [activeSprint] : []),
      ...plannedSprints,
    ];
    return (
      <select
        value={currentKey}
        onChange={(e) => moveTaskToSprint(task.id, e.target.value === BACKLOG_KEY ? null : e.target.value)}
        onClick={(e) => e.stopPropagation()}
        title="Mover para sprint"
        aria-label={`Mover ${task.key} para sprint`}
        className="text-[11px] max-w-[150px] px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      >
        {currentKey !== BACKLOG_KEY && !options.some((s) => s.id === currentKey) && (
          <option value={currentKey}>—</option>
        )}
        {options.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.status === 'active' ? ' (ativa)' : ''}
          </option>
        ))}
        <option value={BACKLOG_KEY}>Backlog</option>
      </select>
    );
  };

  const renderTaskRow = (task: Task, sectionKey: string, showStatus: boolean) => {
    const assignee = members.find((m) => m.id === task.assigneeId);
    const col = currentBoard.columns.find((c) => c.id === task.statusId);
    const blockers = (task.dependencies || []).filter((d) => d.type === 'is_blocked_by');
    const isBlocked = blockers.some((b) => {
      const target = tasks.find((t) => t.id === b.targetTaskId);
      return target && !isTaskDone(currentBoard, target.statusId);
    });
    const blocksCount = (task.dependencies || []).filter((d) => d.type === 'blocks').length;

    return (
      <div
        key={task.id}
        onClick={() => setSelectedTaskModalId(task.id)}
        className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 cursor-pointer transition-colors text-xs"
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <IssueTypeIcon type={task.issueType} className="w-4 h-4 shrink-0" />
          <span className="font-mono font-bold text-slate-500 text-[11px] shrink-0">{task.key}</span>
          <span className="font-semibold text-slate-900 dark:text-slate-100 truncate">{task.title}</span>

          {isBlocked && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-900 px-1.5 py-0.2 rounded shrink-0">
              <Ban className="w-3 h-3" />
              Bloqueada
            </span>
          )}

          {blocksCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-900 px-1.5 py-0.2 rounded shrink-0">
              <Link2 className="w-3 h-3" />
              Bloqueia ({blocksCount})
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:shrink-0" onClick={(e) => e.stopPropagation()}>
          <PriorityIcon priority={task.priority} />
          <span className="font-mono text-slate-600 dark:text-slate-400 text-[11px]">
            {task.storyPoints}pt · {formatHours(getRollupHours(task, tasks).estimatedHours)}
          </span>
          {showStatus && (
            <span className="text-[10px] px-2 py-0.5 rounded font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
              {col?.title}
            </span>
          )}
          {sectionKey !== 'completed' && renderMoveSelect(task, sectionKey)}
          {assignee?.avatar && (
            <img src={assignee.avatar} alt={assignee.name} title={assignee.name} className="w-5 h-5 rounded-full object-cover" />
          )}
        </div>
      </div>
    );
  };

  const iconBtn =
    'p-1.5 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors';

  const renderSprintSection = (sprint: Sprint) => {
    const list = listFor(sprint.id);
    const { points, hours } = totals(list);
    const open = isOpen(sprint.id);
    const badge = STATUS_BADGE[sprint.status];
    const doneCount = list.filter((t) => isTaskDone(currentBoard, t.statusId)).length;

    return (
      <div
        key={sprint.id}
        className={`bg-white dark:bg-slate-900 rounded-xl border shadow-2xs overflow-hidden ${
          sprint.status === 'active' ? 'border-indigo-200 dark:border-indigo-900' : 'border-slate-200 dark:border-slate-800'
        }`}
      >
        <div
          onClick={() => toggle(sprint.id)}
          className="p-3 sm:p-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {open ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">{sprint.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${badge.className}`}>{badge.label}</span>
                <span className="text-[11px] text-slate-400">{formatRange(sprint)}</span>
              </div>
              {sprint.goal && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{sprint.goal}</p>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono" onClick={(e) => e.stopPropagation()}>
            <span className="px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">{points} pts</span>
            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{formatHours(hours)} est.</span>
            <span className="text-slate-400 text-[11px]">
              ({sprint.status === 'planned' ? list.length : `${doneCount}/${list.length}`} tarefas)
            </span>

            {canManage && sprint.status !== 'completed' && (
              <div className="flex items-center gap-1 font-sans">
                {sprint.status === 'planned' && (
                  <button
                    onClick={() => void runAction(() => startSprint(sprint.id))}
                    disabled={Boolean(activeSprint)}
                    title={activeSprint ? `Conclua "${activeSprint.name}" antes de iniciar outra sprint` : 'Iniciar sprint'}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white"
                  >
                    <Play className="w-3 h-3" />
                    Iniciar
                  </button>
                )}
                {sprint.status === 'active' && (
                  <button
                    onClick={() => setCompleting(sprint)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Flag className="w-3 h-3" />
                    Concluir
                  </button>
                )}
                <button onClick={() => setSprintForm({ mode: 'edit', sprint })} className={iconBtn} title="Editar sprint" aria-label="Editar sprint">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {sprint.status === 'planned' && (
                  <button onClick={() => handleDeleteSprint(sprint)} className={`${iconBtn} hover:text-rose-600`} title="Excluir sprint" aria-label="Excluir sprint">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {open && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {list.map((task) =>
              renderTaskRow(task, sprint.status === 'completed' ? 'completed' : sprint.id, sprint.status !== 'planned')
            )}
            {list.length === 0 && (
              <p className="text-xs text-slate-400 italic p-6 text-center">
                {sprint.status === 'completed'
                  ? 'Nenhuma tarefa registrada nesta sprint.'
                  : 'Nenhuma tarefa nesta sprint. Use o seletor das tarefas do backlog para adicioná-las.'}
              </p>
            )}
          </div>
        )}
      </div>
    );
  };

  const backlogTotals = totals(backlogTasks);
  const backlogOpen = isOpen(BACKLOG_KEY);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100/60 dark:bg-slate-950 p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
            <ListTodo className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Backlog & Planejamento de Sprints</h2>
            <p className="text-xs text-slate-500">
              Organização do backlog de produto, refinamento de requisitos e dimensionamento de escopo
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              onClick={openCreateSprint}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-indigo-200 dark:border-indigo-900 text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-950 transition-colors"
            >
              <CalendarPlus className="w-3.5 h-3.5" />
              <span>Nova Sprint</span>
            </button>
          )}
          {can('canCreateTask') && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Criar Item de Backlog</span>
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="flex items-center justify-between gap-3 text-xs px-4 py-2.5 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="font-semibold hover:underline">Fechar</button>
        </div>
      )}

      {!activeSprint && (
        <div className="text-xs px-4 py-3 rounded-lg border border-dashed border-slate-300 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60">
          Nenhuma sprint ativa neste quadro.{' '}
          {canManage &&
            (plannedSprints.length > 0
              ? 'Inicie uma das sprints planejadas abaixo.'
              : 'Crie uma nova sprint para começar a próxima iteração.')}
        </div>
      )}

      {activeSprint && renderSprintSection(activeSprint)}
      {plannedSprints.map(renderSprintSection)}

      {/* BACKLOG DE PRODUTO SECTION */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden">
        <div
          onClick={() => toggle(BACKLOG_KEY)}
          className="p-3 sm:p-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            {backlogOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
            <div>
              <span className="text-xs font-bold text-slate-900 dark:text-slate-100">Backlog de Produto (Fila Futura)</span>
              <span className="text-[11px] text-slate-400 ml-2">Demandas aguardando priorização</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{backlogTotals.points} pts</span>
            <span className="text-slate-400 text-[11px]">({backlogTasks.length} itens)</span>
          </div>
        </div>

        {backlogOpen && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {backlogTasks.map((task) => renderTaskRow(task, BACKLOG_KEY, false))}

            {backlogTasks.length === 0 && (
              <p className="text-xs text-slate-400 italic p-6 text-center">O backlog está vazio.</p>
            )}

            {/* Quick Add into Backlog */}
            {can('canCreateTask') && (
              <form onSubmit={handleQuickAdd} className="p-3 flex gap-2">
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
            )}
          </div>
        )}
      </div>

      {/* SPRINTS CONCLUÍDAS */}
      {completedSprints.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          >
            {showCompleted ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            <History className="w-3.5 h-3.5" />
            Sprints concluídas ({completedSprints.length})
          </button>
          {showCompleted && completedSprints.map(renderSprintSection)}
        </div>
      )}

      {sprintForm && (
        <SprintFormModal
          mode={sprintForm.mode}
          initial={sprintFormInitial()}
          onClose={() => setSprintForm(null)}
          onSubmit={handleSprintSubmit}
        />
      )}

      {completing && (() => {
        const list = listFor(completing.id);
        const done = list.filter((t) => isTaskDone(currentBoard, t.statusId)).length;
        return (
          <CompleteSprintModal
            sprint={completing}
            doneCount={done}
            pendingCount={list.length - done}
            plannedSprints={plannedSprints}
            onClose={() => setCompleting(null)}
            onConfirm={async (moveTo) => {
              await completeSprint(completing.id, moveTo);
            }}
          />
        );
      })()}
    </div>
  );
};
