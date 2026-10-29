/**
 * Item 3 (Onda 2) — tarefa pública com comentários anônimos.
 *
 * Superfície anônima que GRAVA → defenses: token opaco + expiração + revogação,
 * payload sem PII, sanitização de HTML, rate limit por IP e notificação apenas
 * por e-mail/in-app (nunca webhook).
 */
import express from 'express';
import crypto from 'crypto';
import { query } from './db';
import { authenticateToken } from './auth';
import { resolvePermissions, type EffectivePermissions, type PermissionFlag } from './permissions';
import {
  PUBLIC_LINK_DEFAULT_DAYS,
  PUBLIC_TOKEN_PATTERN,
  VISITOR_COMMENT_WINDOW_MINUTES,
  buildPublicTaskPayload,
  isPublicLinkActive,
  redactEmails,
  resolveExpiryDays,
  sanitizeVisitorBody,
  sanitizeVisitorName,
  stripHtml,
  visitorCommentRateState,
} from './publicTasks';

export const publicTaskRouter = express.Router();

function safeJson(val: any, fallback: any = []) {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function escHtml(s: string): string {
  const AMP = String.fromCharCode(38);
  const LT = String.fromCharCode(60);
  const GT = String.fromCharCode(62);
  const QUOT = String.fromCharCode(34);
  const APOS = String.fromCharCode(39);
  return String(s || '')
    .split(AMP).join(AMP + 'amp;')
    .split(LT).join(AMP + 'lt;')
    .split(GT).join(AMP + 'gt;')
    .split(QUOT).join(AMP + 'quot;')
    .split(APOS).join(AMP + '#39;');
}

/** Rate limit em memória por IP (superfície anônima) */
const publicBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = publicBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    publicBuckets.set(key, { count: 1, resetAt: now + windowMs });
    if (publicBuckets.size > 5000) {
      for (const [k, v] of publicBuckets) if (v.resetAt <= now) publicBuckets.delete(k);
    }
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

/** Hash do IP (nunca storing o IP cru) — com sal do ambiente. */
function hashIp(ip: string): string {
  const salt = process.env.PUBLIC_LINK_SALT || process.env.JWT_SECRET || 'brolabs-public';
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function clientIp(req: any): string {
  return String(req.ip || req.socket?.remoteAddress || 'unknown');
}

function publicUrlBase(req: any): string {
  return (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

interface TaskRow {
  id: string;
  board_id: string;
  key: string;
  title: string;
  description: string;
  priority: string;
  issue_type: string;
  due_date: string;
  story_points: number;
  status_id: string;
  assignee_id: string;
  assignee_ids: string;
  tags: string;
  subtasks: string;
}

type TaskAccessResult =
  | { ok: true; task: TaskRow; eff: EffectivePermissions }
  | { ok: false; status: number; message: string };

async function loadTaskForMember(
  memberId: string,
  taskId: string,
  flag: PermissionFlag
): Promise<TaskAccessResult> {
  const r = await query('SELECT * FROM tasks WHERE id = $1', [taskId]);
  if (!r.rows.length) {
    return { ok: false, status: 404, message: 'Tarefa não encontrada' };
  }
  const task = r.rows[0] as TaskRow;
  const eff = await resolvePermissions(memberId, task.board_id);
  if (!eff) {
    return { ok: false, status: 403, message: 'Sem acesso a esta tarefa' };
  }
  if (!eff[flag]) {
    return { ok: false, status: 403, message: 'Sem permissão para esta ação' };
  }
  return { ok: true, task, eff };
}

async function assigneeNamesOf(task: TaskRow): Promise<string[]> {
  const ids: string[] = [];
  try {
    const parsed = safeJson(task.assignee_ids, []);
    if (Array.isArray(parsed)) ids.push(...parsed.filter((x: any) => typeof x === 'string' && x));
  } catch {
    /* ignora */
  }
  if (task.assignee_id) ids.push(task.assignee_id);
  const unique = [...new Set(ids)];
  if (!unique.length) return [];
  const mRes = await query('SELECT id, name FROM members WHERE id = ANY($1)', [unique]);
  return mRes.rows.map((m: any) => String(m.name)).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Management (autenticado)
// ---------------------------------------------------------------------------

/** Estado do link público da tarefa. */
publicTaskRouter.get('/tasks/:id/public-link', authenticateToken, async (req, res) => {
  try {
    const loaded = await loadTaskForMember(req.memberId!, req.params.id, 'canManageBoard');
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.message });

    const r = await query(
      `SELECT id, token, allow_comments, expires_at, revoked_at, created_at
       FROM task_public_links WHERE task_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC LIMIT 1`,
      [req.params.id]
    );
    const link = r.rows[0];
    const active = isPublicLinkActive(link);
    res.json({
      active,
      token: active ? link.token : null,
      url: active ? `${publicUrlBase(req)}/t/${link.token}` : null,
      expiresAt: active ? link.expires_at : null,
      allowComments: active ? Boolean(link.allow_comments) : false,
      createdAt: link?.created_at || null,
    });
  } catch (error: any) {
    console.error('GET public-link failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/** Cria (ou rotaciona) o link público da tarefa. */
publicTaskRouter.post('/tasks/:id/public-link', authenticateToken, async (req, res) => {
  try {
    const loaded = await loadTaskForMember(req.memberId!, req.params.id, 'canManageBoard');
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.message });

    const days = resolveExpiryDays(req.body?.expiresInDays ?? PUBLIC_LINK_DEFAULT_DAYS);
    const token = crypto.randomBytes(32).toString('hex');
    const linkId = `tpl-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Uma task por vez: revoga links anteriores (mantém histórico mínimo)
    await query(
      'UPDATE task_public_links SET revoked_at = NOW() WHERE task_id = $1 AND revoked_at IS NULL',
      [req.params.id]
    );
    const r = await query(
      `INSERT INTO task_public_links (id, task_id, token, allow_comments, expires_at, created_by)
       VALUES ($1, $2, $3, TRUE, NOW() + make_interval(days => $4::int), $5)
       RETURNING token, expires_at`,
      [linkId, req.params.id, token, days, req.memberId]
    );
    res.status(201).json({
      token: r.rows[0].token,
      url: `${publicUrlBase(req)}/t/${r.rows[0].token}`,
      expiresAt: r.rows[0].expires_at,
      allowComments: true,
    });
  } catch (error: any) {
    console.error('POST public-link failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/** Revoga o link público. */
publicTaskRouter.delete('/tasks/:id/public-link', authenticateToken, async (req, res) => {
  try {
    const loaded = await loadTaskForMember(req.memberId!, req.params.id, 'canManageBoard');
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.message });

    await query(
      'UPDATE task_public_links SET revoked_at = NOW() WHERE task_id = $1 AND revoked_at IS NULL',
      [req.params.id]
    );
    res.json({ success: true, active: false });
  } catch (error: any) {
    console.error('DELETE public-link failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/** Toggle "permitir comentários" do link público. */
publicTaskRouter.patch('/tasks/:id/public-link', authenticateToken, async (req, res) => {
  try {
    const loaded = await loadTaskForMember(req.memberId!, req.params.id, 'canManageBoard');
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.message });

    const allow = Boolean(req.body?.allowComments);
    const r = await query(
      `UPDATE task_public_links SET allow_comments = $1
       WHERE task_id = $2 AND revoked_at IS NULL
       RETURNING allow_comments`,
      [allow, req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Nenhum link público ativo para esta tarefa' });
    res.json({ allowComments: Boolean(r.rows[0].allow_comments) });
  } catch (error: any) {
    console.error('PATCH public-link failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/** Comentários de visitante da tarefa (visão interna). */
publicTaskRouter.get('/tasks/:id/public-comments', authenticateToken, async (req, res) => {
  try {
    const loaded = await loadTaskForMember(req.memberId!, req.params.id, 'canAddComment');
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.message });

    const r = await query(
      `SELECT id, visitor_name, body, created_at, removed_at
       FROM task_public_comments WHERE task_id = $1 ORDER BY created_at ASC`,
      [req.params.id]
    );
    res.json({
      comments: r.rows.map((c: any) => ({
        id: c.id,
        authorName: `Visitante: ${c.visitor_name}`,
        text: c.body,
        createdAt: c.created_at,
        removed: Boolean(c.removed_at),
      })),
    });
  } catch (error: any) {
    console.error('GET public-comments failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/** Remove comentário de visitante (membro com permissão de gerenciar o quadro). */
publicTaskRouter.delete('/tasks/:id/public-comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const loaded = await loadTaskForMember(req.memberId!, req.params.id, 'canManageBoard');
    if (!loaded.ok) return res.status(loaded.status).json({ error: loaded.message });

    const r = await query(
      `UPDATE task_public_comments SET removed_at = NOW(), removed_by = $1
       WHERE id = $2 AND task_id = $3 AND removed_at IS NULL`,
      [req.memberId, req.params.commentId, req.params.id]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Comentário não encontrado' });
    res.json({ success: true });
  } catch (error: any) {
    console.error('DELETE public-comment failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------------------------------------
// Superfície anônima (sem autenticação)
// ---------------------------------------------------------------------------

const genericNotFound = (res: any) =>
  res.status(404).json({ error: 'Link inválido ou desativado' });

/** Payload público da tarefa (sem PII, sem anexos, sem comentários internos). */
publicTaskRouter.get('/public/tasks/:token', async (req, res) => {
  try {
    const ip = clientIp(req);
    if (!rateLimit(`read:${ip}`, 60, 60_000)) {
      return res.status(429).json({ error: 'Muitas requisições. Tente novamente em 1 minuto.' });
    }
    const { token } = req.params;
    if (!PUBLIC_TOKEN_PATTERN.test(token)) return genericNotFound(res);

    const linkRes = await query(
      `SELECT id, task_id, token, allow_comments, expires_at, revoked_at
       FROM task_public_links WHERE token = $1`,
      [token]
    );
    const link = linkRes.rows[0];
    if (!isPublicLinkActive(link)) return genericNotFound(res);

    const taskRes = await query('SELECT * FROM tasks WHERE id = $1', [link.task_id]);
    if (!taskRes.rows.length) return genericNotFound(res);
    const task = taskRes.rows[0] as TaskRow;

    const boardRes = await query('SELECT columns FROM boards WHERE id = $1', [task.board_id]);
    const cols = safeJson(boardRes.rows[0]?.columns, []);
    const statusTitle =
      (Array.isArray(cols) ? cols.find((c: any) => c.id === task.status_id)?.title : '') || task.status_id;

    const names = await assigneeNamesOf(task);
    const payload = buildPublicTaskPayload({
      id: task.id,
      key: task.key,
      title: task.title,
      description: task.description,
      priority: task.priority,
      issueType: task.issue_type,
      dueDate: task.due_date,
      storyPoints: task.story_points,
      tags: safeJson(task.tags, []),
      subtasks: safeJson(task.subtasks, []),
      assigneeNames: names,
      statusTitle,
    });

    const cRes = await query(
      `SELECT id, visitor_name, body, created_at FROM task_public_comments
       WHERE link_id = $1 AND removed_at IS NULL ORDER BY created_at ASC`,
      [link.id]
    );

    res.set('Cache-Control', 'no-store');
    res.set('X-Robots-Tag', 'noindex');
    res.json({
      task: payload,
      allowComments: Boolean(link.allow_comments),
      expiresAt: link.expires_at,
      comments: cRes.rows.map((c: any) => ({
        id: c.id,
        visitorName: c.visitor_name,
        body: c.body,
        createdAt: c.created_at,
      })),
    });
  } catch (error: any) {
    console.error('Public task failed:', error);
    res.status(500).json({ error: 'Erro ao carregar tarefa pública' });
  }
});

/** Comentário anônimo (nome + texto). */
publicTaskRouter.post('/public/tasks/:token/comments', async (req, res) => {
  try {
    const ip = clientIp(req);
    const ipHash = hashIp(ip);
    if (!rateLimit(`write:${ip}`, 10, 60_000)) {
      return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em 1 minuto.' });
    }
    const { token } = req.params;
    if (!PUBLIC_TOKEN_PATTERN.test(token)) return genericNotFound(res);

    const linkRes = await query(
      `SELECT id, task_id, token, allow_comments, expires_at, revoked_at
       FROM task_public_links WHERE token = $1`,
      [token]
    );
    const link = linkRes.rows[0];
    if (!isPublicLinkActive(link)) return genericNotFound(res);
    if (!link.allow_comments) {
      return res.status(403).json({ error: 'Comentários desativados para este link' });
    }

    const name = sanitizeVisitorName(req.body?.name);
    const body = sanitizeVisitorBody(req.body?.body);
    if (!body) {
      return res.status(400).json({ error: 'Escreva um comentário antes de enviar' });
    }

    // Rate limit por IP (janela deslizante) — persistido, funciona em serverless
    const recent = await query(
      `SELECT COUNT(*)::int AS n FROM task_public_comments
       WHERE ip_hash = $1 AND created_at > NOW() - make_interval(mins => $2::int)`,
      [ipHash, VISITOR_COMMENT_WINDOW_MINUTES]
    );
    const rate = visitorCommentRateState(recent.rows[0]?.n ?? 0);
    if (!rate.allowed) {
      return res.status(429).json({
        error: `Limite de comentários atingido. Tente novamente em ${rate.retryAfterMinutes} min.`,
        retryAfterMinutes: rate.retryAfterMinutes,
      });
    }

    const taskRes = await query('SELECT id, key, title, board_id, assignee_id, assignee_ids FROM tasks WHERE id = $1', [
      link.task_id,
    ]);
    if (!taskRes.rows.length) return genericNotFound(res);
    const task = taskRes.rows[0];

    const commentId = `tpc-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    await query(
      `INSERT INTO task_public_comments (id, link_id, task_id, visitor_name, body, ip_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [commentId, link.id, link.task_id, name, body, ipHash]
    );

    // Notificação: apenas in-app + e-mail (nunca webhook)
    await notifyVisitorComment(task, name, body).catch((e) =>
      console.error('notifyVisitorComment falhou:', e?.message || e)
    );

    res.status(201).json({
      success: true,
      comment: { id: commentId, visitorName: name, body, createdAt: new Date().toISOString() },
    });
  } catch (error: any) {
    console.error('Public task comment failed:', error);
    res.status(500).json({ error: 'Erro ao registrar comentário' });
  }
});

/** In-app + e-mail aos responsáveis (nunca webhook — requisito do plano). */
async function notifyVisitorComment(task: any, visitorName: string, body: string): Promise<void> {
  const ids: string[] = [];
  const parsed = safeJson(task.assignee_ids, []);
  if (Array.isArray(parsed)) ids.push(...parsed.filter((x: any) => typeof x === 'string' && x));
  if (task.assignee_id) ids.push(task.assignee_id);
  const unique = [...new Set(ids)];
  if (!unique.length) return;

  const mRes = await query('SELECT id, name, email FROM members WHERE id = ANY($1)', [unique]);
  const members = mRes.rows.filter((m: any) => m.email);
  if (!members.length) return;

  const preview = `${visitorName}: ${body}`.slice(0, 300);

  await query(
    `INSERT INTO activity_logs (id, type, task_id, task_key, task_title, member_id, member_name, details, timestamp)
     VALUES ($1, 'comment_added', $2, $3, $4, $5, $6, $7, NOW())`,
    [
      `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      task.id,
      task.key,
      task.title,
      members[0].id,
      members[0].name,
      `Comentário público de ${visitorName}`,
    ]
  );

  const settingsRes = await query('SELECT * FROM email_settings LIMIT 1');
  const settings = settingsRes.rows[0];
  if (!settings?.enabled) return;

  for (const m of members) {
    try {
      await query(
        `INSERT INTO email_notifications
           (id, trigger_type, task_id, task_key, task_title, recipient_email, recipient_name,
            sender_name, subject, content_preview, html_body, status, timestamp, read, member_id, created_at)
         VALUES ($1, 'public_comment', $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, false, $12, now())`,
        [
          `em-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          task.id,
          task.key,
          task.title,
          m.email,
          m.name,
          settings.sender_name || 'Brolabs Workflow',
          `Novo comentário público em ${task.key}`,
          preview,
          `<p>Olá ${escHtml(m.name)},</p><p><strong>${escHtml(visitorName)}</strong> comentou na tarefa ${escHtml(
            task.key
          )}:</p><p>${escHtml(body).slice(0, 1000)}</p>`,
          new Date().toISOString(),
          m.id,
        ]
      );
    } catch (e: any) {
      console.error('public_comment email enqueue falhou:', e?.message || e);
    }
  }
}

export { stripHtml, redactEmails };
