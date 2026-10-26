import React, { useState } from 'react';
import { useAgile } from '../context/AgileContext';
import { Pause, Play, Square, ChevronDown, ChevronUp, Timer } from 'lucide-react';

const formatTimerSeconds = (totalSec: number) => {
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// Item 2 (Onda 2) — mini player flutuante do timer.
// Sempre visível enquanto houver timer na sessão; complementa o indicador da Navbar.
export const FloatingTimer: React.FC = () => {
  const { activeTimer, tasks, pauseTimer, resumeTimer, stopTimerAndLogWork } = useAgile();
  const [collapsed, setCollapsed] = useState(false);

  if (!activeTimer) return null;

  const task = tasks.find((t) => t.id === activeTimer.taskId);

  const togglePlay = () => {
    if (activeTimer.isRunning) pauseTimer();
    else resumeTimer();
  };

  return (
    <div className="fixed bottom-4 right-4 z-[55] w-64 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden select-none">
      {collapsed ? (
        <div className="flex items-center gap-2 px-3 py-2">
          <Timer className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100 flex-1 tabular-nums">
            {formatTimerSeconds(activeTimer.elapsedSeconds)}
          </span>
          <button
            onClick={togglePlay}
            title={activeTimer.isRunning ? 'Pausar timer' : 'Retomar timer'}
            className="p-1 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            {activeTimer.isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => stopTimerAndLogWork()}
            title="Parar e registrar horas"
            className="p-1 rounded-md text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
          >
            <Square className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setCollapsed(false)}
            title="Expandir player"
            className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between px-3 pt-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Timer className="w-4 h-4 text-indigo-500 shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 truncate">
                {task?.key || 'Tarefa'}
              </span>
            </div>
            <button
              onClick={() => setCollapsed(true)}
              title="Recolher player"
              className="p-1 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
          <div
            className="px-3 pb-0.5 text-xs font-medium text-slate-700 dark:text-slate-300 truncate"
            title={task?.title}
          >
            {task?.title || '—'}
          </div>
          <div className="px-3 pb-2.5 font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-50">
            {formatTimerSeconds(activeTimer.elapsedSeconds)}
          </div>
          <div className="flex border-t border-slate-200 dark:border-slate-700 divide-x divide-slate-200 dark:divide-slate-700">
            <button
              onClick={togglePlay}
              className="flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              {activeTimer.isRunning ? (
                <>
                  <Pause className="w-3.5 h-3.5" /> Pausar
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" /> Retomar
                </>
              )}
            </button>
            <button
              onClick={() => stopTimerAndLogWork()}
              title="Parar timer e registrar horas"
              className="flex-1 py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              <Square className="w-3.5 h-3.5" /> Parar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
