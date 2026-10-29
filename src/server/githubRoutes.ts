/**
 * Item 4 (Onda 2) — receiver de pushes do GitHub (D4: webhook + secret).
 *
 * Superfície pública que GRAVA → defenses:
 * - HMAC-SHA256 sobre o corpo cru (`X-Hub-Signature-256`), comparação timing-safe.
 * - Anti-replay por `X-GitHub-Delivery` (tabela `github_deliveries`).
 * - Whitelist de owner/repo configurada pelo admin (segredo criptografado no banco).
 * - Sem referência de tarefa → 200 sem gravação (nada é criado por engano).
 */
import express from 'express';
import crypto from 'crypto';
import { query } from './db';
import { authenticateToken } from './auth';
import { requireAdmin } from './permissions';
import { decryptSecret, encryptSecret } from './crypto';
import {
  GITHUB_DELIVERY_HEADER,
  GITHUB_EVENT_HEADER,
  GITHUB_SIGNATURE_HEADER,
  collectReferencedTaskKeys,
  isRepoAllowed,
  parseGitHubPush,
  verifyGitHubSignature,
} from './github';

export const githubRouter = express.Router();

interface GithubSettingRow {
  id: string;
  owner: string;
  repo: string;
  secret_encrypted: string;
  enabled: boolean;
}

async function loadSettings(): Promise<GithubSettingRow[]> {
  const r = await query('SELECT * FROM github_settings WHERE enabled = TRUE');
  return r.rows;
}

/**
 * Config admin: owner/repo + secret (criptografado).
 * O secret nunca é devolvido — apenas a indicação de que existe.
 */
githubRouter.get('/github/settings', authenticateToken, requireAdmin(), async (_req, res) => {
  try {
    const rows = await loadSettings();
    res.json({
      repositories: rows.map((r) => ({
        id: r.id,
        owner: r.owner,
        repo: r.repo,
        enabled: Boolean(r.enabled),
        hasSecret: Boolean(r.secret_encrypted),
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

githubRouter.post('/github/settings', authenticateToken, requireAdmin(), async (req, res) => {
  try {
    const owner = String(req.body?.owner || '').trim();
    const repo = String(req.body?.repo || '').trim();
    const secret = String(req.body?.secret || '');
    if (!owner || !repo || secret.length < 16) {
      return res.status(400).json({ error: 'Informe owner, repo e um secret com pelo menos 16 caracteres' });
    }
    const id = `ghs-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const encrypted = encryptSecret(secret);
    const r = await query(
      `INSERT INTO github_settings (id, owner, repo, secret_encrypted, enabled, created_by)
       VALUES ($1, $2, $3, $4, TRUE, $5)
       ON CONFLICT (owner, repo)
       DO UPDATE SET secret_encrypted = EXCLUDED.secret_encrypted, enabled = TRUE, updated_at = NOW()
       RETURNING id, owner, repo`,
      [id, owner, repo, encrypted, req.memberId]
    );
    res.status(201).json({ id: r.rows[0].id, owner: r.rows[0].owner, repo: r.rows[0].repo, hasSecret: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

githubRouter.delete('/github/settings/:id', authenticateToken, requireAdmin(), async (req, res) => {
  try {
    const r = await query('DELETE FROM github_settings WHERE id = $1', [req.params.id]);
    if (!r.rowCount) return res.status(404).json({ error: 'Configuração não encontrada' });
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Commits atrelados a uma tarefa (visão interna). */
githubRouter.get('/tasks/:id/commits', authenticateToken, async (req, res) => {
  try {
    const tRes = await query('SELECT board_id FROM tasks WHERE id = $1', [req.params.id]);
    if (!tRes.rows.length) return res.status(404).json({ error: 'Tarefa não encontrada' });

    const bm = await query(
      'SELECT 1 FROM board_members WHERE board_id = $1 AND member_id = $2',
      [tRes.rows[0].board_id, req.memberId]
    );
    const isAdmin = await query("SELECT system_role FROM members WHERE id = $1", [req.memberId]);
    const admin = isAdmin.rows[0]?.system_role === 'admin';
    if (!bm.rowCount && !admin) return res.status(403).json({ error: 'Sem acesso a esta tarefa' });

    const r = await query(
      `SELECT id, sha, message, author, author_avatar, url, branch, repo_full_name, committed_at, created_at
       FROM task_commits WHERE task_id = $1 ORDER BY created_at DESC LIMIT 50`,
      [req.params.id]
    );
    res.json({
      commits: r.rows.map((c: any) => ({
        id: c.id,
        sha: c.sha,
        message: c.message,
        author: c.author,
        authorAvatar: c.author_avatar,
        url: c.url,
        branch: c.branch,
        repo: c.repo_full_name,
        committedAt: c.committed_at,
        createdAt: c.created_at,
      })),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** Receiver público do GitHub (push). */
githubRouter.post('/webhooks/github', async (req, res) => {
  const rawBody: Buffer = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.from(JSON.stringify(req.body || {}));

  try {
    const event = String(req.headers[GITHUB_EVENT_HEADER] || '');
    const deliveryId = String(req.headers[GITHUB_DELIVERY_HEADER] || '');
    const signature = String(req.headers[GITHUB_SIGNATURE_HEADER] || '');

    if (event !== 'push') {
      // evento não suportado: 200 sem gravação (GitHub não deve repetir)
      return res.status(200).json({ ok: true, ignored: 'evento não suportado' });
    }

    const settings = await loadSettings();

    // assinatura válida para **algum** repo configurado
    let matched: GithubSettingRow | null = null;
    for (const s of settings) {
      let secret = '';
      try {
        secret = decryptSecret(s.secret_encrypted);
      } catch {
        continue;
      }
      if (verifyGitHubSignature(rawBody, signature, secret)) {
        matched = s;
        break;
      }
    }
    if (!matched) {
      return res.status(401).json({ error: 'Assinatura inválida' });
    }

    // anti-replay: mesma delivery não é processada duas vezes
    if (deliveryId) {
      const ins = await query(
        'INSERT INTO github_deliveries (delivery_id) VALUES ($1) ON CONFLICT DO NOTHING',
        [deliveryId]
      );
      if (!ins.rowCount) {
        return res.status(200).json({ ok: true, ignored: 'delivery já processada' });
      }
    }

    const info = parseGitHubPush(req.body);
    if (!info) return res.status(200).json({ ok: true, ignored: 'payload inválido' });

    // whitelist owner/repo
    if (!isRepoAllowed(info.owner, info.repo, settings)) {
      return res.status(403).json({ error: 'Repositório não autorizado' });
    }

    const keys = collectReferencedTaskKeys(info);
    if (!keys.length) {
      // push sem referência de tarefa → 200 sem gravação
      return res.status(200).json({ ok: true, linked: 0, ignored: 'nenhuma referência de tarefa' });
    }

    const tasksRes = await query('SELECT id, key, title, board_id, assignee_id, assignee_ids FROM tasks WHERE UPPER(key) = ANY($1)', [
      keys,
    ]);
    if (!tasksRes.rows.length) {
      // referência inexistente → WARN + 200
      console.warn('GitHub push com referência sem tarefa correspondente:', keys.join(', '));
      return res.status(200).json({ ok: true, linked: 0, warning: 'referência sem tarefa correspondente' });
    }

    let linked = 0;
    for (const task of tasksRes.rows) {
      for (const commit of info.commits) {
        const id = `tc-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        const ins = await query(
          `INSERT INTO task_commits
             (id, task_id, sha, message, author, author_avatar, url, branch, repo_full_name, committed_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (task_id, sha) DO NOTHING`,
          [
            id,
            task.id,
            commit.sha,
            commit.message.slice(0, 500),
            commit.author,
            commit.authorAvatar,
            commit.url,
            commit.branch,
            info.repoFullName,
            commit.committedAt,
          ]
        );
        if (ins.rowCount) {
          linked += 1;
          await notifyCommit(task, commit).catch((e) =>
            console.error('notifyCommit falhou:', e?.message || e)
          );
        }
      }
    }

    res.status(200).json({ ok: true, linked });
  } catch (error: any) {
    console.error('GitHub webhook failed:', error);
    res.status(500).json({ error: 'Erro ao processar push' });
  }
});

/** Notificação in-app + e-mail aos responsáveis (nunca webhook — requisito do plano). */
async function notifyCommit(task: any, commit: { sha: string; message: string; url: string }): Promise<void> {
  const ids: string[] = [];
  const parsed = typeof task.assignee_ids === 'string' ? JSON.parse(task.assignee_ids || '[]') : task.assignee_ids;
  if (Array.isArray(parsed)) ids.push(...parsed.filter((x: any) => typeof x === 'string' && x));
  if (task.assignee_id) ids.push(task.assignee_id);
  const unique = [...new Set(ids)];
  if (!unique.length) return;

  const mRes = await query('SELECT id, name, email FROM members WHERE id = ANY($1)', [unique]);
  const members = mRes.rows.filter((m: any) => m.email);
  if (!members.length) return;

  const shortSha = commit.sha.slice(0, 7);
  await query(
    `INSERT INTO activity_logs (id, type, task_id, task_key, task_title, member_id, member_name, details, timestamp)
     VALUES ($1, 'task_updated', $2, $3, $4, $5, $6, $7, NOW())`,
    [
      `act-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      task.id,
      task.key,
      task.title,
      members[0].id,
      members[0].name,
      `Commit ${shortSha} atrelado à tarefa`,
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
         VALUES ($1, 'github_commit', $2, $3, $4, $5, $6, $7, $8, $9, $10, 'pending', $11, false, $12, now())`,
        [
          `em-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
          task.id,
          task.key,
          task.title,
          m.email,
          m.name,
          settings.sender_name || 'Brolabs Workflow',
          `Novo commit em ${task.key}`,
          `${shortSha}: ${commit.message.slice(0, 200)}`,
          `<p>Olá ${m.name},</p><p>Um commit foi atrelado à tarefa <strong>${task.key}</strong>:</p><p><code>${shortSha}</code> — ${commit.message.slice(
            0,
            300
          )}</p>`,
          new Date().toISOString(),
          m.id,
        ]
      );
    } catch (e: any) {
      console.error('github_commit email enqueue falhou:', e?.message || e);
    }
  }
}
