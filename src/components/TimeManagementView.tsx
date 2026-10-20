import React, { useState } from 'react';
import {
  Clock,
  AlertTriangle,
  TrendingUp,
  Download,
  Plus,
  Filter,
  CheckCircle2,
  Calendar,
  Layers,
  Search,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { formatHours, formatDate, isTaskDone } from '../utils/agileHelpers';
import { IssueTypeIcon } from './AgileIcons';

export const TimeManagementView: React.FC = () => {
  const {
    currentBoard,
    boardTasks,
    members,
    currentUser,
    addWorklog,
    setSelectedTaskModalId,
  } = useAgile();

  // Filters
  const [filterType, setFilterType] = useState<'all' | 'overrun' | 'completed' | 'in_progress'>('all');
  const [memberFilter, setMemberFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Quick worklog inline form
  const [selectedTaskId, setSelectedTaskId] = useState(boardTasks[0]?.id || '');
  const [logHours, setLogHours] = useState('2');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logComment, setLogComment] = useState('');
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);

  // Totals
  const totalEstimated = boardTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
  const totalLogged = boardTasks.reduce((acc, t) => acc + (t.loggedHours || 0), 0);
  const totalVariance = Number((totalLogged - totalEstimated).toFixed(1));

  // Overrun tasks
  const overrunTasks = boardTasks.filter((t) => t.estimatedHours > 0 && t.loggedHours > t.estimatedHours);

  // Accuracy calculation: sum of abs differences vs estimated
  const accuracyPercent =
    totalEstimated > 0
      ? Math.max(0, Math.round((1 - Math.abs(totalLogged - totalEstimated) / totalEstimated) * 100))
      : 100;

  // Filtered tasks for the variance table
  const displayedTasks = boardTasks.filter((t) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!t.key.toLowerCase().includes(q) && !t.title.toLowerCase().includes(q)) return false;
    }
    if (memberFilter !== 'all' && t.assigneeId !== memberFilter) return false;
    if (filterType === 'overrun') {
      return t.estimatedHours > 0 && t.loggedHours > t.estimatedHours;
    }
    if (filterType === 'completed') {
      return isTaskDone(currentBoard, t.statusId);
    }
    if (filterType === 'in_progress') {
      return t.statusId === 'col-inprogress';
    }
    return true;
  });

  const handleQuickLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hrs = parseFloat(logHours);
    if (!selectedTaskId || isNaN(hrs) || hrs <= 0) return;
    addWorklog(selectedTaskId, hrs, logDate, logComment.trim() || 'Apontamento de horas');
    setLogComment('');
    setShowQuickLogModal(false);
  };

  // CSV export
  const handleExportCSV = () => {
    const headers = ['Chave', 'Titulo', 'Tipo', 'Responsavel', 'Status', 'Horas Estimadas', 'Horas Realizadas', 'Variancia (h)'];
    const rows = boardTasks.map((t) => {
      const member = members.find((m) => m.id === t.assigneeId)?.name || 'N/A';
      const col = currentBoard.columns.find((c) => c.id === t.statusId)?.title || 'N/A';
      const variance = (t.loggedHours - t.estimatedHours).toFixed(1);
      return `"${t.key}","${t.title.replace(/"/g, '""')}","${t.issueType}","${member}","${col}",${t.estimatedHours},${t.loggedHours},${variance}`;
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `timesheet_${currentBoard.key}_${todayStr()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const todayStr = () => new Date().toISOString().split('T')[0];

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100/60 dark:bg-slate-950 p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Clock className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Gestão de Horas: Estimadas x Realizadas
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhamento de orçamento de tempo, desvio de cronograma e apontamento de esforço da equipe
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowQuickLogModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Registrar Horas</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-slate-700 dark:text-slate-200 shadow-2xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Exportar CSV</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Estimado */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs text-slate-400">Total Horas Estimadas</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {formatHours(totalEstimated)}
          </div>
          <span className="text-[11px] text-slate-500">Planejadas para o sprint</span>
        </div>

        {/* Total Realizado */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs text-slate-400">Total Horas Realizadas</span>
          <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
            {formatHours(totalLogged)}
          </div>
          <span className="text-[11px] text-indigo-600 font-medium">
            {totalEstimated > 0 ? ((totalLogged / totalEstimated) * 100).toFixed(1) : 0}% consumido
          </span>
        </div>

        {/* Variância / Desvio */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs text-slate-400">Desvio Acumulado (Variance)</span>
          <div
            className={`text-2xl font-bold font-mono ${
              totalVariance > 0
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {totalVariance > 0 ? `+${totalVariance}h` : `${totalVariance}h`}
          </div>
          <span className="text-[11px] text-slate-500">
            {totalVariance > 0 ? 'Horas além da estimativa inicial' : 'Dentro do teto previsto'}
          </span>
        </div>

        {/* Acurácia de Estimativa */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs text-slate-400">Acurácia de Estimativas</span>
          <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 font-mono">
            {accuracyPercent}%
          </div>
          <span className="text-[11px] text-slate-500">
            {overrunTasks.length} {overrunTasks.length === 1 ? 'tarefa estourada' : 'tarefas estouradas'}
          </span>
        </div>
      </div>

      {/* Visual Progress Bar by Epic */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-indigo-500" />
          Distribuição de Horas por Épico (Estimado vs Realizado)
        </h3>

        <div className="space-y-3">
          {currentBoard.epics?.map((epic) => {
            const epicTasks = boardTasks.filter((t) => t.epicId === epic.id);
            const epicEst = epicTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
            const epicLog = epicTasks.reduce((acc, t) => acc + (t.loggedHours || 0), 0);
            const pct = epicEst > 0 ? Math.min(100, Math.round((epicLog / epicEst) * 100)) : 0;
            const isEpicOverrun = epicEst > 0 && epicLog > epicEst;

            return (
              <div key={epic.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: epic.color }}
                    />
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{epic.name}</span>
                    <span className="text-slate-400 text-[11px]">({epicTasks.length} tarefas)</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className={isEpicOverrun ? 'text-rose-600 font-bold' : 'text-slate-700 dark:text-slate-300'}>
                      {formatHours(epicLog)}
                    </span>
                    <span className="text-slate-400">/</span>
                    <span className="text-slate-500">{formatHours(epicEst)}</span>
                    <span className="text-slate-400 text-[10px]">({pct}%)</span>
                  </div>
                </div>

                <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isEpicOverrun ? 'bg-rose-500' : 'bg-indigo-600'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Variance Analysis Table */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden space-y-3 p-5">
        {/* Table Filters */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Análise Detalhada de Horas por Tarefa
            </span>
            <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-0.5 rounded font-mono">
              {displayedTasks.length} itens
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter segments */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg text-xs">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilterType('overrun')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  filterType === 'overrun'
                    ? 'bg-rose-500 text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Estouradas ({overrunTasks.length})
              </button>
              <button
                onClick={() => setFilterType('in_progress')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  filterType === 'in_progress'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Em Andamento
              </button>
              <button
                onClick={() => setFilterType('completed')}
                className={`px-2.5 py-1 rounded font-medium transition-colors ${
                  filterType === 'completed'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Concluídas
              </button>
            </div>

            {/* Member selector */}
            <select
              value={memberFilter}
              onChange={(e) => setMemberFilter(e.target.value)}
              className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-300"
            >
              <option value="all">Todos os Membros</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Tarefa</th>
                <th className="py-2.5 px-3">Responsável</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Estimado</th>
                <th className="py-2.5 px-3 text-right">Realizado</th>
                <th className="py-2.5 px-3 text-right">Desvio</th>
                <th className="py-2.5 px-3">Progresso de Tempo</th>
                <th className="py-2.5 px-3 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {displayedTasks.map((task) => {
                const assignee = members.find((m) => m.id === task.assigneeId);
                const col = currentBoard.columns.find((c) => c.id === task.statusId);
                const est = task.estimatedHours || 0;
                const log = task.loggedHours || 0;
                const variance = Number((log - est).toFixed(1));
                const isOver = est > 0 && log > est;
                const pct = est > 0 ? Math.min(100, Math.round((log / est) * 100)) : 0;

                return (
                  <tr
                    key={task.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                    onClick={() => setSelectedTaskModalId(task.id)}
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <IssueTypeIcon type={task.issueType} className="w-3.5 h-3.5 shrink-0" />
                        <div>
                          <span className="font-mono font-bold text-slate-600 dark:text-slate-400">
                            {task.key}
                          </span>
                          <p className="font-semibold text-slate-800 dark:text-slate-200 max-w-xs truncate">
                            {task.title}
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <img
                          src={assignee?.avatar}
                          alt={assignee?.name}
                          className="w-5 h-5 rounded-full object-cover"
                        />
                        <span className="text-slate-700 dark:text-slate-300 font-medium truncate max-w-[100px]">
                          {assignee?.name || 'N/A'}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {col?.title}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-500">
                      {formatHours(est)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                      {formatHours(log)}
                    </td>

                    <td className="py-3 px-3 text-right font-mono">
                      {isOver ? (
                        <span className="text-rose-600 dark:text-rose-400 font-bold">
                          +{variance}h
                        </span>
                      ) : variance < 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          {variance}h
                        </span>
                      ) : (
                        <span className="text-slate-400">0h</span>
                      )}
                    </td>

                    <td className="py-3 px-3 min-w-[120px]">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                          <span>{pct}%</span>
                          {isOver && <span className="text-rose-500 font-bold">Estourado</span>}
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isOver ? 'bg-rose-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => {
                          setSelectedTaskId(task.id);
                          setShowQuickLogModal(true);
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 rounded transition-colors"
                      >
                        + Horas
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Worklog Modal */}
      {showQuickLogModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              Registrar Horas de Trabalho
            </h3>

            <form onSubmit={handleQuickLogSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Selecionar Tarefa *
                </label>
                <select
                  value={selectedTaskId}
                  onChange={(e) => setSelectedTaskId(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {boardTasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.key} - {t.title.slice(0, 45)}...
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Horas Gastas *
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.1"
                    required
                    value={logHours}
                    onChange={(e) => setLogHours(e.target.value)}
                    className="w-full font-mono text-xs px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Data do Apontamento
                  </label>
                  <input
                    type="date"
                    required
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Descrição da Atividade
                </label>
                <input
                  type="text"
                  placeholder="Ex: Code review de PR e validação do fluxo de MFA"
                  value={logComment}
                  onChange={(e) => setLogComment(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowQuickLogModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded shadow-xs"
                >
                  Salvar Apontamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
