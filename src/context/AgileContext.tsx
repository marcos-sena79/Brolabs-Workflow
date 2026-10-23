import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import confetti from 'canvas-confetti';
import {
  Board,
  Member,
  Task,
  IntegrationConfig,
  ActivityItem,
  WebhookLog,
  ViewTab,
  SubTask,
  WorkLog,
  TaskComment,
  IntegrationPlatform,
  EmailNotification,
  EmailSettings,
  DependencyType,
  TaskAttachment,
  BoardPermissions,
  PermissionFlag,
} from '../types';
import { api } from '../services/api';
import { useAuth } from './AuthContext';
import { getTodoColumnId, isTaskDone } from '../utils/agileHelpers';

interface ActiveTimer {
  taskId: string;
  startTime: number;
  elapsedSeconds: number;
  isRunning: boolean;
}

interface FilterState {
  searchQuery: string;
  selectedAssigneeId: string;
  selectedPriority: string;
  selectedIssueType: string;
  selectedEpicId: string;
  onlyMyTasks: boolean;
  onlyBlockedTasks?: boolean;
}

interface AgileContextType {
  boards: Board[];
  currentBoardId: string;
  currentBoard: Board;
  tasks: Task[];
  boardTasks: Task[];
  filteredBoardTasks: Task[];
  members: Member[];
  currentUser: Member;
  activityLogs: ActivityItem[];
  integrations: IntegrationConfig[];
  webhookLogs: WebhookLog[];
  currentView: ViewTab;
  filters: FilterState;
  activeTimer: ActiveTimer | null;
  selectedTaskModalId: string | null;
  isCreateModalOpen: boolean;
  isShortcutsModalOpen: boolean;
  isCommandPaletteOpen: boolean;
  isBoardSettingsOpen: boolean;
  isTaskArchiveOpen: boolean;
  archivedTasks: Task[];
  isArchivedTasksLoading: boolean;

  // Authentication
  isAuthenticated: boolean;
  login: (token: string, member: Member) => void;
  logout: () => void;

  // Database Connection Status
  isLoading: boolean;
  dbConnected: boolean;
  refetchDbData: () => Promise<void>;

  // Setters & Nav
  setCurrentBoardId: (id: string) => void;
  setCurrentView: (view: ViewTab) => void;
  setCurrentUserId: (id: string) => void;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  setSelectedTaskModalId: (id: string | null) => void;
  setIsCreateModalOpen: (open: boolean) => void;
  setIsShortcutsModalOpen: (open: boolean) => void;
  setIsCommandPaletteOpen: (open: boolean) => void;
  setIsBoardSettingsOpen: (open: boolean) => void;
  setIsTaskArchiveOpen: (open: boolean) => void;

  // Task Operations
  createTask: (taskData: {
    title: string;
    description: string;
    issueType: Task['issueType'];
    priority: Task['priority'];
    statusId: string;
    assigneeId: string;
    epicId?: string;
    estimatedHours: number;
    storyPoints: number;
    dueDate: string;
    tags?: string[];
  }) => Task;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  moveTask: (taskId: string, targetStatusId: string) => void;
  deleteTask: (taskId: string) => void;
  archiveTask: (taskId: string, force?: boolean) => Promise<void>;
  unarchiveTask: (taskId: string) => Promise<void>;
  fetchArchivedTasks: () => Promise<void>;

  addSubtask: (taskId: string, title: string, estimatedHours?: number, assigneeId?: string) => void;
  toggleSubtask: (taskId: string, subtaskId: string) => void;
  deleteSubtask: (taskId: string, subtaskId: string) => void;
  reorderSubtasks: (taskId: string, sourceIndex: number, destinationIndex: number) => void;

  // Task Dependencies & Blockers
  addDependency: (sourceTaskId: string, targetTaskId: string, type: DependencyType) => void;
  removeDependency: (taskId: string, targetTaskId: string) => void;

  // Worklog & Comments
  addWorklog: (taskId: string, hours: number, date: string, comment: string) => void;
  addComment: (taskId: string, text: string) => void;

  // Board Operations
  createBoard: (board: { name: string; key: string; description: string; sprintName: string }) => void;
  updateBoard: (boardId: string, updates: Partial<Board>) => void;
  addColumn: (data: {
    title: string;
    accentColor?: string;
    wipLimit?: number | null;
    isDone?: boolean;
  }) => Promise<void>;
  updateColumn: (
    columnId: string,
    data: { title?: string; accentColor?: string; wipLimit?: number | null; isDone?: boolean }
  ) => Promise<void>;
  reorderColumns: (order: string[]) => Promise<void>;
  deleteColumn: (columnId: string, reassignTo?: string) => Promise<void>;

  // Members
  addMember: (member: Omit<Member, 'id'>) => void;
  updateMember: (memberId: string, updates: Partial<Member>) => void;

  // Integrations
  updateIntegrationConfig: (platform: IntegrationPlatform, updates: Partial<IntegrationConfig>) => void;
  sendTestWebhook: (platform: IntegrationPlatform) => Promise<boolean>;

  // Timer
  startTimer: (taskId: string) => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  stopTimer: () => void;
  stopTimerAndLogWork: (comment?: string) => void;

  // Email Notifications
  emailNotifications: EmailNotification[];
  emailSettings: EmailSettings;
  isEmailDrawerOpen: boolean;
  setIsEmailDrawerOpen: (open: boolean) => void;
  lastEmailAlertToast: EmailNotification | null;
  clearEmailAlertToast: () => void;
  triggerEmailAlert: (alertData: {
    triggerType: 'status_change' | 'mention';
    taskId: string;
    taskKey: string;
    taskTitle: string;
    recipientEmail: string;
    recipientName: string;
    senderName: string;
    subject: string;
    contentPreview: string;
    htmlBody: string;
  }) => void;
  updateEmailSettings: (settings: Partial<EmailSettings>) => void;
  markEmailAsRead: (id: string) => void;
  markAllEmailsAsRead: () => void;
  clearEmailHistory: () => void;

  // Permissões por board (item 5.1)
  myPermissions: Record<string, BoardPermissions>;
  can: (flag: PermissionFlag, boardId?: string) => boolean;

  // Anexos de tarefas (item 2.1)
  attachmentsByTask: Record<string, TaskAttachment[]>;
  isAttachmentsLoading: boolean;
  fetchTaskAttachments: (taskId: string) => Promise<void>;
  uploadTaskAttachment: (
    taskId: string,
    file: File,
    onProgress?: (pct: number) => void
  ) => Promise<void>;
  deleteTaskAttachment: (taskId: string, attachmentId: string) => Promise<void>;

  // Modal de acesso ao quadro (item 5.1)
  isBoardAccessOpen: boolean;
  setIsBoardAccessOpen: (open: boolean) => void;

  // Reset
  resetToDemoData: () => void;
}

const DEFAULT_BOARD: Board = {
  id: 'board-default',
  key: 'ENG',
  name: 'Sprint 24 - Plataforma & Core',
  description: 'Desenvolvimento do núcleo de microsserviços e segurança.',
  sprintName: 'Sprint 24',
  sprintGoal: 'Finalizar módulo de autenticação e banco de dados Neon',
  sprintStartDate: new Date().toISOString().split('T')[0],
  sprintEndDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
  columns: [
    { id: 'col-backlog', title: 'Backlog', order: 0, wipLimit: 15, accentColor: '#64748b' },
    { id: 'col-todo', title: 'A Fazer', order: 1, wipLimit: 8, accentColor: '#3b82f6' },
    { id: 'col-inprogress', title: 'Em Andamento', order: 2, wipLimit: 5, accentColor: '#eab308' },
    { id: 'col-review', title: 'Code Review / QA', order: 3, wipLimit: 4, accentColor: '#8b5cf6' },
    { id: 'col-done', title: 'Concluído', order: 4, accentColor: '#10b981', isDone: true },
  ],
  epics: [],
};

const DEFAULT_MEMBER: Member = {
  id: 'mem-default',
  name: 'Lucas Santos',
  email: 'lucas.santos@techcorp.com.br',
  avatar: '/bucket/avatars/lucas-santos.svg',
  role: 'Tech Lead & Arquiteto',
  department: 'Engenharia',
  weeklyCapacityHours: 40,
  active: true,
};

const AgileContext = createContext<AgileContextType | undefined>(undefined);

export const AgileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Authentication (from AuthContext)
  const { member: authMember, login: authLogin, logout: authLogout, isAuthenticated: authIsAuthenticated, isLoading: authIsLoading } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(true);

  const [boards, setBoards] = useState<Board[]>([DEFAULT_BOARD]);
  const [currentBoardId, setCurrentBoardIdState] = useState<string>(DEFAULT_BOARD.id);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([DEFAULT_MEMBER]);
  const [currentUserId, setCurrentUserIdState] = useState<string>(DEFAULT_MEMBER.id);
  const [integrations, setIntegrations] = useState<IntegrationConfig[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityItem[]>([]);
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([]);

  const [currentView, setCurrentView] = useState<ViewTab>('kanban');
  const [selectedTaskModalId, setSelectedTaskModalId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isBoardSettingsOpen, setIsBoardSettingsOpen] = useState(false);
  const [isTaskArchiveOpen, setIsTaskArchiveOpen] = useState(false);
  const [archivedTasks, setArchivedTasks] = useState<Task[]>([]);
  const [isArchivedTasksLoading, setIsArchivedTasksLoading] = useState(false);

  // Permissões + anexos (itens 5.1 / 2.1)
  const [myPermissions, setMyPermissions] = useState<Record<string, BoardPermissions>>({});
  const [attachmentsByTask, setAttachmentsByTask] = useState<Record<string, TaskAttachment[]>>({});
  const [isAttachmentsLoading, setIsAttachmentsLoading] = useState(false);
  const [isBoardAccessOpen, setIsBoardAccessOpen] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedAssigneeId: 'all',
    selectedPriority: 'all',
    selectedIssueType: 'all',
    selectedEpicId: 'all',
    onlyMyTasks: false,
    onlyBlockedTasks: false,
  });

  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);

  // Email Notification States
  const [emailNotifications, setEmailNotifications] = useState<EmailNotification[]>([]);
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    enabled: true,
    senderEmail: 'flowpulse-agile@techcorp.com.br',
    senderName: 'FlowPulse Notification Hub',
    notifyOnStatusChange: true,
    notifyOnMentions: true,
    notifyReporterOnDone: true,
  });

  const [isEmailDrawerOpen, setIsEmailDrawerOpen] = useState(false);
  const [lastEmailAlertToast, setLastEmailAlertToast] = useState<EmailNotification | null>(null);

  // Fetch all initial data from NeonDB backend
  const fetchDbData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await api.getInitialState();
      if (data.boards && data.boards.length > 0) {
        setBoards(data.boards);
      }
      if (data.members && data.members.length > 0) {
        setMembers(data.members);
      }
      setTasks(data.tasks || []);
      setActivityLogs(data.activityLogs || []);
      setIntegrations(data.integrations || []);
      setWebhookLogs(data.webhookLogs || []);
      setMyPermissions(data.myPermissions || {});
      if (data.emailSettings) {
        setEmailSettings(data.emailSettings);
      }
      setEmailNotifications(data.emailNotifications || []);

      if (data.currentBoardId) {
        setCurrentBoardIdState(data.currentBoardId);
      } else if (data.boards && data.boards[0]) {
        setCurrentBoardIdState(data.boards[0].id);
      }

      if (data.currentUserId) {
        setCurrentUserIdState(data.currentUserId);
      } else if (data.members && data.members[0]) {
        setCurrentUserIdState(data.members[0].id);
      }

      setDbConnected(true);
    } catch (err) {
      console.error('Falha ao conectar com o backend NeonDB:', err);
      setDbConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDbData();
  }, [fetchDbData]);

  const can = useCallback(
    (flag: PermissionFlag, boardId?: string): boolean => {
      const id = boardId || currentBoardId;
      const perms = myPermissions[id];
      if (!perms) return true; // ainda sem info — o backend continua sendo a autoridade
      return Boolean(perms[flag]);
    },
    [myPermissions, currentBoardId]
  );

  const setCurrentBoardId = (id: string) => {
    setCurrentBoardIdState(id);
    setArchivedTasks([]);
    api.setAppSetting('current_board_id', id).catch(console.error);
  };

  const setCurrentUserId = (id: string) => {
    setCurrentUserIdState(id);
    api.setAppSetting('current_user_id', id).catch(console.error);
  };

  // Active Timer Tick effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (activeTimer && activeTimer.isRunning) {
      interval = setInterval(() => {
        setActiveTimer((prev) => (prev ? { ...prev, elapsedSeconds: prev.elapsedSeconds + 1 } : null));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeTimer?.isRunning]);

  // Global Keyboard Shortcuts System (Jira / Linear Style)
  useEffect(() => {
    let pendingGKey = false;
    let pendingGTimeout: NodeJS.Timeout | null = null;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isInput) {
        if (e.key === 'Escape') {
          (target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (isEmailDrawerOpen) {
          setIsEmailDrawerOpen(false);
          return;
        }
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
          return;
        }
        if (isBoardSettingsOpen) {
          setIsBoardSettingsOpen(false);
          return;
        }
        if (isTaskArchiveOpen) {
          setIsTaskArchiveOpen(false);
          return;
        }
        if (isShortcutsModalOpen) {
          setIsShortcutsModalOpen(false);
          return;
        }
        if (selectedTaskModalId) {
          setSelectedTaskModalId(null);
          return;
        }
        if (isCreateModalOpen) {
          setIsCreateModalOpen(false);
          return;
        }
      }

      if (
        isCreateModalOpen ||
        selectedTaskModalId ||
        isShortcutsModalOpen ||
        isCommandPaletteOpen ||
        isEmailDrawerOpen ||
        isBoardSettingsOpen ||
        isTaskArchiveOpen
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      if (pendingGKey) {
        pendingGKey = false;
        if (pendingGTimeout) clearTimeout(pendingGTimeout);

        switch (key) {
          case 'k':
            e.preventDefault();
            setCurrentView('kanban');
            return;
          case 'b':
            e.preventDefault();
            setCurrentView('backlog');
            return;
          case 'd':
            e.preventDefault();
            setCurrentView('daily_dashboard');
            return;
          case 't':
            e.preventDefault();
            setCurrentView('time_tracking');
            return;
          case 'r':
            e.preventDefault();
            setCurrentView('productivity_reports');
            return;
          case 'm':
            e.preventDefault();
            setCurrentView('member_performance');
            return;
          case 'i':
            e.preventDefault();
            setCurrentView('integrations');
            return;
        }
      }

      if (key === 'g' && !e.metaKey && !e.ctrlKey) {
        pendingGKey = true;
        pendingGTimeout = setTimeout(() => {
          pendingGKey = false;
        }, 1200);
        return;
      }

      if (e.key === '1') {
        e.preventDefault();
        setCurrentView('kanban');
        return;
      }
      if (e.key === '2') {
        e.preventDefault();
        setCurrentView('backlog');
        return;
      }
      if (e.key === '3') {
        e.preventDefault();
        setCurrentView('daily_dashboard');
        return;
      }
      if (e.key === '4') {
        e.preventDefault();
        setCurrentView('time_tracking');
        return;
      }
      if (e.key === '5') {
        e.preventDefault();
        setCurrentView('productivity_reports');
        return;
      }
      if (e.key === '6') {
        e.preventDefault();
        setCurrentView('member_performance');
        return;
      }
      if (e.key === '7') {
        e.preventDefault();
        setCurrentView('integrations');
        return;
      }

      if (key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsCreateModalOpen(true);
        return;
      }

      if (key === 'e' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsEmailDrawerOpen((prev) => !prev);
        return;
      }

      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
        return;
      }

      if (e.key === '/' && !e.shiftKey) {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Pesquisar"]') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      if (key === 'm' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setFilters((prev) => ({ ...prev, onlyMyTasks: !prev.onlyMyTasks }));
        return;
      }

      if (key === 't' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (activeTimer) {
          if (activeTimer.isRunning) pauseTimer();
          else resumeTimer();
        } else {
          const board = boards.find((b) => b.id === currentBoardId) || boards[0] || DEFAULT_BOARD;
          const taskCandidate = tasks.find((t) => t.boardId === currentBoardId && !isTaskDone(board, t.statusId));
          if (taskCandidate) {
            startTimer(taskCandidate.id);
          }
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (pendingGTimeout) clearTimeout(pendingGTimeout);
    };
  }, [
    isCreateModalOpen,
    selectedTaskModalId,
    isShortcutsModalOpen,
    isCommandPaletteOpen,
    isBoardSettingsOpen,
    isTaskArchiveOpen,
    isEmailDrawerOpen,
    activeTimer,
    currentBoardId,
    boards,
    tasks,
  ]);

  // Derived current board and user
  const currentBoard = useMemo(() => {
    return boards.find((b) => b.id === currentBoardId) || boards[0] || DEFAULT_BOARD;
  }, [boards, currentBoardId]);

  const currentUser = useMemo(() => {
    if (authMember) return authMember;
    return members.find((m) => m.id === currentUserId) || members[0] || DEFAULT_MEMBER;
  }, [members, currentUserId, authMember]);

  // Tasks for current board
  const boardTasks = useMemo(() => {
    return tasks.filter((t) => t.boardId === currentBoard.id);
  }, [tasks, currentBoard.id]);

  // Filtered tasks for current board
  const filteredBoardTasks = useMemo(() => {
    return boardTasks.filter((task) => {
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const matchesKey = task.key.toLowerCase().includes(query);
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = (task.description || '').toLowerCase().includes(query);
        const matchesTags = task.tags?.some((t) => t.toLowerCase().includes(query));
        if (!matchesKey && !matchesTitle && !matchesDesc && !matchesTags) return false;
      }

      if (filters.selectedAssigneeId !== 'all' && task.assigneeId !== filters.selectedAssigneeId) {
        return false;
      }

      if (filters.onlyMyTasks && task.assigneeId !== currentUser.id) {
        return false;
      }

      if (filters.selectedPriority !== 'all' && task.priority !== filters.selectedPriority) {
        return false;
      }

      if (filters.selectedIssueType !== 'all' && task.issueType !== filters.selectedIssueType) {
        return false;
      }

      if (filters.selectedEpicId !== 'all' && task.epicId !== filters.selectedEpicId) {
        return false;
      }

      if (filters.onlyBlockedTasks) {
        const hasActiveBlocker = (task.dependencies || []).some((dep) => {
          if (dep.type !== 'is_blocked_by') return false;
          const blocker = tasks.find((t) => t.id === dep.targetTaskId);
          return blocker && !isTaskDone(currentBoard, blocker.statusId);
        });
        if (!hasActiveBlocker) return false;
      }

      return true;
    });
  }, [boardTasks, filters, currentUser.id, tasks]);

  // Helper to add activity log and persist to NeonDB
  const logActivity = (item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    const newLog: ActivityItem = {
      ...item,
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    setActivityLogs((prev) => [newLog, ...prev.slice(0, 49)]);
    api.createActivity(newLog).catch(console.error);
  };

  // Trigger Email Notification Alert and persist to NeonDB
  const triggerEmailAlert = (alertData: {
    triggerType: 'status_change' | 'mention';
    taskId: string;
    taskKey: string;
    taskTitle: string;
    recipientEmail: string;
    recipientName: string;
    senderName: string;
    subject: string;
    contentPreview: string;
    htmlBody: string;
  }) => {
    const newEmail: EmailNotification = {
      id: `em-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      ...alertData,
      status: 'delivered',
      timestamp: new Date().toISOString(),
      read: false,
    };

    setEmailNotifications((prev) => [newEmail, ...prev.slice(0, 49)]);
    setLastEmailAlertToast(newEmail);
    api.createEmailNotification(newEmail).catch(console.error);

    setTimeout(() => {
      setLastEmailAlertToast((curr) => (curr?.id === newEmail.id ? null : curr));
    }, 5500);

    logActivity({
      type: 'email_alert_sent',
      taskId: alertData.taskId,
      taskKey: alertData.taskKey,
      taskTitle: alertData.taskTitle,
      memberId: currentUser.id,
      memberName: currentUser.name,
      details: `Disparou email para ${alertData.recipientName} (${alertData.recipientEmail}): "${alertData.subject}"`,
    });
  };

  const updateEmailSettings = (settings: Partial<EmailSettings>) => {
    setEmailSettings((prev) => {
      const next = { ...prev, ...settings };
      api.updateEmailSettings(next).catch(console.error);
      return next;
    });
  };

  const markEmailAsRead = (id: string) => {
    setEmailNotifications((prev) =>
      prev.map((e) => (e.id === id ? { ...e, read: true } : e))
    );
    api.markEmailAsRead(id).catch(console.error);
  };

  const markAllEmailsAsRead = () => {
    setEmailNotifications((prev) => prev.map((e) => ({ ...e, read: true })));
    api.markAllEmailsAsRead().catch(console.error);
  };

  const clearEmailHistory = () => {
    setEmailNotifications([]);
    api.clearEmailHistory().catch(console.error);
  };

  const clearEmailAlertToast = () => {
    setLastEmailAlertToast(null);
  };

  // Helper to trigger communication webhooks
  const dispatchIntegrationEvent = (
    eventType: 'task_completed' | 'worklog_logged' | 'task_blocked' | 'sprint_started',
    summary: string,
    detailsObj: Record<string, unknown>
  ) => {
    integrations.forEach((integration) => {
      if (!integration.enabled) return;

      const shouldNotify =
        (eventType === 'task_completed' && integration.notifyOnTaskComplete) ||
        (eventType === 'worklog_logged' && integration.notifyOnWorklog) ||
        (eventType === 'task_blocked' && integration.notifyOnTaskBlocked) ||
        (eventType === 'sprint_started' && integration.notifyOnSprintStart);

      if (!shouldNotify) return;

      const logItem: WebhookLog = {
        id: `wh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        platform: integration.id,
        eventType,
        payloadSummary: `[${integration.name}] ${summary}`,
        status: 'delivered',
        timestamp: new Date().toISOString(),
      };

      setWebhookLogs((prev) => [logItem, ...prev.slice(0, 49)]);
      api.createWebhookLog(logItem).catch(console.error);

      if (integration.webhookUrl && integration.webhookUrl.startsWith('http')) {
        try {
          fetch(integration.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              app: 'Brolabs Workflow',
              event: eventType,
              message: summary,
              data: detailsObj,
              timestamp: new Date().toISOString(),
            }),
            mode: 'no-cors',
          }).catch(() => {});
        } catch {
          // ignore network error
        }
      }
    });
  };

  // Create Task and persist to NeonDB
  const createTask = (taskData: {
    title: string;
    description: string;
    issueType: Task['issueType'];
    priority: Task['priority'];
    statusId: string;
    assigneeId: string;
    epicId?: string;
    estimatedHours: number;
    storyPoints: number;
    dueDate: string;
    tags?: string[];
  }): Task => {
    const prefix = currentBoard.key || 'TASK';
    const existingNumbers = tasks
      .filter((t) => t.key.startsWith(`${prefix}-`))
      .map((t) => parseInt(t.key.replace(`${prefix}-`, ''), 10))
      .filter((n) => !isNaN(n));
    const nextNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 101;
    const taskKey = `${prefix}-${nextNumber}`;

    const newTask: Task = {
      id: `task-${Date.now()}`,
      key: taskKey,
      boardId: currentBoard.id,
      title: taskData.title,
      description: taskData.description || '',
      issueType: taskData.issueType || 'task',
      priority: taskData.priority || 'medium',
      statusId: taskData.statusId || getTodoColumnId(currentBoard),
      assigneeId: taskData.assigneeId || currentUser.id,
      reporterId: currentUser.id,
      epicId: taskData.epicId,
      estimatedHours: taskData.estimatedHours || 0,
      loggedHours: 0,
      storyPoints: taskData.storyPoints || 1,
      dueDate: taskData.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      subtasks: [],
      worklogs: [],
      comments: [],
      tags: taskData.tags || [],
      dependencies: [],
    };

    setTasks((prev) => [newTask, ...prev]);
    api.createTask(newTask).catch(console.error);

    logActivity({
      type: 'task_created',
      taskId: newTask.id,
      taskKey: newTask.key,
      taskTitle: newTask.title,
      memberId: currentUser.id,
      memberName: currentUser.name,
      details: `Criou a tarefa com prioridade ${newTask.priority} e estimativa de ${newTask.estimatedHours}h`,
    });

    return newTask;
  };

  // Update Task and persist to NeonDB
  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updated = {
            ...t,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
          api.updateTask(taskId, updates).catch(console.error);
          return updated;
        }
        return t;
      })
    );
  };

  // Move task (Drag and drop or status select)
  const moveTask = (taskId: string, targetStatusId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.statusId === targetStatusId) return;

    const sourceCol = currentBoard.columns.find((c) => c.id === task.statusId);
    const targetCol = currentBoard.columns.find((c) => c.id === targetStatusId);
    const isMovedToDone = isTaskDone(currentBoard, targetStatusId);

    updateTask(taskId, { statusId: targetStatusId });

    logActivity({
      type: 'status_change',
      taskId: task.id,
      taskKey: task.key,
      taskTitle: task.title,
      memberId: currentUser.id,
      memberName: currentUser.name,
      details: `Moveu de "${sourceCol?.title || 'Anterior'}" para "${targetCol?.title || 'Novo'}"`,
    });

    if (emailSettings.enabled && emailSettings.notifyOnStatusChange) {
      const sourceTitle = sourceCol?.title || 'Backlog';
      const targetTitle = targetCol?.title || targetStatusId;
      const assignee = members.find((m) => m.id === task.assigneeId);
      const reporter = members.find((m) => m.id === task.reporterId);
      const recipient = (assignee && assignee.id !== currentUser.id) ? assignee : (reporter || assignee || currentUser);

      triggerEmailAlert({
        triggerType: 'status_change',
        taskId: task.id,
        taskKey: task.key,
        taskTitle: task.title,
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        senderName: currentUser.name,
        subject: `[Brolabs Workflow] Status alterado: ${task.key} para "${targetTitle}"`,
        contentPreview: `${currentUser.name} moveu a tarefa ${task.key} de "${sourceTitle}" para "${targetTitle}".`,
        htmlBody: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%); padding: 16px 20px; border-radius: 8px; color: #ffffff; margin-bottom: 20px;">
              <h2 style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em;">Brolabs Workflow</h2>
              <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Atualização Automática de Status</p>
            </div>
            
            <p style="font-size: 14px; color: #1e293b; margin-top: 0;">Olá <strong>${recipient.name}</strong>,</p>
            
            <p style="font-size: 14px; color: #334155; line-height: 1.5;">
              O status da tarefa <strong style="color: #4f46e5;">${task.key} - ${task.title}</strong> foi atualizado por <strong>${currentUser.name}</strong>.
            </p>
            
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #4f46e5; border-radius: 6px; padding: 16px; margin: 20px 0;">
              <div style="font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">
                Transição de Fluxo de Trabalho
              </div>
              <div style="font-size: 15px; font-weight: 600; color: #0f172a;">
                <span style="color: #64748b; text-decoration: line-through;">${sourceTitle}</span> ➔ <span style="color: #10b981; font-weight: 700;">${targetTitle}</span>
              </div>
            </div>
          </div>
        `,
      });
    }

    if (isMovedToDone) {
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b'],
        });
      } catch {
        // confetti fallback
      }

      dispatchIntegrationEvent(
        'task_completed',
        `🎉 Tarefa ${task.key} (${task.title}) foi concluída por ${currentUser.name}! [${task.loggedHours}h gastas de ${task.estimatedHours}h estimadas]`,
        {
          taskKey: task.key,
          title: task.title,
          completedBy: currentUser.name,
          loggedHours: task.loggedHours,
          estimatedHours: task.estimatedHours,
        }
      );
    }
  };

  // Delete Task and persist to NeonDB
  const deleteTask = (taskId: string) => {
    setTasks((prev) =>
      prev
        .filter((t) => t.id !== taskId)
        .map((t) => ({
          ...t,
          dependencies: (t.dependencies || []).filter((d) => d.targetTaskId !== taskId),
        }))
    );
    setArchivedTasks((prev) => prev.filter((t) => t.id !== taskId));
    setAttachmentsByTask((prev) => {
      if (!(taskId in prev)) return prev;
      const next = { ...prev };
      delete next[taskId];
      return next;
    });
    api.deleteTask(taskId).catch(console.error);
    if (selectedTaskModalId === taskId) setSelectedTaskModalId(null);
    if (activeTimer?.taskId === taskId) setActiveTimer(null);
  };

  // Subtask management with NeonDB persistence
  const addSubtask = (taskId: string, title: string, estimatedHours = 1, assigneeId?: string) => {
    const newSub: SubTask = {
      id: `sub-${Date.now()}`,
      taskId,
      title,
      completed: false,
      assigneeId: assigneeId || currentUser.id,
      estimatedHours,
      loggedHours: 0,
    };

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updatedSubtasks = [...t.subtasks, newSub];
          api.updateTask(taskId, { subtasks: updatedSubtasks }).catch(console.error);
          return {
            ...t,
            subtasks: updatedSubtasks,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );

    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      logActivity({
        type: 'subtask_added',
        taskId: task.id,
        taskKey: task.key,
        taskTitle: task.title,
        memberId: currentUser.id,
        memberName: currentUser.name,
        details: `Adicionou sub-tarefa: "${title}" (${estimatedHours}h)`,
      });
    }
  };

  const toggleSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updatedSubtasks = t.subtasks.map((s) => {
            if (s.id === subtaskId) {
              return { ...s, completed: !s.completed };
            }
            return s;
          });
          api.updateTask(taskId, { subtasks: updatedSubtasks }).catch(console.error);
          return {
            ...t,
            subtasks: updatedSubtasks,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );

    const task = tasks.find((t) => t.id === taskId);
    const sub = task?.subtasks.find((s) => s.id === subtaskId);
    if (task && sub) {
      logActivity({
        type: 'subtask_toggled',
        taskId: task.id,
        taskKey: task.key,
        taskTitle: task.title,
        memberId: currentUser.id,
        memberName: currentUser.name,
        details: `${sub.completed ? 'Reabriu' : 'Concluiu'} sub-tarefa: "${sub.title}"`,
      });
    }
  };

  const deleteSubtask = (taskId: string, subtaskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updatedSubtasks = t.subtasks.filter((s) => s.id !== subtaskId);
          api.updateTask(taskId, { subtasks: updatedSubtasks }).catch(console.error);
          return {
            ...t,
            subtasks: updatedSubtasks,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );
  };

  const reorderSubtasks = (taskId: string, sourceIndex: number, destinationIndex: number) => {
    if (sourceIndex === destinationIndex) return;
    let targetTaskTitle = '';
    let targetTaskKey = '';
    let movedSubtaskTitle = '';

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const list = [...t.subtasks];
          if (
            sourceIndex < 0 ||
            sourceIndex >= list.length ||
            destinationIndex < 0 ||
            destinationIndex >= list.length
          ) {
            return t;
          }
          const [movedItem] = list.splice(sourceIndex, 1);
          movedSubtaskTitle = movedItem.title;
          targetTaskTitle = t.title;
          targetTaskKey = t.key;
          list.splice(destinationIndex, 0, movedItem);
          api.updateTask(taskId, { subtasks: list }).catch(console.error);
          return {
            ...t,
            subtasks: list,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );

    if (targetTaskTitle) {
      logActivity({
        type: 'subtask_reordered',
        taskId,
        taskKey: targetTaskKey,
        taskTitle: targetTaskTitle,
        memberId: currentUser.id,
        memberName: currentUser.name,
        details: `Reordenou hierarquia: "${movedSubtaskTitle}" movida para a posição #${destinationIndex + 1}`,
      });
    }
  };

  // Task Dependencies & Blockers management with NeonDB persistence
  const addDependency = (sourceTaskId: string, targetTaskId: string, type: DependencyType) => {
    if (sourceTaskId === targetTaskId) return;

    const sourceTask = tasks.find((t) => t.id === sourceTaskId);
    const targetTask = tasks.find((t) => t.id === targetTaskId);
    if (!sourceTask || !targetTask) return;

    const existingSrc = (sourceTask.dependencies || []).find((d) => d.targetTaskId === targetTaskId);
    if (existingSrc && existingSrc.type === type) return;

    const reciprocalType: DependencyType = type === 'blocks' ? 'is_blocked_by' : 'blocks';
    const now = new Date().toISOString();

    const newSrcDeps = [
      ...(sourceTask.dependencies || []).filter((d) => d.targetTaskId !== targetTaskId),
      {
        id: `dep-${Date.now()}-src`,
        targetTaskId,
        type,
        createdAt: now,
      },
    ];

    const newTgtDeps = [
      ...(targetTask.dependencies || []).filter((d) => d.targetTaskId !== sourceTaskId),
      {
        id: `dep-${Date.now()}-tgt`,
        targetTaskId: sourceTaskId,
        type: reciprocalType,
        createdAt: now,
      },
    ];

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === sourceTaskId) {
          return { ...t, dependencies: newSrcDeps, updatedAt: now };
        }
        if (t.id === targetTaskId) {
          return { ...t, dependencies: newTgtDeps, updatedAt: now };
        }
        return t;
      })
    );

    api.updateTask(sourceTaskId, { dependencies: newSrcDeps }).catch(console.error);
    api.updateTask(targetTaskId, { dependencies: newTgtDeps }).catch(console.error);

    const relDescription =
      type === 'blocks'
        ? `${sourceTask.key} bloqueia ${targetTask.key}`
        : `${sourceTask.key} é bloqueada por ${targetTask.key}`;

    logActivity({
      type: 'dependency_linked',
      taskId: sourceTask.id,
      taskKey: sourceTask.key,
      taskTitle: sourceTask.title,
      memberId: currentUser.id,
      memberName: currentUser.name,
      details: `Vínculo de dependência adicionado: ${relDescription}`,
    });

    if (type === 'is_blocked_by' && !isTaskDone(currentBoard, targetTask.statusId)) {
      dispatchIntegrationEvent(
        'task_blocked',
        `⚠️ ${sourceTask.key} foi marcada como bloqueada por ${targetTask.key} (${targetTask.title})`,
        {
          blockedTaskKey: sourceTask.key,
          blockerTaskKey: targetTask.key,
          linkedBy: currentUser.name,
        }
      );
    } else if (type === 'blocks' && !isTaskDone(currentBoard, sourceTask.statusId)) {
      dispatchIntegrationEvent(
        'task_blocked',
        `⚠️ ${targetTask.key} está bloqueada por ${sourceTask.key} (${sourceTask.title})`,
        {
          blockedTaskKey: targetTask.key,
          blockerTaskKey: sourceTask.key,
          linkedBy: currentUser.name,
        }
      );
    }
  };

  const removeDependency = (taskId: string, targetTaskId: string) => {
    const taskA = tasks.find((t) => t.id === taskId);
    const taskB = tasks.find((t) => t.id === targetTaskId);
    const now = new Date().toISOString();

    const newADeps = (taskA?.dependencies || []).filter((d) => d.targetTaskId !== targetTaskId);
    const newBDeps = (taskB?.dependencies || []).filter((d) => d.targetTaskId !== taskId);

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return { ...t, dependencies: newADeps, updatedAt: now };
        }
        if (t.id === targetTaskId) {
          return { ...t, dependencies: newBDeps, updatedAt: now };
        }
        return t;
      })
    );

    api.updateTask(taskId, { dependencies: newADeps }).catch(console.error);
    api.updateTask(targetTaskId, { dependencies: newBDeps }).catch(console.error);

    if (taskA && taskB) {
      logActivity({
        type: 'dependency_unlinked',
        taskId: taskA.id,
        taskKey: taskA.key,
        taskTitle: taskA.title,
        memberId: currentUser.id,
        memberName: currentUser.name,
        details: `Removeu vínculo de dependência entre ${taskA.key} e ${taskB.key}`,
      });
    }
  };

  // Add worklog (Estimadas x Realizadas) and persist to NeonDB
  const addWorklog = (taskId: string, hours: number, date: string, comment: string) => {
    const newLog: WorkLog = {
      id: `wl-${Date.now()}`,
      taskId,
      memberId: currentUser.id,
      hours: Number(hours.toFixed(1)),
      date: date || new Date().toISOString().split('T')[0],
      comment: comment || 'Apontamento de desenvolvimento',
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const newLogged = Number((t.loggedHours + hours).toFixed(1));
          const updatedWorklogs = [newLog, ...t.worklogs];
          api.updateTask(taskId, { loggedHours: newLogged, worklogs: updatedWorklogs }).catch(console.error);
          return {
            ...t,
            loggedHours: newLogged,
            worklogs: updatedWorklogs,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );

    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const totalLoggedNow = Number((task.loggedHours + hours).toFixed(1));
      logActivity({
        type: 'worklog_added',
        taskId: task.id,
        taskKey: task.key,
        taskTitle: task.title,
        memberId: currentUser.id,
        memberName: currentUser.name,
        details: `Registrou ${hours}h (${newLog.comment}). Total na tarefa: ${totalLoggedNow}h / ${task.estimatedHours}h`,
      });

      dispatchIntegrationEvent(
        'worklog_logged',
        `⏱ ${currentUser.name} registrou ${hours}h na tarefa ${task.key} (${task.title}). Total: ${totalLoggedNow}h/${task.estimatedHours}h`,
        {
          taskKey: task.key,
          member: currentUser.name,
          loggedHours: hours,
          totalLogged: totalLoggedNow,
          estimated: task.estimatedHours,
          comment,
        }
      );
    }
  };

  // Add Comment and persist to NeonDB
  const addComment = (taskId: string, text: string) => {
    if (!text.trim()) return;
    const newComment: TaskComment = {
      id: `c-${Date.now()}`,
      taskId,
      authorId: currentUser.id,
      text: text.trim(),
      createdAt: new Date().toISOString(),
    };

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          const updatedComments = [...t.comments, newComment];
          api.updateTask(taskId, { comments: updatedComments }).catch(console.error);
          return {
            ...t,
            comments: updatedComments,
            updatedAt: new Date().toISOString(),
          };
        }
        return t;
      })
    );

    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      logActivity({
        type: 'comment_added',
        taskId: task.id,
        taskKey: task.key,
        taskTitle: task.title,
        memberId: currentUser.id,
        memberName: currentUser.name,
        details: `Comentou: "${text.substring(0, 40)}${text.length > 40 ? '...' : ''}"`,
      });

      if (emailSettings.enabled && emailSettings.notifyOnMentions) {
        const mentionMatches = text.match(/@([a-zA-Z0-9_\u00C0-\u00FF.-]+)/g) || [];
        const recipientsToNotify = new Map<string, Member>();

        mentionMatches.forEach((m) => {
          const query = m.replace('@', '').toLowerCase();
          if (['todos', 'equipe', 'time', 'all', 'squad'].includes(query)) {
            members.forEach((mem) => {
              if (mem.id !== currentUser.id) {
                recipientsToNotify.set(mem.id, mem);
              }
            });
          } else {
            const found = members.find((mem) => {
              const firstName = mem.name.split(' ')[0].toLowerCase();
              const fullName = mem.name.toLowerCase();
              const emailPrefix = mem.email.split('@')[0].toLowerCase();
              return (
                firstName.includes(query) ||
                query.includes(firstName) ||
                fullName.includes(query) ||
                emailPrefix.includes(query)
              );
            });
            if (found) {
              recipientsToNotify.set(found.id, found);
            }
          }
        });

        if (mentionMatches.length > 0 && recipientsToNotify.size === 0) {
          const assignee = members.find((m) => m.id === task.assigneeId);
          if (assignee && assignee.id !== currentUser.id) {
            recipientsToNotify.set(assignee.id, assignee);
          } else if (members[1]) {
            recipientsToNotify.set(members[1].id, members[1]);
          }
        }

        recipientsToNotify.forEach((targetMember) => {
          triggerEmailAlert({
            triggerType: 'mention',
            taskId: task.id,
            taskKey: task.key,
            taskTitle: task.title,
            recipientEmail: targetMember.email,
            recipientName: targetMember.name,
            senderName: currentUser.name,
            subject: `[Brolabs Workflow] ${currentUser.name} mencionou você na tarefa ${task.key}`,
            contentPreview: `${currentUser.name} mencionou você: "${text.substring(0, 85)}${text.length > 85 ? '...' : ''}"`,
            htmlBody: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
                <div style="background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); padding: 16px 20px; border-radius: 8px; color: #ffffff; margin-bottom: 20px;">
                  <h2 style="margin: 0; font-size: 18px; font-weight: 700; letter-spacing: -0.02em;">Brolabs Workflow</h2>
                  <p style="margin: 4px 0 0 0; font-size: 12px; opacity: 0.9;">Alerta de Menção (@) em Comentário</p>
                </div>
                
                <p style="font-size: 14px; color: #1e293b; margin-top: 0;">Olá <strong>${targetMember.name}</strong>,</p>
                
                <p style="font-size: 14px; color: #334155; line-height: 1.5;">
                  <strong>${currentUser.name}</strong> mencionou você em um comentário da tarefa <strong style="color: #4f46e5;">${task.key} - ${task.title}</strong>:
                </p>
                
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #6366f1; border-radius: 6px; padding: 16px; margin: 20px 0;">
                  <p style="margin: 0; font-size: 14px; color: #1e293b; font-style: italic; white-space: pre-wrap;">"${text}"</p>
                </div>
              </div>
            `,
          });
        });
      }
    }
  };

  // Board operations and persistence to NeonDB
  const createBoard = (boardData: { name: string; key: string; description: string; sprintName: string }) => {
    const newBoard: Board = {
      id: `board-${Date.now()}`,
      key: boardData.key.toUpperCase(),
      name: boardData.name,
      description: boardData.description,
      sprintName: boardData.sprintName || 'Sprint 1',
      sprintGoal: 'Metas e entregas principais da iteração',
      sprintStartDate: new Date().toISOString().split('T')[0],
      sprintEndDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      columns: [
        { id: 'col-backlog', title: 'Backlog', order: 0, wipLimit: 20, accentColor: '#64748b' },
        { id: 'col-todo', title: 'A Fazer', order: 1, wipLimit: 10, accentColor: '#3b82f6' },
        { id: 'col-inprogress', title: 'Em Andamento', order: 2, wipLimit: 6, accentColor: '#eab308' },
        { id: 'col-review', title: 'Code Review / QA', order: 3, wipLimit: 4, accentColor: '#8b5cf6' },
        { id: 'col-done', title: 'Concluído', order: 4, accentColor: '#10b981', isDone: true },
      ],
      epics: [],
    };

    setBoards((prev) => [...prev, newBoard]);
    setCurrentBoardId(newBoard.id);
    api.createBoard(newBoard).catch(console.error);
  };

  const updateBoard = (boardId: string, updates: Partial<Board>) => {
    setBoards((prev) =>
      prev.map((b) => {
        if (b.id === boardId) {
          const updated = { ...b, ...updates };
          api.updateBoard(boardId, updates).catch(console.error);
          return updated;
        }
        return b;
      })
    );
  };

  // Board columns (item 1.1) — lock otimista via boards.version
  const applyColumnsResult = (boardId: string, columns: Board['columns'], version: number) => {
    setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, columns, version } : b)));
  };

  const addColumn = async (data: {
    title: string;
    accentColor?: string;
    wipLimit?: number | null;
    isDone?: boolean;
  }) => {
    try {
      const res = await api.createColumn(currentBoard.id, { ...data, version: currentBoard.version ?? 1 });
      applyColumnsResult(currentBoard.id, res.columns, res.version);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Falha ao criar coluna');
      throw err;
    }
  };

  const updateColumn = async (
    columnId: string,
    data: { title?: string; accentColor?: string; wipLimit?: number | null; isDone?: boolean }
  ) => {
    try {
      const res = await api.updateColumn(currentBoard.id, columnId, {
        ...data,
        version: currentBoard.version ?? 1,
      });
      applyColumnsResult(currentBoard.id, res.columns, res.version);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Falha ao atualizar coluna');
      throw err;
    }
  };

  const reorderColumns = async (order: string[]) => {
    try {
      const res = await api.reorderColumns(currentBoard.id, order, currentBoard.version ?? 1);
      applyColumnsResult(currentBoard.id, res.columns, res.version);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Falha ao reordenar colunas');
      throw err;
    }
  };

  const deleteColumn = async (columnId: string, reassignTo?: string) => {
    try {
      const res = await api.deleteColumn(currentBoard.id, columnId, currentBoard.version ?? 1, reassignTo);
      applyColumnsResult(currentBoard.id, res.columns, res.version);
    } catch (err: any) {
      console.error(err);
      alert(err?.message || 'Falha ao remover coluna');
      throw err;
    }
  };

  // Task archive (item 1.5)
  const fetchArchivedTasks = async () => {
    try {
      setIsArchivedTasksLoading(true);
      const list = await api.getArchivedTasks(currentBoard.id);
      setArchivedTasks(list);
    } catch (err) {
      console.error('Falha ao carregar tarefas arquivadas:', err);
    } finally {
      setIsArchivedTasksLoading(false);
    }
  };

  const archiveTask = async (taskId: string, force = false): Promise<void> => {
    const task = tasks.find((t) => t.id === taskId);
    try {
      const res = await api.archiveTask(taskId, force);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setArchivedTasks((prev) => [res.task, ...prev]);
      if (selectedTaskModalId === taskId) setSelectedTaskModalId(null);
      if (activeTimer?.taskId === taskId) setActiveTimer(null);
      if (task) {
        logActivity({
          type: 'status_change',
          taskId: task.id,
          taskKey: task.key,
          taskTitle: task.title,
          memberId: currentUser.id,
          memberName: currentUser.name,
          details: `Arquivou a tarefa ${task.key}${force ? ' (forçado — bloqueios removidos)' : ''}`,
        });
      }
    } catch (err: any) {
      if (err?.status === 409 && err?.blockingTaskIds?.length > 0 && !force) {
        const keys = err.blockingTaskIds
          .map((id: string) => tasks.find((t) => t.id === id)?.key || id)
          .join(', ');
        if (
          confirm(
            `Esta tarefa bloqueia outras tarefas ativas (${keys}). Arquivar mesmo assim e remover os bloqueios?`
          )
        ) {
          return archiveTask(taskId, true);
        }
        throw err;
      }
      console.error('Falha ao arquivar tarefa:', err);
      alert(err?.message || 'Falha ao arquivar tarefa');
      throw err;
    }
  };

  const unarchiveTask = async (taskId: string): Promise<void> => {
    try {
      const res = await api.unarchiveTask(taskId);
      setArchivedTasks((prev) => prev.filter((t) => t.id !== taskId));
      setTasks((prev) => [res.task, ...prev]);
    } catch (err: any) {
      console.error('Falha ao restaurar tarefa:', err);
      alert('Falha ao restaurar tarefa');
      throw err;
    }
  };

  // Task attachments (item 2.1)
  const fetchTaskAttachments = async (taskId: string): Promise<void> => {
    try {
      setIsAttachmentsLoading(true);
      const attachments = await api.getTaskAttachments(taskId);
      setAttachmentsByTask((prev) => ({ ...prev, [taskId]: attachments }));
    } catch (err) {
      console.error('Falha ao carregar anexos:', err);
    } finally {
      setIsAttachmentsLoading(false);
    }
  };

  const uploadTaskAttachment = async (
    taskId: string,
    file: File,
    onProgress?: (pct: number) => void
  ): Promise<void> => {
    const attachment = await api.uploadTaskAttachment(taskId, file, onProgress);
    setAttachmentsByTask((prev) => ({
      ...prev,
      [taskId]: [attachment, ...(prev[taskId] || [])],
    }));
  };

  const deleteTaskAttachment = async (taskId: string, attachmentId: string): Promise<void> => {
    await api.deleteTaskAttachment(taskId, attachmentId);
    setAttachmentsByTask((prev) => ({
      ...prev,
      [taskId]: (prev[taskId] || []).filter((a) => a.id !== attachmentId),
    }));
  };

  // Members and persistence to NeonDB
  const addMember = (memberData: Omit<Member, 'id'>) => {
    const newMember: Member = {
      ...memberData,
      id: `mem-${Date.now()}`,
    };
    setMembers((prev) => [...prev, newMember]);
    api.createMember(newMember).catch(console.error);
  };

  const updateMember = (memberId: string, updates: Partial<Member>) => {
    setMembers((prev) =>
      prev.map((m) => {
        if (m.id === memberId) {
          const updated = { ...m, ...updates };
          api.updateMember(memberId, updates).catch(console.error);
          return updated;
        }
        return m;
      })
    );
  };

  // Integrations and persistence to NeonDB
  const updateIntegrationConfig = (platform: IntegrationPlatform, updates: Partial<IntegrationConfig>) => {
    setIntegrations((prev) =>
      prev.map((item) => {
        if (item.id === platform) {
          const updated = { ...item, ...updates };
          api.updateIntegration(platform, updates).catch(console.error);
          return updated;
        }
        return item;
      })
    );
  };

  const sendTestWebhook = async (platform: IntegrationPlatform): Promise<boolean> => {
    const target = integrations.find((i) => i.id === platform);
    if (!target) return false;

    const newLog: WebhookLog = {
      id: `wh-${Date.now()}`,
      platform,
      eventType: 'test_ping',
      payloadSummary: `[Teste] Disparo simulado com sucesso para ${target.name} (${target.channelName})`,
      status: 'delivered',
      timestamp: new Date().toISOString(),
    };

    setWebhookLogs((prev) => [newLog, ...prev]);
    api.createWebhookLog(newLog).catch(console.error);

    updateIntegrationConfig(platform, {
      lastTestedAt: new Date().toISOString(),
      lastTestStatus: 'success',
    });

    logActivity({
      type: 'webhook_dispatched',
      taskId: 'system',
      taskKey: 'INTEG',
      taskTitle: `Disparo de teste ${target.name}`,
      memberId: currentUser.id,
      memberName: currentUser.name,
      details: `Enviou ping de teste para o canal ${target.channelName}`,
    });

    return true;
  };

  // Real-time Timer
  const startTimer = (taskId: string) => {
    setActiveTimer({
      taskId,
      startTime: Date.now(),
      elapsedSeconds: 0,
      isRunning: true,
    });
  };

  const pauseTimer = () => {
    setActiveTimer((prev) => (prev ? { ...prev, isRunning: false } : null));
  };

  const resumeTimer = () => {
    setActiveTimer((prev) => (prev ? { ...prev, isRunning: true } : null));
  };

  const stopTimer = () => {
    setActiveTimer(null);
  };

  const stopTimerAndLogWork = (comment?: string) => {
    if (!activeTimer) return;
    const hoursSpent = Math.max(0.1, Number((activeTimer.elapsedSeconds / 3600).toFixed(2)));
    addWorklog(
      activeTimer.taskId,
      hoursSpent,
      new Date().toISOString().split('T')[0],
      comment || `Sessão cronometrada em tempo real (${Math.floor(activeTimer.elapsedSeconds / 60)} min)`
    );
    setActiveTimer(null);
  };

  // Reset / Seed directly in NeonDB database
  const resetToDemoData = async () => {
    try {
      setIsLoading(true);
      await api.resetDatabase();
      await fetchDbData();
      setActiveTimer(null);
      setSelectedTaskModalId(null);
    } catch (err) {
      console.error('Falha ao resetar banco de dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AgileContext.Provider
      value={{
        boards,
        currentBoardId,
        currentBoard,
        tasks,
        boardTasks,
        filteredBoardTasks,
        members,
        currentUser,
        activityLogs,
        integrations,
        webhookLogs,
        currentView,
        filters,
        activeTimer,
        selectedTaskModalId,
        isCreateModalOpen,
        isShortcutsModalOpen,
        isCommandPaletteOpen,
        isBoardSettingsOpen,
        isTaskArchiveOpen,
        archivedTasks,
        isArchivedTasksLoading,
        isLoading: isLoading || authIsLoading,
        dbConnected,
        refetchDbData: fetchDbData,
        setCurrentBoardId,
        setCurrentView,
        setCurrentUserId,
        setFilters,
        setSelectedTaskModalId,
        setIsCreateModalOpen,
        setIsShortcutsModalOpen,
        setIsCommandPaletteOpen,
        setIsBoardSettingsOpen,
        setIsTaskArchiveOpen,
        createTask,
        updateTask,
        moveTask,
        deleteTask,
        archiveTask,
        unarchiveTask,
        fetchArchivedTasks,
        addSubtask,
        toggleSubtask,
        deleteSubtask,
        reorderSubtasks,
        addDependency,
        removeDependency,
        addWorklog,
        addComment,
        createBoard,
        updateBoard,
        addColumn,
        updateColumn,
        reorderColumns,
        deleteColumn,
        addMember,
        updateMember,
        updateIntegrationConfig,
        sendTestWebhook,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        stopTimerAndLogWork,
        login: authLogin,
        logout: authLogout,
        isAuthenticated: authIsAuthenticated,
        resetToDemoData,
        emailNotifications,
        emailSettings,
        isEmailDrawerOpen,
        setIsEmailDrawerOpen,
        lastEmailAlertToast,
        clearEmailAlertToast,
        triggerEmailAlert,
        updateEmailSettings,
        markEmailAsRead,
        markAllEmailsAsRead,
        clearEmailHistory,
        myPermissions,
        can,
        attachmentsByTask,
        isAttachmentsLoading,
        fetchTaskAttachments,
        uploadTaskAttachment,
        deleteTaskAttachment,
        isBoardAccessOpen,
        setIsBoardAccessOpen,
      }}
    >
      {children}
    </AgileContext.Provider>
  );
};

export const useAgile = () => {
  const context = useContext(AgileContext);
  if (!context) {
    throw new Error('useAgile must be used within an AgileProvider');
  }
  return context;
};
