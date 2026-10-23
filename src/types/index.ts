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
}

export interface SubTask {
  id: string;
  taskId: string;
  title: string;
  completed: boolean;
  assigneeId?: string;
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
  assigneeId: string;
  reporterId: string;
  epicId?: string;
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
  status: 'sent' | 'delivered';
  timestamp: string;
  read: boolean;
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
  lastTestedAt?: string;
  lastTestStatus?: 'success' | 'failed';
}

export interface WebhookLog {
  id: string;
  platform: IntegrationPlatform;
  eventType: string;
  payloadSummary: string;
  status: 'delivered' | 'simulated';
  timestamp: string;
}

export type ViewTab =
  | 'kanban'
  | 'backlog'
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
