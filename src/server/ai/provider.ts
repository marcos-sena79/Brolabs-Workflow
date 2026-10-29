import { GoogleGenAI } from '@google/genai';
import { query } from '../db';

const TIMEOUT_MS = 25000;
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
  } finally {
    clearTimeout(timer);
  }
}

/** Chama o provedor ativo com timeout de 25s e 1 retry (com espera de 1,5s) em 5xx/429. Lança AiFailedError. */
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
