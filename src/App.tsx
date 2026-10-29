import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AgileProvider, useAgile } from './context/AgileContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { KanbanBoard } from './components/KanbanBoard';
import { BacklogView } from './components/BacklogView';
import { DailyDashboard } from './components/DailyDashboard';
import { TimeManagementView } from './components/TimeManagementView';
import { ProductivityReportView } from './components/ProductivityReportView';
import { MemberPerformanceView } from './components/MemberPerformanceView';
import { IntegrationsView } from './components/IntegrationsView';
import { TaskModal } from './components/TaskModal';
import { CreateTaskModal } from './components/CreateTaskModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { BoardSettingsModal } from './components/BoardSettingsModal';
import { TaskArchiveModal } from './components/TaskArchiveModal';
import { BoardAccessModal } from './components/BoardAccessModal';
import { TagsManagerModal } from './components/TagsManagerModal';
import { CommandPalette } from './components/CommandPalette';
import { EmailAlertToast } from './components/EmailAlertToast';
import { EmailNotificationDrawer } from './components/EmailNotificationDrawer';
import { FloatingTimer } from './components/FloatingTimer';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { PrivateRoute } from './components/PrivateRoute';
import { MyTodoView } from './components/MyTodoView';
import { NotesView } from './components/NotesView';
import { PublicBoardView } from './components/PublicBoardView';
import { deriveAppStatus } from './utils/initialDataFlow';
import { Loader2, TriangleAlert, Inbox, RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const {
    currentView,
    tasks,
    setSelectedTaskModalId,
    isLoading,
    dbConnected,
    boards,
    refetchDbData,
  } = useAgile();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    setIsSidebarOpen(false);
  }, [currentView]);

  // Link profundo de webhook/e-mail: /?task=<id> abre o modal da tarefa (S2, item 5)
  const pendingTaskRef = React.useRef<string | null>(
    new URLSearchParams(window.location.search).get('task')
  );
  React.useEffect(() => {
    const wanted = pendingTaskRef.current;
    if (!wanted) return;
    if (tasks.some((t) => t.id === wanted)) {
      pendingTaskRef.current = null;
      setSelectedTaskModalId(wanted);
      const url = new URL(window.location.href);
      url.searchParams.delete('task');
      window.history.replaceState({}, '', url.toString());
    }
  }, [tasks, setSelectedTaskModalId]);

  // Backend é a fonte de verdade: sem dados reais do servidor, não monta a UI
  // (nada de boards/membros fictícios durante loading, erro ou vazio).
  const appStatus = deriveAppStatus({ isLoading, dbConnected, boards });

  if (appStatus === 'loading') {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600 dark:text-indigo-400" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Carregando dados do Brolabs…</p>
        </div>
      </div>
    );
  }

  if (appStatus === 'error') {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4">
        <div className="flex max-w-md w-full flex-col items-center gap-4 rounded-xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
          <div className="rounded-full bg-rose-50 dark:bg-rose-950/40 p-3">
            <TriangleAlert className="w-8 h-8 text-rose-600 dark:text-rose-400" />
          </div>
          <h1 className="text-lg font-bold">Não foi possível carregar os dados</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Falha de conexão com o backend. Verifique sua rede ou tente novamente.
          </p>
          <button
            onClick={() => refetchDbData()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (appStatus === 'empty') {
    return (
      <div className="flex h-dvh w-full items-center justify-center bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4">
        <div className="flex max-w-md w-full flex-col items-center gap-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center shadow-sm">
          <div className="rounded-full bg-slate-50 dark:bg-slate-800/60 p-3">
            <Inbox className="w-8 h-8 text-slate-400" />
          </div>
          <h1 className="text-lg font-bold">Nenhum quadro disponível</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sua conta ainda não tem acesso a nenhum board. Peça a um administrador
            para adicionar você a um quadro.
          </p>
        </div>
      </div>
    );
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'kanban':
        return <KanbanBoard />;
      case 'backlog':
        return <BacklogView />;
      case 'my_todo':
        return <MyTodoView />;
      case 'notes':
        return <NotesView />;
      case 'daily_dashboard':
        return <DailyDashboard />;
      case 'time_tracking':
        return <TimeManagementView />;
      case 'productivity_reports':
        return <ProductivityReportView />;
      case 'member_performance':
        return <MemberPerformanceView />;
      case 'integrations':
        return <IntegrationsView />;
      default:
        return <KanbanBoard />;
    }
  };

  return (
    <div className="flex flex-col h-dvh w-full bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans antialiased">
      {/* Top Jira-like Navigation */}
      <Navbar onMenuClick={() => setIsSidebarOpen(true)} />

      {/* Main Workspace (Sidebar + Dynamic View Area) */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {renderCurrentView()}
        </main>
      </div>

      {/* Global Interactive Modals & Shortcut Tools */}
      <TaskModal />
      <CreateTaskModal />
      <ShortcutsModal />
      <BoardSettingsModal />
      <TaskArchiveModal />
      <BoardAccessModal />
      <TagsManagerModal />
      <CommandPalette />
      <EmailAlertToast />
      <EmailNotificationDrawer />
      {/* Item 2 — mini player flutuante do timer (visível em qualquer rota da sessão) */}
      <FloatingTimer />
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* Quadro público (item 1.2) — sem autenticação, fora do PrivateRoute */}
          <Route path="/q/:token" element={<PublicBoardView />} />
          <Route
            element={
              <PrivateRoute>
                <AgileProvider>
                  <AppContent />
                </AgileProvider>
              </PrivateRoute>
            }
          >
            <Route path="/" element={<AppContent />} />
          </Route>
        </Routes>
      </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
