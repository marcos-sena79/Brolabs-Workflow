import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { pool, query } from './src/server/db';
import { initializeDatabase, seedDatabase } from './src/server/initDb';
import {
  authenticateToken,
  generateToken,
  hashPassword,
  comparePassword,
  findMemberByEmail,
  findMemberById,
  updateLastLogin,
} from './src/server/auth';
import {
  validateBody,
  loginSchema,
  registerSchema,
  resetDatabaseSchema,
  appSettingSchema,
  memberCreateSchema,
  memberUpdateSchema,
  boardCreateSchema,
  boardUpdateSchema,
  taskCreateSchema,
  taskUpdateSchema,
  emailSettingsSchema,
  columnCreateSchema,
  columnUpdateSchema,
  columnReorderSchema,
  attachmentUploadSchema,
  attachmentConfirmSchema,
  boardMemberInviteSchema,
  boardMemberPatchSchema,
  emailTestSchema,
  memberPreferencesSchema,
} from './src/server/validation';
import {
  resolvePermissions,
  requireBoardPermission,
  requireBoardAccess,
  requireAdmin,
  type EffectivePermissions,
} from './src/server/permissions';
import {
  getStorage,
  storageBucket,
  extensionOf,
  isAllowedExtension,
  statObject,
  removeObject,
  listObjects,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MAX_PER_TASK,
  SIGNED_UPLOAD_TTL_SEC,
  SIGNED_GET_TTL_SEC,
} from './src/server/storage';
import {
  smtpConfigured,
  smtpHost,
  sendEmail,
  processOutbox,
  nextAttemptDate,
} from './src/server/email/sender';
import { renderTestEmail } from './src/server/email/templates';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';
const isVercel = Boolean(process.env.VERCEL);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Storage Bucket for member avatars and assets (served by Vite from /public)
const bucketDir = path.resolve(process.cwd(), 'public', 'bucket');
const avatarsDir = path.resolve(bucketDir, 'avatars');
if (!isVercel && !fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
app.use('/bucket', express.static(bucketDir));

// Serverless: initialize the database once per cold start
let dbReady: Promise<void> | null = null;
if (isVercel) {
  app.use('/api', async (req, res, next) => {
    try {
      dbReady ??= initializeDatabase().catch((err) => {
        dbReady = null;
        throw err;
      });
      await dbReady;
      next();
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}

// CORS: restringe a APP_URL em produção; em dev mantém aberto (Vite serve same-origin)
const allowedOrigin = process.env.APP_URL || (isProduction ? null : '*');
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigin === '*' || (origin && origin === allowedOrigin)) {
    res.header('Access-Control-Allow-Origin', allowedOrigin === '*' ? '*' : origin);
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Security headers básicos (sem dependência externa)
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'SAMEORIGIN');
  res.header('Referrer-Policy', 'same-origin');
  next();
});

// Helper functions for safe JSON parsing and entity mapping
function safeJson(val: any, fallback: any = []) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function safeJsonOrRaw(val: any, fallback: any = '') {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  if (typeof val === 'string') {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

function mapDbBoard(row: any) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description || '',
    sprintName: row.sprint_name || '',
    sprintGoal: row.sprint_goal || '',
    sprintStartDate: row.sprint_start_date || '',
    sprintEndDate: row.sprint_end_date || '',
    columns: safeJson(row.columns, []),
    epics: safeJson(row.epics, []),
    version: parseInt(row.version, 10) || 1,
  };
}

function mapDbMember(row: any) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar || '',
    role: row.role || '',
    department: row.department || '',
    weeklyCapacityHours: parseFloat(row.weekly_capacity_hours) || 40,
    active: Boolean(row.active),
  };
}

function mapDbTask(row: any) {
  return {
    id: row.id,
    key: row.key,
    boardId: row.board_id,
    title: row.title,
    description: row.description || '',
    issueType: row.issue_type,
    priority: row.priority,
    statusId: row.status_id,
    assigneeId: row.assignee_id || '',
    reporterId: row.reporter_id || '',
    epicId: row.epic_id || undefined,
    estimatedHours: parseFloat(row.estimated_hours) || 0,
    loggedHours: parseFloat(row.logged_hours) || 0,
    storyPoints: parseInt(row.story_points, 10) || 0,
    dueDate: row.due_date || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    subtasks: safeJson(row.subtasks, []),
    worklogs: safeJson(row.worklogs, []),
    comments: safeJson(row.comments, []),
    tags: safeJson(row.tags, []),
    dependencies: safeJson(row.dependencies, []),
    archivedAt: row.archived_at || null,
    archivedBy: row.archived_by || null,
  };
}

function mapDbActivity(row: any) {
  return {
    id: row.id,
    type: row.type,
    taskId: row.task_id || '',
    taskKey: row.task_key || '',
    taskTitle: row.task_title || '',
    memberId: row.member_id || '',
    memberName: row.member_name || '',
    details: row.details || '',
    timestamp: row.timestamp,
  };
}

function mapDbIntegration(row: any) {
  return {
    id: row.id,
    name: row.name,
    enabled: Boolean(row.enabled),
    webhookUrl: row.webhook_url || '',
    channelName: row.channel_name || '',
    notifyOnTaskComplete: Boolean(row.notify_on_task_complete),
    notifyOnWorklog: Boolean(row.notify_on_worklog),
    notifyOnTaskBlocked: Boolean(row.notify_on_task_blocked),
    notifyOnSprintStart: Boolean(row.notify_on_sprint_start),
    lastTestedAt: row.last_tested_at || undefined,
    lastTestStatus: row.last_test_status || undefined,
  };
}

function mapDbWebhookLog(row: any) {
  return {
    id: row.id,
    platform: row.platform,
    eventType: row.event_type,
    payloadSummary: row.payload_summary,
    status: row.status,
    timestamp: row.timestamp,
  };
}

function mapDbEmailNotification(row: any) {
  return {
    id: row.id,
    triggerType: row.trigger_type,
    taskId: row.task_id || '',
    taskKey: row.task_key || '',
    taskTitle: row.task_title || '',
    recipientEmail: row.recipient_email || '',
    recipientName: row.recipient_name || '',
    senderName: row.sender_name || '',
    subject: row.subject || '',
    contentPreview: row.content_preview || '',
    htmlBody: row.html_body || '',
    status: row.status || 'sent',
    timestamp: row.timestamp,
    read: Boolean(row.read),
  };
}

// ---------------------- API ROUTES ---------------------- //

// Health & Database status check
app.get('/api/health', async (req, res) => {
  try {
    const timeRes = await query('SELECT NOW() as current_time, current_database() as db_name, version()');
    const tablesRes = await query("SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema='public'");
    const tasksCount = await query('SELECT COUNT(*) as count FROM tasks');
    const boardsCount = await query('SELECT COUNT(*) as count FROM boards');

    res.json({
      status: 'ok',
      database: 'connected',
      provider: 'NeonDB PostgreSQL (AWS sa-east-1)',
      serverTime: timeRes.rows[0].current_time,
      databaseName: timeRes.rows[0].db_name,
      pgVersion: timeRes.rows[0].version,
      publicTables: parseInt(tablesRes.rows[0].count, 10),
      totalTasks: parseInt(tasksCount.rows[0].count, 10),
      totalBoards: parseInt(boardsCount.rows[0].count, 10),
    });
  } catch (error: any) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      error: error.message,
    });
  }
});

// Full initial state for fast bootstrap
app.get('/api/initial-state', authenticateToken, async (req, res) => {
  try {
    const memberRes = await query('SELECT system_role, email, preferences FROM members WHERE id = $1', [req.memberId]);
    const isAdmin = memberRes.rows[0]?.system_role === 'admin';
    const myEmail = memberRes.rows[0]?.email || '';
    const myPreferences = safeJsonOrRaw(memberRes.rows[0]?.preferences, {});

    let boardsQuery;
    let tasksQuery;
    if (isAdmin) {
      boardsQuery = query('SELECT * FROM boards ORDER BY created_at ASC');
      tasksQuery = query('SELECT * FROM tasks WHERE archived_at IS NULL ORDER BY created_at DESC');
    } else {
      boardsQuery = query(
        `SELECT b.* FROM boards b
         INNER JOIN board_members bm ON bm.board_id = b.id AND bm.member_id = $1
         ORDER BY b.created_at ASC`,
        [req.memberId]
      );
      tasksQuery = query(
        `SELECT t.* FROM tasks t
         INNER JOIN board_members bm ON bm.board_id = t.board_id AND bm.member_id = $1
         WHERE t.archived_at IS NULL
         ORDER BY t.created_at DESC`,
        [req.memberId]
      );
    }

    const [boardsRes, membersRes, tasksRes, activitiesRes, integrationsRes, webhooksRes, emailSettingsRes, emailNotificationsRes, appSettingsRes] =
      await Promise.all([
        boardsQuery,
        query('SELECT * FROM members ORDER BY name ASC'),
        tasksQuery,
        query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100'),
        query('SELECT * FROM integrations ORDER BY id ASC'),
        query('SELECT * FROM webhook_logs ORDER BY timestamp DESC LIMIT 50'),
        query('SELECT * FROM email_settings LIMIT 1'),
        query(
          `SELECT * FROM email_notifications
           WHERE member_id = $1 OR LOWER(recipient_email) = LOWER($2)
           ORDER BY timestamp DESC LIMIT 50`,
          [req.memberId, myEmail]
        ),
        query('SELECT * FROM app_settings'),
      ]);

    const boards = boardsRes.rows.map(mapDbBoard);
    const members = membersRes.rows.map(mapDbMember);
    const tasks = tasksRes.rows.map(mapDbTask);
    const activityLogs = activitiesRes.rows.map(mapDbActivity);
    const integrations = integrationsRes.rows.map(mapDbIntegration);
    const webhookLogs = webhooksRes.rows.map(mapDbWebhookLog);
    const emailNotifications = emailNotificationsRes.rows.map(mapDbEmailNotification);

    const myPermissions: Record<string, EffectivePermissions> = {};
    for (const board of boards) {
      const eff = await resolvePermissions(req.memberId!, board.id);
      if (eff) myPermissions[board.id] = eff;
    }

    let emailSettings = {
      enabled: true,
      senderEmail: 'flowpulse-agile@techcorp.com.br',
      senderName: 'FlowPulse Notification Hub',
      notifyOnStatusChange: true,
      notifyOnMentions: true,
      notifyReporterOnDone: true,
    };
    if (emailSettingsRes.rows.length > 0) {
      const row = emailSettingsRes.rows[0];
      emailSettings = {
        enabled: Boolean(row.enabled),
        senderEmail: row.sender_email,
        senderName: row.sender_name,
        notifyOnStatusChange: Boolean(row.notify_on_status_change),
        notifyOnMentions: Boolean(row.notify_on_mentions),
        notifyReporterOnDone: Boolean(row.notify_reporter_on_done),
      };
    }

    const appSettingsMap: Record<string, any> = {};
    for (const row of appSettingsRes.rows) {
      appSettingsMap[row.key] = safeJsonOrRaw(row.value);
    }

    const storedBoardId = appSettingsMap['current_board_id'];
    const currentBoardId =
      storedBoardId && myPermissions[storedBoardId]
        ? storedBoardId
        : boards[0]
          ? boards[0].id
          : '';
    const currentUserId = req.memberId || '';

    res.json({
      boards,
      members,
      tasks,
      activityLogs,
      integrations,
      webhookLogs,
      emailSettings,
      emailNotifications,
      currentBoardId,
      currentUserId,
      myPermissions,
      preferences: myPreferences,
    });
  } catch (error: any) {
    console.error('Error fetching initial state:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset / Seed database (destructivo: exige auth + admin + confirmação explícita)
app.post(
  '/api/reset-database',
  authenticateToken,
  requireAdmin(),
  validateBody(resetDatabaseSchema),
  async (req, res) => {
    try {
      if (isProduction) {
        return res.status(403).json({ error: 'Reset do banco desabilitado em produção' });
      }
      await seedDatabase();
      res.json({ success: true, message: 'Database reset and re-seeded successfully in NeonDB' });
    } catch (error: any) {
      console.error('Reset database failed:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

// App Settings update
app.put('/api/app-settings/:key', authenticateToken, validateBody(appSettingSchema), async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    await query(
      `INSERT INTO app_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      [key, JSON.stringify(value)]
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- AUTH ENDPOINTS --- //

app.post('/api/auth/register', validateBody(registerSchema), async (req, res) => {
  try {
    const { name, email, password, role, department, weeklyCapacityHours } =
      req.body;

    const existing = await findMemberByEmail(email);
    if (existing) {
      return res.status(409).json({ error: 'E-mail já cadastrado' });
    }

    const passwordHash = await hashPassword(password);
    const id = `mem-${Date.now()}`;

    await query(
      `INSERT INTO members (id, name, email, avatar, role, department, weekly_capacity_hours, active, password_hash)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        name,
        email,
        '',
        role || '',
        department || '',
        weeklyCapacityHours || 40,
        true,
        passwordHash,
      ]
    );

    const memberRow = await findMemberById(id);
    const member = mapDbMember(memberRow);

    const token = generateToken(id);
    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(201).json({ success: true, token, member });
  } catch (error: any) {
    console.error('Error registering member:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', validateBody(loginSchema), async (req, res) => {
  try {
    const { email, password } = req.body;

    const memberRow = await findMemberByEmail(email);
    if (!memberRow) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    const passwordValid = await comparePassword(password, memberRow.password_hash || '');
    if (!passwordValid) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos' });
    }

    await updateLastLogin(memberRow.id);

    const token = generateToken(memberRow.id);
    const member = mapDbMember(memberRow);

    res.cookie('token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ success: true, token, member });
  } catch (error: any) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/logout', async (req, res) => {
  try {
    res.clearCookie('token');
    res.json({ success: true, message: 'Desconectado com sucesso' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const memberId = req.memberId;
    if (!memberId) {
      return res.status(401).json({ error: 'Não autenticado' });
    }
    const memberRow = await findMemberById(memberId);
    if (!memberRow) {
      return res.status(404).json({ error: 'Membro não encontrado' });
    }
    res.json({ success: true, member: mapDbMember(memberRow) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- TASKS ENDPOINTS --- //

app.post('/api/tasks', authenticateToken, requireBoardPermission('canCreateTask'), validateBody(taskCreateSchema), async (req, res) => {
  try {
    const t = req.body;
    await query(
      `INSERT INTO tasks (
        id, key, board_id, title, description, issue_type, priority, status_id,
        assignee_id, reporter_id, epic_id, estimated_hours, logged_hours, story_points,
        due_date, created_at, updated_at, subtasks, worklogs, comments, tags, dependencies
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22
      )`,
      [
        t.id,
        t.key,
        t.boardId,
        t.title,
        t.description || '',
        t.issueType,
        t.priority,
        t.statusId,
        t.assigneeId || '',
        t.reporterId || '',
        t.epicId || null,
        t.estimatedHours || 0,
        t.loggedHours || 0,
        t.storyPoints || 0,
        t.dueDate || '',
        t.createdAt || new Date().toISOString(),
        t.updatedAt || new Date().toISOString(),
        JSON.stringify(t.subtasks || []),
        JSON.stringify(t.worklogs || []),
        JSON.stringify(t.comments || []),
        JSON.stringify(t.tags || []),
        JSON.stringify(t.dependencies || []),
      ]
    );

    res.status(201).json({ success: true, task: t });
  } catch (error: any) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/tasks/:id', authenticateToken, validateBody(taskUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Fetch existing
    const existingRes = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const current = mapDbTask(existingRes.rows[0]);

    // Permissões efetivas no board da task (item 5.1)
    const eff = await resolvePermissions(req.memberId!, current.boardId);
    if (!eff) {
      return res.status(403).json({ error: 'Sem acesso a este quadro' });
    }
    req.boardPermissions = eff;
    if (!eff.canEditTask) {
      return res.status(403).json({ error: 'Sem permissão para esta ação', required: 'canEditTask' });
    }
    if (updates.statusId && updates.statusId !== current.statusId && !eff.canChangeStatus) {
      return res.status(403).json({ error: 'Sem permissão para esta ação', required: 'canChangeStatus' });
    }
    if ('worklogs' in updates && !eff.canLogWork) {
      return res.status(403).json({ error: 'Sem permissão para esta ação', required: 'canLogWork' });
    }
    if ('comments' in updates && !eff.canAddComment) {
      return res.status(403).json({ error: 'Sem permissão para esta ação', required: 'canAddComment' });
    }

    const merged = { ...current, ...updates, updatedAt: new Date().toISOString() };

    await query(
      `UPDATE tasks SET
        key = $1, board_id = $2, title = $3, description = $4, issue_type = $5,
        priority = $6, status_id = $7, assignee_id = $8, reporter_id = $9, epic_id = $10,
        estimated_hours = $11, logged_hours = $12, story_points = $13, due_date = $14,
        updated_at = $15, subtasks = $16, worklogs = $17, comments = $18, tags = $19,
        dependencies = $20
      WHERE id = $21`,
      [
        merged.key,
        merged.boardId,
        merged.title,
        merged.description,
        merged.issueType,
        merged.priority,
        merged.statusId,
        merged.assigneeId,
        merged.reporterId,
        merged.epicId || null,
        merged.estimatedHours,
        merged.loggedHours,
        merged.storyPoints,
        merged.dueDate,
        merged.updatedAt,
        JSON.stringify(merged.subtasks || []),
        JSON.stringify(merged.worklogs || []),
        JSON.stringify(merged.comments || []),
        JSON.stringify(merged.tags || []),
        JSON.stringify(merged.dependencies || []),
        id,
      ]
    );

    res.json({ success: true, task: merged });
  } catch (error: any) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const existingRes = await query('SELECT board_id FROM tasks WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const eff = await resolvePermissions(req.memberId!, existingRes.rows[0].board_id);
    if (!eff) {
      return res.status(403).json({ error: 'Sem acesso a este quadro' });
    }
    if (!eff.canDeleteTask) {
      return res.status(403).json({ error: 'Sem permissão para esta ação', required: 'canDeleteTask' });
    }
    await query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting task:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- TASK ARCHIVE (item 1.5) --- //

app.post('/api/tasks/:id/archive', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const force = Boolean(req.body?.force);

    const taskRes = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const task = mapDbTask(taskRes.rows[0]);
    if (task.archivedAt) {
      return res.json({ success: true, task });
    }

    const archiveEff = await resolvePermissions(req.memberId!, task.boardId);
    if (!archiveEff) {
      return res.status(403).json({ error: 'Sem acesso a este quadro' });
    }
    if (!archiveEff.canEditTask) {
      return res.status(403).json({ error: 'Sem permissão para esta ação', required: 'canEditTask' });
    }

    const boardRes = await query('SELECT * FROM boards WHERE id = $1', [task.boardId]);
    const board = boardRes.rows.length > 0 ? mapDbBoard(boardRes.rows[0]) : null;
    const doneColId = board?.columns?.find((c: any) => c.isDone)?.id ?? 'col-done';

    const boardTasksRes = await query(
      'SELECT * FROM tasks WHERE board_id = $1 AND archived_at IS NULL',
      [task.boardId]
    );
    const blockingTaskIds = boardTasksRes.rows
      .map((r: any) => mapDbTask(r))
      .filter(
        (t: any) =>
          t.id !== task.id &&
          t.statusId !== doneColId &&
          (t.dependencies || []).some(
            (d: any) => d.type === 'is_blocked_by' && d.targetTaskId === task.id
          )
      )
      .map((t: any) => t.id);

    if (blockingTaskIds.length > 0 && !force) {
      return res.status(409).json({
        error: 'Esta tarefa bloqueia outras tarefas ativas. Use force para arquivar removendo os bloqueios.',
        blockingTaskIds,
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (force && blockingTaskIds.length > 0) {
        for (const blockerTaskId of blockingTaskIds) {
          const row = boardTasksRes.rows.find((r: any) => r.id === blockerTaskId);
          const deps = safeJson(row?.dependencies, []).filter(
            (d: any) => !(d.type === 'is_blocked_by' && d.targetTaskId === task.id)
          );
          await client.query('UPDATE tasks SET dependencies = $1 WHERE id = $2', [
            JSON.stringify(deps),
            blockerTaskId,
          ]);
        }
        const taskDeps = safeJson(taskRes.rows[0].dependencies, []).filter(
          (d: any) =>
            !(
              d.type === 'blocks' &&
              blockingTaskIds.some((bid: string) => bid === d.targetTaskId)
            )
        );
        await client.query(
          'UPDATE tasks SET archived_at = NOW(), archived_by = $1, dependencies = $2, updated_at = NOW() WHERE id = $3',
          [req.memberId, JSON.stringify(taskDeps), id]
        );
      } else {
        await client.query(
          'UPDATE tasks SET archived_at = NOW(), archived_by = $1, updated_at = NOW() WHERE id = $2',
          [req.memberId, id]
        );
      }
      await client.query('COMMIT');
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const updated = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    res.json({ success: true, task: mapDbTask(updated.rows[0]) });
  } catch (error: any) {
    console.error('Error archiving task:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tasks/:id/unarchive', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const taskRes = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    if (taskRes.rows.length === 0) {
      return res.status(404).json({ error: 'Task not found' });
    }
    const task = mapDbTask(taskRes.rows[0]);
    if (!task.archivedAt) {
      return res.json({ success: true, task });
    }

    const unarchiveEff = await resolvePermissions(req.memberId!, task.boardId);
    if (!unarchiveEff) {
      return res.status(403).json({ error: 'Sem acesso a este quadro' });
    }
    if (!unarchiveEff.canEditTask) {
      return res.status(403).json({ error: 'Sem permissão para esta ação', required: 'canEditTask' });
    }

    const boardRes = await query('SELECT * FROM boards WHERE id = $1', [task.boardId]);
    const board = boardRes.rows.length > 0 ? mapDbBoard(boardRes.rows[0]) : null;
    const columnExists = board?.columns?.some((c: any) => c.id === task.statusId);
    const newStatusId = columnExists ? task.statusId : board?.columns?.[0]?.id ?? task.statusId;

    await query(
      'UPDATE tasks SET archived_at = NULL, archived_by = NULL, status_id = $1, updated_at = NOW() WHERE id = $2',
      [newStatusId, id]
    );
    const updated = await query('SELECT * FROM tasks WHERE id = $1', [id]);
    res.json({ success: true, task: mapDbTask(updated.rows[0]) });
  } catch (error: any) {
    console.error('Error unarchiving task:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/boards/:id/tasks', authenticateToken, requireBoardAccess(), async (req, res) => {
  try {
    const { id } = req.params;
    const archivedOnly = req.query.archived === 'true';
    const condition = archivedOnly ? 'archived_at IS NOT NULL' : 'archived_at IS NULL';
    const tasksRes = await query(
      `SELECT * FROM tasks WHERE board_id = $1 AND ${condition} ORDER BY created_at DESC`,
      [id]
    );
    res.json({ tasks: tasksRes.rows.map(mapDbTask) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- BOARDS ENDPOINTS --- //

app.post('/api/boards', authenticateToken, validateBody(boardCreateSchema), async (req, res) => {
  try {
    const b = req.body;
    await query(
      `INSERT INTO boards (id, key, name, description, sprint_name, sprint_goal, sprint_start_date, sprint_end_date, columns, epics)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        b.id,
        b.key,
        b.name,
        b.description || '',
        b.sprintName || '',
        b.sprintGoal || '',
        b.sprintStartDate || '',
        b.sprintEndDate || '',
        JSON.stringify(b.columns || []),
        JSON.stringify(b.epics || []),
      ]
    );
    // Criador vira owner do board (item 5.1)
    await query(
      `INSERT INTO board_members (board_id, member_id, role, permissions)
       VALUES ($1, $2, 'owner', '{}') ON CONFLICT DO NOTHING`,
      [b.id, req.memberId]
    );
    res.status(201).json({ success: true, board: b });
  } catch (error: any) {
    console.error('Error creating board:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/boards/:id', authenticateToken, requireBoardPermission('canManageBoard'), validateBody(boardUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingRes = await query('SELECT * FROM boards WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Board not found' });
    }

    const current = mapDbBoard(existingRes.rows[0]);
    const merged = { ...current, ...updates };

    await query(
      `UPDATE boards SET
        key = $1, name = $2, description = $3, sprint_name = $4, sprint_goal = $5,
        sprint_start_date = $6, sprint_end_date = $7, columns = $8, epics = $9,
        updated_at = NOW()
      WHERE id = $10`,
      [
        merged.key,
        merged.name,
        merged.description,
        merged.sprintName,
        merged.sprintGoal,
        merged.sprintStartDate,
        merged.sprintEndDate,
        JSON.stringify(merged.columns || []),
        JSON.stringify(merged.epics || []),
        id,
      ]
    );

    res.json({ success: true, board: merged });
  } catch (error: any) {
    console.error('Error updating board:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/boards/:id', authenticateToken, requireBoardPermission('canManageBoard'), async (req, res) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM tasks WHERE board_id = $1', [id]);
    await query('DELETE FROM boards WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting board:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- BOARD COLUMNS (item 1.1, lock otimista via boards.version) --- //

async function updateBoardColumnsWithLock(
  boardId: string,
  newColumns: any[],
  expectedVersion: number
): Promise<
  | { ok: true; columns: any[]; version: number }
  | { ok: false; status: number; error: string }
> {
  const res = await query(
    `UPDATE boards SET columns = $1, version = version + 1, updated_at = NOW()
     WHERE id = $2 AND version = $3
     RETURNING columns, version`,
    [JSON.stringify(newColumns), boardId, expectedVersion]
  );
  if (res.rowCount === 0) {
    const exists = await query('SELECT id FROM boards WHERE id = $1', [boardId]);
    if (exists.rows.length === 0) {
      return { ok: false, status: 404, error: 'Quadro não encontrado' };
    }
    return {
      ok: false,
      status: 409,
      error: 'Quadro foi modificado por outro usuário. Recarregue e tente novamente.',
    };
  }
  return {
    ok: true,
    columns: safeJson(res.rows[0].columns, []),
    version: parseInt(res.rows[0].version, 10),
  };
}

app.post(
  '/api/boards/:id/columns',
  authenticateToken,
  requireBoardPermission('canManageBoard'),
  validateBody(columnCreateSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, accentColor, wipLimit, isDone, version } = req.body;

      const boardRes = await query('SELECT * FROM boards WHERE id = $1', [id]);
      if (boardRes.rows.length === 0) {
        return res.status(404).json({ error: 'Quadro não encontrado' });
      }
      const board = mapDbBoard(boardRes.rows[0]);
      if (board.columns.length >= 30) {
        return res.status(422).json({ error: 'Limite de 30 colunas por quadro atingido' });
      }

      const newColumn = {
        id: `col-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title,
        order: board.columns.length > 0 ? Math.max(...board.columns.map((c: any) => c.order)) + 1 : 0,
        accentColor: accentColor || '#64748b',
        ...(wipLimit != null ? { wipLimit } : {}),
        ...(isDone ? { isDone: true } : {}),
      };
      let columns = [...board.columns, newColumn];
      if (isDone) {
        columns = columns.map((c: any) => (c.id === newColumn.id ? c : { ...c, isDone: false }));
      }

      const result = await updateBoardColumnsWithLock(id, columns, version);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      res.status(201).json({ success: true, columns: result.columns, version: result.version });
    } catch (error: any) {
      console.error('Error creating column:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.patch(
  '/api/boards/:id/columns/:columnId',
  authenticateToken,
  requireBoardPermission('canManageBoard'),
  validateBody(columnUpdateSchema),
  async (req, res) => {
    try {
      const { id, columnId } = req.params;
      const { title, accentColor, wipLimit, isDone, version } = req.body;

      const boardRes = await query('SELECT * FROM boards WHERE id = $1', [id]);
      if (boardRes.rows.length === 0) {
        return res.status(404).json({ error: 'Quadro não encontrado' });
      }
      const board = mapDbBoard(boardRes.rows[0]);
      const idx = board.columns.findIndex((c: any) => c.id === columnId);
      if (idx === -1) {
        return res.status(404).json({ error: 'Coluna não encontrada' });
      }

      let columns = board.columns.map((c: any) => {
        if (c.id !== columnId) return c;
        const updated = { ...c };
        if (title !== undefined) updated.title = title;
        if (accentColor !== undefined) updated.accentColor = accentColor;
        if (wipLimit !== undefined) {
          if (wipLimit === null) delete updated.wipLimit;
          else updated.wipLimit = wipLimit;
        }
        if (isDone === true) updated.isDone = true;
        if (isDone === false) delete updated.isDone;
        return updated;
      });
      if (isDone === true) {
        columns = columns.map((c: any) => {
          if (c.id === columnId) return { ...c, isDone: true };
          const { isDone: _ignored, ...rest } = c;
          return rest;
        });
      }

      const result = await updateBoardColumnsWithLock(id, columns, version);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json({ success: true, columns: result.columns, version: result.version });
    } catch (error: any) {
      console.error('Error updating column:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.put(
  '/api/boards/:id/columns/reorder',
  authenticateToken,
  requireBoardPermission('canManageBoard'),
  validateBody(columnReorderSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { order, version } = req.body;

      const boardRes = await query('SELECT * FROM boards WHERE id = $1', [id]);
      if (boardRes.rows.length === 0) {
        return res.status(404).json({ error: 'Quadro não encontrado' });
      }
      const board = mapDbBoard(boardRes.rows[0]);
      const currentIds = board.columns.map((c: any) => c.id).sort();
      const newIds = [...order].sort();
      if (
        currentIds.length !== newIds.length ||
        currentIds.some((cid: string, i: number) => cid !== newIds[i])
      ) {
        return res.status(422).json({ error: 'A lista de ordenação não corresponde às colunas do quadro' });
      }

      const columns = order.map((colId: string, i: number) => {
        const col = board.columns.find((c: any) => c.id === colId);
        return { ...col, order: i };
      });

      const result = await updateBoardColumnsWithLock(id, columns, version);
      if (!result.ok) {
        return res.status(result.status).json({ error: result.error });
      }
      res.json({ success: true, columns: result.columns, version: result.version });
    } catch (error: any) {
      console.error('Error reordering columns:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.delete('/api/boards/:id/columns/:columnId', authenticateToken, requireBoardPermission('canManageBoard'), async (req, res) => {
  try {
    const { id, columnId } = req.params;
    const reassignTo = req.query.reassignTo as string | undefined;
    const version = parseInt(req.query.version as string, 10);

    if (!Number.isInteger(version) || version < 1) {
      return res.status(400).json({ error: 'Parâmetro version é obrigatório' });
    }

    const boardRes = await query('SELECT * FROM boards WHERE id = $1', [id]);
    if (boardRes.rows.length === 0) {
      return res.status(404).json({ error: 'Quadro não encontrado' });
    }
    const board = mapDbBoard(boardRes.rows[0]);
    const col = board.columns.find((c: any) => c.id === columnId);
    if (!col) {
      return res.status(404).json({ error: 'Coluna não encontrada' });
    }
    if (board.columns.length <= 1) {
      return res.status(409).json({ error: 'Não é possível remover a última coluna do quadro' });
    }

    const countRes = await query(
      'SELECT COUNT(*)::int AS count FROM tasks WHERE board_id = $1 AND status_id = $2',
      [id, columnId]
    );
    const taskCount = countRes.rows[0].count;

    if (taskCount > 0 && !reassignTo) {
      return res
        .status(409)
        .json({ error: `A coluna possui ${taskCount} tarefa(s). Informe reassignTo para movê-las.`, taskCount });
    }
    if (reassignTo) {
      const target = board.columns.find((c: any) => c.id === reassignTo);
      if (!target || reassignTo === columnId) {
        return res.status(422).json({ error: 'Coluna de destino inválida' });
      }
    }

    let columns = board.columns.filter((c: any) => c.id !== columnId);
    if (reassignTo) {
      columns = columns.map((c: any) => (c.id === reassignTo ? { ...c, order: col.order } : c));
      columns.sort((a: any, b: any) => a.order - b.order).map((c: any, i: number) => ({ ...c, order: i }));
    } else {
      columns = columns.map((c: any, i: number) => ({ ...c, order: i }));
    }
    if (col.isDone) {
      const newDoneId = reassignTo || columns[columns.length - 1]?.id;
      columns = columns.map((c: any) => (c.id === newDoneId ? { ...c, isDone: true } : c));
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (reassignTo && taskCount > 0) {
        await client.query(
          'UPDATE tasks SET status_id = $1, updated_at = NOW() WHERE board_id = $2 AND status_id = $3',
          [reassignTo, id, columnId]
        );
      }
      const upd = await client.query(
        `UPDATE boards SET columns = $1, version = version + 1, updated_at = NOW()
         WHERE id = $2 AND version = $3 RETURNING version`,
        [JSON.stringify(columns), id, version]
      );
      if (upd.rowCount === 0) {
        await client.query('ROLLBACK');
        return res
          .status(409)
          .json({ error: 'Quadro foi modificado por outro usuário. Recarregue e tente novamente.' });
      }
      await client.query('COMMIT');
      res.json({ success: true, columns, version: parseInt(upd.rows[0].version, 10) });
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Error deleting column:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- MEMBERS ENDPOINTS --- //

app.post('/api/members', authenticateToken, validateBody(memberCreateSchema), async (req, res) => {
  try {
    const m = req.body;
    await query(
      `INSERT INTO members (id, name, email, avatar, role, department, weekly_capacity_hours, active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [m.id, m.name, m.email, m.avatar || '', m.role || '', m.department || '', m.weeklyCapacityHours || 40, m.active !== false]
    );
    res.status(201).json({ success: true, member: m });
  } catch (error: any) {
    console.error('Error creating member:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/members/:id', authenticateToken, validateBody(memberUpdateSchema), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingRes = await query('SELECT * FROM members WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const current = mapDbMember(existingRes.rows[0]);
    const merged = { ...current, ...updates };

    await query(
      `UPDATE members SET
        name = $1, email = $2, avatar = $3, role = $4, department = $5,
        weekly_capacity_hours = $6, active = $7
      WHERE id = $8`,
      [merged.name, merged.email, merged.avatar, merged.role, merged.department, merged.weeklyCapacityHours, merged.active, id]
    );

    res.json({ success: true, member: merged });
  } catch (error: any) {
    console.error('Error updating member:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- BUCKET STORAGE ENDPOINTS --- //

// List available avatars in bucket
app.get('/api/bucket/avatars', (req, res) => {
  try {
    if (!fs.existsSync(avatarsDir)) {
      return res.json({ files: [] });
    }
    const files = fs.readdirSync(avatarsDir).filter((f) => /\.(png|jpe?g|svg|webp|gif)$/i.test(f));
    const list = files.map((filename) => ({
      filename,
      url: `/bucket/avatars/${filename}`,
    }));
    res.json({ files: list });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload image directly to the storage bucket
app.post('/api/bucket/upload', authenticateToken, async (req, res) => {
  try {
    const { memberId, filename, imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 é obrigatório' });
    }

    let ext = 'png';
    let base64Data = imageBase64;
    if (imageBase64.includes(';base64,')) {
      const parts = imageBase64.split(';base64,');
      const mimeMatch = parts[0].match(/:(.*?)$/);
      if (mimeMatch) {
        const mime = mimeMatch[1];
        if (mime.includes('jpeg') || mime.includes('jpg')) ext = 'jpg';
        else if (mime.includes('svg')) ext = 'svg';
        else if (mime.includes('webp')) ext = 'webp';
        else if (mime.includes('gif')) ext = 'gif';
        else ext = 'png';
      }
      base64Data = parts[1];
    }

    const cleanMemberId = (memberId || 'upload').replace(/[^a-zA-Z0-9_-]/g, '_');
    const finalFilename = `${cleanMemberId}-${Date.now()}.${ext}`;
    const buffer = Buffer.from(base64Data, 'base64');

    // Vercel's filesystem is read-only/ephemeral: persist the image as a data URL in the DB
    let publicUrl: string;
    if (isVercel) {
      const mimeType = ext === 'jpg' ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
      publicUrl = `data:${mimeType};base64,${buffer.toString('base64')}`;
    } else {
      fs.writeFileSync(path.resolve(avatarsDir, finalFilename), buffer);
      publicUrl = `/bucket/avatars/${finalFilename}`;
    }

    if (memberId) {
      await query('UPDATE members SET avatar = $1 WHERE id = $2', [publicUrl, memberId]);
    }

    res.json({
      success: true,
      url: publicUrl,
      filename: finalFilename,
      sizeBytes: buffer.length,
    });
  } catch (error: any) {
    console.error('Error uploading to bucket:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- ACTIVITY LOGS --- //

app.post('/api/activities', authenticateToken, async (req, res) => {
  try {
    const a = req.body;
    await query(
      `INSERT INTO activity_logs (id, type, task_id, task_key, task_title, member_id, member_name, details, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [a.id, a.type, a.taskId || '', a.taskKey || '', a.taskTitle || '', a.memberId || '', a.memberName || '', a.details || '', a.timestamp]
    );
    res.status(201).json({ success: true, activity: a });
  } catch (error: any) {
    console.error('Error saving activity:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- INTEGRATIONS --- //

app.put('/api/integrations/:id', authenticateToken, requireAdmin(), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingRes = await query('SELECT * FROM integrations WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const current = mapDbIntegration(existingRes.rows[0]);
    const merged = { ...current, ...updates };

    await query(
      `UPDATE integrations SET
        name = $1, enabled = $2, webhook_url = $3, channel_name = $4,
        notify_on_task_complete = $5, notify_on_worklog = $6, notify_on_task_blocked = $7,
        notify_on_sprint_start = $8, last_tested_at = $9, last_test_status = $10
      WHERE id = $11`,
      [
        merged.name,
        merged.enabled,
        merged.webhookUrl,
        merged.channelName,
        merged.notifyOnTaskComplete,
        merged.notifyOnWorklog,
        merged.notifyOnTaskBlocked,
        merged.notifyOnSprintStart,
        merged.lastTestedAt || null,
        merged.lastTestStatus || null,
        id,
      ]
    );

    res.json({ success: true, integration: merged });
  } catch (error: any) {
    console.error('Error updating integration:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/webhooks', authenticateToken, requireAdmin(), async (req, res) => {
  try {
    const w = req.body;
    await query(
      `INSERT INTO webhook_logs (id, platform, event_type, payload_summary, status, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [w.id, w.platform, w.eventType, w.payloadSummary, w.status, w.timestamp]
    );
    res.status(201).json({ success: true, webhookLog: w });
  } catch (error: any) {
    console.error('Error creating webhook log:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- EMAIL SETTINGS & NOTIFICATIONS --- //

app.put('/api/email/settings', authenticateToken, validateBody(emailSettingsSchema), async (req, res) => {
  try {
    const updates = req.body;
    await query(
      `INSERT INTO email_settings (id, enabled, sender_email, sender_name, notify_on_status_change, notify_on_mentions, notify_reporter_on_done)
       VALUES ('default', $1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO UPDATE SET
         enabled = EXCLUDED.enabled,
         sender_email = EXCLUDED.sender_email,
         sender_name = EXCLUDED.sender_name,
         notify_on_status_change = EXCLUDED.notify_on_status_change,
         notify_on_mentions = EXCLUDED.notify_on_mentions,
         notify_reporter_on_done = EXCLUDED.notify_reporter_on_done`,
      [
        Boolean(updates.enabled),
        updates.senderEmail || '',
        updates.senderName || '',
        Boolean(updates.notifyOnStatusChange),
        Boolean(updates.notifyOnMentions),
        Boolean(updates.notifyReporterOnDone),
      ]
    );
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating email settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// Resolve o member_id dono de uma notificação (para escopo por usuário).
async function resolveNotificationOwnerRow(id: string): Promise<any | null> {
  const res = await query('SELECT * FROM email_notifications WHERE id = $1', [id]);
  return res.rows.length > 0 ? res.rows[0] : null;
}

function notificationOwnedBy(row: any, memberId: string, memberEmail: string): boolean {
  if (row.member_id && row.member_id === memberId) return true;
  if (row.recipient_email && memberEmail && row.recipient_email.toLowerCase() === memberEmail.toLowerCase()) return true;
  return false;
}

app.post('/api/email/notifications', authenticateToken, async (req, res) => {
  try {
    const e = req.body;
    const meRes = await query('SELECT id, email FROM members WHERE id = $1', [req.memberId]);
    const me = meRes.rows[0] || {};

    // Deduplicação: mesmo task + trigger + destinatário dentro de 5 min → descarta
    if (e.taskId && e.triggerType && e.recipientEmail) {
      const dup = await query(
        `SELECT 1 FROM email_notifications
         WHERE task_id = $1 AND trigger_type = $2 AND LOWER(recipient_email) = LOWER($3)
           AND created_at > NOW() - INTERVAL '5 minutes'`,
        [e.taskId, e.triggerType, e.recipientEmail]
      );
      if (dup.rows.length > 0) {
        return res.status(201).json({ success: true, emailNotification: e, duplicate: true });
      }
    }

    // Ownership: se o destinatário é um membro, vincula a row a ele (escopo 3.2)
    let ownerId: string | null = null;
    if (e.recipientEmail) {
      const ownerRes = await query('SELECT id FROM members WHERE LOWER(email) = LOWER($1)', [e.recipientEmail]);
      ownerId = ownerRes.rows.length > 0 ? ownerRes.rows[0].id : null;
    }

    await query(
      `INSERT INTO email_notifications (
        id, trigger_type, task_id, task_key, task_title, recipient_email,
        recipient_name, sender_name, subject, content_preview, html_body, status, timestamp, read,
        member_id, next_attempt_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        e.id,
        e.triggerType,
        e.taskId || '',
        e.taskKey || '',
        e.taskTitle || '',
        e.recipientEmail || '',
        e.recipientName || '',
        e.senderName || '',
        e.subject || '',
        e.contentPreview || '',
        e.htmlBody || '',
        'pending',
        e.timestamp,
        Boolean(e.read),
        ownerId,
        new Date(),
      ]
    );

    // Flush lazy: envia até 5 pendentes antigas se SMTP ativo (padrão outbox — erro nunca derruba a request)
    try {
      const settingsRes = await query('SELECT enabled FROM email_settings LIMIT 1');
      if (settingsRes.rows[0]?.enabled && smtpConfigured()) {
        await processOutbox(5);
      }
    } catch (flushErr) {
      console.error('Email outbox flush failed (non-fatal):', flushErr);
    }

    res.status(201).json({ success: true, emailNotification: e });
  } catch (error: any) {
    console.error('Error creating email notification:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/email/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const meRes = await query('SELECT email, system_role FROM members WHERE id = $1', [req.memberId]);
    const me = meRes.rows[0] || {};
    const upd = await query(
      `UPDATE email_notifications SET read = TRUE
       WHERE id = $1 AND ($3 OR member_id = $2 OR LOWER(recipient_email) = LOWER($4))`,
      [id, req.memberId, me.system_role === 'admin', me.email || '']
    );
    if (upd.rowCount === 0) return res.status(404).json({ error: 'Notificação não encontrada' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/email/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    const meRes = await query('SELECT email FROM members WHERE id = $1', [req.memberId]);
    const myEmail = meRes.rows[0]?.email || '';
    const upd = await query(
      `UPDATE email_notifications SET read = TRUE
       WHERE member_id = $1 OR LOWER(recipient_email) = LOWER($2)`,
      [req.memberId, myEmail]
    );
    res.json({ success: true, updated: upd.rowCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Limpar tudo (escopado ao usuário logado — item 3.2)
app.delete('/api/email/notifications', authenticateToken, async (req, res) => {
  try {
    const meRes = await query('SELECT email FROM members WHERE id = $1', [req.memberId]);
    const myEmail = meRes.rows[0]?.email || '';
    const del = await query(
      `DELETE FROM email_notifications
       WHERE member_id = $1 OR LOWER(recipient_email) = LOWER($2)`,
      [req.memberId, myEmail]
    );
    res.json({ success: true, deleted: del.rowCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Remover item individual (item 3.2) — dono ou admin
app.delete('/api/email/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const row = await resolveNotificationOwnerRow(id);
    const meRes = await query('SELECT email, system_role FROM members WHERE id = $1', [req.memberId]);
    const me = meRes.rows[0] || {};
    const isAdmin = me.system_role === 'admin';
    if (!row || (!isAdmin && !notificationOwnedBy(row, req.memberId!, me.email || ''))) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }
    await query('DELETE FROM email_notifications WHERE id = $1', [id]);
    res.json({ success: true, deleted: 1 });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- E-mail real (item 3.1) ---

app.get('/api/email/status', authenticateToken, async (req, res) => {
  try {
    res.json({
      configured: smtpConfigured(),
      provider: 'smtp',
      host: smtpConfigured() ? smtpHost() : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/email/test', authenticateToken, requireAdmin(), validateBody(emailTestSchema), async (req, res) => {
  try {
    const { to } = req.body;
    const settingsRes = await query('SELECT * FROM email_settings LIMIT 1');
    const settings = settingsRes.rows[0];
    const messageId = await sendEmail({
      to,
      subject: 'Teste de e-mail — Brolabs Workflow',
      html: renderTestEmail(to),
      fromEmail: settings?.sender_email || undefined,
      fromName: settings?.sender_name || undefined,
    });
    res.json({ success: true, messageId });
  } catch (error: any) {
    console.error('Test email failed:', error);
    res.status(502).json({ error: error.message });
  }
});

app.post('/api/email/notifications/:id/retry', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const force = req.query.force === 'true';
    const row = await resolveNotificationOwnerRow(id);
    const meRes = await query('SELECT email, system_role FROM members WHERE id = $1', [req.memberId]);
    const me = meRes.rows[0] || {};
    const isAdmin = me.system_role === 'admin';
    if (!row || (!isAdmin && !notificationOwnedBy(row, req.memberId!, me.email || ''))) {
      return res.status(404).json({ error: 'Notificação não encontrada' });
    }
    if (row.status === 'sent' && !force) {
      return res.status(409).json({ error: 'Notificação já enviada. Use ?force=true para reenviar.' });
    }
    await query(
      `UPDATE email_notifications SET status = 'pending', next_attempt_at = NOW() WHERE id = $1`,
      [id]
    );
    // tenta enviar imediatamente (best-effort)
    try {
      const settingsRes = await query('SELECT enabled FROM email_settings LIMIT 1');
      if (settingsRes.rows[0]?.enabled && smtpConfigured()) {
        await processOutbox(1);
      }
    } catch (flushErr) {
      console.error('Email retry flush failed (non-fatal):', flushErr);
    }
    res.status(202).json({ success: true, status: 'pending' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cron: consome o outbox de e-mails (Bearer $CRON_SECRET)
app.get('/api/cron/process-emails', async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
    if (!secret) return res.status(503).json({ error: 'CRON_SECRET não configurado' });
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Token inválido' });
    }
    const result = await processOutbox(50);
    res.json({ success: true, ...result });
  } catch (error: any) {
    console.error('Process emails cron failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// --- Preferências do membro (itens 3.3 / 5.4) ---

app.get('/api/members/me/preferences', authenticateToken, async (req, res) => {
  try {
    const r = await query('SELECT preferences FROM members WHERE id = $1', [req.memberId]);
    if (r.rows.length === 0) return res.status(404).json({ error: 'Membro não encontrado' });
    res.json({ preferences: safeJsonOrRaw(r.rows[0].preferences, {}) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/members/me/preferences', authenticateToken, validateBody(memberPreferencesSchema), async (req, res) => {
  try {
    const currentRes = await query('SELECT preferences FROM members WHERE id = $1', [req.memberId]);
    if (currentRes.rows.length === 0) return res.status(404).json({ error: 'Membro não encontrado' });
    const current = safeJsonOrRaw(currentRes.rows[0].preferences, {});
    const merged = { ...current, ...req.body };
    await query('UPDATE members SET preferences = $1 WHERE id = $2', [
      JSON.stringify(merged),
      req.memberId,
    ]);
    res.json({ preferences: merged });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ---------------------- TASK ATTACHMENTS (item 2.1) ---------------------- //

function mapDbAttachment(row: any) {
  return {
    id: row.id,
    taskId: row.task_id,
    boardId: row.board_id,
    uploaderId: row.uploader_id || '',
    originalName: row.original_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    createdAt: row.created_at,
  };
}

async function findTaskRowForAttachment(taskId: string): Promise<any | null> {
  const r = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  return r.rows.length > 0 ? r.rows[0] : null;
}

function attachmentPath(boardId: string, taskId: string, attachmentId: string, filename: string): string {
  return `${boardId}/${taskId}/${attachmentId}.${extensionOf(filename)}`;
}

app.post(
  '/api/tasks/:id/attachments/upload-url',
  authenticateToken,
  validateBody(attachmentUploadSchema),
  async (req, res) => {
    try {
      const taskRow = await findTaskRowForAttachment(req.params.id);
      if (!taskRow) return res.status(404).json({ error: 'Task not found' });

      const eff = await resolvePermissions(req.memberId!, taskRow.board_id);
      if (!eff) return res.status(403).json({ error: 'Sem acesso a este quadro' });
      if (!eff.canEditTask) {
        return res.status(403).json({ error: 'Sem permissão para esta ação', required: 'canEditTask' });
      }

      const { filename, mimeType, sizeBytes } = req.body;
      if (sizeBytes > ATTACHMENT_MAX_BYTES) {
        return res.status(413).json({ error: 'Arquivo excede o limite de 10 MB' });
      }
      if (!isAllowedExtension(filename)) {
        return res.status(415).json({
          error: 'Tipo de arquivo não permitido. Use: png, jpg, jpeg, gif, webp, pdf, csv, txt, zip, md, doc, docx, xls ou xlsx',
        });
      }
      if (mimeType === 'image/svg+xml') {
        return res.status(415).json({ error: 'SVG não é permitido (risco de XSS)' });
      }

      const countRes = await query(
        'SELECT COUNT(*)::int AS n FROM task_attachments WHERE task_id = $1',
        [req.params.id]
      );
      if (countRes.rows[0].n >= ATTACHMENT_MAX_PER_TASK) {
        return res.status(409).json({ error: `Limite de ${ATTACHMENT_MAX_PER_TASK} anexos por tarefa` });
      }

      const supabase = getStorage();
      if (!supabase) {
        return res.status(503).json({
          error: 'Storage não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.',
        });
      }

      const attachmentId = `att-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
      const storagePath = attachmentPath(taskRow.board_id, req.params.id, attachmentId, filename);

      const { data, error } = await supabase.storage
        .from(storageBucket())
        .createSignedUploadUrl(storagePath);
      if (error || !data) {
        return res.status(500).json({ error: error?.message || 'Falha ao gerar URL de upload' });
      }

      res.status(201).json({
        attachmentId,
        uploadUrl: data.signedUrl,
        token: data.token,
      });
    } catch (error: any) {
      console.error('Error creating upload url:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.post(
  '/api/tasks/:id/attachments/confirm',
  authenticateToken,
  validateBody(attachmentConfirmSchema),
  async (req, res) => {
    try {
      const taskRow = await findTaskRowForAttachment(req.params.id);
      if (!taskRow) return res.status(404).json({ error: 'Task not found' });

      const eff = await resolvePermissions(req.memberId!, taskRow.board_id);
      if (!eff) return res.status(403).json({ error: 'Sem acesso a este quadro' });
      if (!eff.canEditTask) {
        return res.status(403).json({ error: 'Sem permissão para esta ação', required: 'canEditTask' });
      }

      const { attachmentId, filename, mimeType, sizeBytes } = req.body;
      if (sizeBytes > ATTACHMENT_MAX_BYTES) {
        return res.status(413).json({ error: 'Arquivo excede o limite de 10 MB' });
      }
      if (!isAllowedExtension(filename) || mimeType === 'image/svg+xml') {
        return res.status(415).json({ error: 'Tipo de arquivo não permitido' });
      }

      const supabase = getStorage();
      if (!supabase) {
        return res.status(503).json({ error: 'Storage não configurado' });
      }

      const storagePath = attachmentPath(taskRow.board_id, req.params.id, attachmentId, filename);
      const meta = await statObject(storagePath);
      if (!meta) {
        return res.status(422).json({ error: 'Arquivo não encontrado no storage' });
      }

      const insertRes = await query(
        `INSERT INTO task_attachments (id, task_id, board_id, uploader_id, original_name, storage_path, mime_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING
         RETURNING *`,
        [attachmentId, req.params.id, taskRow.board_id, req.memberId, filename, storagePath, mimeType, sizeBytes]
      );
      if (insertRes.rows.length === 0) {
        return res.status(409).json({ error: 'Anexo já confirmado' });
      }

      res.status(201).json({ success: true, attachment: mapDbAttachment(insertRes.rows[0]) });
    } catch (error: any) {
      console.error('Error confirming attachment:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.get('/api/tasks/:id/attachments', authenticateToken, async (req, res) => {
  try {
    const taskRow = await findTaskRowForAttachment(req.params.id);
    if (!taskRow) return res.status(404).json({ error: 'Task not found' });
    const eff = await resolvePermissions(req.memberId!, taskRow.board_id);
    if (!eff) return res.status(403).json({ error: 'Sem acesso a este quadro' });

    const rows = await query(
      'SELECT * FROM task_attachments WHERE task_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ attachments: rows.rows.map(mapDbAttachment) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/tasks/:id/attachments/:attId/url', authenticateToken, async (req, res) => {
  try {
    const taskRow = await findTaskRowForAttachment(req.params.id);
    if (!taskRow) return res.status(404).json({ error: 'Task not found' });
    const eff = await resolvePermissions(req.memberId!, taskRow.board_id);
    if (!eff) return res.status(403).json({ error: 'Sem acesso a este quadro' });

    const attRes = await query(
      'SELECT * FROM task_attachments WHERE id = $1 AND task_id = $2',
      [req.params.attId, req.params.id]
    );
    if (attRes.rows.length === 0) return res.status(404).json({ error: 'Anexo não encontrado' });

    const supabase = getStorage();
    if (!supabase) return res.status(503).json({ error: 'Storage não configurado' });

    const { data, error } = await supabase.storage
      .from(storageBucket())
      .createSignedUrl(attRes.rows[0].storage_path, SIGNED_GET_TTL_SEC);
    if (error || !data) {
      return res.status(500).json({ error: error?.message || 'Falha ao gerar URL de download' });
    }
    res.json({ url: data.signedUrl, expiresIn: SIGNED_GET_TTL_SEC });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id/attachments/:attId', authenticateToken, async (req, res) => {
  try {
    const taskRow = await findTaskRowForAttachment(req.params.id);
    if (!taskRow) return res.status(404).json({ error: 'Task not found' });
    const eff = await resolvePermissions(req.memberId!, taskRow.board_id);
    if (!eff) return res.status(403).json({ error: 'Sem acesso a este quadro' });
    if (!eff.canEditTask) {
      return res.status(403).json({ error: 'Sem permissão para esta ação', required: 'canEditTask' });
    }

    const attRes = await query(
      'DELETE FROM task_attachments WHERE id = $1 AND task_id = $2 RETURNING storage_path',
      [req.params.attId, req.params.id]
    );
    if (attRes.rows.length === 0) return res.status(404).json({ error: 'Anexo não encontrado' });

    await removeObject(attRes.rows[0].storage_path);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Cron diário: remove objetos do storage com >24h sem row correspondente (upload nunca confirmado).
// Autenticação: Authorization: Bearer $CRON_SECRET
app.get('/api/cron/cleanup-attachments', async (req, res) => {
  try {
    const secret = process.env.CRON_SECRET;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : '';
    if (!secret) {
      return res.status(503).json({ error: 'CRON_SECRET não configurado' });
    }
    const a = Buffer.from(token);
    const b = Buffer.from(secret);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return res.status(401).json({ error: 'Token inválido' });
    }

    const supabase = getStorage();
    if (!supabase) return res.status(503).json({ error: 'Storage não configurado' });

    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const removed: string[] = [];
    let scanned = 0;

    const boardsRes = await query('SELECT id FROM boards');
    for (const board of boardsRes.rows) {
      const taskDirs = await listObjects(board.id);
      for (const dir of taskDirs) {
        if (dir.id !== null) continue; // só pastas (taskId)
        const files = await listObjects(`${board.id}/${dir.name}`);
        for (const file of files) {
          if (file.id === null) continue;
          const createdAt = file.created_at ? Date.parse(file.created_at) : NaN;
          if (Number.isNaN(createdAt) || createdAt > cutoff) continue;
          scanned++;
          const storagePath = `${board.id}/${dir.name}/${file.name}`;
          const rowRes = await query(
            'SELECT 1 FROM task_attachments WHERE storage_path = $1',
            [storagePath]
          );
          if (rowRes.rows.length === 0) {
            const ok = await removeObject(storagePath);
            if (ok) removed.push(storagePath);
          }
        }
      }
    }

    res.json({ success: true, scanned, removed });
  } catch (error: any) {
    console.error('Cleanup attachments failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------- BOARD MEMBERS / PERMISSÕES (item 5.1) ---------------------- //

app.get('/api/boards/:id/members', authenticateToken, requireBoardAccess(), async (req, res) => {
  try {
    const rows = await query(
      `SELECT bm.role, bm.permissions, bm.created_at AS joined_at,
              m.id, m.name, m.email, m.avatar, m.role AS job_title, m.active
       FROM board_members bm
       INNER JOIN members m ON m.id = bm.member_id
       WHERE bm.board_id = $1
       ORDER BY bm.created_at ASC, m.name ASC`,
      [req.params.id]
    );
    res.json({
      members: rows.rows.map((r: any) => ({
        memberId: r.id,
        name: r.name,
        email: r.email,
        avatar: r.avatar || '',
        jobTitle: r.job_title || '',
        active: Boolean(r.active),
        role: r.role,
        permissions: safeJsonOrRaw(r.permissions),
        joinedAt: r.joined_at,
      })),
      myRole: req.boardPermissions?.role,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  '/api/boards/:id/members',
  authenticateToken,
  requireBoardPermission('canInviteMember'),
  validateBody(boardMemberInviteSchema),
  async (req, res) => {
    try {
      const { email, role = 'editor', permissions = {} } = req.body;
      const memberRes = await query('SELECT * FROM members WHERE email = $1', [email]);
      if (memberRes.rows.length === 0) {
        return res.status(404).json({ error: 'Membro não encontrado com esse email' });
      }
      const memberId = memberRes.rows[0].id;

      const exists = await query(
        'SELECT 1 FROM board_members WHERE board_id = $1 AND member_id = $2',
        [req.params.id, memberId]
      );
      if (exists.rows.length > 0) {
        return res.status(409).json({ error: 'Este membro já participa do quadro' });
      }

      await query(
        `INSERT INTO board_members (board_id, member_id, role, permissions, invited_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [req.params.id, memberId, role, JSON.stringify(permissions), req.memberId]
      );

      res.status(201).json({
        success: true,
        member: {
          memberId,
          name: memberRes.rows[0].name,
          email: memberRes.rows[0].email,
          avatar: memberRes.rows[0].avatar || '',
          jobTitle: memberRes.rows[0].role || '',
          active: Boolean(memberRes.rows[0].active),
          role,
          permissions,
          joinedAt: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('Error inviting board member:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.patch(
  '/api/boards/:id/members/:memberId',
  authenticateToken,
  requireBoardPermission('canManageMembers'),
  validateBody(boardMemberPatchSchema),
  async (req, res) => {
    try {
      const { id: boardId, memberId } = req.params;
      const { role, permissions } = req.body;

      const currentRes = await query(
        'SELECT * FROM board_members WHERE board_id = $1 AND member_id = $2',
        [boardId, memberId]
      );
      if (currentRes.rows.length === 0) {
        return res.status(404).json({ error: 'Membro não encontrado neste quadro' });
      }

      if (role && role !== 'owner' && currentRes.rows[0].role === 'owner') {
        const ownersRes = await query(
          "SELECT COUNT(*)::int AS n FROM board_members WHERE board_id = $1 AND role = 'owner'",
          [boardId]
        );
        if (ownersRes.rows[0].n <= 1) {
          return res.status(409).json({ error: 'Não é possível rebaixar o último owner do quadro' });
        }
      }

      const updated = await query(
        `UPDATE board_members
         SET role = COALESCE($1, role),
             permissions = COALESCE($2, permissions)
         WHERE board_id = $3 AND member_id = $4
         RETURNING *`,
        [role ?? null, permissions ? JSON.stringify(permissions) : null, boardId, memberId]
      );

      res.json({
        success: true,
        member: {
          memberId,
          role: updated.rows[0].role,
          permissions: safeJsonOrRaw(updated.rows[0].permissions),
        },
      });
    } catch (error: any) {
      console.error('Error updating board member:', error);
      res.status(500).json({ error: error.message });
    }
  }
);

app.delete('/api/boards/:id/members/:memberId', authenticateToken, async (req, res) => {
  try {
    const { id: boardId, memberId } = req.params;

    const eff = await resolvePermissions(req.memberId!, boardId);
    if (!eff) return res.status(403).json({ error: 'Sem acesso a este quadro' });
    const isSelf = memberId === req.memberId;
    if (!eff.canManageMembers && !isSelf) {
      return res.status(403).json({ error: 'Sem permissão para esta ação', required: 'canManageMembers' });
    }

    const currentRes = await query(
      'SELECT * FROM board_members WHERE board_id = $1 AND member_id = $2',
      [boardId, memberId]
    );
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Membro não encontrado neste quadro' });
    }

    if (currentRes.rows[0].role === 'owner') {
      const ownersRes = await query(
        "SELECT COUNT(*)::int AS n FROM board_members WHERE board_id = $1 AND role = 'owner'",
        [boardId]
      );
      if (ownersRes.rows[0].n <= 1) {
        return res.status(409).json({ error: 'Não é possível remover o último owner do quadro' });
      }
    }

    await query('DELETE FROM board_members WHERE board_id = $1 AND member_id = $2', [
      boardId,
      memberId,
    ]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error removing board member:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------- VITE & STATIC SERVING ---------------------- //

async function startServer() {
  try {
    // 1. Connect & initialize NeonDB
    await initializeDatabase();

    // 2. Setup Vite or static serving
    if (!isProduction) {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log('⚡ Vite development middlewares mounted');
    } else {
      const distPath = path.resolve(__dirname, 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
      console.log(`📦 Serving production build from ${distPath}`);
    }

    // 3. Listen on port
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`📡 Connected to NeonDB: sa-east-1`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (!isVercel) {
  startServer();
}

export default app;
