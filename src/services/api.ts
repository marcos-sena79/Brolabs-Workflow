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

export const api = {
  async getHealth(): Promise<HealthResponse> {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error('Falha ao verificar saúde do backend');
    return res.json();
  },

  async getInitialState(): Promise<InitialStateResponse> {
    const res = await fetch('/api/initial-state');
    if (!res.ok) throw new Error('Falha ao carregar estado inicial do banco de dados Neon');
    return res.json();
  },

  async resetDatabase(): Promise<{ success: boolean; message: string }> {
    const res = await fetch('/api/reset-database', { method: 'POST' });
    if (!res.ok) throw new Error('Falha ao reiniciar banco de dados');
    return res.json();
  },

  async setAppSetting(key: string, value: any): Promise<void> {
    await fetch(`/api/app-settings/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value }),
    });
  },

  // Tasks
  async createTask(task: Task): Promise<Task> {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(task),
    });
    if (!res.ok) throw new Error('Falha ao criar tarefa no NeonDB');
    const data = await res.json();
    return data.task || task;
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<Task> {
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Falha ao atualizar tarefa no NeonDB');
    const data = await res.json();
    return data.task;
  },

  async deleteTask(id: string): Promise<void> {
    const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao remover tarefa no NeonDB');
  },

  // Boards
  async createBoard(board: Board): Promise<Board> {
    const res = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(board),
    });
    if (!res.ok) throw new Error('Falha ao criar board no NeonDB');
    const data = await res.json();
    return data.board || board;
  },

  async updateBoard(id: string, updates: Partial<Board>): Promise<Board> {
    const res = await fetch(`/api/boards/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Falha ao atualizar board no NeonDB');
    const data = await res.json();
    return data.board;
  },

  async deleteBoard(id: string): Promise<void> {
    const res = await fetch(`/api/boards/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Falha ao deletar board no NeonDB');
  },

  // Members
  async createMember(member: Member): Promise<Member> {
    const res = await fetch('/api/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(member),
    });
    if (!res.ok) throw new Error('Falha ao cadastrar membro no NeonDB');
    const data = await res.json();
    return data.member || member;
  },

  async updateMember(id: string, updates: Partial<Member>): Promise<Member> {
    const res = await fetch(`/api/members/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activity),
    });
  },

  // Integrations
  async updateIntegration(platform: IntegrationPlatform, updates: Partial<IntegrationConfig>): Promise<IntegrationConfig> {
    const res = await fetch(`/api/integrations/${encodeURIComponent(platform)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Falha ao atualizar integração no NeonDB');
    const data = await res.json();
    return data.integration;
  },

  async createWebhookLog(log: WebhookLog): Promise<void> {
    await fetch('/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(log),
    });
  },

  // Email
  async updateEmailSettings(settings: Partial<EmailSettings>): Promise<void> {
    await fetch('/api/email/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
  },

  async createEmailNotification(notification: EmailNotification): Promise<void> {
    await fetch('/api/email/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(notification),
    });
  },

  async markEmailAsRead(id: string): Promise<void> {
    await fetch(`/api/email/notifications/${encodeURIComponent(id)}/read`, {
      method: 'PUT',
    });
  },

  async markAllEmailsAsRead(): Promise<void> {
    await fetch('/api/email/notifications/read-all', {
      method: 'PUT',
    });
  },

  async clearEmailHistory(): Promise<void> {
    await fetch('/api/email/notifications', {
      method: 'DELETE',
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
            headers: { 'Content-Type': 'application/json' },
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
};
