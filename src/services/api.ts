import {
  Board,
  Member,
  Task,
  ActivityItem,
  IntegrationConfig,
  WebhookLog,
  EmailNotification,
  EmailSettings,
  IntegrationPlatform,
} from '../types';

export interface InitialStateResponse {
  boards: Board[];
  members: Member[];
  tasks: Task[];
  activityLogs: ActivityItem[];
  integrations: IntegrationConfig[];
  webhookLogs: WebhookLog[];
  emailSettings: EmailSettings;
  emailNotifications: EmailNotification[];
  currentBoardId: string;
  currentUserId: string;
}

export interface HealthResponse {
  status: string;
  database: string;
  provider: string;
  serverTime: string;
  databaseName: string;
  pgVersion: string;
  publicTables: number;
  totalTasks: number;
  totalBoards: number;
}

export interface AuthLoginResponse {
  token: string;
  member: Member;
}

export interface AuthRegisterResponse {
  token: string;
  member: Member;
}

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('brolabs_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Falha ao verificar saúde do backend');
    return res.json();
  },

  async getInitialState(): Promise<InitialStateResponse> {
    const res = await fetch('/api/initial-state', { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Falha ao carregar estado inicial do banco de dados Neon');
    return res.json();
  },

  async resetDatabase(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/reset-database', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ confirm: 'RESET' }),
    });
    if (!res.ok) throw new Error('Falha ao reiniciar banco de dados');
    return res.json();
  },

  async setAppSetting(key: string, value: any): Promise<void> {
    await fetch(`/api/app-settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ value }),
    });
  },

  // Tasks
  async createTask(task: Task): Promise<Task> {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(task),
    });
    if (!res.ok) throw new Error('Falha ao criar tarefa no NeonDB');
    const data = await res.json();
    return data.task || task;
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Falha ao atualizar tarefa no NeonDB');
    const data = await res.json();
    return data.task;
  },

  async deleteTask(id: string): Promise<void> {
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Falha ao remover tarefa no NeonDB');
  },

  // Boards
  async createBoard(board: Board): Promise<Board> {
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(board),
    });
    if (!res.ok) throw new Error('Falha ao criar board no NeonDB');
    const data = await res.json();
    return data.board || board;
  },

  async updateBoard(id: string, updates: Partial<Board>): Promise<Board> {
    const res = await fetch(`/api/boards/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Falha ao atualizar board no NeonDB');
    const data = await res.json();
    return data.board;
  },

  async deleteBoard(id: string): Promise<void> {
    const res = await fetch(`/api/boards/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Falha ao deletar board no NeonDB');
  },

  // Board columns (item 1.1 — lock otimista via version)
  async createColumn(
    boardId: string,
    data: { title: string; accentColor?: string; wipLimit?: number | null; isDone?: boolean; version: number }
  ): Promise<{ columns: Board['columns']; version: number }> {
    const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/columns`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao criar coluna');
    return res.json();
  },

  async updateColumn(
    boardId: string,
    columnId: string,
    data: { title?: string; accentColor?: string; wipLimit?: number | null; isDone?: boolean; version: number }
  ): Promise<{ columns: Board['columns']; version: number }> {
    const res = await fetch(
      `/api/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}`,
      {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(data),
      }
    );
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao atualizar coluna');
    return res.json();
  },

  async reorderColumns(
    boardId: string,
    order: string[],
    version: number
  ): Promise<{ columns: Board['columns']; version: number }> {
    const res = await fetch(`/api/boards/${encodeURIComponent(boardId)}/columns/reorder`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ order, version }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Falha ao reordenar colunas');
    return res.json();
  },

  async deleteColumn(
    boardId: string,
    columnId: string,
    version: number,
    reassignTo?: string
  ): Promise<{ columns: Board['columns']; version: number }> {
    const params = new URLSearchParams({ version: String(version) });
    if (reassignTo) params.set('reassignTo', reassignTo);
    const res = await fetch(
      `/api/boards/${encodeURIComponent(boardId)}/columns/${encodeURIComponent(columnId)}?${params}`,
      { method: 'DELETE', headers: getAuthHeaders() }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || 'Falha ao remover coluna');
    }
    return res.json();
  },

  // Task archive (item 1.5)
  async archiveTask(id: string, force = false): Promise<{ task: Task }> {
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}/archive`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ force }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw Object.assign(new Error(err?.error || 'Falha ao arquivar tarefa'), {
        blockingTaskIds: err?.blockingTaskIds,
        status: res.status,
      });
    }
    return res.json();
  },

  async unarchiveTask(id: string): Promise<{ task: Task }> {
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}/unarchive`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Falha ao restaurar tarefa');
    return res.json();
  },

  async getArchivedTasks(boardId: string): Promise<Task[]> {
    const res = await fetch(
      `/api/boards/${encodeURIComponent(boardId)}/tasks?archived=true`,
      { headers: getAuthHeaders() }
    );
    if (!res.ok) throw new Error('Falha ao carregar tarefas arquivadas');
    const data = await res.json();
    return data.tasks || [];
  },

  // Members
  async createMember(member: Member): Promise<Member> {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(member),
    });
    if (!res.ok) throw new Error('Falha ao cadastrar membro no NeonDB');
    const data = await res.json();
    return data.member || member;
  },

  async updateMember(id: string, updates: Partial<Member>): Promise<Member> {
    const res = await fetch(`/api/members/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Falha ao atualizar membro no NeonDB');
    const data = await res.json();
    return data.member;
  },

  // Activities
  async createActivity(activity: ActivityItem): Promise<void> {
    await fetch('/api/activities', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(activity),
    });
  },

  // Integrations
  async updateIntegration(platform: IntegrationPlatform, updates: Partial<IntegrationConfig>): Promise<IntegrationConfig> {
    const res = await fetch(`/api/integrations/${encodeURIComponent(platform)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Falha ao atualizar integração no NeonDB');
    const data = await res.json();
    return data.integration;
  },

  async createWebhookLog(log: WebhookLog): Promise<void> {
    await fetch('/api/webhooks', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(log),
    });
  },

  // Email
  async updateEmailSettings(settings: Partial<EmailSettings>): Promise<void> {
    await fetch('/api/email/settings', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(settings),
    });
  },

  async createEmailNotification(notification: EmailNotification): Promise<void> {
    await fetch('/api/email/notifications', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(notification),
    });
  },

  async markEmailAsRead(id: string): Promise<void> {
    await fetch(`/api/email/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
  },

  async markAllEmailsAsRead(): Promise<void> {
    await fetch('/api/email/notifications/read-all', {
      method: 'PUT',
      headers: getAuthHeaders(),
    });
  },

  async clearEmailHistory(): Promise<void> {
    await fetch('/api/email/notifications', {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
  },

  // Bucket Storage
  async uploadAvatarToBucket(
    file: File,
    memberId?: string
  ): Promise<{ success: boolean; url: string; filename: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const imageBase64 = reader.result as string;
          const res = await fetch('/api/bucket/upload', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
              memberId,
              filename: file.name,
              imageBase64,
            }),
          });
          if (!res.ok) throw new Error('Falha no upload para o bucket');
          const data = await res.json();
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  },

  async getBucketAvatars(): Promise<Array<{ filename: string; url: string }>> {
    const res = await fetch('/api/bucket/avatars');
    if (!res.ok) throw new Error('Falha ao listar arquivos do bucket');
    const data = await res.json();
    return data.files || [];
  },

  // Auth
  async login(credentials: {
    email: string;
    password: string;
  }): Promise<AuthLoginResponse> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Falha ao fazer login');
    }
    return res.json();
  },

  async register(memberData: {
    id: string;
    name: string;
    email: string;
    password: string;
    role: string;
    department: string;
    weeklyCapacityHours: number;
    active: boolean;
  }): Promise<AuthRegisterResponse> {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memberData),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Falha ao cadastrar membro');
    }
    return res.json();
  },

  async logout(): Promise<void> {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  },

  async me(): Promise<{ member: Member }> {
    const res = await fetch('/api/auth/me', {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Falha ao validar sessão');
    return res.json();
  },
};
