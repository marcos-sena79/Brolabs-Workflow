import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
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
} from './src/server/validation';

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
    const [boardsRes, membersRes, tasksRes, activitiesRes, integrationsRes, webhooksRes, emailSettingsRes, emailNotificationsRes, appSettingsRes] =
      await Promise.all([
        query('SELECT * FROM boards ORDER BY created_at ASC'),
        query('SELECT * FROM members ORDER BY name ASC'),
        query('SELECT * FROM tasks ORDER BY created_at DESC'),
        query('SELECT * FROM activity_logs ORDER BY timestamp DESC LIMIT 100'),
        query('SELECT * FROM integrations ORDER BY id ASC'),
        query('SELECT * FROM webhook_logs ORDER BY timestamp DESC LIMIT 50'),
        query('SELECT * FROM email_settings LIMIT 1'),
        query('SELECT * FROM email_notifications ORDER BY timestamp DESC LIMIT 50'),
        query('SELECT * FROM app_settings'),
      ]);

    const boards = boardsRes.rows.map(mapDbBoard);
    const members = membersRes.rows.map(mapDbMember);
    const tasks = tasksRes.rows.map(mapDbTask);
    const activityLogs = activitiesRes.rows.map(mapDbActivity);
    const integrations = integrationsRes.rows.map(mapDbIntegration);
    const webhookLogs = webhooksRes.rows.map(mapDbWebhookLog);
    const emailNotifications = emailNotificationsRes.rows.map(mapDbEmailNotification);

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

    const currentBoardId = appSettingsMap['current_board_id'] || (boards[0] ? boards[0].id : '');
    const currentUserId = appSettingsMap['current_user_id'] || (members[0] ? members[0].id : '');

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
    });
  } catch (error: any) {
    console.error('Error fetching initial state:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset / Seed database (destructivo: exige auth + confirmação explícita)
app.post(
  '/api/reset-database',
  authenticateToken,
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

app.post('/api/tasks', authenticateToken, validateBody(taskCreateSchema), async (req, res) => {
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
    await query('DELETE FROM tasks WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting task:', error);
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
    res.status(201).json({ success: true, board: b });
  } catch (error: any) {
    console.error('Error creating board:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/boards/:id', authenticateToken, validateBody(boardUpdateSchema), async (req, res) => {
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

app.delete('/api/boards/:id', authenticateToken, async (req, res) => {
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

app.put('/api/integrations/:id', authenticateToken, async (req, res) => {
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

app.post('/api/webhooks', authenticateToken, async (req, res) => {
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

app.post('/api/email/notifications', authenticateToken, async (req, res) => {
  try {
    const e = req.body;
    await query(
      `INSERT INTO email_notifications (
        id, trigger_type, task_id, task_key, task_title, recipient_email,
        recipient_name, sender_name, subject, content_preview, html_body, status, timestamp, read
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
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
        e.status || 'sent',
        e.timestamp,
        Boolean(e.read),
      ]
    );
    res.status(201).json({ success: true, emailNotification: e });
  } catch (error: any) {
    console.error('Error creating email notification:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/email/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE email_notifications SET read = TRUE WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/email/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    await query('UPDATE email_notifications SET read = TRUE');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/email/notifications', authenticateToken, async (req, res) => {
  try {
    await query('DELETE FROM email_notifications');
    res.json({ success: true });
  } catch (error: any) {
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
