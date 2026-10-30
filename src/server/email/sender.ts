import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { query } from '../db';

export function smtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export function smtpHost(): string | null {
  return process.env.SMTP_HOST || null;
}

function getTransport(): Transporter | null {
  if (!smtpConfigured()) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER!,
      pass: process.env.SMTP_PASS!,
    },
    pool: true,
  });
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  fromEmail?: string;
  fromName?: string;
}

/** Envia um e-mail. Retorna messageId ou lança erro do SMTP. */
export async function sendEmail(input: SendEmailInput): Promise<string> {
  const transport = getTransport();
  if (!transport) {
    throw new Error('SMTP não configurado (SMTP_HOST / SMTP_USER / SMTP_PASS)');
  }
  const from = input.fromEmail || process.env.SMTP_USER || 'no-reply@localhost';
  const info = await transport.sendMail({
    from: `"${input.fromName || 'Brolabs Workflow'}" <${from}>`,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });
  return info.messageId || '';
}

/** Backoff: 1, 5, 15, 60, 240 minutos (máx 5 tentativas). */
export const BACKOFF_MINUTES = [1, 5, 15, 60, 240];
export const MAX_ATTEMPTS = 5;

export function nextAttemptDate(attemptsSoFar: number): Date {
  const idx = Math.min(Math.max(attemptsSoFar, 0), BACKOFF_MINUTES.length - 1);
  return new Date(Date.now() + BACKOFF_MINUTES[idx] * 60_000);
}

const EXHAUSTED_DATE = new Date('9999-12-31T23:59:59.000Z');

/** Rate limit: máx 20 e-mails/hora por destinatário. */
export async function isRateLimited(recipientEmail: string): Promise<boolean> {
  const res = await query(
    `SELECT COUNT(*)::int AS n FROM email_notifications
     WHERE LOWER(recipient_email) = LOWER($1)
       AND sent_at IS NOT NULL
       AND sent_at > NOW() - INTERVAL '1 hour'`,
    [recipientEmail]
  );
  return res.rows[0].n >= 20;
}

function truncateError(msg: string): string {
  return msg.slice(0, 500);
}

/**
 * Processa o outbox: envia pendentes/falhados elegíveis (backoff respeitado).
 * Nunca lança — falha vira status na row.
 */
export async function processOutbox(
  limit = 20
): Promise<{ sent: number; failed: number; skipped: number }> {
  const result = { sent: 0, failed: 0, skipped: 0 };
  if (!smtpConfigured()) return result;

  const rows = await query(
    `SELECT * FROM email_notifications
     WHERE status IN ('pending', 'failed')
       AND attempts < $2
       AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
     ORDER BY created_at ASC
     LIMIT $1`,
    [limit, MAX_ATTEMPTS]
  );

  for (const row of rows.rows) {
    if (!row.member_id) {
      result.skipped++;
      continue;
    }
    if (!row.recipient_email) {
      result.skipped++;
      continue;
    }
    if (await isRateLimited(row.recipient_email)) {
      result.skipped++;
      continue;
    }
    try {
      const settingsRes = await query('SELECT * FROM email_settings LIMIT 1');
      const settings = settingsRes.rows[0];
      await sendEmail({
        to: row.recipient_email,
        subject: row.subject || '(sem assunto)',
        html: row.html_body || `<p>${row.content_preview || ''}</p>`,
        fromEmail: settings?.sender_email || undefined,
        fromName: settings?.sender_name || undefined,
      });
      await query(
        `UPDATE email_notifications
         SET status = 'sent', sent_at = NOW(), attempts = attempts + 1, last_error = NULL
         WHERE id = $1`,
        [row.id]
      );
      result.sent++;
    } catch (err: any) {
      console.error(
        `Email send failed (${row.id}) [secure=${process.env.SMTP_SECURE} port=${process.env.SMTP_PORT}]:`,
        err?.message,
      );
      const attempts = (row.attempts || 0) + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      await query(
        `UPDATE email_notifications
         SET status = 'failed', attempts = $2, last_error = $3, next_attempt_at = $4
         WHERE id = $1`,
        [
          row.id,
          attempts,
          truncateError(err?.message || 'erro desconhecido'),
          exhausted ? EXHAUSTED_DATE : nextAttemptDate(attempts),
        ]
      );
      result.failed++;
    }
  }

  return result;
}
