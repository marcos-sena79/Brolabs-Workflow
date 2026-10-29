export type IssueType = 'story' | 'task' | 'bug' | 'epic';

export type Priority = 'lowest' | 'low' | 'medium' | 'high' | 'urgent';

export interface Member {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: string;
  department: string;
  weeklyCapacityHours: number;
  active: boolean;
  passwordHash?: string;
  system_role?: string;
}

export interface SubTask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  assigneeId?: string;
  assigneeIds?: string[]; // subtarefas herdam o mecanismo (Item 1)
  estimatedHours: number;
  loggedHours: number;
}

export interface WorkLog {
  id: string;
  taskId: string;
  memberId: string;
  hours: number;
  date: string;
  comment: string;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export type DependencyType = 'blocks' | 'is_blocked_by';

export interface TaskDependencyLink {
  id: string;
  targetTaskId: string;
  type: DependencyType;
  createdAt: string;
}

export interface Task {
  id: string;
  key: string; // e.g. "ENG-101"
  boardId: string;
  title: string;
  description: string;
  issueType: IssueType;
  priority: Priority;
  statusId: string;
  assigneeId: string; // principal (primeiro da lista; compat legado)
  assigneeIds: string[]; // múltiplos responsáveis (Item 1 — Onda 2)
  reporterId: string;
  epicId?: string | null;
  parentId?: string | null; // história pai (Onda 2 — 2A)
  estimatedHours: number;
  loggedHours: number;
  storyPoints: number;
  dueDate: string;
  createdAt: string;
  updatedAt: string;
  subtasks: SubTask[];
  worklogs: WorkLog[];
  comments: TaskComment[];
  tags: string[];
  dependencies?: TaskDependencyLink[];
  archivedAt?: string | null;
  archivedBy?: string | null;
}

export interface Column {
  id: string;
  title: string;
  order: number;
  wipLimit?: number;
  accentColor: string;
  isDone?: boolean;
}

export interface Epic {
  id: string;
  boardId: string;
  key: string;
  name: string;
  color: string;
  description: string;
}

export interface Board {
  id: string;
  key: string; // e.g. "ENG"
  name: string;
  description: string;
  sprintName: string;
  sprintGoal: string;
  sprintStartDate: string;
  sprintEndDate: string;
  columns: Column[];
  epics: Epic[];
  version?: number;
}

export type ActivityActionType =
  | 'status_change'
  | 'worklog_added'
  | 'task_created'
  | 'task_updated'
  | 'subtask_toggled'
  | 'subtask_added'
  | 'subtask_reordered'
  | 'dependency_linked'
  | 'dependency_unlinked'
  | 'comment_added'
  | 'webhook_dispatched'
  | 'email_alert_sent';

export interface EmailNotification {
  id: string;
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
  status: 'sent' | 'delivered' | 'pending' | 'failed';
  timestamp: string;
  read: boolean;
  attempts?: number;
  lastError?: string | null;
}

export interface MemberPreferences {
  soundEnabled?: boolean;
  soundVolume?: number;
  soundEvent?: 'none' | 'soft' | 'digital';
  theme?: 'light' | 'dark' | 'system';
}

export interface EmailSettings {
  enabled: boolean;
  senderEmail: string;
  senderName: string;
  notifyOnStatusChange: boolean;
  notifyOnMentions: boolean;
  notifyReporterOnDone: boolean;
}

export interface ActivityItem {
  id: string;
  type: ActivityActionType;
  taskId: string;
  taskKey: string;
  taskTitle: string;
  memberId: string;
  memberName: string;
  details: string;
  timestamp: string;
}

export type IntegrationPlatform = 'slack' | 'discord' | 'teams' | 'custom';

export interface IntegrationConfig {
  id: IntegrationPlatform;
  name: string;
  enabled: boolean;
  webhookUrl: string;
  channelName: string;
  notifyOnTaskComplete: boolean;
  notifyOnWorklog: boolean;
  notifyOnTaskBlocked: boolean;
  notifyOnSprintStart: boolean;
  notifyOnMention?: boolean;
  notifyOnAssignment?: boolean;
  memberHandles?: Record<string, string>;
  lastTestedAt?: string;
  lastTestStatus?: 'success' | 'failed';
}

export interface WebhookLog {
  id: string;
  platform: IntegrationPlatform;
  eventType: string;
  payloadSummary: string;
  status: 'delivered' | 'failed' | 'pending' | 'simulated';
  timestamp: string;
  attempts?: number;
  responseStatus?: number | null;
  error?: string | null;
}

export type ViewTab =
  | 'kanban'
  | 'backlog'
  | 'my_todo'
  | 'notes'
  | 'daily_dashboard'
  | 'time_tracking'
  | 'productivity_reports'
  | 'member_performance'
  | 'integrations';

// --- Permissões por board (item 5.1) ---

export type BoardRole = 'owner' | 'editor' | 'viewer';

export type PermissionFlag =
  | 'canCreateTask'
  | 'canEditTask'
  | 'canChangeStatus'
  | 'canAddComment'
  | 'canLogWork'
  | 'canInviteMember'
  | 'canManageMembers'
  | 'canManageBoard'
  | 'canDeleteTask';

export interface BoardPermissions extends Record<PermissionFlag, boolean> {
  role: BoardRole;
  isAdmin: boolean;
  hasBoardAccess: boolean;
}

export interface BoardMemberInfo {
  memberId: string;
  name: string;
  email: string;
  avatar: string;
  jobTitle: string;
  active: boolean;
  role: BoardRole;
  permissions: Partial<Record<PermissionFlag, boolean>>;
  joinedAt: string;
}

// --- Anexos de tarefas (item 2.1) ---

export interface TaskAttachment {
  id: string;
  taskId: string;
  boardId: string;
  uploaderId: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

// --- To-Do do dia (item 2.4) ---

export interface DailyTodo {
  id: string;
  memberId: string;
  boardId: string | null;
  title: string;
  done: boolean;
  dueDate: string; // YYYY-MM-DD
  sourceTaskId: string | null;
  position: number;
  createdAt: string;
  completedAt: string | null;
}

// Tarefa sugerida para virar To-Do (vencendo hoje / atrasadas)
export interface TodoSuggestion {
  id: string;
  key: string;
  title: string;
  boardId: string;
  boardKey: string;
  priority: string;
  dueDate: string;
  statusId: string;
  statusTitle: string;
  isOverdue: boolean;
}

// --- Notas + IA (item 4.1) ---

export interface Note {
  id: string;
  boardId: string;
  memberId: string;
  authorName: string;
  title: string;
  content: string;
  pinned: boolean;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

export type NoteAiAction = 'summarize' | 'expand' | 'action_items';

export interface AiUsage {
  id: number;
  memberId: string | null;
  action: string;
  inputChars: number | null;
  outputChars: number | null;
  status: 'ok' | 'error' | 'rate_limited';
  createdAt: string;
}

// --- Board público/privado (item 1.2) ---

export interface BoardShareInfo {
  visibility: 'public' | 'private';
  token: string | null;
  url: string | null;
  expiresAt: string | null;
}

export interface PublicTask {
  id: string;
  key: string;
  title: string;
  statusId: string;
  priority: string;
  issueType: string;
  assigneeName: string | null;
  assigneeNames?: string[]; // múltiplos responsáveis no payload público (Item 1)
  dueDate: string;
  storyPoints: number;
  tags: string[];
  subtasks: { title: string; completed: boolean }[];
  commentsCount: number;
}

export interface PublicBoardData {
  board: Board;
  tasks: PublicTask[];
}

// --- Tarefa pública com comentários (item 3 da Onda 2) ---

export interface TaskPublicLink {
  active: boolean;
  token: string | null;
  url: string | null;
  expiresAt: string | null;
  allowComments: boolean;
  createdAt?: string | null;
}

export interface VisitorComment {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
  removed?: boolean;
}

export interface PublicTaskDetail {
  id: string;
  key: string;
  title: string;
  description: string;
  priority: string;
  issueType: string;
  dueDate: string;
  storyPoints: number;
  tags: string[];
  statusTitle: string;
  subtasks: { title: string; completed: boolean }[];
  assigneeNames: string[];
}

export interface PublicTaskData {
  task: PublicTaskDetail;
  allowComments: boolean;
  expiresAt: string | null;
  comments: { id: string; visitorName: string; body: string; createdAt: string }[];
}

// --- Commits do GitHub atrelados à tarefa (item 4 da Onda 2) ---

export interface TaskCommit {
  id: string;
  sha: string;
  message: string;
  author: string | null;
  authorAvatar: string | null;
  url: string | null;
  branch: string | null;
  repo: string | null;
  committedAt: string | null;
  createdAt: string;
}

export interface GithubRepoSetting {
  id: string;
  owner: string;
  repo: string;
  enabled: boolean;
  hasSecret: boolean;
}

// --- Etiquetas globais (item 2.2) ---

export interface TagDef {
  id: string;
  name: string;
  color: string;
  usageCount: number;
  orphan?: boolean;
}
