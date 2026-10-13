import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Kanban,
  ListTodo,
  CalendarCheck,
  Clock,
  BarChart3,
  Users,
  Radio,
  Plus,
  Play,
  Pause,
  UserCheck,
  Keyboard,
  Layers,
  ArrowRight,
  Mail,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { ViewTab } from '../types';

interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Navegação' | 'Ações' | 'Quadros';
  icon: React.FC<{ className?: string }>;
  shortcut?: string;
  run: () => void;
}

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    setCurrentView,
    setIsCreateModalOpen,
    setIsShortcutsModalOpen,
    setIsEmailDrawerOpen,
    boards,
    setCurrentBoardId,
    activeTimer,
    startTimer,
    pauseTimer,
    boardTasks,
    filters,
    setFilters,
  } = useAgile();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  const commands: CommandItem[] = [
    // Views
    {
      id: 'view-kanban',
      title: 'Abrir Quadro Kanban',
      subtitle: 'Visualizar colunas de fluxo, WIP limits e cards',
      category: 'Navegação',
      icon: Kanban,
      shortcut: '1',
      run: () => setCurrentView('kanban'),
    },
    {
      id: 'view-backlog',
      title: 'Abrir Backlog & Planejamento',
      subtitle: 'Organizar itens de backlog e sprints futuros',
      category: 'Navegação',
      icon: ListTodo,
      shortcut: '2',
      run: () => setCurrentView('backlog'),
    },
    {
      id: 'view-daily',
      title: 'Abrir Acompanhamento Diário',
      subtitle: 'Daily standup, resumo em 4 quadrantes e feed ao vivo',
      category: 'Navegação',
      icon: CalendarCheck,
      shortcut: '3',
      run: () => setCurrentView('daily_dashboard'),
    },
    {
      id: 'view-time',
      title: 'Abrir Gestão de Horas (Est. x Real)',
      subtitle: 'Análise de variância, estouros e timesheet',
      category: 'Navegação',
      icon: Clock,
      shortcut: '4',
      run: () => setCurrentView('time_tracking'),
    },
    {
      id: 'view-reports',
      title: 'Abrir Relatórios de Produtividade',
      subtitle: 'Sprint burndown, velocidade e relatório executivo',
      category: 'Navegação',
      icon: BarChart3,
      shortcut: '5',
      run: () => setCurrentView('productivity_reports'),
    },
    {
      id: 'view-members',
      title: 'Abrir Desempenho por Membro',
      subtitle: 'Capacidade semanal, on-time rate e entregas',
      category: 'Navegação',
      icon: Users,
      shortcut: '6',
      run: () => setCurrentView('member_performance'),
    },
    {
      id: 'view-integrations',
      title: 'Abrir Canais de Comunicação',
      subtitle: 'Configurações de webhooks Slack, Discord e Teams',
      category: 'Navegação',
      icon: Radio,
      shortcut: '7',
      run: () => setCurrentView('integrations'),
    },

    // Actions
    {
      id: 'action-create',
      title: 'Criar Nova Tarefa',
      subtitle: 'Adicionar história, tarefa, bug ou épico',
      category: 'Ações',
      icon: Plus,
      shortcut: 'C',
      run: () => setIsCreateModalOpen(true),
    },
    {
      id: 'action-timer',
      title: activeTimer?.isRunning ? 'Pausar Cronômetro Ativo' : 'Iniciar Cronômetro',
      subtitle: activeTimer ? 'Controlar sessão de apontamento de tempo' : 'Iniciar cronômetro na primeira tarefa ativa',
      category: 'Ações',
      icon: activeTimer?.isRunning ? Pause : Play,
      shortcut: 'T',
      run: () => {
        if (activeTimer) {
          if (activeTimer.isRunning) pauseTimer();
          else startTimer(activeTimer.taskId);
        } else if (boardTasks.length > 0) {
          startTimer(boardTasks[0].id);
        }
      },
    },
    {
      id: 'action-my-tasks',
      title: filters.onlyMyTasks ? 'Exibir Tarefas de Toda a Equipe' : 'Filtrar Somente Minhas Tarefas',
      subtitle: 'Alternar visão entre suas tarefas e as de todo o squad',
      category: 'Ações',
      icon: UserCheck,
      shortcut: 'M',
      run: () => setFilters((prev) => ({ ...prev, onlyMyTasks: !prev.onlyMyTasks })),
    },
    {
      id: 'action-shortcuts',
      title: 'Ver Atalhos de Teclado',
      subtitle: 'Lista completa de atalhos e teclas de atalho',
      category: 'Ações',
      icon: Keyboard,
      shortcut: '?',
      run: () => setIsShortcutsModalOpen(true),
    },
    {
      id: 'action-email-alerts',
      title: 'Abrir Notificações por Email & Caixa de Saída',
      subtitle: 'Histórico de alertas enviados (status, menções) e preferências',
      category: 'Ações',
      icon: Mail,
      shortcut: 'E',
      run: () => setIsEmailDrawerOpen(true),
    },

    // Boards
    ...boards.map((b) => ({
      id: `board-${b.id}`,
      title: `Alternar para o Quadro: ${b.name}`,
      subtitle: `Chave: ${b.key} • ${b.sprintName}`,
      category: 'Quadros' as const,
      icon: Layers,
      run: () => setCurrentBoardId(b.id),
    })),
  ];

  const filteredCommands = commands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q)) ||
      cmd.category.toLowerCase().includes(q) ||
      (cmd.shortcut && cmd.shortcut.toLowerCase() === q)
    );
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].run();
        setIsCommandPaletteOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsCommandPaletteOpen(false);
    }
  };

  return (
    <div
      onClick={() => setIsCommandPaletteOpen(false)}
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-start justify-center pt-20 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100"
      >
        {/* Search input */}
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-4 h-4 text-slate-400 shrink-0 ml-1" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Digite um comando, atalho ou pesquise uma visão (ex: 'Kanban', 'C', 'Daily')..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 shrink-0">
            Esc
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredCommands.map((cmd, index) => {
            const Icon = cmd.icon;
            const isSelected = index === selectedIndex;
            return (
              <div
                key={cmd.id}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={() => {
                  cmd.run();
                  setIsCommandPaletteOpen(false);
                }}
                className={`flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`p-1.5 rounded-md ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : ''}`}>
                      {cmd.title}
                    </p>
                    {cmd.subtitle && (
                      <p
                        className={`text-[11px] truncate ${
                          isSelected ? 'text-indigo-100' : 'text-slate-400'
                        }`}
                      >
                        {cmd.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {cmd.shortcut && (
                    <kbd
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
                        isSelected
                          ? 'bg-white/20 border-white/30 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                      }`}
                    >
                      {cmd.shortcut}
                    </kbd>
                  )}
                  {isSelected && <ArrowRight className="w-3.5 h-3.5 text-white/80" />}
                </div>
              </div>
            );
          })}

          {filteredCommands.length === 0 && (
            <div className="py-8 text-center text-xs text-slate-400">
              Nenhum comando correspondente encontrado para "{query}"
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-3">
            <span>↑↓ para navegar</span>
            <span>↵ para executar</span>
            <span>Esc para sair</span>
          </div>
          <span className="text-[10px] text-slate-400">Brolabs Command Palette</span>
        </div>
      </div>
    </div>
  );
};
