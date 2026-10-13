import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
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
  TaskDependencyLink,
} from '../types';
import {
  INITIAL_BOARDS,
  INITIAL_MEMBERS,
  INITIAL_TASKS,
  INITIAL_INTEGRATIONS,
  INITIAL_ACTIVITY_LOGS,
  INITIAL_WEBHOOK_LOGS,
  INITIAL_EMAIL_SETTINGS,
  INITIAL_EMAIL_NOTIFICATIONS,
} from '../data/initialData';

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

  // Setters & Nav
  setCurrentBoardId: (id: string) => void;
  setCurrentView: (view: ViewTab) => void;
  setCurrentUserId: (id: string) => void;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  setSelectedTaskModalId: (id: string | null) => void;
  setIsCreateModalOpen: (open: boolean) => void;
  setIsShortcutsModalOpen: (open: boolean) => void;
  setIsCommandPaletteOpen: (open: boolean) => void;

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

  // Reset
  resetToDemoData: () => void;
}

const STORAGE_KEYS = {
  BOARDS: 'brolabs_boards_v1',
  TASKS: 'brolabs_tasks_v1',
  MEMBERS: 'brolabs_members_v1',
  INTEGRATIONS: 'brolabs_integrations_v1',
  ACTIVITIES: 'brolabs_activities_v1',
  WEBHOOKS: 'brolabs_webhooks_v1',
  CURRENT_BOARD: 'brolabs_current_board_v1',
  CURRENT_USER: 'brolabs_current_user_v1',
  EMAIL_NOTIFICATIONS: 'brolabs_email_notifications_v1',
  EMAIL_SETTINGS: 'brolabs_email_settings_v1',
};

const AgileContext = createContext<AgileContextType | undefined>(undefined);

export const AgileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Load from localStorage or initial
  const [boards, setBoards] = useState<Board[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BOARDS);
      return saved ? JSON.parse(saved) : INITIAL_BOARDS;
    } catch {
      return INITIAL_BOARDS;
    }
  });

  const [currentBoardId, setCurrentBoardId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_BOARD);
      return saved || INITIAL_BOARDS[0].id;
    } catch {
      return INITIAL_BOARDS[0].id;
    }
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TASKS);
      if (saved) {
        const parsed: Task[] = JSON.parse(saved);
        return parsed.map((t) => {
          const initMatch = INITIAL_TASKS.find((it) => it.id === t.id);
          return {
            ...t,
            dependencies: t.dependencies || initMatch?.dependencies || [],
          };
        });
      }
      return INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  const [members, setMembers] = useState<Member[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      return saved ? JSON.parse(saved) : INITIAL_MEMBERS;
    } catch {
      return INITIAL_MEMBERS;
    }
  });

  const [currentUserId, setCurrentUserId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
      return saved || INITIAL_MEMBERS[0].id;
    } catch {
      return INITIAL_MEMBERS[0].id;
    }
  });

  const [integrations, setIntegrations] = useState<IntegrationConfig[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.INTEGRATIONS);
      return saved ? JSON.parse(saved) : INITIAL_INTEGRATIONS;
    } catch {
      return INITIAL_INTEGRATIONS;
    }
  });

  const [activityLogs, setActivityLogs] = useState<ActivityItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.ACTIVITIES);
      return saved ? JSON.parse(saved) : INITIAL_ACTIVITY_LOGS;
    } catch {
      return INITIAL_ACTIVITY_LOGS;
    }
  });

  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.WEBHOOKS);
      return saved ? JSON.parse(saved) : INITIAL_WEBHOOK_LOGS;
    } catch {
      return INITIAL_WEBHOOK_LOGS;
    }
  });

  const [currentView, setCurrentView] = useState<ViewTab>('kanban');
  const [selectedTaskModalId, setSelectedTaskModalId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  const [filters, setFilters] = useState<FilterState>({
    searchQuery: '',
    selectedAssigneeId: 'all',
    selectedPriority: 'all',
    selectedIssueType: 'all',
    selectedEpicId: 'all',
    onlyMyTasks: false,
  });

  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);

  // Email Notification States
  const [emailNotifications, setEmailNotifications] = useState<EmailNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EMAIL_NOTIFICATIONS);
      return saved ? JSON.parse(saved) : INITIAL_EMAIL_NOTIFICATIONS;
    } catch {
      return INITIAL_EMAIL_NOTIFICATIONS;
    }
  });

  const [emailSettings, setEmailSettings] = useState<EmailSettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EMAIL_SETTINGS);
      return saved ? JSON.parse(saved) : INITIAL_EMAIL_SETTINGS;
    } catch {
      return INITIAL_EMAIL_SETTINGS;
    }
  });

  const [isEmailDrawerOpen, setIsEmailDrawerOpen] = useState(false);
  const [lastEmailAlertToast, setLastEmailAlertToast] = useState<EmailNotification | null>(null);

  // Sync state to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.BOARDS, JSON.stringify(boards));
  }, [boards]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_BOARD, currentBoardId);
  }, [currentBoardId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CURRENT_USER, currentUserId);
  }, [currentUserId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.INTEGRATIONS, JSON.stringify(integrations));
  }, [integrations]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACTIVITIES, JSON.stringify(activityLogs));
  }, [activityLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.WEBHOOKS, JSON.stringify(webhookLogs));
  }, [webhookLogs]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EMAIL_NOTIFICATIONS, JSON.stringify(emailNotifications));
  }, [emailNotifications]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.EMAIL_SETTINGS, JSON.stringify(emailSettings));
  }, [emailSettings]);

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
      // 1. Command Palette: Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      // Check if user is typing inside an editable form element
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

      // 2. Escape to close open modals
      if (e.key === 'Escape') {
        if (isEmailDrawerOpen) {
          setIsEmailDrawerOpen(false);
          return;
        }
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
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

      // If any modal is currently open, don't trigger background action shortcuts
      if (isCreateModalOpen || selectedTaskModalId || isShortcutsModalOpen || isCommandPaletteOpen || isEmailDrawerOpen) {
        return;
      }

      const key = e.key.toLowerCase();

      // 3. Two-key "G then <Key>" Navigation Sequences (Jira Standard)
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

      // 4. Number keys 1-7 for direct View switching
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

      // 5. Common Actions:
      // 'c' -> Create Task (Classic Jira standard)
      if (key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsCreateModalOpen(true);
        return;
      }

      // 'e' -> Open Email Notifications Drawer
      if (key === 'e' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setIsEmailDrawerOpen((prev) => !prev);
        return;
      }

      // '?' -> Open Shortcuts Cheat Sheet
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setIsShortcutsModalOpen(true);
        return;
      }

      // '/' -> Focus Search Input
      if (e.key === '/' && !e.shiftKey) {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Pesquisar"]') as HTMLInputElement | null;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
        return;
      }

      // 'm' -> Toggle "Minhas Tarefas" filter
      if (key === 'm' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setFilters((prev) => ({ ...prev, onlyMyTasks: !prev.onlyMyTasks }));
        return;
      }

      // 't' -> Toggle live timer
      if (key === 't' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (activeTimer) {
          if (activeTimer.isRunning) pauseTimer();
          else resumeTimer();
        } else {
          // Find first available task
          const taskCandidate = tasks.find((t) => t.boardId === currentBoardId && t.statusId !== 'col-done');
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
    activeTimer,
    currentBoardId,
    tasks,
  ]);

  // Derived current board and user
  const currentBoard = useMemo(() => {
    return boards.find((b) => b.id === currentBoardId) || boards[0] || INITIAL_BOARDS[0];
  }, [boards, currentBoardId]);

  const currentUser = useMemo(() => {
    return members.find((m) => m.id === currentUserId) || members[0] || INITIAL_MEMBERS[0];
  }, [members, currentUserId]);

  // Tasks for current board
  const boardTasks = useMemo(() => {
    return tasks.filter((t) => t.boardId === currentBoard.id);
  }, [tasks, currentBoard.id]);

  // Filtered tasks for current board
  const filteredBoardTasks = useMemo(() => {
    return boardTasks.filter((task) => {
      // Search query
      if (filters.searchQuery.trim()) {
        const query = filters.searchQuery.toLowerCase();
        const matchesKey = task.key.toLowerCase().includes(query);
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesDesc = task.description.toLowerCase().includes(query);
        const matchesTags = task.tags?.some((t) => t.toLowerCase().includes(query));
        if (!matchesKey && !matchesTitle && !matchesDesc && !matchesTags) return false;
      }

      // Assignee
      if (filters.selectedAssigneeId !== 'all' && task.assigneeId !== filters.selectedAssigneeId) {
        return false;
      }

      // Only my tasks
      if (filters.onlyMyTasks && task.assigneeId !== currentUser.id) {
        return false;
      }

      // Priority
      if (filters.selectedPriority !== 'all' && task.priority !== filters.selectedPriority) {
        return false;
      }

      // Issue Type
      if (filters.selectedIssueType !== 'all' && task.issueType !== filters.selectedIssueType) {
        return false;
      }

      // Epic
      if (filters.selectedEpicId !== 'all' && task.epicId !== filters.selectedEpicId) {
        return false;
      }

      // Only blocked tasks (tasks with active unresolved blockers)
      if (filters.onlyBlockedTasks) {
        const hasActiveBlocker = (task.dependencies || []).some((dep) => {
          if (dep.type !== 'is_blocked_by') return false;
          const blocker = tasks.find((t) => t.id === dep.targetTaskId);
          return blocker && blocker.statusId !== 'col-done';
        });
        if (!hasActiveBlocker) return false;
      }

      return true;
    });
  }, [boardTasks, filters, currentUser.id, tasks]);

  // Helper to add activity log
  const logActivity = (item: Omit<ActivityItem, 'id' | 'timestamp'>) => {
    const newLog: ActivityItem = {
      ...item,
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    setActivityLogs((prev) => [newLog, ...prev.slice(0, 49)]); // keep 50
  };

  // Trigger Email Notification Alert
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
    setEmailSettings((prev) => ({ ...prev, ...settings }));
  };

  const markEmailAsRead = (id: string) => {
    setEmailNotifications((prev) =>
      prev.map((e) => (e.id === id ? { ...e, read: true } : e))
    );
  };

  const markAllEmailsAsRead = () => {
    setEmailNotifications((prev) => prev.map((e) => ({ ...e, read: true })));
  };

  const clearEmailHistory = () => {
    setEmailNotifications([]);
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

      // Try sending actual webhook if URL is valid HTTP
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
          }).catch(() => {
            // Silently handle CORS in browser preview
          });
        } catch {
          // ignore network err
        }
      }
    });
  };

  // Create Task
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
    // Generate key e.g. ENG-111
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
      statusId: taskData.statusId || currentBoard.columns[1]?.id || 'col-todo',
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

  // Update Task
  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            ...updates,
            updatedAt: new Date().toISOString(),
          };
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

    const isMovedToDone = targetStatusId === 'col-done' || targetCol?.title.toLowerCase().includes('concluíd');

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

    // Email Notification Alert for Status Change
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
              <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569; line-height: 1.6;">
                <p style="margin: 2px 0;"><strong>Quadro:</strong> ${currentBoard.name} (${currentBoard.sprintName})</p>
                <p style="margin: 2px 0;"><strong>Prioridade:</strong> ${task.priority.toUpperCase()}</p>
                <p style="margin: 2px 0;"><strong>Horas:</strong> ${task.loggedHours}h apontadas / ${task.estimatedHours}h estimadas</p>
              </div>
            </div>

            <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
              Notificação automática gerada pelo sistema de alertas do Brolabs Workflow.
            </p>
          </div>
        `,
      });
    }

    // If marked as done, celebrate and dispatch integration!
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

  // Delete Task
  const deleteTask = (taskId: string) => {
    setTasks((prev) =>
      prev
        .filter((t) => t.id !== taskId)
        .map((t) => ({
          ...t,
          dependencies: (t.dependencies || []).filter((d) => d.targetTaskId !== taskId),
        }))
    );
    if (selectedTaskModalId === taskId) setSelectedTaskModalId(null);
    if (activeTimer?.taskId === taskId) setActiveTimer(null);
  };

  // Subtask management
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
          return {
            ...t,
            subtasks: [...t.subtasks, newSub],
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
          return {
            ...t,
            subtasks: t.subtasks.filter((s) => s.id !== subtaskId),
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

  // Task Dependencies & Blockers management
  const addDependency = (sourceTaskId: string, targetTaskId: string, type: DependencyType) => {
    if (sourceTaskId === targetTaskId) return;

    const sourceTask = tasks.find((t) => t.id === sourceTaskId);
    const targetTask = tasks.find((t) => t.id === targetTaskId);
    if (!sourceTask || !targetTask) return;

    const existingSrc = (sourceTask.dependencies || []).find((d) => d.targetTaskId === targetTaskId);
    if (existingSrc && existingSrc.type === type) return;

    const reciprocalType: DependencyType = type === 'blocks' ? 'is_blocked_by' : 'blocks';
    const now = new Date().toISOString();

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === sourceTaskId) {
          const filtered = (t.dependencies || []).filter((d) => d.targetTaskId !== targetTaskId);
          return {
            ...t,
            dependencies: [
              ...filtered,
              {
                id: `dep-${Date.now()}-src`,
                targetTaskId,
                type,
                createdAt: now,
              },
            ],
            updatedAt: now,
          };
        }
        if (t.id === targetTaskId) {
          const filtered = (t.dependencies || []).filter((d) => d.targetTaskId !== sourceTaskId);
          return {
            ...t,
            dependencies: [
              ...filtered,
              {
                id: `dep-${Date.now()}-tgt`,
                targetTaskId: sourceTaskId,
                type: reciprocalType,
                createdAt: now,
              },
            ],
            updatedAt: now,
          };
        }
        return t;
      })
    );

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

    if (type === 'is_blocked_by' && targetTask.statusId !== 'col-done') {
      dispatchIntegrationEvent(
        'task_blocked',
        `⚠️ ${sourceTask.key} foi marcada como bloqueada por ${targetTask.key} (${targetTask.title})`,
        {
          blockedTaskKey: sourceTask.key,
          blockerTaskKey: targetTask.key,
          linkedBy: currentUser.name,
        }
      );
    } else if (type === 'blocks' && sourceTask.statusId !== 'col-done') {
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

    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            dependencies: (t.dependencies || []).filter((d) => d.targetTaskId !== targetTaskId),
            updatedAt: now,
          };
        }
        if (t.id === targetTaskId) {
          return {
            ...t,
            dependencies: (t.dependencies || []).filter((d) => d.targetTaskId !== taskId),
            updatedAt: now,
          };
        }
        return t;
      })
    );

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

  // Add worklog (Estimadas x Realizadas)
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
          return {
            ...t,
            loggedHours: newLogged,
            worklogs: [newLog, ...t.worklogs],
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

  // Add Comment
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
          return {
            ...t,
            comments: [...t.comments, newComment],
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

      // Email Notification Alert for @mentions in Comments
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

        // Fallback: if user typed an @ mention that didn't match anyone specifically, notify the task assignee
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
                  <div style="margin-top: 14px; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #475569; line-height: 1.6;">
                    <p style="margin: 2px 0;"><strong>Quadro:</strong> ${currentBoard.name}</p>
                    <p style="margin: 2px 0;"><strong>Prioridade:</strong> ${task.priority.toUpperCase()}</p>
                    <p style="margin: 2px 0;"><strong>Status:</strong> ${currentBoard.columns.find((c) => c.id === task.statusId)?.title || task.statusId}</p>
                  </div>
                </div>

                <p style="font-size: 12px; color: #94a3b8; margin-top: 24px; border-top: 1px solid #f1f5f9; padding-top: 12px;">
                  Você recebeu este alerta por ter sido citado nominalmente no Brolabs Workflow.
                </p>
              </div>
            `,
          });
        });
      }
    }
  };

  // Board operations
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
        { id: 'col-done', title: 'Concluído', order: 4, accentColor: '#10b981' },
      ],
      epics: [],
    };

    setBoards((prev) => [...prev, newBoard]);
    setCurrentBoardId(newBoard.id);
  };

  const updateBoard = (boardId: string, updates: Partial<Board>) => {
    setBoards((prev) => prev.map((b) => (b.id === boardId ? { ...b, ...updates } : b)));
  };

  // Members
  const addMember = (memberData: Omit<Member, 'id'>) => {
    const newMember: Member = {
      ...memberData,
      id: `mem-${Date.now()}`,
    };
    setMembers((prev) => [...prev, newMember]);
  };

  const updateMember = (memberId: string, updates: Partial<Member>) => {
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, ...updates } : m)));
  };

  // Integrations
  const updateIntegrationConfig = (platform: IntegrationPlatform, updates: Partial<IntegrationConfig>) => {
    setIntegrations((prev) =>
      prev.map((item) => (item.id === platform ? { ...item, ...updates } : item))
    );
  };

  const sendTestWebhook = async (platform: IntegrationPlatform): Promise<boolean> => {
    const target = integrations.find((i) => i.id === platform);
    if (!target) return false;

    const testPayload = {
      event: 'test_notification',
      platform,
      sender: currentUser.name,
      board: currentBoard.name,
      message: `🔔 Teste de integração Brolabs Workflow conectado ao canal ${target.channelName}!`,
      timestamp: new Date().toISOString(),
    };

    const newLog: WebhookLog = {
      id: `wh-${Date.now()}`,
      platform,
      eventType: 'test_ping',
      payloadSummary: `[Teste] Disparo simulado com sucesso para ${target.name} (${target.channelName})`,
      status: 'delivered',
      timestamp: new Date().toISOString(),
    };

    setWebhookLogs((prev) => [newLog, ...prev]);

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

  // Reset to demo
  const resetToDemoData = () => {
    localStorage.removeItem(STORAGE_KEYS.BOARDS);
    localStorage.removeItem(STORAGE_KEYS.TASKS);
    localStorage.removeItem(STORAGE_KEYS.MEMBERS);
    localStorage.removeItem(STORAGE_KEYS.INTEGRATIONS);
    localStorage.removeItem(STORAGE_KEYS.ACTIVITIES);
    localStorage.removeItem(STORAGE_KEYS.WEBHOOKS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_BOARD);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);

    setBoards(INITIAL_BOARDS);
    setCurrentBoardId(INITIAL_BOARDS[0].id);
    setTasks(INITIAL_TASKS);
    setMembers(INITIAL_MEMBERS);
    setCurrentUserId(INITIAL_MEMBERS[0].id);
    setIntegrations(INITIAL_INTEGRATIONS);
    setActivityLogs(INITIAL_ACTIVITY_LOGS);
    setWebhookLogs(INITIAL_WEBHOOK_LOGS);
    setActiveTimer(null);
    setSelectedTaskModalId(null);
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
        setCurrentBoardId,
        setCurrentView,
        setCurrentUserId,
        setFilters,
        setSelectedTaskModalId,
        setIsCreateModalOpen,
        setIsShortcutsModalOpen,
        setIsCommandPaletteOpen,
        createTask,
        updateTask,
        moveTask,
        deleteTask,
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
        addMember,
        updateMember,
        updateIntegrationConfig,
        sendTestWebhook,
        startTimer,
        pauseTimer,
        resumeTimer,
        stopTimer,
        stopTimerAndLogWork,
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
