/**
 * Item 3 (Onda 2) — link público por tarefa + comentários de visitante.
 *
 * Regras de segurança (superfície anônima que GRAVA):
 * - Link: token opaco (32 bytes hex), expiração padrão de 90 dias, revogável.
 * - Payload público: sem e-mails/PII, sem anexos, sem comentários internos.
 * - Comentário do visitante: nome + texto sanitizados (HTML vira texto puro),
 *   limite de tamanho, rate limit por IP (hash) e por link.
 * - Notificação aos responsáveis: **apenas e-mail/in-app**, nunca webhook.
 */

export const PUBLIC_LINK_DEFAULT_DAYS = 90;
export const PUBLIC_LINK_MAX_DAYS = 365;
export const VISITOR_NAME_MAX = 60;
export const VISITOR_BODY_MAX = 2000;
export const VISITOR_COMMENT_LIMIT = 5;
export const VISITOR_COMMENT_WINDOW_MINUTES = 10;
export const PUBLIC_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

const EMAIL_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;

// Entidades HTML montadas por código (evita depender de literais escapados no source)
const AMP = String.fromCharCode(38);
const LT = String.fromCharCode(60);
const GT = String.fromCharCode(62);
const ENTITY_AMP = AMP + 'amp;';
const ENTITY_LT = AMP + 'lt;';
const ENTITY_GT = AMP + 'gt;';

/**
 * Remove qualquer tag HTML e devolve **texto puro**: tags são descartadas e
 * qualquer `<`/`>`/`&` remanescente vira entidade, de modo que o conteúdo
 * salvo nunca possa ser interpretado como HTML.
 */
export function stripHtml(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .split(AMP).join(ENTITY_AMP)
    .split(LT).join(ENTITY_LT)
    .split(GT).join(ENTITY_GT)
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Substitui e-mails por [e-mail oculto] — evita expor PII no payload público. */
export function redactEmails(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(EMAIL_PATTERN, '[e-mail oculto]');
}

export function containsEmailLike(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  EMAIL_PATTERN.lastIndex = 0;
  return EMAIL_PATTERN.test(raw);
}

/** Nome do visitante: texto puro, limitado; vazio → "Visitante". */
export function sanitizeVisitorName(raw: unknown): string {
  const cleaned = stripHtml(raw).replace(/\s+/g, ' ').slice(0, VISITOR_NAME_MAX).trim();
  return cleaned || 'Visitante';
}

/** Corpo do comentário: texto puro, limitado; devolve '' quando inválido. */
export function sanitizeVisitorBody(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  const cleaned = stripHtml(raw).slice(0, VISITOR_BODY_MAX).trim();
  return cleaned;
}

export interface PublicLinkLike {
  token?: string | null;
  allow_comments?: boolean | null;
  expires_at?: string | Date | null;
  revoked_at?: string | Date | null;
}

/** Link ativo = não revogado, não expirado e com token válido. */
export function isPublicLinkActive(link: PublicLinkLike | null | undefined, now = new Date()): boolean {
  if (!link || !link.token) return false;
  if (!PUBLIC_TOKEN_PATTERN.test(link.token)) return false;
  if (link.revoked_at) return false;
  if (link.expires_at && new Date(link.expires_at).getTime() <= now.getTime()) return false;
  return true;
}

/** Expiração normalizada (dias) — limitado a 1 ano. */
export function resolveExpiryDays(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return PUBLIC_LINK_DEFAULT_DAYS;
  return Math.min(PUBLIC_LINK_MAX_DAYS, Math.floor(n));
}

export interface VisitorRateState {
  allowed: boolean;
  retryAfterMinutes: number;
}

/** Rate limit do comentário anônimo: N comentários por IP na janela. */
export function visitorCommentRateState(
  recentCount: number,
  limit = VISITOR_COMMENT_LIMIT,
  windowMinutes = VISITOR_COMMENT_WINDOW_MINUTES
): VisitorRateState {
  if (recentCount < limit) return { allowed: true, retryAfterMinutes: 0 };
  return { allowed: false, retryAfterMinutes: windowMinutes };
}

export interface PublicTaskInput {
  id: string;
  key: string;
  title: string;
  description?: string | null;
  priority?: string | null;
  issueType?: string | null;
  dueDate?: string | null;
  storyPoints?: number | null;
  tags?: string[] | null;
  subtasks?: Array<{ title?: string; completed?: boolean }> | null;
  assigneeNames?: string[] | null;
  statusTitle?: string | null;
}

export interface PublicTaskPayload {
  id: string;
  key: string;
  title: string;
  description: string;
  priority: string;
  issueType: string;
  dueDate: string;
  storyPoints: number;
  tags: string[];
  statusTitle: string;
  subtasks: Array<{ title: string; completed: boolean }>;
  assigneeNames: string[];
}

/**
 * Payload público da tarefa — sem e-mails, sem PII, sem anexos e sem
 * comentários internos (apenas o contador).
 */
export function buildPublicTaskPayload(input: PublicTaskInput): PublicTaskPayload {
  return {
    id: input.id,
    key: input.key,
    title: stripHtml(input.title).slice(0, 300),
    description: redactEmails(stripHtml(input.description)).slice(0, 5000),
    priority: input.priority || 'medium',
    issueType: input.issueType || 'task',
    dueDate: input.dueDate || '',
    storyPoints: Number(input.storyPoints) || 0,
    tags: Array.isArray(input.tags) ? input.tags.map((t) => String(t).slice(0, 40)) : [],
    statusTitle: stripHtml(input.statusTitle || '').slice(0, 80),
    subtasks: Array.isArray(input.subtasks)
      ? input.subtasks.map((s) => ({
          title: stripHtml(s?.title ?? '').slice(0, 200),
          completed: Boolean(s?.completed),
        }))
      : [],
    assigneeNames: Array.isArray(input.assigneeNames)
      ? input.assigneeNames.map((n) => stripHtml(n).slice(0, 80)).filter(Boolean)
      : [],
  };
}

/** Comentário de visitante na visão interna: sempre identificado como "Visitante: nome". */
export function formatVisitorComment(visitorName: string, body: string): string {
  return `Visitante: ${visitorName}`;
}

export function visitorCommentDisplayName(visitorName: string): string {
  return `Visitante: ${visitorName}`;
}
