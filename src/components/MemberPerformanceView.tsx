import React, { useState } from 'react';
import {
  Users,
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertCircle,
  Award,
  ChevronRight,
  Calendar,
  Briefcase,
  Mail,
  Zap,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { Member } from '../types';
import { formatHours, formatDate } from '../utils/agileHelpers';
import { IssueTypeIcon, PriorityIcon } from './AgileIcons';

export const MemberPerformanceView: React.FC = () => {
  const { currentBoard, boardTasks, members, setSelectedTaskModalId } = useAgile();

  const [selectedMemberId, setSelectedMemberId] = useState<string>(members[0]?.id || '');

  const selectedMember = members.find((m) => m.id === selectedMemberId) || members[0];

  // Compute metrics for every member
  const memberStats = members.map((member) => {
    const memberTasks = boardTasks.filter((t) => t.assigneeId === member.id);
    const doneTasks = memberTasks.filter((t) => t.statusId === 'col-done');
    const inProgressTasks = memberTasks.filter((t) => t.statusId === 'col-inprogress');

    const estimatedHours = memberTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
    const loggedHours = memberTasks.reduce((acc, t) => acc + (t.loggedHours || 0), 0);

    // Worklogs registered by this member directly
    const memberWorklogs = boardTasks
      .flatMap((t) => t.worklogs || [])
      .filter((wl) => wl.memberId === member.id);
    const totalWorklogHours = memberWorklogs.reduce((acc, wl) => acc + wl.hours, 0);

    // On-time rate
    const onTimeRate =
      doneTasks.length > 0
        ? Math.round(
            (doneTasks.filter((t) => !t.dueDate || t.updatedAt.split('T')[0] <= t.dueDate).length /
              doneTasks.length) *
              100
          )
        : 100;

    // Capacity utilization (% of 40h)
    const utilizationRate = Math.min(100, Math.round((totalWorklogHours / member.weeklyCapacityHours) * 100));

    // Overrun tasks count
    const overrunCount = memberTasks.filter(
      (t) => t.estimatedHours > 0 && t.loggedHours > t.estimatedHours
    ).length;

    return {
      member,
      tasks: memberTasks,
      doneCount: doneTasks.length,
      inProgressCount: inProgressTasks.length,
      totalTasks: memberTasks.length,
      estimatedHours,
      loggedHours: totalWorklogHours,
      onTimeRate,
      utilizationRate,
      overrunCount,
      worklogs: memberWorklogs,
    };
  });

  const selectedStats = memberStats.find((s) => s.member.id === selectedMember.id) || memberStats[0];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100/60 dark:bg-slate-950 p-6 space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
            <Users className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Relatórios Detalhados de Desempenho por Membro
            </h2>
            <p className="text-xs text-slate-500">
              Produtividade individual, aderência a prazos, horas estimadas vs realizadas e capacidade do time
            </p>
          </div>
        </div>
      </div>

      {/* Team Capacity & Workload Allocation Overview */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          Distribuição da Carga de Trabalho & Alocação Semanal
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {memberStats.map(({ member, loggedHours, utilizationRate, doneCount, totalTasks }) => (
            <button
              key={member.id}
              onClick={() => setSelectedMemberId(member.id)}
              className={`p-3.5 rounded-xl border text-left transition-all relative ${
                member.id === selectedMember.id
                  ? 'border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <img
                  src={member.avatar}
                  alt={member.name}
                  className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{member.name}</p>
                  <p className="text-[10px] text-slate-400 truncate">{member.role}</p>
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Horas:</span>
                  <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                    {formatHours(loggedHours)} / {member.weeklyCapacityHours}h
                  </span>
                </div>

                <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      utilizationRate > 90 ? 'bg-amber-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${utilizationRate}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                  <span>{doneCount}/{totalTasks} entregues</span>
                  <span className="font-mono font-semibold">{utilizationRate}% carga</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Member Deep Dive */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (Profile & Metrics) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-5">
            {/* Header info */}
            <div className="flex items-center gap-3.5">
              <img
                src={selectedMember.avatar}
                alt={selectedMember.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 shadow-xs"
              />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{selectedMember.name}</h3>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{selectedMember.role}</p>
                <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    {selectedMember.department}
                  </span>
                  <span>•</span>
                  <span>{selectedMember.weeklyCapacityHours}h / semana</span>
                </div>
              </div>
            </div>

            {/* Individual KPI grid */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Horas Estimadas</span>
                <p className="text-lg font-bold font-mono text-slate-800 dark:text-slate-200 mt-0.5">
                  {formatHours(selectedStats.estimatedHours)}
                </p>
                <span className="text-[10px] text-slate-400">Total alocado</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Horas Apontadas</span>
                <p className="text-lg font-bold font-mono text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {formatHours(selectedStats.loggedHours)}
                </p>
                <span className="text-[10px] text-indigo-600">{selectedStats.utilizationRate}% da capacidade</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Taxa no Prazo</span>
                <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {selectedStats.onTimeRate}%
                </p>
                <span className="text-[10px] text-emerald-600">On-time delivery</span>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg">
                <span className="text-[10px] text-slate-400 font-semibold uppercase">Tarefas Concluídas</span>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                  {selectedStats.doneCount} <span className="text-xs font-normal text-slate-400">/ {selectedStats.totalTasks}</span>
                </p>
                <span className="text-[10px] text-slate-400">No sprint atual</span>
              </div>
            </div>

            {/* Performance Diagnosis */}
            <div className="p-3.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-lg border border-indigo-100 dark:border-indigo-900/40 text-xs space-y-1.5">
              <span className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-indigo-600" />
                Diagnóstico de Produtividade
              </span>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                {selectedMember.name} mantém um ritmo sólido de entrega com{' '}
                <strong className="text-indigo-700 dark:text-indigo-300">{selectedStats.onTimeRate}% de assertividade</strong> nos
                prazos estipulados. {selectedStats.overrunCount > 0 ? `Identificado estouro de horas em ${selectedStats.overrunCount} tarefa(s).` : 'Nenhum desvio crítico de tempo.'}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column (Tasks & Worklogs History) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Member's Tasks */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tarefas sob Responsabilidade ({selectedStats.tasks.length})
              </h3>
            </div>

            <div className="space-y-2 max-h-64 overflow-y-auto">
              {selectedStats.tasks.map((task) => {
                const col = currentBoard.columns.find((c) => c.id === task.statusId);
                const isOver = task.estimatedHours > 0 && task.loggedHours > task.estimatedHours;
                return (
                  <div
                    key={task.id}
                    onClick={() => setSelectedTaskModalId(task.id)}
                    className="p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-800/40 cursor-pointer transition-colors flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <IssueTypeIcon type={task.issueType} className="w-3.5 h-3.5 shrink-0" />
                      <div className="min-w-0">
                        <span className="font-mono font-bold text-slate-500 text-[11px]">{task.key}</span>
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{task.title}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {formatHours(task.loggedHours)}/{formatHours(task.estimatedHours)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                        {col?.title}
                      </span>
                    </div>
                  </div>
                );
              })}

              {selectedStats.tasks.length === 0 && (
                <p className="text-xs text-slate-400 italic py-4 text-center">
                  Nenhuma tarefa atribuída a este colaborador no quadro atual.
                </p>
              )}
            </div>
          </div>

          {/* Member's Recent Worklogs */}
          <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Histórico Recente de Horas Apontadas ({selectedStats.worklogs.length})
            </h3>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {selectedStats.worklogs.map((wl) => {
                const parentTask = boardTasks.find((t) => t.id === wl.taskId);
                return (
                  <div
                    key={wl.id}
                    className="p-2.5 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/30 flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-[11px]">
                          {parentTask?.key || 'Tarefa'}
                        </span>
                        <span className="text-[10px] text-slate-400">{formatDate(wl.date)}</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 text-xs mt-0.5">{wl.comment}</p>
                    </div>

                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded text-xs shrink-0">
                      +{formatHours(wl.hours)}
                    </span>
                  </div>
                );
              })}

              {selectedStats.worklogs.length === 0 && (
                <p className="text-xs text-slate-400 italic py-2 text-center">
                  Nenhum apontamento registrado ainda neste período.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
