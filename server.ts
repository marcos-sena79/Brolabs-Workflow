import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { pool, query } from './src/server/db';
import { normalizeAssigneeIds, taskAssigneeIds } from './src/utils/taskAssignees';
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
  todoCreateSchema,
  todoUpdateSchema,
  todoListQuerySchema,
  noteCreateSchema,
  noteUpdateSchema,
  noteAiSchema,
  noteFromSprintSchema,
  shareCreateSchema,
  tagCreateSchema,
  tagUpdateSchema,
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
import {
  aiProvider,
  aiConfigured,
  aiModel,
  checkAiRateLimit,
  logAiUsage,
  runAi,
  AiUnavailableError,
  AiFailedError,
} from './src/server/ai/provider';
import { logger } from './src/server/logger';
import { migrationsSummary } from './src/server/migrate';

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
  res.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// Logging estruturado (item 3.6): 1 linha JSON por requisição /api (Vercel captura stdout/stderr)
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) return next();
  const requestId = String(req.headers['x-request-id'] || crypto.randomUUID());
  const start = Date.now();
  res.header('X-Request-Id', requestId);
  res.on('finish', () => {
    const fields = {
      requestId,
      route: req.path,
      method: req.method,
      status: res.statusCode,
      durationMs: Date.now() - start,
      memberId: (req as any).memberId || null,
    };
    if (res.statusCode >= 500) logger.error('request', fields);
    else logger.info('request', fields);
  });
  next();
});

// CSRF (item 3.7): a app usa Bearer (imune); se um browser enviar Origin em métodos
// mutantes, só origens conhecidas passam. Sem Origin (curl/clients Bearer) segue.
const trustedOrigins = new Set(
  [
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
  ]
    .filter(Boolean)
    .map((o) => String(o).replace(/\/+$/, '')),
);
app.use((req, res, next) => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH' || req.method === 'DELETE') {
    const origin = req.headers.origin;
    if (origin && !trustedOrigins.has(origin.replace(/\/+$/, ''))) {
      return res.status(403).json({ error: 'Origem não permitida' });
    }
  }
  next();
});

// Rate limit em memória por IP (item 3.7): 300 req/min em /api (exceto /api/public,
// que tem bucket próprio) e 10/min em login/register. Sem dependência externa (R10).
function makeRateLimiter(max: number, windowMs: number) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (key: string): boolean => {
    const now = Date.now();
    const b = buckets.get(key);
    if (!b || b.resetAt <= now) {
      if (buckets.size > 5000) {
        for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      }
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    b.count += 1;
    return b.count <= max;
  };
}
const checkApiLimit = makeRateLimiter(300, 60_000);
const checkAuthLimit = makeRateLimiter(10, 60_000);
app.use((req, res, next) => {
  if (!req.path.startsWith('/api') || req.path.startsWith('/api/public')) return next();
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkApiLimit(`api:${ip}`)) {
    return res.status(429).json({ error: 'Muitas requisições. Tente novamente em 1 minuto.' });
  }
  const isCredential = req.path.endsWith('/login') || req.path.endsWith('/register');
  if (isCredential && !checkAuthLimit(`auth:${ip}`)) {
    return res.status(429).json({ error: 'Muitas tentativas de autenticação. Tente novamente em 1 minuto.' });
  }
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
  const assigneeIds = normalizeAssigneeIds(
    safeJson(row.assignee_ids, []),
    row.assignee_id ? [row.assignee_id] : []
  );
  return {
    id: row.id,
    key: row.key,
    boardId: row.board_id,
    title: row.title,
    description: row.description || '',
    issueType: row.issue_type,
    priority: row.priority,
    statusId: row.status_id,
    assigneeId: assigneeIds[0] || '',
    assigneeIds,
    reporterId: row.reporter_id || '',
    epicId: row.epic_id || undefined,
    parentId: row.parent_id || undefined,
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
      smtp: smtpConfigured() ? 'configured' : 'unconfigured',
      storage: getStorage() ? 'ok' : 'unconfigured',
      ai: aiConfigured() ? 'configured' : 'unconfigured',
      migrations: await migrationsSummary(),
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

// --- TAGS (item 2.2 — auto-create implícito mantém tags livres na UX atual) ---

async function ensureTagsExist(tags: any, memberId: string): Promise<void> {
  if (!Array.isArray(tags)) return;
  const seen = new Set<string>();
  for (const raw of tags) {
    const name = typeof raw === 'string' ? raw.trim() : '';
    if (!name || name.length > 60) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    await query(
      `INSERT INTO tags (id, name, color, created_by)
       VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
      [`tag-${crypto.randomUUID().slice(0, 8)}`, name, '#64748b', memberId]
    );
  }
}

// --- TASKS ENDPOINTS --- //

app.post('/api/tasks', authenticateToken, requireBoardPermission('canCreateTask'), validateBody(taskCreateSchema), async (req, res) => {
  try {
    const t = req.body;
    const assigneeIds = normalizeAssigneeIds(t.assigneeIds, t.assigneeId ? [t.assigneeId] : []);
    await query(
      `INSERT INTO tasks (
        id, key, board_id, title, description, issue_type, priority, status_id,
        assignee_id, reporter_id, epic_id, estimated_hours, logged_hours, story_points,
        due_date, created_at, updated_at, subtasks, worklogs, comments, tags, dependencies,
        assignee_ids, parent_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22,
        $23, $24
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
        assigneeIds[0] || '',
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
        JSON.stringify(assigneeIds),
        t.parentId || null,
      ]
    );

    if (Array.isArray(t.tags) && t.tags.length) {
      await ensureTagsExist(t.tags, req.memberId!).catch(() => {});
    }

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

    // Múltiplos responsáveis (Item 1): lista é fonte de verdade; assignee_id = 1º
    let assigneeIds: string[];
    if ('assigneeIds' in updates) {
      assigneeIds = normalizeAssigneeIds(updates.assigneeIds, current.assigneeIds);
    } else if ('assigneeId' in updates) {
      assigneeIds = normalizeAssigneeIds(undefined, updates.assigneeId ? [updates.assigneeId] : []);
    } else {
      assigneeIds = current.assigneeIds;
    }
    merged.assigneeIds = assigneeIds;
    merged.assigneeId = assigneeIds[0] || '';

    await query(
      `UPDATE tasks SET
        key = $1, board_id = $2, title = $3, description = $4, issue_type = $5,
        priority = $6, status_id = $7, assignee_id = $8, reporter_id = $9, epic_id = $10,
        estimated_hours = $11, logged_hours = $12, story_points = $13, due_date = $14,
        updated_at = $15, subtasks = $16, worklogs = $17, comments = $18, tags = $19,
        dependencies = $20, assignee_ids = $21, parent_id = $22
      WHERE id = $23`,
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
        JSON.stringify(assigneeIds),
        merged.parentId || null,
        id,
      ]
    );

    if (Array.isArray(updates.tags)) {
      await ensureTagsExist(updates.tags, req.memberId!).catch(() => {});
    }

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

// --- BOARD SHARE (item 1.2 — quadro público/privado) --- //

function shareUrlBase(req: any): string {
  return (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

function isShareActive(row: any): boolean {
  if (row.visibility !== 'public' || !row.share_token) return false;
  if (row.share_token_expires_at && new Date(row.share_token_expires_at) < new Date()) return false;
  return true;
}

app.get('/api/boards/:id/share', authenticateToken, requireBoardPermission('canManageBoard'), async (req, res) => {
  try {
    const { id } = req.params;
    const r = await query(
      'SELECT visibility, share_token, share_token_expires_at FROM boards WHERE id = $1',
      [id]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Quadro não encontrado' });
    const b = r.rows[0];
    const active = isShareActive(b);
    res.json({
      visibility: b.visibility === 'public' ? 'public' : 'private',
      token: active ? b.share_token : null,
      url: active ? `${shareUrlBase(req)}/q/${b.share_token}` : null,
      expiresAt: active ? b.share_token_expires_at : null,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post(
  '/api/boards/:id/share',
  authenticateToken,
  requireBoardPermission('canManageBoard'),
  validateBody(shareCreateSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const expiresInDays = req.body.expiresInDays ?? 90;
      const token = crypto.randomBytes(32).toString('hex');
      const r = await query(
        `UPDATE boards
         SET visibility = 'public', share_token = $1,
             share_token_expires_at = NOW() + make_interval(days => $2::int),
             share_token_created_by = $3, updated_at = NOW()
         WHERE id = $4
         RETURNING share_token, share_token_expires_at`,
        [token, expiresInDays, req.memberId, id]
      );
      if (r.rows.length === 0) return res.status(404).json({ error: 'Quadro não encontrado' });
      res.status(201).json({
        token: r.rows[0].share_token,
        url: `${shareUrlBase(req)}/q/${r.rows[0].share_token}`,
        expiresAt: r.rows[0].share_token_expires_at,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  }
);

app.delete('/api/boards/:id/share', authenticateToken, requireBoardPermission('canManageBoard'), async (req, res) => {
  try {
    const { id } = req.params;
    const r = await query(
      `UPDATE boards
       SET visibility = 'private', share_token = NULL,
           share_token_expires_at = NULL, share_token_created_by = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id]
    );
    if (r.rowCount === 0) return res.status(404).json({ error: 'Quadro não encontrado' });
    res.json({ visibility: 'private' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Rate limit em memória por IP (30/min) — aceito na Onda 1 (risco R10)
const publicRateBuckets = new Map<string, { count: number; resetAt: number }>();
function publicRateLimit(key: string, max = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const bucket = publicRateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    publicRateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    if (publicRateBuckets.size > 5000) {
      for (const [k, v] of publicRateBuckets) if (v.resetAt <= now) publicRateBuckets.delete(k);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

// View pública somente leitura, sem auth (item 1.2) — nunca expõe e-mails/PII
app.get('/api/public/boards/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    if (!publicRateLimit(ip)) {
      return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em 1 minuto.' });
    }
    const notFound = () => res.status(404).json({ error: 'Link inválido ou desativado' });
    if (!/^[a-f0-9]{64}$/.test(token)) return notFound();

    const r = await query(
      `SELECT id, key, name, description, sprint_name, sprint_goal, sprint_start_date, sprint_end_date,
              columns, epics, visibility, share_token_expires_at
       FROM boards WHERE share_token = $1`,
      [token]
    );
    if (r.rows.length === 0) return notFound();
    const b = r.rows[0];
    if (b.visibility !== 'public') return notFound();
    if (b.share_token_expires_at && new Date(b.share_token_expires_at) < new Date()) return notFound();

    const tasksRes = await query(
      `SELECT t.* FROM tasks t
       WHERE t.board_id = $1 AND t.archived_at IS NULL
       ORDER BY t.created_at DESC`,
      [b.id]
    );

    // Nomes de todos os responsáveis (Item 1) — payload público segue saneado (só nomes)
    const rawWithIds = tasksRes.rows.map((t) => ({
      t,
      ids: normalizeAssigneeIds(safeJson(t.assignee_ids, []), t.assignee_id ? [t.assignee_id] : []),
    }));
    const allAssigneeIds = [...new Set(rawWithIds.flatMap((x) => x.ids))];
    const nameById = new Map<string, string>();
    if (allAssigneeIds.length > 0) {
      const mRes = await query('SELECT id, name FROM members WHERE id = ANY($1)', [allAssigneeIds]);
      for (const r of mRes.rows) nameById.set(String(r.id), String(r.name));
    }

    const publicTasks = rawWithIds.map(({ t, ids }) => {
      const comments = safeJson(t.comments, []);
      const subtasks = safeJson(t.subtasks, []);
      const assigneeNames = ids.map((id) => nameById.get(id)).filter((n): n is string => Boolean(n));
      return {
        id: t.id,
        key: t.key,
        title: t.title,
        statusId: t.status_id,
        priority: t.priority,
        issueType: t.issue_type,
        assigneeName: assigneeNames[0] || null,
        assigneeNames,
        dueDate: t.due_date || '',
        storyPoints: parseInt(t.story_points, 10) || 0,
        tags: safeJson(t.tags, []),
        subtasks: (Array.isArray(subtasks) ? subtasks : []).map((s: any) => ({
          title: String(s?.title ?? ''),
          completed: Boolean(s?.completed),
        })),
        commentsCount: Array.isArray(comments) ? comments.length : 0,
      };
    });

    res.set('Cache-Control', 'public, max-age=60');
    res.set('X-Robots-Tag', 'noindex');
    res.json({
      board: {
        id: b.id,
        key: b.key,
        name: b.name,
        description: b.description || '',
        sprintName: b.sprint_name || '',
        sprintGoal: b.sprint_goal || '',
        sprintStartDate: b.sprint_start_date || '',
        sprintEndDate: b.sprint_end_date || '',
        columns: safeJson(b.columns, []),
        epics: safeJson(b.epics, []),
      },
      tasks: publicTasks,
    });
  } catch (error) {
    console.error('Public board failed:', error);
    res.status(500).json({ error: 'Erro ao carregar quadro público' });
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

// ---------------------- TO-DO DO DIA (item 2.4) ---------------------- //

const TODO_MAX_PER_DAY = 200;

function mapDbTodo(row: any) {
  const d = row.due_date;
  return {
    id: row.id,
    memberId: row.member_id,
    boardId: row.board_id ?? null,
    title: row.title,
    done: row.done,
    dueDate: d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10),
    sourceTaskId: row.source_task_id ?? null,
    position: row.position,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? null,
  };
}

async function findOwnedTodo(id: string, memberId: string): Promise<any | null> {
  const r = await query('SELECT * FROM daily_todos WHERE id = $1 AND member_id = $2', [id, memberId]);
  return r.rows.length > 0 ? r.rows[0] : null;
}

// Sugestões: tarefas do membro com due_date <= hoje, não arquivadas, status != done
async function buildTodoSuggestions(memberId: string, today: string): Promise<any[]> {
  const boardsRes = await query(
    `SELECT b.id, b.key, b.columns FROM boards b
     JOIN board_members bm ON bm.board_id = b.id AND bm.member_id = $1`,
    [memberId]
  );
  const boardIds = boardsRes.rows.map((b) => b.id);
  if (boardIds.length === 0) return [];

  const tasksRes = await query(
    `SELECT * FROM tasks
     WHERE archived_at IS NULL
       AND (assignee_id = $1
            OR $1 = ANY(ARRAY(SELECT jsonb_array_elements_text(COALESCE(assignee_ids, '[]'::jsonb)))))
       AND due_date IS NOT NULL AND due_date <> ''
       AND LEFT(due_date, 10) <= $2
     ORDER BY due_date ASC LIMIT 25`,
    [memberId, today]
  );
  if (tasksRes.rows.length === 0) return [];

  const linkedRes = await query(
    `SELECT source_task_id FROM daily_todos
     WHERE member_id = $1 AND source_task_id IS NOT NULL`,
    [memberId]
  );
  const linked = new Set(linkedRes.rows.map((r) => r.source_task_id));

  const boardMeta = new Map<string, { key: string; doneIds: Set<string>; title: Map<string, string> }>();
  for (const b of boardsRes.rows) {
    const cols: any[] = safeJson(b.columns, []);
    const doneIds = new Set<string>(
      cols.filter((c) => c.isDone).map((c) => String(c.id))
    );
    const title = new Map<string, string>(
      cols.map((c) => [String(c.id), String(c.title || '')])
    );
    boardMeta.set(b.id, { key: b.key, doneIds, title });
  }

  return tasksRes.rows
    .filter((t) => !linked.has(t.id))
    .map((t) => {
      const meta = boardMeta.get(t.board_id);
      const statusTitle = meta?.title.get(String(t.status_id)) || String(t.status_id || '');
      const due = String(t.due_date || '').slice(0, 10);
      return {
        id: t.id,
        key: t.key,
        title: t.title,
        boardId: t.board_id,
        boardKey: meta?.key || '',
        priority: t.priority,
        dueDate: due,
        statusId: t.status_id,
        statusTitle,
        isOverdue: due < today,
      };
    })
    .filter((s) => !boardMeta.get(s.boardId)?.doneIds.has(s.statusId));
}

app.get('/api/todos', authenticateToken, async (req, res) => {
  try {
    const parsed = todoListQuerySchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Data inválida' });
    const today = parsed.data.date || new Date().toISOString().slice(0, 10);

    const [todosRes, suggested] = await Promise.all([
      query(
        `SELECT * FROM daily_todos WHERE member_id = $1 AND due_date = $2::date
         ORDER BY done ASC, position ASC, created_at ASC LIMIT 500`,
        [req.memberId, today]
      ),
      buildTodoSuggestions(req.memberId!, today),
    ]);

    res.json({ todos: todosRes.rows.map(mapDbTodo), suggested });
  } catch (error: any) {
    console.error('Error listing todos:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/todos', authenticateToken, validateBody(todoCreateSchema), async (req, res) => {
  try {
    const { title, dueDate, boardId, sourceTaskId } = req.body;
    const today = new Date().toISOString().slice(0, 10);
    const targetDate = dueDate || today;

    const countRes = await query(
      `SELECT COUNT(*)::int AS n FROM daily_todos WHERE member_id = $1 AND due_date = $2::date`,
      [req.memberId, targetDate]
    );
    if ((countRes.rows[0]?.n ?? 0) >= TODO_MAX_PER_DAY) {
      return res.status(429).json({ error: `Limite de ${TODO_MAX_PER_DAY} itens por dia atingido` });
    }

    const posRes = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS p FROM daily_todos WHERE member_id = $1 AND due_date = $2::date`,
      [req.memberId, targetDate]
    );

    const id = `todo-${crypto.randomUUID().slice(0, 8)}`;
    const r = await query(
      `INSERT INTO daily_todos (id, member_id, board_id, title, due_date, source_task_id, position)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7) RETURNING *`,
      [id, req.memberId, boardId ?? null, title, targetDate, sourceTaskId ?? null, posRes.rows[0].p]
    );
    res.status(201).json({ todo: mapDbTodo(r.rows[0]) });
  } catch (error: any) {
    console.error('Error creating todo:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/todos/:id', authenticateToken, validateBody(todoUpdateSchema), async (req, res) => {
  try {
    const row = await findOwnedTodo(req.params.id, req.memberId!);
    if (!row) return res.status(404).json({ error: 'Item não encontrado' });

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    const b = req.body;
    if (b.title !== undefined) { sets.push(`title = $${i++}`); vals.push(b.title); }
    if (b.done !== undefined) {
      sets.push(`done = $${i++}`, `completed_at = $${i++}`);
      vals.push(b.done, b.done ? new Date() : null);
    }
    if (b.dueDate !== undefined) { sets.push(`due_date = $${i++}::date`); vals.push(b.dueDate); }
    if (b.position !== undefined) { sets.push(`position = $${i++}`); vals.push(b.position); }
    vals.push(req.params.id, req.memberId);

    const r = await query(
      `UPDATE daily_todos SET ${sets.join(', ')} WHERE id = $${i++} AND member_id = $${i} RETURNING *`,
      vals
    );
    res.json({ todo: mapDbTodo(r.rows[0]) });
  } catch (error: any) {
    console.error('Error updating todo:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/todos/:id', authenticateToken, async (req, res) => {
  try {
    const r = await query('DELETE FROM daily_todos WHERE id = $1 AND member_id = $2', [
      req.params.id,
      req.memberId,
    ]);
    if (r.rowCount === 0) return res.status(404).json({ error: 'Item não encontrado' });
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting todo:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/todos/from-task/:taskId', authenticateToken, async (req, res) => {
  try {
    const taskId = req.params.taskId;
    const today = new Date().toISOString().slice(0, 10);

    const taskRes = await query(
      `SELECT t.* FROM tasks t
       JOIN board_members bm ON bm.board_id = t.board_id AND bm.member_id = $2
       WHERE t.id = $1`,
      [taskId, req.memberId]
    );
    if (taskRes.rows.length === 0) return res.status(404).json({ error: 'Tarefa não encontrada' });
    const t = taskRes.rows[0];

    const dup = await query(
      'SELECT 1 FROM daily_todos WHERE member_id = $1 AND source_task_id = $2',
      [req.memberId, taskId]
    );
    if (dup.rows.length > 0) return res.status(409).json({ error: 'Tarefa já está na sua To-Do' });

    const countRes = await query(
      `SELECT COUNT(*)::int AS n FROM daily_todos WHERE member_id = $1 AND due_date = $2::date`,
      [req.memberId, today]
    );
    if ((countRes.rows[0]?.n ?? 0) >= TODO_MAX_PER_DAY) {
      return res.status(429).json({ error: `Limite de ${TODO_MAX_PER_DAY} itens por dia atingido` });
    }

    const posRes = await query(
      `SELECT COALESCE(MAX(position), -1) + 1 AS p FROM daily_todos WHERE member_id = $1 AND due_date = $2::date`,
      [req.memberId, today]
    );
    const due = t.due_date ? String(t.due_date).slice(0, 10) : today;

    const id = `todo-${crypto.randomUUID().slice(0, 8)}`;
    const r = await query(
      `INSERT INTO daily_todos (id, member_id, board_id, title, due_date, source_task_id, position)
       VALUES ($1, $2, $3, $4, $5::date, $6, $7) RETURNING *`,
      [id, req.memberId, t.board_id, t.title, due, taskId, posRes.rows[0].p]
    );
    res.status(201).json({ todo: mapDbTodo(r.rows[0]) });
  } catch (error: any) {
    console.error('Error creating todo from task:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------- NOTAS + IA (item 4.1) ---------------------- //

function mapDbNote(row: any) {
  return {
    id: row.id,
    boardId: row.board_id,
    memberId: row.member_id,
    authorName: row.author_name || '',
    title: row.title,
    content: row.content,
    pinned: row.pinned,
    aiGenerated: row.ai_generated,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadNoteWithAccess(id: string, memberId: string) {
  const r = await query('SELECT * FROM notes WHERE id = $1', [id]);
  if (r.rows.length === 0) return null;
  const eff = await resolvePermissions(memberId, r.rows[0].board_id);
  return { note: r.rows[0], eff };
}

app.get('/api/notes', authenticateToken, async (req, res) => {
  try {
    const boardId = typeof req.query.boardId === 'string' ? req.query.boardId : '';
    if (!boardId) return res.status(400).json({ error: 'boardId obrigatório' });
    const eff = await resolvePermissions(req.memberId!, boardId);
    if (!eff) return res.status(403).json({ error: 'Sem acesso a este quadro' });

    const r = await query(
      `SELECT n.*, m.name AS author_name FROM notes n
       LEFT JOIN members m ON m.id = n.member_id
       WHERE n.board_id = $1
       ORDER BY n.pinned DESC, n.updated_at DESC LIMIT 300`,
      [boardId]
    );
    res.json({ notes: r.rows.map(mapDbNote) });
  } catch (error: any) {
    console.error('Error listing notes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/notes', authenticateToken, validateBody(noteCreateSchema), async (req, res) => {
  try {
    const { boardId, title, content } = req.body;
    const eff = await resolvePermissions(req.memberId!, boardId);
    if (!eff) return res.status(403).json({ error: 'Sem acesso a este quadro' });
    if (eff.role === 'viewer') return res.status(403).json({ error: 'Sem permissão para criar notas' });

    const id = `note-${crypto.randomUUID().slice(0, 8)}`;
    const r = await query(
      `INSERT INTO notes (id, board_id, member_id, title, content)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [id, boardId, req.memberId, title || 'Sem título', content || '']
    );
    res.status(201).json({ note: mapDbNote(r.rows[0]) });
  } catch (error: any) {
    console.error('Error creating note:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/notes/:id', authenticateToken, validateBody(noteUpdateSchema), async (req, res) => {
  try {
    const loaded = await loadNoteWithAccess(req.params.id, req.memberId!);
    if (!loaded || !loaded.eff) return res.status(404).json({ error: 'Nota não encontrada' });
    const { note, eff } = loaded;
    const isAuthor = note.member_id === req.memberId;
    if (!isAuthor && !eff.canManageBoard) {
      return res.status(403).json({ error: 'Sem permissão para editar esta nota' });
    }

    const sets: string[] = [];
    const vals: any[] = [];
    let i = 1;
    const b = req.body;
    if (b.title !== undefined) { sets.push(`title = $${i++}`); vals.push(b.title); }
    if (b.content !== undefined) { sets.push(`content = $${i++}`); vals.push(b.content); }
    if (b.pinned !== undefined) { sets.push(`pinned = $${i++}`); vals.push(b.pinned); }
    vals.push(req.params.id);

    const r = await query(
      `UPDATE notes SET ${sets.join(', ')}, updated_at = now() WHERE id = $${i} RETURNING *`,
      vals
    );
    res.json({ note: mapDbNote(r.rows[0]) });
  } catch (error: any) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/notes/:id', authenticateToken, async (req, res) => {
  try {
    const loaded = await loadNoteWithAccess(req.params.id, req.memberId!);
    if (!loaded || !loaded.eff) return res.status(404).json({ error: 'Nota não encontrada' });
    const { note, eff } = loaded;
    if (note.member_id !== req.memberId && !eff.canManageBoard) {
      return res.status(403).json({ error: 'Sem permissão para excluir esta nota' });
    }
    await query('DELETE FROM notes WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ações de IA sobre uma nota — NÃO grava; o cliente decide substituir/inserir
app.post('/api/notes/:id/ai', authenticateToken, validateBody(noteAiSchema), async (req, res) => {
  const { action } = req.body;
  const memberId = req.memberId!;
  let inputChars = 0;
  try {
    const loaded = await loadNoteWithAccess(req.params.id, memberId);
    if (!loaded || !loaded.eff) return res.status(404).json({ error: 'Nota não encontrada' });
    if (loaded.eff.role === 'viewer') {
      return res.status(403).json({ error: 'Sem permissão para executar IA nesta nota' });
    }
    const note = loaded.note;
    if (!note.content.trim()) return res.status(400).json({ error: 'Nota vazia' });

    if (!aiConfigured()) {
      await logAiUsage(memberId, action, note.content.length, 0, 'error');
      return res.status(503).json({ error: 'IA não configurada', unavailable: true });
    }

    const retryAfter = await checkAiRateLimit(memberId);
    if (retryAfter) {
      await logAiUsage(memberId, action, note.content.length, 0, 'rate_limited');
      const minutes = Math.max(1, Math.ceil((retryAfter.getTime() - Date.now()) / 60000));
      return res
        .status(429)
        .json({ error: `Limite de 20 usos/h atingido. Tente em ${minutes} min`, retryAfterMinutes: minutes });
    }

    const instructions: Record<string, string> = {
      summarize: 'Resuma o conteúdo abaixo em markdown conciso.',
      expand: 'Expanda o conteúdo abaixo mantendo o mesmo tópico e adicionando detalhes úteis.',
      action_items: 'Extraia itens de ação (checkboxes markdown) do conteúdo abaixo, com responsável quando mencionado.',
    };
    inputChars = note.content.length;
    const prompt = `${instructions[action]}\n\n<<<NOTA>>>\n${note.content.slice(0, 20000)}\n<<<END>>>`;
    const output = await runAi(prompt);

    await logAiUsage(memberId, action, inputChars, output.length, 'ok');
    res.json({
      content: output,
      usage: { action, inputChars, outputChars: output.length, provider: aiProvider(), model: aiModel() },
    });
  } catch (error: any) {
    const status = error instanceof AiUnavailableError ? 503 : 502;
    await logAiUsage(memberId, action, inputChars, 0, 'error').catch(() => {});
    console.error('Note AI action failed:', error);
    res.status(status).json({ error: error.message || 'Falha na IA' });
  }
});

// Gerar nota a partir das tasks da sprint ativa do board
app.post('/api/notes/ai/from-sprint', authenticateToken, validateBody(noteFromSprintSchema), async (req, res) => {
  const { boardId } = req.body;
  const memberId = req.memberId!;
  let inputChars = 0;
  try {
    const eff = await resolvePermissions(memberId, boardId);
    if (!eff) return res.status(403).json({ error: 'Sem acesso a este quadro' });
    if (eff.role === 'viewer') {
      return res.status(403).json({ error: 'Sem permissão para criar notas' });
    }

    if (!aiConfigured()) {
      await logAiUsage(memberId, 'from_sprint', 0, 0, 'error');
      return res.status(503).json({ error: 'IA não configurada', unavailable: true });
    }

    const retryAfter = await checkAiRateLimit(memberId);
    if (retryAfter) {
      await logAiUsage(memberId, 'from_sprint', 0, 0, 'rate_limited');
      const minutes = Math.max(1, Math.ceil((retryAfter.getTime() - Date.now()) / 60000));
      return res
        .status(429)
        .json({ error: `Limite de 20 usos/h atingido. Tente em ${minutes} min`, retryAfterMinutes: minutes });
    }

    const boardRes = await query('SELECT * FROM boards WHERE id = $1', [boardId]);
    if (boardRes.rows.length === 0) return res.status(404).json({ error: 'Quadro não encontrado' });
    const board = boardRes.rows[0];

    const tasksRes = await query(
      `SELECT t.* FROM tasks t
       WHERE t.board_id = $1 AND t.archived_at IS NULL
       ORDER BY t.created_at DESC LIMIT 50`,
      [boardId]
    );

    const aiTaskRows = tasksRes.rows.map((t) => ({
      t,
      ids: normalizeAssigneeIds(safeJson(t.assignee_ids, []), t.assignee_id ? [t.assignee_id] : []),
    }));
    const aiAssigneeIds = [...new Set(aiTaskRows.flatMap((x) => x.ids))];
    const aiNameById = new Map<string, string>();
    if (aiAssigneeIds.length > 0) {
      const mRes = await query('SELECT id, name FROM members WHERE id = ANY($1)', [aiAssigneeIds]);
      for (const r of mRes.rows) aiNameById.set(String(r.id), String(r.name));
    }

    const statusTitle = new Map(
      safeJson(board.columns, []).map((c: any) => [String(c.id), String(c.title || '')])
    );

    const lines = aiTaskRows.map(({ t, ids }) => {
      const responsible = ids.map((id) => aiNameById.get(id)).filter(Boolean).join(', ');
      return `- ${t.key} | ${String(t.title).slice(0, 120)} | status: ${statusTitle.get(String(t.status_id)) || t.status_id} | prioridade: ${t.priority} | vence: ${t.due_date ? String(t.due_date).slice(0, 10) : '-'} | pontos: ${t.story_points ?? '-'} | responsável: ${responsible || '-'}`;
    });
    const context = lines.join('\n');
    inputChars = context.length;

    const prompt = `Gere um resumo executivo da sprint em markdown (pt-BR) do quadro "${board.name}".
Inclua seções: Visão geral, Em andamento, Atrasados/riscos, Concluídos.
Não invente dados. Use apenas o contexto.

<<<CONTEXTO>>>
${context}
<<<END>>>`;

    const output = await runAi(prompt);

    const id = `note-${crypto.randomUUID().slice(0, 8)}`;
    const r = await query(
      `INSERT INTO notes (id, board_id, member_id, title, content, ai_generated)
       VALUES ($1, $2, $3, $4, $5, true) RETURNING *`,
      [id, boardId, memberId, `Resumo da sprint — ${board.name}`, output]
    );

    await logAiUsage(memberId, 'from_sprint', inputChars, output.length, 'ok');
    res.status(201).json({ note: mapDbNote(r.rows[0]) });
  } catch (error: any) {
    const status = error instanceof AiUnavailableError ? 503 : 502;
    await logAiUsage(memberId, 'from_sprint', inputChars, 0, 'error').catch(() => {});
    console.error('From-sprint note failed:', error);
    res.status(status).json({ error: error.message || 'Falha na IA' });
  }
});

// --- TAGS ENDPOINTS (item 2.2 — catálogo global de etiquetas) --- //

async function hasAnyBoardManage(memberId: string): Promise<boolean> {
  const m = await query('SELECT system_role FROM members WHERE id = $1', [memberId]);
  if (m.rows[0]?.system_role === 'admin') return true;
  const r = await query(
    `SELECT 1 FROM board_members
     WHERE member_id = $1
       AND (role = 'owner' OR COALESCE((permissions ->> 'canManageBoard')::boolean, FALSE))
     LIMIT 1`,
    [memberId]
  );
  return r.rows.length > 0;
}

async function requireTagManage(req: any, res: any): Promise<boolean> {
  if (await hasAnyBoardManage(req.memberId!)) return true;
  res.status(403).json({ error: 'Sem permissão para gerenciar etiquetas', required: 'canManageBoard' });
  return false;
}

async function tagUsageCount(name: string): Promise<number> {
  const r = await query(
    `SELECT COUNT(*)::int AS n FROM tasks, jsonb_array_elements_text(tasks.tags) x
     WHERE lower(x) = lower($1)`,
    [name]
  );
  return r.rows[0]?.n ?? 0;
}

function mapTag(row: any, usageCount: number, orphan = false) {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    usageCount,
    ...(orphan ? { orphan: true } : {}),
  };
}

app.get('/api/tags', authenticateToken, async (req, res) => {
  try {
    const [catalogRes, usageRes] = await Promise.all([
      query('SELECT * FROM tags ORDER BY lower(name)'),
      query(
        `SELECT lower(x) AS lname, MIN(x) AS name, COUNT(*)::int AS cnt
         FROM tasks, jsonb_array_elements_text(tasks.tags) x
         WHERE length(trim(x)) > 0
         GROUP BY lower(x)`
      ),
    ]);

    const usage = new Map<string, { name: string; cnt: number }>(
      usageRes.rows.map((r: any) => [r.lname, { name: r.name, cnt: r.cnt }])
    );

    const tags = catalogRes.rows.map((row: any) =>
      mapTag(row, usage.get(String(row.name).toLowerCase())?.cnt || 0)
    );
    const seen = new Set(tags.map((t) => t.name.toLowerCase()));
    for (const [lname, u] of usage) {
      if (!seen.has(lname)) {
        tags.push(mapTag({ id: `orphan-${lname}`.slice(0, 100), name: u.name, color: '#64748b' }, u.cnt, true));
      }
    }
    tags.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    res.json({ tags });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/tags', authenticateToken, validateBody(tagCreateSchema), async (req, res) => {
  try {
    if (!(await requireTagManage(req, res))) return;
    const { name, color } = req.body;
    const existing = await query('SELECT * FROM tags WHERE lower(name) = lower($1)', [name]);
    if (existing.rows.length > 0) {
      return res
        .status(409)
        .json({ error: 'Etiqueta já existe com esse nome', tag: mapTag(existing.rows[0], 0) });
    }
    const id = `tag-${crypto.randomUUID().slice(0, 8)}`;
    const r = await query(
      'INSERT INTO tags (id, name, color, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [id, name, color || '#64748b', req.memberId]
    );
    res.status(201).json({ tag: mapTag(r.rows[0], await tagUsageCount(name)) });
  } catch (error: any) {
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Etiqueta já existe com esse nome' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/tags/:id', authenticateToken, validateBody(tagUpdateSchema), async (req, res) => {
  const client = await pool.connect();
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      client.release();
    }
  };
  try {
    if (!(await requireTagManage(req, res))) return release();
    const { id } = req.params;
    const cur = await query('SELECT * FROM tags WHERE id = $1', [id]);
    if (cur.rows.length === 0) {
      release();
      return res.status(404).json({ error: 'Etiqueta não encontrada' });
    }
    const oldName: string = cur.rows[0].name;
    const newName: string = req.body.name ?? oldName;
    const color: string = req.body.color ?? cur.rows[0].color;
    const renamed = newName !== oldName;

    if (renamed) {
      const dup = await query('SELECT id, name FROM tags WHERE lower(name) = lower($1) AND id <> $2', [newName, id]);
      if (dup.rows.length > 0) {
        release();
        return res.status(409).json({ error: 'Etiqueta já existe com esse nome', tag: dup.rows[0] });
      }
    }

    let tasksUpdated = 0;
    await client.query('BEGIN');
    try {
      if (renamed) {
        const upd = await client.query(
          `UPDATE tasks SET tags = (
             SELECT COALESCE(jsonb_agg(DISTINCT CASE WHEN lower(x) = lower($1) THEN $2 ELSE x END), '[]'::jsonb)
             FROM jsonb_array_elements_text(tasks.tags) x
           )
           WHERE EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(tasks.tags) x WHERE lower(x) = lower($1)
           )`,
          [oldName, newName]
        );
        tasksUpdated = upd.rowCount ?? 0;
        await client.query('UPDATE tags SET name = $1, color = $2 WHERE id = $3', [newName, color, id]);
      } else {
        await client.query('UPDATE tags SET color = $1 WHERE id = $2', [color, id]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    }
    release();

    const updated = await query('SELECT * FROM tags WHERE id = $1', [id]);
    const usage = await tagUsageCount(renamed ? newName : oldName);
    res.json({ tag: mapTag(updated.rows[0], usage), tasksUpdated });
  } catch (error: any) {
    if (!released) await client.query('ROLLBACK').catch(() => {});
    release();
    if (error?.code === '23505') {
      return res.status(409).json({ error: 'Etiqueta já existe com esse nome' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/tags/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  let released = false;
  const release = () => {
    if (!released) {
      released = true;
      client.release();
    }
  };
  try {
    if (!(await requireTagManage(req, res))) return release();
    const { id } = req.params;
    const cur = await query('SELECT * FROM tags WHERE id = $1', [id]);
    if (cur.rows.length === 0) {
      release();
      return res.status(404).json({ error: 'Etiqueta não encontrada' });
    }
    const name: string = cur.rows[0].name;
    const removeFromTasks = req.query.removeFromTasks === 'true';
    const usage = await tagUsageCount(name);

    if (usage > 0 && !removeFromTasks) {
      release();
      return res.status(409).json({
        error: `Etiqueta usada em ${usage} tarefa(s). Remover das tarefas?`,
        usageCount: usage,
      });
    }

    let removedFromTasks = 0;
    await client.query('BEGIN');
    try {
      if (usage > 0) {
        const upd = await client.query(
          `UPDATE tasks SET tags = COALESCE((
             SELECT jsonb_agg(x) FROM jsonb_array_elements_text(tasks.tags) x WHERE lower(x) <> lower($1)
           ), '[]'::jsonb)
           WHERE EXISTS (
             SELECT 1 FROM jsonb_array_elements_text(tasks.tags) x WHERE lower(x) = lower($1)
           )`,
          [name]
        );
        removedFromTasks = upd.rowCount ?? 0;
      }
      await client.query('DELETE FROM tags WHERE id = $1', [id]);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK').catch(() => {});
      throw e;
    }
    release();

    res.json({ removedFromTasks });
  } catch (error: any) {
    if (!released) await client.query('ROLLBACK').catch(() => {});
    release();
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
