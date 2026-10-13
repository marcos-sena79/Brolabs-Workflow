import React, { useState } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Flame,
  TrendingUp,
  Activity,
  UserCheck,
  ArrowRight,
  FileText,
  Copy,
  Check,
  Zap,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { formatHours, formatDate, formatRelativeTime, isOverdue } from '../utils/agileHelpers';
import { IssueTypeIcon, PriorityIcon } from './AgileIcons';

export const DailyDashboard: React.FC = () => {
  const {
    currentBoard,
    boardTasks,
    members,
    activityLogs,
    setSelectedTaskModalId,
    currentUser,
  } = useAgile();

  const [copiedStandup, setCopiedStandup] = useState(false);

  // Today ISO
  const todayStr = new Date().toISOString().split('T')[0];

  // Daily metrics
  const doneTasks = boardTasks.filter((t) => t.statusId === 'col-done');
  const inProgressTasks = boardTasks.filter((t) => t.statusId === 'col-inprogress');
  const todoTasks = boardTasks.filter((t) => t.statusId === 'col-todo');
  const reviewTasks = boardTasks.filter((t) => t.statusId === 'col-review');

  // Tasks in risk (overdue or logged > estimated)
  const atRiskTasks = boardTasks.filter((t) => {
    const isDone = t.statusId === 'col-done';
    const overdue = isOverdue(t.dueDate, isDone);
    const overrun = t.estimatedHours > 0 && t.loggedHours > t.estimatedHours;
    return (!isDone && overdue) || overrun;
  });

  // Hours today across all worklogs
  const allWorklogs = boardTasks.flatMap((t) => t.worklogs || []);
  const todayWorklogs = allWorklogs.filter((wl) => wl.date === todayStr);
  const totalHoursToday = todayWorklogs.reduce((acc, wl) => acc + wl.hours, 0);

  // Sprint totals
  const totalEstimated = boardTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
  const totalLogged = boardTasks.reduce((acc, t) => acc + (t.loggedHours || 0), 0);
  const sprintBurnPercent = totalEstimated > 0 ? Math.min(100, Math.round((totalLogged / totalEstimated) * 100)) : 0;

  // Generate Daily Standup Summary text
  const generateStandupText = () => {
    const doneLines = doneTasks.slice(0, 3).map((t) => `• [${t.key}] ${t.title}`).join('\n');
    const inProgLines = inProgressTasks.slice(0, 4).map((t) => `• [${t.key}] ${t.title} (${t.loggedHours}h/${t.estimatedHours}h)`).join('\n');
    const riskLines = atRiskTasks.length > 0
      ? atRiskTasks.map((t) => `• ⚠️ [${t.key}] ${t.title} (Requer atenção)`).join('\n')
      : '• Nenhum impedimento crítico relatado hoje.';

    return `*Acompanhamento Diário - Daily Standup (${formatDate(todayStr)})*
Quadro: ${currentBoard.name} (${currentBoard.sprintName})

✅ *O que foi concluído:*
${doneLines || '• Nenhuma tarefa finalizada nas últimas 24h.'}

⏳ *Em andamento hoje:*
${inProgLines || '• Nenhuma tarefa em andamento.'}

🚨 *Impedimentos e Riscos:*
${riskLines}

📊 *Métricas de Horas:*
• Horas Apontadas Hoje: ${formatHours(totalHoursToday)}
• Progresso do Sprint: ${totalLogged.toFixed(1)}h de ${totalEstimated}h (${sprintBurnPercent}%)`;
  };

  const handleCopyStandup = () => {
    navigator.clipboard.writeText(generateStandupText());
    setCopiedStandup(true);
    setTimeout(() => setCopiedStandup(false), 2500);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100/60 dark:bg-slate-950 p-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <CalendarCheck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Acompanhamento Diário & Daily Standup
              </h2>
              <p className="text-xs text-slate-500">
                Visão consolidada do fluxo de trabalho diário • {formatDate(todayStr)} • {currentBoard.sprintName}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyStandup}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800/60 transition-colors"
          >
            {copiedStandup ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ata Copiada!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Resumo da Daily</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 4 Top KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Tarefas Concluídas */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tarefas Concluídas</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
            {doneTasks.length} <span className="text-xs font-normal text-slate-400">/ {boardTasks.length}</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">
            {boardTasks.length > 0 ? Math.round((doneTasks.length / boardTasks.length) * 100) : 0}% de taxa de entrega
          </div>
        </div>

        {/* Card 2: Horas Realizadas vs Estimadas */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Horas Gastas no Sprint</span>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {totalLogged.toFixed(1)}h <span className="text-xs font-normal text-slate-400">/ {totalEstimated}h</span>
          </div>
          <div className="text-[11px] text-indigo-600 font-medium">
            {sprintBurnPercent}% do esforço estimado consumido
          </div>
        </div>

        {/* Card 3: Itens em Risco / Atenção */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Itens em Risco / Atrasados</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400">
            {atRiskTasks.length}
          </div>
          <div className="text-[11px] text-slate-500">
            {atRiskTasks.length > 0 ? 'Requer intervenção no daily' : 'Fluxo sem impedimentos'}
          </div>
        </div>

        {/* Card 4: Apontamentos Hoje */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Apontamentos Hoje</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {formatHours(totalHoursToday)}
          </div>
          <div className="text-[11px] text-slate-500">
            {todayWorklogs.length} registros computados hoje
          </div>
        </div>
      </div>

      {/* Main Grid: 4-Quadrant Standup Board + Real-time Activity Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Cols: Quadrants of Daily Standup */}
        <div className="lg:col-span-8 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Quadro de Standup Diário
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Quadrant 1: O Que Está em Andamento Hoje */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Em Andamento Ativo ({inProgressTasks.length})
                </span>
                <span className="text-[10px] text-slate-400">Prioridade alta</span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {inProgressTasks.map((task) => {
                  const assignee = members.find((m) => m.id === task.assigneeId);
                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskModalId(task.id)}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 hover:border-indigo-400 cursor-pointer bg-slate-50/50 dark:bg-slate-800/40 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-mono font-semibold text-slate-500">{task.key}</span>
                        <div className="flex items-center gap-1 font-mono text-[10px]">
                          <span>{formatHours(task.loggedHours)}</span>
                          <span className="text-slate-400">/</span>
                          <span className="text-slate-500">{formatHours(task.estimatedHours)}</span>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{task.title}</p>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 dark:border-slate-700/60 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <img src={assignee?.avatar} alt={assignee?.name} className="w-4 h-4 rounded-full object-cover" />
                          <span>{assignee?.name.split(' ')[0]}</span>
                        </span>
                        <PriorityIcon priority={task.priority} />
                      </div>
                    </div>
                  );
                })}

                {inProgressTasks.length === 0 && (
                  <p className="text-xs text-slate-400 py-4 text-center italic">
                    Nenhuma tarefa em andamento no momento.
                  </p>
                )}
              </div>
            </div>

            {/* Quadrant 2: Itens em Risco e Gargalos */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-rose-200 dark:border-rose-950/60 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-rose-100 dark:border-rose-900/40">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Gargalos & Riscos ({atRiskTasks.length})
                </span>
                <span className="text-[10px] text-rose-500">Atenção imediata</span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {atRiskTasks.map((task) => {
                  const assignee = members.find((m) => m.id === task.assigneeId);
                  const isOverrun = task.estimatedHours > 0 && task.loggedHours > task.estimatedHours;
                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskModalId(task.id)}
                      className="p-2.5 rounded-lg border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 hover:border-rose-400 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-mono font-semibold text-rose-700 dark:text-rose-400">{task.key}</span>
                        {isOverrun && (
                          <span className="text-[9px] font-bold text-rose-600 bg-rose-100 dark:bg-rose-900/60 px-1 py-0.2 rounded">
                            +{Number((task.loggedHours - task.estimatedHours).toFixed(1))}h acima
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{task.title}</p>
                      <div className="flex items-center justify-between mt-2 pt-1 border-t border-rose-100 dark:border-rose-900/40 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <img src={assignee?.avatar} alt={assignee?.name} className="w-4 h-4 rounded-full object-cover" />
                          <span>{assignee?.name.split(' ')[0]}</span>
                        </span>
                        <span className="text-rose-600 font-semibold">Prazo: {formatDate(task.dueDate)}</span>
                      </div>
                    </div>
                  );
                })}

                {atRiskTasks.length === 0 && (
                  <div className="py-6 text-center text-xs text-slate-400">
                    🎉 Nenhuma tarefa em atraso ou com estouro de horas!
                  </div>
                )}
              </div>
            </div>

            {/* Quadrant 3: Entregas Recentes / Concluídas */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  Concluídas no Ciclo ({doneTasks.length})
                </span>
                <span className="text-[10px] text-emerald-600">Entregues</span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {doneTasks.map((task) => {
                  const assignee = members.find((m) => m.id === task.assigneeId);
                  return (
                    <div
                      key={task.id}
                      onClick={() => setSelectedTaskModalId(task.id)}
                      className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 hover:border-emerald-400 cursor-pointer bg-emerald-50/20 dark:bg-emerald-950/10 transition-colors"
                    >
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-mono font-semibold text-slate-500">{task.key}</span>
                        <span className="text-[10px] font-mono text-emerald-600">{task.loggedHours}h gastas</span>
                      </div>
                      <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{task.title}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quadrant 4: Em Code Review / QA */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-500" />
                  Code Review / QA ({reviewTasks.length})
                </span>
                <span className="text-[10px] text-purple-600">Validação</span>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto">
                {reviewTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskModalId(task.id)}
                    className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700/60 hover:border-purple-400 cursor-pointer bg-slate-50/50 dark:bg-slate-800/40 transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-mono font-semibold text-slate-500">{task.key}</span>
                      <PriorityIcon priority={task.priority} />
                    </div>
                    <p className="text-xs font-medium text-slate-800 dark:text-slate-200 line-clamp-1">{task.title}</p>
                  </div>
                ))}

                {reviewTasks.length === 0 && (
                  <p className="text-xs text-slate-400 py-4 text-center italic">
                    Nenhuma tarefa em revisão no momento.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Cols: Live Team Activity Stream */}
        <div className="lg:col-span-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-indigo-500" />
              Feed em Tempo Real
            </h3>
            <span className="text-[10px] text-emerald-600 font-medium">Ao vivo</span>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[560px] overflow-y-auto">
            {activityLogs.map((act) => (
              <div
                key={act.id}
                onClick={() => {
                  if (act.taskId && act.taskId !== 'system') {
                    setSelectedTaskModalId(act.taskId);
                  }
                }}
                className="p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{act.memberName}</span>
                  <span className="text-[10px] text-slate-400">{formatRelativeTime(act.timestamp)}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">{act.details}</p>
                {act.taskKey && (
                  <div className="mt-1 flex items-center gap-1">
                    <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded">
                      {act.taskKey}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[180px]">{act.taskTitle}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
