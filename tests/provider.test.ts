import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AiUnavailableError,
  aiConfigured,
  aiModel,
  aiProvider,
  runAi,
} from '../src/server/ai/provider';

const ENV_KEYS = ['AI_PROVIDER', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY', 'OPENROUTER_MODEL', 'GEMINI_MODEL'] as const;

function clearEnv() {
  for (const k of ENV_KEYS) delete process.env[k];
}

beforeEach(clearEnv);
afterEach(() => {
  vi.unstubAllGlobals();
  clearEnv();
});

describe('aiProvider', () => {
  it('null quando nada configurado', () => {
    expect(aiProvider()).toBeNull();
    expect(aiConfigured()).toBe(false);
  });
  it('auto: só OpenRouter → openrouter; só Gemini → gemini; ambos → openrouter', () => {
    process.env.OPENROUTER_API_KEY = 'k1';
    expect(aiProvider()).toBe('openrouter');
    clearEnv();
    process.env.GEMINI_API_KEY = 'k2';
    expect(aiProvider()).toBe('gemini');
    process.env.OPENROUTER_API_KEY = 'k1';
    expect(aiProvider()).toBe('openrouter');
  });
  it('AI_PROVIDER explícito respeita a escolha', () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'k2';
    process.env.OPENROUTER_API_KEY = 'k1';
    expect(aiProvider()).toBe('gemini');
  });
  it('forçado sem a key correspondente → null', () => {
    process.env.AI_PROVIDER = 'openrouter';
    expect(aiProvider()).toBeNull();
    process.env.AI_PROVIDER = 'gemini';
    expect(aiProvider()).toBeNull();
  });
  it('AI_PROVIDER desconhecido cai no auto', () => {
    process.env.AI_PROVIDER = 'claude';
    process.env.OPENROUTER_API_KEY = 'k1';
    expect(aiProvider()).toBe('openrouter');
  });
});

describe('aiModel', () => {
  it('defaults e override por env', () => {
    process.env.OPENROUTER_API_KEY = 'k1';
    expect(aiModel()).toBe('openai/gpt-4o-mini');
    process.env.OPENROUTER_MODEL = 'meta/llama-3-70b';
    expect(aiModel()).toBe('meta/llama-3-70b');
    clearEnv();
    process.env.GEMINI_API_KEY = 'k2';
    expect(aiModel()).toBe('gemini-2.5-flash');
    process.env.GEMINI_MODEL = 'gemini-2.0-pro';
    expect(aiModel()).toBe('gemini-2.0-pro');
    clearEnv();
    expect(aiModel()).toBe('—');
  });
});

function openRouterResponse(content: string, status = 200): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('runAi (OpenRouter com fetch mockado)', () => {
  it('sucesso: extrai choices[0].message.content e envia auth/modelo', async () => {
    process.env.OPENROUTER_API_KEY = 'k1';
    const fetchMock = vi.fn().mockResolvedValue(openRouterResponse('olá mundo'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(runAi('prompt')).resolves.toBe('olá mundo');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect(init.headers.Authorization).toBe('Bearer k1');
    expect(init.headers['X-Title']).toBe('Brolabs Workflow');
    expect(JSON.parse(init.body).model).toBe('openai/gpt-4o-mini');
  });

  it('retry em 500: primeira falha, segunda sucesso', async () => {
    process.env.OPENROUTER_API_KEY = 'k1';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('boom', { status: 500 }))
      .mockImplementationOnce(() => openRouterResponse('ok no retry'));
    vi.stubGlobal('fetch', fetchMock);

    await expect(runAi('prompt')).resolves.toBe('ok no retry');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('429 persistente: 2 tentativas e lança AiFailedError', async () => {
    process.env.OPENROUTER_API_KEY = 'k1';
    const fetchMock = vi.fn(() => new Response('{}', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(runAi('prompt')).rejects.toThrowError(/OpenRouter HTTP 429/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('resposta vazia → AiFailedError', async () => {
    process.env.OPENROUTER_API_KEY = 'k1';
    vi.stubGlobal('fetch', vi.fn(() => openRouterResponse('   ')));

    await expect(runAi('prompt')).rejects.toThrowError('Resposta vazia do modelo');
  });

  it('sem provedor configurado → AiUnavailableError', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(runAi('prompt')).rejects.toBeInstanceOf(AiUnavailableError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
