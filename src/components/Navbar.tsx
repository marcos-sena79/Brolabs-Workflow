import React, { useState } from 'react';
import {
  Layers,
  Search,
  Plus,
  Play,
  Pause,
  Square,
  Bell,
  ChevronDown,
  X,
  ExternalLink,
  Kanban,
  CheckCircle2,
  Keyboard,
  Command,
  Mail,
  Database,
  RefreshCw,
  Check,
  Menu,
  LogOut,
  LogIn,
  User,
  Settings,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { useAuth } from '../context/AuthContext';
import { formatHours, formatRelativeTime } from '../utils/agileHelpers';

export const Navbar: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
  const {
    boards,
    currentBoardId,
    currentBoard,
    setCurrentBoardId,
    filters,
    setFilters,
    currentUser,
    members,
    setCurrentUserId,
    activeTimer,
    pauseTimer,
    resumeTimer,
    stopTimerAndLogWork,
    setIsCreateModalOpen,
    setIsShortcutsModalOpen,
    setIsCommandPaletteOpen,
    activityLogs,
    tasks,
    createBoard,
    integrations,
    setSelectedTaskModalId,
    emailNotifications,
    setIsEmailDrawerOpen,
    dbConnected,
    isLoading,
    refetchDbData,
    resetToDemoData,
    setIsBoardSettingsOpen,
  } = useAgile();

  const { member: authMember, isAuthenticated, login, logout, isLoading: authLoading } = useAuth();

  const [isBoardDropdownOpen, setIsBoardDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isActivityOpen, setIsActivityOpen] = useState(false);
  const [isNewBoardModalOpen, setIsNewBoardModalOpen] = useState(false);
  const [isDbModalOpen, setIsDbModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);

  // New Board Form State
  const [newBoardName, setNewBoardName] = useState('');
  const [newBoardKey, setNewBoardKey] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');
  const [newBoardSprint, setNewBoardSprint] = useState('Sprint 1');

  // Timer formatted
  const formatTimerSeconds = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const timerTask = activeTimer ? tasks.find((t) => t.id === activeTimer.taskId) : null;

  const handleCreateBoardSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim() || !newBoardKey.trim()) return;
    createBoard({
      name: newBoardName.trim(),
      key: newBoardKey.trim().toUpperCase(),
      description: newBoardDesc.trim(),
      sprintName: newBoardSprint.trim(),
    });
    setNewBoardName('');
    setNewBoardKey('');
    setNewBoardDesc('');
    setIsNewBoardModalOpen(false);
    setIsBoardDropdownOpen(false);
  };

  const enabledIntegrationsCount = integrations.filter((i) => i.enabled).length;

  return (
    <header className="sticky top-0 z-30 h-14 sm:h-16 shrink-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-2 sm:px-4 lg:px-6 flex items-center justify-between gap-2 sm:gap-4">
      {/* Left: Branding & Board Selector */}
      <div className="flex items-center gap-1 sm:gap-4 min-w-0">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md shrink-0"
          aria-label="Abrir menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="hidden sm:flex items-center gap-2.5 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm shadow-indigo-200 dark:shadow-none">
            <Kanban className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base text-slate-900 dark:text-slate-100 tracking-tight">Brolabs</span>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded">Workflow</span>
            </div>
            <p className="text-[11px] text-slate-400 -mt-0.5 font-medium hidden sm:block">Gestão de Equipes & Produtividade</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 hidden md:block" />

        {/* Board Dropdown */}
        <div className="relative min-w-0">
          <button
            onClick={() => setIsBoardDropdownOpen(!isBoardDropdownOpen)}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-900 dark:text-slate-200 flex items-center gap-1.5">
                <span className="truncate max-w-[110px] sm:max-w-none">{currentBoard.name}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              </span>
              <span className="text-[10px] text-slate-400 truncate max-w-[130px] sm:max-w-none">{currentBoard.sprintName}</span>
            </div>
          </button>

          {isBoardDropdownOpen && (
            <div className="absolute left-0 mt-2 w-72 max-w-[calc(100vw-1rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-2 z-50">
              <div className="px-3 py-1.5 text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                Quadros / Boards
              </div>
              {boards.map((b) => (
                <button
                  key={b.id}
                  onClick={() => {
                    setCurrentBoardId(b.id);
                    setIsBoardDropdownOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors ${
                    b.id === currentBoardId ? 'bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="truncate pr-2">
                    <p className="text-xs font-semibold">{b.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{b.sprintName}</p>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500">
                    {b.key}
                  </span>
                </button>
              ))}

              <div className="border-t border-slate-100 dark:border-slate-800 my-1 pt-1 px-2">
                <button
                  onClick={() => {
                    setIsBoardDropdownOpen(false);
                    setIsNewBoardModalOpen(true);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Criar Novo Quadro
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Board settings (columns) trigger */}
        <button
          onClick={() => setIsBoardSettingsOpen(true)}
          className="hidden sm:flex p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors shrink-0"
          title="Configurar colunas do quadro"
          aria-label="Configurar colunas do quadro"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      {/* Center: Search Bar with Hotkey & Command Palette Launcher */}
      <div className="flex-1 max-w-md mx-2 hidden md:block">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
            placeholder="Pesquisar tarefas, épicos, ou tecle '/' para buscar..."
            className="w-full bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 rounded-md pl-9 pr-20 py-1.5 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {filters.searchQuery ? (
              <button
                onClick={() => setFilters((prev) => ({ ...prev, searchQuery: '' }))}
                className="text-slate-400 hover:text-slate-600 mr-1"
                title="Limpar pesquisa"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : null}
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              title="Abrir Paleta de Comandos (⌘K ou Ctrl+K)"
              className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-700/80 border border-slate-200 dark:border-slate-600 hover:text-indigo-600 hover:border-indigo-400 transition-colors shadow-2xs"
            >
              <Command className="w-2.5 h-2.5" />
              <span>K</span>
            </button>
          </div>
        </div>
      </div>

      {/* Right Controls: Timer, User Switcher, Activity, New Task Button */}
      <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
        <button
          onClick={() => setIsCommandPaletteOpen(true)}
          className="md:hidden p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
          aria-label="Pesquisar"
        >
          <Search className="w-4 h-4" />
        </button>
        {/* Active Live Timer */}
        {activeTimer && (
          <div className="flex items-center gap-1.5 sm:gap-2 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/80 px-1.5 sm:px-2.5 py-1 rounded-md text-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <div className="flex flex-col">
              <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-300 text-xs leading-none">
                {formatTimerSeconds(activeTimer.elapsedSeconds)}
              </span>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 leading-none truncate max-w-[100px]">
                {timerTask?.key || 'Tarefa'}
              </span>
            </div>
            <div className="flex items-center gap-1 ml-1">
              {activeTimer.isRunning ? (
                <button
                  onClick={pauseTimer}
                  title="Pausar cronômetro"
                  className="p-1 hover:bg-emerald-200/60 dark:hover:bg-emerald-900 rounded text-emerald-700 dark:text-emerald-300"
                >
                  <Pause className="w-3 h-3" />
                </button>
              ) : (
                <button
                  onClick={resumeTimer}
                  title="Retomar cronômetro"
                  className="p-1 hover:bg-emerald-200/60 dark:hover:bg-emerald-900 rounded text-emerald-700 dark:text-emerald-300"
                >
                  <Play className="w-3 h-3" />
                </button>
              )}
              <button
                onClick={() => stopTimerAndLogWork()}
                title="Concluir e registrar horas apontadas"
                className="p-1 hover:bg-emerald-200/60 dark:hover:bg-emerald-900 rounded text-emerald-800 dark:text-emerald-200 font-bold"
              >
                <Square className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* NeonDB Database Live Status Badge */}
        <button
          onClick={() => setIsDbModalOpen(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
            dbConnected
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
              : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 hover:bg-rose-100'
          }`}
          title="Status do banco de dados Neon PostgreSQL"
        >
          <Database className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="font-semibold hidden sm:inline">Brolabs - DB</span>
          <span
            className={`w-2 h-2 rounded-full ${
              isLoading ? 'bg-amber-500 animate-ping' : dbConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          />
        </button>

        {/* Keyboard Shortcuts Trigger */}
        <button
          onClick={() => setIsShortcutsModalOpen(true)}
          className="hidden md:block p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
          title="Atalhos de Teclado (Pressione '?')"
        >
          <Keyboard className="w-4 h-4" />
        </button>

        {/* Email Alerts Outbox & Settings Trigger */}
        <button
          onClick={() => setIsEmailDrawerOpen(true)}
          className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors relative"
          title="Alertas de Email & Caixa de Saída (Status & @Menções - Atalho: 'E')"
        >
          <Mail className="w-4 h-4" />
          {emailNotifications.length > 0 && (
            <span className="absolute top-1 right-1 px-1 min-w-[14px] h-3.5 rounded-full bg-emerald-500 text-[9px] font-mono font-bold text-white flex items-center justify-center">
              {emailNotifications.length > 9 ? '9+' : emailNotifications.length}
            </span>
          )}
        </button>

        {/* Activity Feed Bell */}
        <div className="relative">
          <button
            onClick={() => setIsActivityOpen(!isActivityOpen)}
            className="p-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors relative"
            title="Fluxo de Atividades em Tempo Real"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-500 rounded-full" />
          </button>

          {isActivityOpen && (
            <div className="fixed left-2 right-2 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-auto mt-2 sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-2xl py-2 z-50">
              <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-100">Atividades em Tempo Real</span>
                  <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">
                    {activityLogs.length}
                  </span>
                </div>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Conectado
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
                {activityLogs.slice(0, 10).map((act) => (
                  <div
                    key={act.id}
                    onClick={() => {
                      if (act.taskId && act.taskId !== 'system') {
                        setSelectedTaskModalId(act.taskId);
                        setIsActivityOpen(false);
                      }
                    }}
                    className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{act.memberName}</span>
                      <span className="text-slate-400 text-[10px]">{formatRelativeTime(act.timestamp)}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">{act.details}</p>
                    {act.taskKey && act.taskKey !== 'INTEG' && (
                      <span className="inline-block mt-1 text-[10px] font-mono text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.5 rounded">
                        {act.taskKey}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Current User: Login / Logout */}
        {!isAuthenticated || !authMember ? (
          <button
            onClick={() => {
              window.location.href = '/login';
            }}
            className="flex items-center gap-2 p-1 pl-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors text-sm"
            title="Entrar"
          >
            <LogIn className="w-4 h-4" />
            <span className="text-slate-700 dark:text-slate-300 hidden sm:inline">Entrar</span>
          </button>
        ) : (
          <div className="relative group">
            <button
              onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
              className="flex items-center gap-2 p-1 pl-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition-colors"
            >
              <img
                src={authMember.avatar}
                alt={authMember.name}
                className="w-6 h-6 rounded-full object-cover border border-slate-200"
              />
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300 hidden lg:inline max-w-[100px] truncate">
                {authMember.name.split(' ')[0]}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isUserDropdownOpen && (
              <div className="fixed left-2 right-2 top-14 sm:absolute sm:left-auto sm:right-0 sm:top-auto mt-2 sm:w-64 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl py-2 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase text-slate-400 tracking-wider">
                  Conta: {authMember.name}
                </div>
                <div className="px-3 py-1 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">{authMember.email}</p>
                  <p className="text-[10px] text-slate-400 truncate">{authMember.role} • {authMember.department}</p>
                </div>
                <div className="px-3 py-1">
                  <button
                    onClick={() => {
                      logout();
                      setIsUserDropdownOpen(false);
                      window.location.href = '/login';
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sair
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* + Criar Tarefa CTA */}
        <button
          onClick={() => setIsCreateModalOpen(true)}
          title="Criar Tarefa (Atalho: Pressione 'C')"
          className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-md shadow-sm transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Criar Tarefa</span>
          <kbd className="hidden sm:inline-block ml-1 px-1 py-0.2 rounded text-[10px] font-mono bg-indigo-700/80 text-indigo-100 border border-indigo-500/40">
            C
          </kbd>
        </button>
      </div>

      {/* Modal: Novo Board */}
      {isNewBoardModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Criar Novo Quadro (Board)</h3>
              <button
                onClick={() => setIsNewBoardModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateBoardSubmit} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Nome do Projeto / Quadro
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Engenharia Web - Squad Alpha"
                  value={newBoardName}
                  onChange={(e) => {
                    setNewBoardName(e.target.value);
                    if (!newBoardKey && e.target.value.length >= 3) {
                      setNewBoardKey(e.target.value.substring(0, 3).toUpperCase());
                    }
                  }}
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Chave do Projeto (Key)
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="Ex: WEB"
                    value={newBoardKey}
                    onChange={(e) => setNewBoardKey(e.target.value.toUpperCase())}
                    className="w-full font-mono text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">Prefixo das tarefas (ex: WEB-101)</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Nome do Sprint Inicial
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Sprint 1"
                    value={newBoardSprint}
                    onChange={(e) => setNewBoardSprint(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Descrição do Objetivo
                </label>
                <textarea
                  rows={2}
                  placeholder="Escopo do time e entregas chave..."
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewBoardModalOpen(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs"
                >
                  Criar e Acessar Quadro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* NeonDB Database Info & Sync Modal */}
      {isDbModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-950/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Banco de Dados Neon PostgreSQL</h3>
                  <p className="text-[11px] text-slate-400">AWS sa-east-1 (São Paulo) • Pooler</p>
                </div>
              </div>
              <button
                onClick={() => setIsDbModalOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400">Status da Conexão</span>
                <span className="flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Conectado e Operacional
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
                <span className="text-slate-500 dark:text-slate-400">Host do Cluster</span>
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300 truncate max-w-[210px]">
                  ep-little-sun-b6r9taiu-pooler...
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                <div className="p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                  <span className="block text-base font-bold text-indigo-600 dark:text-indigo-400">{tasks.length}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Tarefas no DB</span>
                </div>
                <div className="p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                  <span className="block text-base font-bold text-indigo-600 dark:text-indigo-400">{boards.length}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Quadros</span>
                </div>
                <div className="p-2 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40">
                  <span className="block text-base font-bold text-indigo-600 dark:text-indigo-400">{members.length}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">Membros</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
