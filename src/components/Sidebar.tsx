import React from 'react';
import {
  Kanban,
  ListTodo,
  CalendarCheck,
  Clock,
  BarChart3,
  Users,
  Radio,
  RotateCcw,
  Sparkles,
  ChevronRight,
  Flame,
  Keyboard,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { ViewTab } from '../types';

export const Sidebar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    currentBoard,
    boardTasks,
    resetToDemoData,
    integrations,
    setIsShortcutsModalOpen,
  } = useAgile();

  const totalTasks = boardTasks.length;
  const doneTasks = boardTasks.filter((t) => t.statusId === 'col-done').length;
  const progressPercent = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const totalEstimated = boardTasks.reduce((acc, t) => acc + (t.estimatedHours || 0), 0);
  const totalLogged = boardTasks.reduce((acc, t) => acc + (t.loggedHours || 0), 0);

  const navItems: { id: ViewTab; label: string; icon: React.FC<{ className?: string }>; badge?: string; shortcutKey: string }[] = [
    { id: 'kanban', label: 'Quadro Kanban', icon: Kanban, shortcutKey: '1' },
    { id: 'backlog', label: 'Backlog & Lista', icon: ListTodo, shortcutKey: '2' },
    { id: 'daily_dashboard', label: 'Acompanhamento Diário', icon: CalendarCheck, badge: 'Hoje', shortcutKey: '3' },
    { id: 'time_tracking', label: 'Gestão de Horas (Est. x Real)', icon: Clock, shortcutKey: '4' },
    { id: 'productivity_reports', label: 'Relatórios de Produtividade', icon: BarChart3, badge: 'Auto', shortcutKey: '5' },
    { id: 'member_performance', label: 'Desempenho por Membro', icon: Users, shortcutKey: '6' },
    { id: 'integrations', label: 'Canais de Comunicação', icon: Radio, shortcutKey: '7' },
  ];

  const enabledIntegrations = integrations.filter((i) => i.enabled).length;

  return (
    <aside className="w-64 bg-slate-50/80 dark:bg-slate-900/60 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 select-none overflow-y-auto">
      {/* Top Section: Navigation Links */}
      <div className="p-3 space-y-6">
        {/* Project Info Pill */}
        <div className="px-2 pt-1">
          <div className="flex items-center justify-between text-[11px] text-slate-500 font-semibold tracking-wider uppercase mb-1">
            <span>Visões Ágeis</span>
            <span className="text-indigo-600 font-mono text-[10px]">{currentBoard.key}</span>
          </div>
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
            {currentBoard.name}
          </div>
        </div>

        {/* Nav Links */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentView(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {item.badge && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-semibold shrink-0 ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                  <kbd
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded border transition-colors ${
                      isActive
                        ? 'bg-white/20 border-white/30 text-white font-bold'
                        : 'bg-slate-200/70 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 text-slate-400 group-hover:text-slate-600'
                    }`}
                  >
                    {item.shortcutKey}
                  </kbd>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Sprint Health Widget */}
        <div className="bg-white dark:bg-slate-800/80 rounded-xl p-3 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-500 fill-orange-500/20" />
              {currentBoard.sprintName}
            </span>
            <span className="text-[10px] font-mono text-emerald-600 font-semibold">{progressPercent}%</span>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-600 h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] border-t border-slate-100 dark:border-slate-700/60">
            <div>
              <p className="text-slate-400 text-[10px]">Tarefas</p>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                {doneTasks} <span className="text-slate-400 font-normal">/ {totalTasks}</span>
              </p>
            </div>
            <div>
              <p className="text-slate-400 text-[10px]">Horas Gastas</p>
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                {totalLogged.toFixed(1)}h <span className="text-slate-400 font-normal">/ {totalEstimated}h</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Section: Reset & Quick Status */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
          <span className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                enabledIntegrations > 0 ? 'bg-emerald-500' : 'bg-slate-400'
              }`}
            />
            {enabledIntegrations} canais integrados
          </span>
          <span className="text-[10px] text-slate-400 font-mono">v2.4</span>
        </div>

        <button
          onClick={() => setIsShortcutsModalOpen(true)}
          className="w-full flex items-center justify-between py-1.5 px-2 text-[11px] font-medium text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-md transition-colors"
          title="Ver todos os atalhos de teclado (Pressione '?')"
        >
          <span className="flex items-center gap-2">
            <Keyboard className="w-3.5 h-3.5 text-slate-400" />
            Atalhos de Teclado
          </span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-400">
            ?
          </kbd>
        </button>

        <button
          onClick={() => {
            if (confirm('Deseja restaurar os dados de demonstração com tarefas, membros e horas preenchidas?')) {
              resetToDemoData();
            }
          }}
          className="w-full flex items-center justify-center gap-2 py-1.5 px-2 text-[11px] font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800 rounded-md transition-colors"
          title="Restaura o estado inicial da demonstração"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Restaurar Dados Demo
        </button>
      </div>
    </aside>
  );
};
