// Motor de entrega server-side de webhooks (S2, item 5).
// Filosofia do outbox: fila = webhook_logs.status 'pending', retry com backoff,
// processada imediatamente + pelo cron. Sem fila externa. Whitelist anti-SSRF.
import crypto from 'crypto';
import { query } from '../db';

export type WebhookPlatform = 'slack' | 'discord' | 'teams' | 'custom';

export type WebhookEventType =
  | 'task_completed'
  | 'worklog_logged'
  | 'task_blocked'
  | 'sprint_started'
  | 'mention'
  | 'task_assigned'
  | 'test_ping';

const FETCH_TIMEOUT_MS = 10000;
export const BACKOFF_MINUTES = [1, 5, 15, 60, 240];
export const MAX_ATTEMPTS = 5;

const DEFAULT_ALLOWED_HOSTS = [
  'hooks.slack.com',
  'discord.com',
  'discordapp.com',
  'hooks.discord.com',
  'webhook.office.com',
];

export function allowedHosts(): string[] {
  const extra = (process.env.WEBHOOK_ALLOWED_DOMAINS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set([...DEFAULT_ALLOWED_HOSTS, ...extra])];
}

export function isUrlAllowed(rawUrl: string): { ok: boolean; reason?: string } {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'URL inválida' };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    return { ok: false, reason: `Protocolo não permitido (${url.protocol})` };
  }
  const host = url.hostname.toLowerCase();
  const ok = allowedHosts().some((a) => host === a || host.endsWith('.' + a));
  return ok
    ? { ok: true }
    : { ok: false, reason: `Host "${host}" fora da whitelist (WEBHOOK_ALLOWED_DOMAINS)` };
}

export interface EventContext {
  eventType: WebhookEventType;
  message: string;
  details: Record<string, unknown>;
}
export function buildPayload(
  platform: string,
  ctx: EventContext,
  channelName?: string
): Record<string, unknown> {
  const { eventType, message, details } = ctx;
  switch (platform) {
    case 'slack':
      return {
        text: message,
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: message } }],
        ...(channelName ? { channel: channelName } : {}),
      };
    case 'discord':
      return {
        content: message,
        embeds: [
          {
            description: message,
            color: 0x6366f1,
            footer: { text: `Brolabs Workflow · ${eventType}` },
          },
        ],
        ...(channelName ? { username: channelName } : {}),
      };
    case 'teams':
      return {
        '@type': 'MessageCard',
        themeColor: '6366F1',
        title: 'Brolabs Workflow',
        text: message,
        facts: [
          { name: 'Evento', value: eventType },
          ...(channelName ? [{ name: 'Canal', value: channelName }] : []),
        ],
      };
    default:
      return {
        app: 'Brolabs Workflow',
        event: eventType,
        message,
        data: details,
        timestamp: new Date().toISOString(),
      };
  }
}

// Estado derivado para retry (puro — testável sem DB)
export function nextAttemptState(
  attempts: number
): { status: 'pending' | 'failed'; nextAttemptAt: Date | null } {
  if (attempts >= MAX_ATTEMPTS) return { status: 'failed', nextAttemptAt: null };
  const delayMin = BACKOFF_MINUTES[Math.min(attempts - 1, BACKOFF_MINUTES.length - 1)];
  return { status: 'pending', nextAttemptAt: new Date(Date.now() + delayMin * 60_000) };
}

// Verificação de assinatura do incoming (D3): HMAC-SHA256 sobre `${ts}.${rawBody}`
export function verifyIncomingSignature(
  secret: string,
  timestamp: string,
  rawBody: string | Buffer,
  signatureHeader: string | undefined,
  maxSkewSeconds = 300
): { ok: boolean; reason?: string } {
  if (!signatureHeader || !timestamp) return { ok: false, reason: 'Assinatura ausente' };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, reason: 'Timestamp inválido' };
  const skew = Math.abs(Date.now() - (ts < 1e12 ? ts * 1000 : ts)) / 1000;
  if (skew > maxSkewSeconds) return { ok: false, reason: 'Timestamp fora da janela (replay)' };
  const provided = signatureHeader.replace(/^sha256=/i, '').trim();
  const expected = crypto
    .createHmac('sha256', secret)
    .update(
      typeof rawBody === 'string'
        ? `${timestamp}.${rawBody}`
        : Buffer.concat([Buffer.from(`${timestamp}.`), rawBody])
    )
    .digest('hex');
  const a = Buffer.from(provided.toLowerCase(), 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'Assinatura inválida' };
  }
  return { ok: true };
}

export function signIncoming(secret: string, timestamp: string, rawBody: string): string {
  return (
    'sha256=' + crypto.createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  );
}

async function insertPendingLog(row: {
  id: string;
  platform: string;
  eventType: string;
  summary: string;
  payload: string;
}): Promise<void> {
  await query(
    `INSERT INTO webhook_logs (id, platform, event_type, payload_summary, status, timestamp, payload, attempts, created_at)
     VALUES ($1, $2, $3, $4, 'pending', $5, $6, 0, now())`,
    [row.id, row.platform, row.eventType, row.summary, new Date().toISOString(), row.payload]
  );
}

// Entrega de UM log pendente (1ª tentativa ou retry). Nunca lança.
export async function attemptDelivery(logId: string): Promise<void> {
  try {
    const res = await query(
      `SELECT w.*, i.webhook_url, i.enabled AS int_enabled, i.name AS int_name
       FROM webhook_logs w LEFT JOIN integrations i ON i.id = w.platform
       WHERE w.id = $1`,
      [logId]
    );
    const log = res.rows[0];
    if (!log || log.status !== 'pending') return;
    const attempts = (Number(log.attempts) || 0) + 1;

    const url = String(log.webhook_url || '');
    if (!log.int_enabled || !url.startsWith('http')) {
      await query(
        `UPDATE webhook_logs SET status = 'failed', attempts = $1,
           error = 'Integração desabilitada ou URL removida' WHERE id = $2`,
        [attempts, logId]
      );
      return;
    }

    const check = isUrlAllowed(url);
    if (!check.ok) {
      await query(
        `UPDATE webhook_logs SET status = 'failed', attempts = $1, error = $2 WHERE id = $3`,
        [attempts, check.reason, logId]
      );
      return;
    }

    let responseStatus: number | null = null;
    let errMsg: string | null = null;
    let delivered = false;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: log.payload || '{}',
        signal: controller.signal,
        redirect: 'error',
      }).finally(() => clearTimeout(timer));
      responseStatus = resp.status;
      delivered = resp.ok;
      if (!resp.ok) errMsg = `HTTP ${resp.status}`;
    } catch (e: any) {
      errMsg = e?.name === 'AbortError' ? `timeout ${FETCH_TIMEOUT_MS}ms` : String(e?.message || e);
    }

    if (delivered) {
      await query(
        `UPDATE webhook_logs SET status = 'delivered', attempts = $1, response_status = $2,
           next_attempt_at = NULL, error = NULL WHERE id = $3`,
        [attempts, responseStatus, logId]
      );
      return;
    }

    const st = nextAttemptState(attempts);
    await query(
      `UPDATE webhook_logs SET status = $1, attempts = $2, response_status = $3,
         next_attempt_at = $4, error = $5 WHERE id = $6`,
      [
        st.status,
        attempts,
        responseStatus,
        st.nextAttemptAt ? st.nextAttemptAt.toISOString() : null,
        errMsg,
        logId,
      ]
    );
  } catch (e: any) {
    console.error('webhook attemptDelivery falhou:', e?.message || e);
  }
}

interface IntegrationRow {
  id: string;
  name: string;
  enabled: boolean;
  webhook_url: string | null;
  channel_name: string | null;
  notify_on_task_complete: boolean;
  notify_on_worklog: boolean;
  notify_on_task_blocked: boolean;
  notify_on_sprint_start: boolean;
  notify_on_mention: boolean;
  notify_on_assignment: boolean;
  member_handles?: Record<string, string> | null;
}

const FLAG_BY_EVENT: Record<string, keyof IntegrationRow> = {
  task_completed: 'notify_on_task_complete',
  worklog_logged: 'notify_on_worklog',
  task_blocked: 'notify_on_task_blocked',
  sprint_started: 'notify_on_sprint_start',
  mention: 'notify_on_mention',
  task_assigned: 'notify_on_assignment',
};

// Ponto de entrada: enfileira + dispara imediatamente (fire-and-forget).
// `summary` pode conter o placeholder {mentions}, renderizado por integração
// a partir do mapeamento membro → handle (member_handles).
export function dispatchEvent(
  eventType: WebhookEventType,
  summary: string,
  details: Record<string, unknown>,
  mentions?: { memberId: string; name: string }[]
): void {
  void (async () => {
    try {
      const res = await query('SELECT * FROM integrations WHERE enabled = TRUE');
      const rows: IntegrationRow[] = res.rows;
      const flag = FLAG_BY_EVENT[eventType];
      for (const row of rows) {
        if (!row.webhook_url || !row.webhook_url.startsWith('http')) continue;
        if (flag && row[flag] !== true) continue;

        let message = summary;
        if (mentions?.length && summary.includes('{mentions}')) {
          const rendered = mentions
            .map((m) => {
              const h = row.member_handles?.[m.memberId];
              if (h) return String(h).startsWith('@') ? String(h) : `@${h}`;
              return `@${m.name.split(' ')[0]}`;
            })
            .join(' ');
          message = summary.replace('{mentions}', rendered);
        }

        const logId = `wh-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
        const check = isUrlAllowed(row.webhook_url);
        const payload = buildPayload(
          row.id,
          { eventType, message, details },
          row.channel_name || undefined
        );

        if (!check.ok) {
          await query(
            `INSERT INTO webhook_logs (id, platform, event_type, payload_summary, status, timestamp, payload, attempts, error, created_at)
             VALUES ($1, $2, $3, $4, 'failed', $5, $6, 1, $7, now())`,
            [logId, row.id, eventType, `[${row.name}] ${summary}`, new Date().toISOString(), JSON.stringify(payload), check.reason]
          );
          continue;
        }

        await insertPendingLog({
          id: logId,
          platform: row.id,
          eventType,
          summary: `[${row.name}] ${summary}`,
          payload: JSON.stringify(payload),
        });
        void attemptDelivery(logId);
      }
    } catch (e: any) {
      console.error('dispatchEvent falhou:', e?.message || e);
    }
  })();
}

// Retry: processa pendentes vencidos (chamado pelo cron / lazy flush)
export async function processWebhookOutbox(limit = 20): Promise<{ processed: number }> {
  const res = await query(
    `SELECT id FROM webhook_logs WHERE status = 'pending'
       AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
     ORDER BY created_at ASC LIMIT $1`,
    [limit]
  );
  for (const row of res.rows) {
    await attemptDelivery(row.id);
  }
  return { processed: res.rows.length };
}

// Test ping real (POST /api/webhooks/test/:id) — entrega de verdade e reporta status
export async function testIntegration(integrationId: string): Promise<{
  logId: string;
  status: 'delivered' | 'failed';
  responseStatus: number | null;
  error: string | null;
}> {
  const res = await query('SELECT * FROM integrations WHERE id = $1', [integrationId]);
  const row = res.rows[0];
  if (!row) throw new Error('Integração não encontrada');

  const logId = `wh-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const message = `Ping de teste do Brolabs Workflow (${row.name})`;
  const details = { test: true, integration: row.id };

  if (!row.enabled || !row.webhook_url || !row.webhook_url.startsWith('http')) {
    throw new Error('Integração desabilitada ou sem URL válida');
  }

  const check = isUrlAllowed(row.webhook_url);
  const payload = buildPayload(row.id, { eventType: 'test_ping', message, details }, row.channel_name || undefined);

  if (!check.ok) {
    await query(
      `INSERT INTO webhook_logs (id, platform, event_type, payload_summary, status, timestamp, payload, attempts, error, created_at)
       VALUES ($1, $2, 'test_ping', $3, 'failed', $4, $5, 1, $6, now())`,
      [logId, row.id, `[${row.name}] ${message}`, new Date().toISOString(), JSON.stringify(payload), check.reason]
    );
    return { logId, status: 'failed', responseStatus: null, error: check.reason || null };
  }

  await insertPendingLog({
    id: logId,
    platform: row.id,
    eventType: 'test_ping',
    summary: `[${row.name}] ${message}`,
    payload: JSON.stringify(payload),
  });
  await attemptDelivery(logId);

  const after = await query('SELECT status, response_status, error FROM webhook_logs WHERE id = $1', [logId]);
  const log = after.rows[0];
  return {
    logId,
    status: log?.status === 'delivered' ? 'delivered' : 'failed',
    responseStatus: log?.response_status ?? null,
    error: log?.error || null,
  };
}
