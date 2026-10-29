/**
 * Item 7 (S2) — cobertura mockada da análise de tarefa com IA.
 *
 * Cobriu: sucesso, ausência de configuração, rate limit, 429 do provedor,
 * timeout e erro genérico — **sem depender de API externa**.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/server/db', () => ({
  query: vi.fn(),
  pool: { on: vi.fn() },
}));

import { query } from '../src/server/db';
import {
  AiFailedError,
  AiUnavailableError,
  checkAiRateLimit,
  logAiUsage,
  mapAiError,
  runAi,
} from '../src/server/ai/provider';

const q = vi.mocked(query);
const ENV_KEYS = ['AI_PROVIDER', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_MODEL'] as const;

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

beforeEach(() => {
  clearEnv();
  q.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  clearEnv();
});

function openRouterOk(content: string): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('runAi — timeout do provedor', () => {
  it('requisição pendente é abortada e gera erro legível, sem retry', async () => {
    process.env.OPENROUTER_API_KEY = 'k1';
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: any, init: any) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            reject(Object.assign(new Error('This operation was aborted'), { name: 'AbortError' }));
          });
        })
    );
    vi.stubGlobal('fetch', fetchMock);

    const promise = runAi('prompt');
    const assertion = expect(promise).rejects.toThrowError(/Timeout: o provedor não respondeu em 59s/);
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    // timeout não é retentável: 1 única chamada (sem dobrar latência)
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('mapAiError — erro apresentado claramente ao usuário', () => {
  it('IA não configurada → 503 com unavailable', () => {
    const mapped = mapAiError(new AiUnavailableError('IA não configurada'));
    expect(mapped.status).toBe(503);
    expect(mapped.body.unavailable).toBe(true);
    expect(mapped.body.error).toMatch(/não configurada/i);
  });

  it('429 do provedor → 429 com hint de nova tentativa', () => {
    const mapped = mapAiError(new AiFailedError('OpenRouter HTTP 429: Provider returned error'));
    expect(mapped.status).toBe(429);
    expect(mapped.body.retryAfterMinutes).toBeGreaterThan(0);
    expect(mapped.body.error).toMatch(/limite de uso/i);
  });

  it('timeout → 504 (gateway timeout) com detalhe', () => {
    const mapped = mapAiError(new AiFailedError('Timeout: o provedor não respondeu em 59s'));
    expect(mapped.status).toBe(504);
    expect(mapped.body.error).toMatch(/Tempo limite/i);
  });

  it('erro legítimo do provedor → 502 preservando o detalhe original', () => {
    const mapped = mapAiError(new AiFailedError('OpenRouter HTTP 500: upstream exploded'));
    expect(mapped.status).toBe(502);
    expect(mapped.body.error).toContain('upstream exploded');
  });

  it('erro desconhecido → 502 sem quebrar', () => {
    const mapped = mapAiError(new Error('boom'));
    expect(mapped.status).toBe(502);
    expect(mapped.body.error).toBe('boom');
  });
});

describe('checkAiRateLimit — 20 usos/h por membro', () => {
  it('dentro do limite → null (liberado)', async () => {
    q.mockResolvedValueOnce({ rows: [{ n: 7 }] } as any);
    await expect(checkAiRateLimit('mem-1')).resolves.toBeNull();
    expect(q).toHaveBeenCalledTimes(1);
  });

  it('no limite → data de liberação (bloqueio com 429 no endpoint)', async () => {
    q.mockResolvedValueOnce({ rows: [{ n: 20 }] } as any);
    q.mockResolvedValueOnce({ rows: [{ t: new Date('2026-10-29T10:00:00.000Z') }] } as any);
    const until = await checkAiRateLimit('mem-1');
    expect(until).toBeInstanceOf(Date);
    expect(until!.getTime()).toBeGreaterThan(0);
  });
});

describe('logAiUsage — auditoria de uso', () => {
  it('grava ação, tamanhos e status', async () => {
    q.mockResolvedValueOnce({ rows: [] } as any);
    await logAiUsage('mem-1', 'task_analyze', 120, 340, 'ok');
    expect(q).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_usage'),
      ['mem-1', 'task_analyze', 120, 340, 'ok']
    );
  });

  it('status rate_limited é aceito', async () => {
    q.mockResolvedValueOnce({ rows: [] } as any);
    await logAiUsage('mem-1', 'task_analyze', 0, 0, 'rate_limited');
    expect(q).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO ai_usage'),
      ['mem-1', 'task_analyze', 0, 0, 'rate_limited']
    );
  });
});
