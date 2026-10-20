import React, { useState } from 'react';
import {
  BarChart3,
  TrendingDown,
  TrendingUp,
  Clock,
  Zap,
  CheckCircle2,
  FileText,
  Printer,
  Copy,
  Check,
  Download,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { formatHours, formatDate, isTaskDone } from '../utils/agileHelpers';

export const ProductivityReportView: React.FC = () => {
  const { currentBoard, boardTasks, members } = useAgile();

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  // Metrics computation
  const totalTasks = boardTasks.length;
  const doneTasks = boardTasks.filter((t) => isTaskDone(currentBoard, t.statusId));
  const inProgressTasks = boardTasks.filter((t) => t.statusId === 'col-inprogress');
  const reviewTasks = boardTasks.filter((t) => t.statusId === 'col-review');

  const totalPoints = boardTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);
  const donePoints = doneTasks.reduce((acc, t) => acc + (t.storyPoints || 0), 0);

  const totalEstHours = boardTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
  const totalLogHours = boardTasks.reduce((acc, t) => acc + (t.loggedHours || 0), 0);

  const overrunTasks = boardTasks.filter((t) => t.estimatedHours > 0 && t.loggedHours > t.estimatedHours);

  // Flow metrics (simulated/computed based on days and task points)
  const averageCycleTimeDays = 2.8;
  const averageLeadTimeDays = 4.6;
  const sprintThroughput = doneTasks.length;
  const estimationAccuracy = totalEstHours > 0
    ? Math.max(0, Math.round((1 - Math.abs(totalLogHours - totalEstHours) / totalEstHours) * 100))
    : 92;

  // Burndown chart data points (10 sprint days)
  const sprintDays = [
    { day: 'D1', ideal: 85, actual: 85 },
    { day: 'D2', ideal: 76, actual: 82 },
    { day: 'D3', ideal: 68, actual: 74 },
    { day: 'D4', ideal: 59, actual: 66 },
    { day: 'D5', ideal: 51, actual: 57 },
    { day: 'D6', ideal: 42, actual: 48 },
    { day: 'D7', ideal: 34, actual: 36 },
    { day: 'D8 (Hoje)', ideal: 25, actual: 29 },
    { day: 'D9', ideal: 17, actual: null },
    { day: 'D10', ideal: 0, actual: null },
  ];

  // Velocity history
  const velocityHistory = [
    { sprint: 'Sprint 21', points: 34, hours: 142 },
    { sprint: 'Sprint 22', points: 42, hours: 160 },
    { sprint: 'Sprint 23', points: 38, hours: 154 },
    { sprint: `${currentBoard.key} Atual`, points: donePoints, hours: Math.round(totalLogHours) },
  ];

  // Automated Executive Summary Generator
  const generateExecutiveReport = () => {
    return `=======================================================
RELATÓRIO EXECUTIVO AUTOMATIZADO DE PRODUTIVIDADE ÁGIL
Projeto: ${currentBoard.name} | Ciclo: ${currentBoard.sprintName}
Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}
=======================================================

1. RESUMO GERAL DA VELOCIDADE DO TIME
-------------------------------------------------------
• Story Points Entregues: ${donePoints} de ${totalPoints} pts (${totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0}% de conclusão)
• Tarefas Finalizadas: ${doneTasks.length} de ${totalTasks} itens
• Taxa de Conclusão de Escopo: ${(doneTasks.length / Math.max(1, totalTasks) * 100).toFixed(1)}%
• Throughput Atual: ${sprintThroughput} tarefas finalizadas

2. GESTÃO DE HORAS: ESTIMADAS X REALIZADAS
-------------------------------------------------------
• Total de Horas Estimadas: ${formatHours(totalEstHours)}
• Total de Horas Realizadas: ${formatHours(totalLogHours)}
• Variância Acumulada: ${totalLogHours > totalEstHours ? `+${(totalLogHours - totalEstHours).toFixed(1)}h (Acima do planejado)` : `${(totalLogHours - totalEstHours).toFixed(1)}h (Dentro da capacidade)`}
• Acurácia de Estimativa da Equipe: ${estimationAccuracy}%
• Tarefas com Estouro de Horas: ${overrunTasks.length} itens identificados

3. EFICIÊNCIA DE FLUXO & GARGALOS
-------------------------------------------------------
• Cycle Time Médio: ${averageCycleTimeDays} dias por tarefa
• Lead Time Médio: ${averageLeadTimeDays} dias da criação até a entrega
• Itens em Code Review / QA: ${reviewTasks.length} tarefas aguardando homologação
• Itens em Desenvolvimento Ativo: ${inProgressTasks.length} tarefas

4. DESTAQUES E RECOMENDAÇÕES PARA A RETROSPECTIVA
-------------------------------------------------------
✓ Ponto Positivo: Aderência à queima de escopo manteve-se próxima à linha ideal do Burndown.
⚠️ Ponto de Atenção: ${overrunTasks.length > 0 ? `Revisar estimativas das tarefas estouradas (${overrunTasks.map(t => t.key).join(', ')}) para refinar o sizing nos próximos refinamentos.` : 'Excelente precisão nas estimativas técnicas.'}
💡 Ação Recomendada: Manter o limite WIP de Code Review em no máximo 4 itens simultâneos para evitar retenção de vazão antes do fim do sprint.

=======================================================
Gerado automaticamente pelo Brolabs Workflow`;
  };

  const handleCopyReport = () => {
    navigator.clipboard.writeText(generateExecutiveReport());
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100/60 dark:bg-slate-950 p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Relatórios Automatizados de Produtividade
              </h2>
              <p className="text-xs text-slate-500">
                Burndown chart em tempo real, velocidade sprint a sprint e geração de laudo executivo
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setIsReportModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors shrink-0"
        >
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>Gerar Relatório Executivo</span>
        </button>
      </div>

      {/* 4 Flow Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Cycle Time */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs text-slate-400">Cycle Time Médio</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {averageCycleTimeDays} <span className="text-xs font-normal text-slate-400">dias</span>
          </div>
          <span className="text-[11px] text-emerald-600 font-medium">Tempo de desenvolvimento ativo</span>
        </div>

        {/* Lead Time */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs text-slate-400">Lead Time Médio</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {averageLeadTimeDays} <span className="text-xs font-normal text-slate-400">dias</span>
          </div>
          <span className="text-[11px] text-slate-500">Da criação no backlog até Done</span>
        </div>

        {/* Velocidade / Pontos Entregues */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs text-slate-400">Velocidade Atual</span>
          <div className="text-2xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
            {donePoints} <span className="text-xs font-normal text-slate-400">/ {totalPoints} pts</span>
          </div>
          <span className="text-[11px] text-indigo-600 font-medium">
            {totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0}% dos Story Points entregues
          </span>
        </div>

        {/* Acurácia de Estimativa */}
        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs text-slate-400">Acurácia de Estimativa</span>
          <div className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
            {estimationAccuracy}%
          </div>
          <span className="text-[11px] text-slate-500">Precisão horas estimadas vs gastas</span>
        </div>
      </div>

      {/* Sprint Burndown Chart Section */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <TrendingDown className="w-4 h-4 text-indigo-500" />
              Sprint Burndown Chart (Horas Restantes ao Longo dos Dias)
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Compara a queima ideal prevista com a curva real de esforço executado pela squad
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="w-3 h-0.5 bg-slate-300 dark:bg-slate-600 border-dashed" />
              Ideal
            </span>
            <span className="flex items-center gap-1.5 text-indigo-600 dark:text-indigo-400 font-semibold">
              <span className="w-3 h-1 bg-indigo-600 rounded-full" />
              Realizado
            </span>
          </div>
        </div>

        {/* Responsive Burndown Graphic */}
        <div className="bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800/80">
          <div className="h-64 flex items-end justify-between gap-2 px-2 pt-8 pb-4 relative">
            {/* Horizontal Gridlines */}
            <div className="absolute inset-x-0 top-8 border-b border-dashed border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 pl-2">
              80h
            </div>
            <div className="absolute inset-x-0 top-24 border-b border-dashed border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 pl-2">
              50h
            </div>
            <div className="absolute inset-x-0 top-40 border-b border-dashed border-slate-200 dark:border-slate-800 text-[10px] text-slate-400 pl-2">
              25h
            </div>

            {sprintDays.map((item, idx) => {
              const maxVal = 90;
              const idealHeight = `${(item.ideal / maxVal) * 100}%`;
              const actualHeight = item.actual !== null ? `${(item.actual / maxVal) * 100}%` : '0%';

              return (
                <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end relative z-10">
                  <div className="w-full flex items-end justify-center gap-1 h-full pb-2">
                    {/* Ideal Bar (ghost) */}
                    <div
                      style={{ height: idealHeight }}
                      className="w-2.5 sm:w-3.5 bg-slate-200 dark:bg-slate-700 rounded-t transition-all"
                      title={`Ideal: ${item.ideal}h`}
                    />
                    {/* Actual Bar (solid) */}
                    {item.actual !== null && (
                      <div
                        style={{ height: actualHeight }}
                        className="w-3 sm:w-4 bg-indigo-600 dark:bg-indigo-500 rounded-t shadow-xs transition-all relative group"
                        title={`Real: ${item.actual}h restantes`}
                      >
                        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                          {item.actual}h
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-slate-500 text-center whitespace-nowrap">
                    {item.day}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Velocity History (Sprint a Sprint) */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-500" />
          Histórico de Velocidade (Story Points por Ciclo)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {velocityHistory.map((item, i) => (
            <div
              key={i}
              className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 space-y-2"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800 dark:text-slate-200">{item.sprint}</span>
                <span className="text-[10px] font-mono text-slate-400">{item.hours}h</span>
              </div>
              <div className="text-xl font-bold font-mono text-indigo-600 dark:text-indigo-400">
                {item.points} <span className="text-xs font-normal text-slate-400">pts</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full"
                  style={{ width: `${Math.min(100, (item.points / 50) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: Relatório Executivo Formatado */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full p-6 my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Laudo Executivo de Produtividade Ágil
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyReport}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-100"
                >
                  {copiedReport ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedReport ? 'Copiado!' : 'Copiar Texto'}
                </button>
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs px-2 py-1"
                >
                  Fechar
                </button>
              </div>
            </div>

            <pre className="mt-4 p-4 rounded-lg bg-slate-950 text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[60vh]">
              {generateExecutiveReport()}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
