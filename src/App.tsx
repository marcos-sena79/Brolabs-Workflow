import React from 'react';
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
import { CommandPalette } from './components/CommandPalette';
import { EmailAlertToast } from './components/EmailAlertToast';
import { EmailNotificationDrawer } from './components/EmailNotificationDrawer';

const AppContent: React.FC = () => {
  const { currentView } = useAgile();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  React.useEffect(() => {
    setIsSidebarOpen(false);
  }, [currentView]);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'kanban':
        return <KanbanBoard />;
      case 'backlog':
        return <BacklogView />;
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
    <div className="flex flex-col     h-dvh w-full bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans antialiased">
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
      <CommandPalette />
      <EmailAlertToast />
      <EmailNotificationDrawer />
    </div>
  );
};

export default function App() {
  return (
    <AgileProvider>
      <AppContent />
    </AgileProvider>
  );
}
