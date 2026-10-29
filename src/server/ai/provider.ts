import { GoogleGenAI } from '@google/genai';
import { query } from '../db';

const TIMEOUT_MS = 59000;
const RATE_LIMIT_PER_HOUR = 20;

const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';
const OPENROUTER_DEFAULT_MODEL = 'openai/gpt-4o-mini';

const SYSTEM = `Você é o assistente de notas do Brolabs Workflow (pt-BR).
Responda apenas sobre o conteúdo fornecido. Não invente dados de tarefas.
Devolva markdown limpo, sem preâmbulo.`;

export type AiProvider = 'openrouter' | 'gemini';

function normalizeProvider(v: string | undefined): AiProvider | null {
  const p = (v || '').trim().toLowerCase();
  if (p === 'openrouter' || p === 'gemini') return p;
  return null;
}

function geminiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

function openrouterKey(): string | undefined {
  return process.env.OPENROUTER_API_KEY;
}

/**
 * Provedor ativo: AI_PROVIDER=openrouter|gemini.
 * Sem AI_PROVIDER, escolhe automaticamente o provedor cuja API key esteja definida.
 * Retorna null se nenhum estiver configurado (UI mostra "indisponível").
 */
export function aiProvider(): AiProvider | null {
  const explicit = normalizeProvider(process.env.AI_PROVIDER);
  if (explicit === 'openrouter' && openrouterKey()) return 'openrouter';
  if (explicit === 'gemini' && geminiKey()) return 'gemini';
  if (explicit) return null; // forçado mas sem a key correspondente
  if (openrouterKey()) return 'openrouter';
  if (geminiKey()) return 'gemini';
  return null;
}

export function aiConfigured(): boolean {
  return aiProvider() !== null;
}

export function aiModel(): string {
  switch (aiProvider()) {
    case 'openrouter':
      return process.env.OPENROUTER_MODEL || OPENROUTER_DEFAULT_MODEL;
    case 'gemini':
      return process.env.GEMINI_MODEL || GEMINI_DEFAULT_MODEL;
    default:
      return '—';
  }
}

/** 20 req/h por membro. Retorna null se dentro do limite, ou a data da liberação. */
export async function checkAiRateLimit(memberId: string): Promise<Date | null> {
  const r = await query(
    `SELECT COUNT(*)::int AS n FROM ai_usage
     WHERE member_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [memberId]
  );
  if ((r.rows[0]?.n ?? 0) < RATE_LIMIT_PER_HOUR) return null;
  const oldest = await query(
    `SELECT MIN(created_at) AS t FROM ai_usage
     WHERE member_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
    [memberId]
  );
  const t = oldest.rows[0]?.t ? new Date(oldest.rows[0].t) : new Date();
  return new Date(t.getTime() + 60 * 60 * 1000);
}

export async function logAiUsage(
  memberId: string,
  action: string,
  inputChars: number,
  outputChars: number,
  status: 'ok' | 'error' | 'rate_limited'
): Promise<void> {
  await query(
    `INSERT INTO ai_usage (member_id, action, input_chars, output_chars, status)
     VALUES ($1, $2, $3, $4, $5)`,
    [memberId, action, inputChars, outputChars, status]
  );
}

export class AiUnavailableError extends Error {}
export class AiFailedError extends Error {}

async function runGeminiOnce(prompt: string): Promise<string> {
  const client = new GoogleGenAI({ apiKey: geminiKey()! });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await client.models.generateContent({
      model: aiModel(),
      contents: prompt,
      config: {
        systemInstruction: SYSTEM,
        abortSignal: controller.signal,
      },
    });
    const text = res.text;
    if (!text || !text.trim()) throw new AiFailedError('Resposta vazia do modelo!');
    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function runOpenRouterOnce(prompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openrouterKey()}`,
        'Content-Type': 'application/json',
        // Atribuição opcional exibida em rankings do OpenRouter
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3000',
        'X-Title': 'Brolabs Workflow',
      },
      body: JSON.stringify({
        model: aiModel(),
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: prompt },
        ],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null as any);
      const detail = errBody?.error?.message ? `: ${errBody.error.message}` : '';
      throw new AiFailedError(`OpenRouter HTTP ${res.status}${detail}`);
    }

    const data: any = await res.json();
    const text: string | undefined = data?.choices?.[0]?.message?.content;
    if (!text || !text.trim()) throw new AiFailedError('Resposta vazia do modelo!');
    return text;
  } catch (err: any) {
    if (isAbortError(err)) {
      throw new AiFailedError(
        `Timeout: o provedor não respondeu em ${Math.round(TIMEOUT_MS / 1000)}s`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Detecta abort/timeout do cliente (fetch abortado ou SDK cancelado). */
export function isAbortError(err: any): boolean {
  const name = String(err?.name || '');
  const msg = String(err?.message || err || '');
  return name === 'AbortError' || /abort|timed out|timeout/i.test(msg);
}

/** Chama o provedor ativo com timeout de 59s e 1 retry (com espera de 1,5s) em 5xx/429. Lança AiFailedError. */
export async function runAi(prompt: string): Promise<string> {
  const provider = aiProvider();
  if (!provider) {
    throw new AiUnavailableError('IA não configurada');
  }

  const attempt = async (): Promise<string> =>
    provider === 'openrouter' ? runOpenRouterOnce(prompt) : runGeminiOnce(prompt);

  try {
    return await attempt();
  } catch (err: any) {
    const msg = String(err?.message || err);
    // Timeout não é retentável: repetir dobra a latência percebida pelo usuário.
    if (isAbortError(err)) {
      throw new AiFailedError(msg);
    }
    const retryable =
      err instanceof AiFailedError ||
      /\b(5\d{2}|429)\b/.test(msg) ||
      /overloaded|unavailable|quota/i.test(msg);
    if (!retryable) throw new AiFailedError(msg);
    try {
      await new Promise((r) => setTimeout(r, 1500));
      return await attempt();
    } catch (err2: any) {
      throw new AiFailedError(String(err2?.message || err2));
    }
  }
}

export interface AiErrorResponse {
  status: number;
  body: {
    error: string;
    unavailable?: boolean;
    retryAfterMinutes?: number;
    providerStatus?: number;
  };
}

/**
 * Traduz falha da IA em resposta HTTP legível para o usuário.
 *
 * - IA não configurada → 503 (unavailable).
 * - Limite do provedor (429 / rate limit / quota) → 429 com hint de nova tentativa.
 * - Timeout do provedor → 504 (gateway timeout).
 * - Qualquer outra falha (inclusive erro legítimo do provedor) → 502 com o
 *   detalhe original, para o usuário saber o que houve.
 */
export function mapAiError(error: unknown): AiErrorResponse {
  const message = String((error as any)?.message || error || 'Falha na IA');

  if (error instanceof AiUnavailableError) {
    return {
      status: 503,
      body: { error: 'IA não configurada no servidor', unavailable: true },
    };
  }

  const provider429 = message.match(/\b429\b/) || /rate.?limit|too many requests|quota/i.test(message);
  if (provider429) {
    return {
      status: 429,
      body: {
        error: `O provedor de IA recusou a requisição por limite de uso. Tente novamente em alguns minutos. Detalhe: ${message}`,
        retryAfterMinutes: 5,
        providerStatus: 429,
      },
    };
  }

  if (isAbortError(error) || /timeout|tempo limite|não respondeu/i.test(message)) {
    return {
      status: 504,
      body: { error: `Tempo limite do provedor de IA excedido. Detalhe: ${message}` },
    };
  }

  return { status: 502, body: { error: message } };
}
