/**
 * Item 4 (Onda 2) — commits do GitHub atrelados à tarefa.
 *
 * Decisão D4: **webhook + secret** (não GitHub App).
 * Segurança: HMAC-SHA256 no corpo cru (header `X-Hub-Signature-256`),
 * comparação timing-safe, anti-replay pelo `X-GitHub-Delivery` e
 * whitelist de owner/repo configurada pelo admin.
 */
import crypto from 'crypto';

export const GITHUB_SIGNATURE_HEADER = 'x-hub-signature-256';
export const GITHUB_DELIVERY_HEADER = 'x-github-delivery';
export const GITHUB_EVENT_HEADER = 'x-github-event';

export interface GitHubCommit {
  sha: string;
  message: string;
  author: string;
  authorAvatar?: string | null;
  url: string;
  branch: string;
  committedAt: string | null;
}

export interface GitHubPushInfo {
  repoFullName: string;
  owner: string;
  repo: string;
  branch: string;
  commits: GitHubCommit[];
}

/** Calcula `sha256=<hex>` sobre o corpo cru. */
export function signGitHubPayload(rawBody: string | Buffer, secret: string): string {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8');
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${hmac}`;
}

/** Verifica a assinatura do GitHub em tempo constante. */
export function verifyGitHubSignature(
  rawBody: string | Buffer,
  signature: string | undefined | null,
  secret: string
): boolean {
  if (!signature || !secret) return false;
  const expected = signGitHubPayload(rawBody, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Extrai chaves de tarefa do tipo `#BRO-12` em um texto (branch, mensagem). */
export function extractTaskKeys(text: string): string[] {
  const out = new Set<string>();
  const re = /#([A-Za-z][A-Za-z0-9]*-\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(text || ''))) !== null) {
    out.add(m[1].toUpperCase());
  }
  return [...out];
}

/** Extrai chaves de tarefa do nome do branch (ex.: `feature/BRO-12-x`). */
export function extractTaskKeysFromBranch(branch: string): string[] {
  const out = new Set<string>();
  const re = /([A-Za-z][A-Za-z0-9]*-\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(branch || ''))) !== null) {
    out.add(m[1].toUpperCase());
  }
  return [...out];
}

/** Normaliza o payload de `push` do GitHub. */
export function parseGitHubPush(payload: any): GitHubPushInfo | null {
  if (!payload || typeof payload !== 'object') return null;
  const repo = payload.repository || {};
  const fullName = String(repo.full_name || '');
  const [owner = '', name = ''] = fullName.split('/');
  const branch = String(payload.ref || '').replace(/^refs\/heads\//, '');

  const rawCommits = Array.isArray(payload.commits) ? payload.commits : [];
  const commits: GitHubCommit[] = rawCommits
    .filter((c: any) => c && (c.id || c.sha))
    .map((c: any) => ({
      sha: String(c.id || c.sha),
      message: String(c.message || ''),
      author: String(c.author?.name || c.author?.username || 'desconhecido'),
      authorAvatar: c.author?.avatar_url ? String(c.author.avatar_url) : null,
      url: String(c.url || ''),
      branch,
      committedAt: c.timestamp ? String(c.timestamp) : null,
    }));

  return { repoFullName: fullName, owner, repo: name, branch, commits };
}

/**
 * Chaves de tarefa referenciadas no push (mensagens dos commits + branch).
 * Commit sem referência não é vinculado a nenhuma tarefa.
 */
export function collectReferencedTaskKeys(info: GitHubPushInfo): string[] {
  const keys = new Set<string>();
  for (const c of info.commits) {
    for (const k of extractTaskKeys(c.message)) keys.add(k);
  }
  for (const k of extractTaskKeysFromBranch(info.branch)) keys.add(k);
  return [...keys];
}

/** Repo autorizado? (whitelist owner/repo do admin; vazio = nada autorizado). */
export function isRepoAllowed(
  owner: string,
  repo: string,
  allowed: { owner: string; repo: string }[]
): boolean {
  if (!owner || !repo) return false;
  return allowed.some(
    (r) =>
      String(r.owner).toLowerCase() === owner.toLowerCase() &&
      String(r.repo).toLowerCase() === repo.toLowerCase()
  );
}
