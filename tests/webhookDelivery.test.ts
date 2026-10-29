import { describe, it, expect, afterEach } from 'vitest';
import {
  isUrlAllowed,
  buildPayload,
  nextAttemptState,
  verifyIncomingSignature,
  signIncoming,
  BACKOFF_MINUTES,
  MAX_ATTEMPTS,
} from '../src/server/webhooks/dispatcher';
import { integrationUpdateSchema } from '../src/server/validation';

describe('whitelist anti-SSRF (isUrlAllowed)', () => {
  afterEach(() => {
    delete process.env.WEBHOOK_ALLOWED_DOMAINS;
  });

  it('aceita hooks.slack.com', () => {
    expect(isUrlAllowed('https://hooks.slack.com/services/T00/B00/xxx').ok).toBe(true);
  });

  it('aceita domínios padrão de discord/teams e subdomínios', () => {
    expect(isUrlAllowed('https://discord.com/api/webhooks/1/abc').ok).toBe(true);
    expect(isUrlAllowed('https://cdn.discordapp.com/x').ok).toBe(true);
    expect(isUrlAllowed('https://webhook.office.com/webhookb2/abc').ok).toBe(true);
  });

  it('rejeita host fora da whitelist', () => {
    const r = isUrlAllowed('https://evil.example.com/hook');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/fora da whitelist/);
  });

  it('rejeita protocolo não http(s)', () => {
    expect(isUrlAllowed('ftp://hooks.slack.com/x').ok).toBe(false);
    expect(isUrlAllowed('nonsense').ok).toBe(false);
  });

  it('libera host extras via WEBHOOK_ALLOWED_DOMAINS', () => {
    process.env.WEBHOOK_ALLOWED_DOMAINS = '127.0.0.1, meuhook.empresa.br';
    expect(isUrlAllowed('http://127.0.0.1:3999/hook').ok).toBe(true);
    expect(isUrlAllowed('https://meuhook.empresa.br/x').ok).toBe(true);
    expect(isUrlAllowed('https://outro.empresa.br/x').ok).toBe(false);
  });
});

describe('formatos de mensagem por plataforma (buildPayload)', () => {
  const ctx = {
    eventType: 'task_completed' as const,
    message: 'Tarefa ABC-1 concluída',
    details: { taskKey: 'ABC-1' },
  };

  it('slack: text + blocks mrkdwn', () => {
    const p = buildPayload('slack', ctx, '#geral');
    expect(p).toMatchObject({ text: ctx.message, channel: '#geral' });
    expect((p.blocks as any[])[0]).toMatchObject({ type: 'section' });
  });

  it('discord: content + embeds', () => {
    const p = buildPayload('discord', ctx, 'alertas');
    expect(p.content).toBe(ctx.message);
    expect((p.embeds as any[])[0].description).toBe(ctx.message);
  });

  it('teams: MessageCard', () => {
    const p = buildPayload('teams', ctx);
    expect(p['@type']).toBe('MessageCard');
    expect(p.text).toBe(ctx.message);
  });

  it('custom: evento genérico com data', () => {
    const p = buildPayload('custom', ctx);
    expect(p).toMatchObject({ app: 'Brolabs Workflow', event: 'task_completed', data: ctx.details });
  });
});

describe('retry com backoff (nextAttemptState)', () => {
  it('antes do limite: pendente com backoff crescente', () => {
    const s1 = nextAttemptState(1);
    expect(s1.status).toBe('pending');
    expect(s1.nextAttemptAt).toBeInstanceOf(Date);
    const delay1 = s1.nextAttemptAt!.getTime() - Date.now();
    const delay2 = nextAttemptState(2).nextAttemptAt!.getTime() - Date.now();
    expect(Math.round(delay2 / 60000)).toBe(BACKOFF_MINUTES[1]);
    expect(Math.round(delay1 / 60000)).toBe(BACKOFF_MINUTES[0]);
  });

  it(`no limite (${MAX_ATTEMPTS} tentativas): failed sem novo agendamento`, () => {
    const s = nextAttemptState(MAX_ATTEMPTS);
    expect(s.status).toBe('failed');
    expect(s.nextAttemptAt).toBeNull();
  });
});

describe('assinatura HMAC do incoming (D3)', () => {
  const secret = 'segredo-de-teste';

  it('assinatura válida é aceita', () => {
    const body = JSON.stringify({ action: 'create', boardId: 'b1' });
    const ts = String(Math.floor(Date.now() / 1000));
    expect(verifyIncomingSignature(secret, ts, body, signIncoming(secret, ts, body)).ok).toBe(true);
  });

  it('assinatura inválida é rejeitada', () => {
    const body = '{"action":"create"}';
    const ts = String(Math.floor(Date.now() / 1000));
    const r = verifyIncomingSignature(secret, ts, body, 'sha256=' + 'ab'.repeat(32));
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/inválida/);
  });

  it('timestamp velho (replay) é rejeitado', () => {
    const body = '{"action":"create"}';
    const ts = String(Math.floor(Date.now() / 1000) - 3600);
    expect(verifyIncomingSignature(secret, ts, body, signIncoming(secret, ts, body)).ok).toBe(false);
  });

  it('assinatura ausente é rejeitada', () => {
    expect(verifyIncomingSignature(secret, String(Date.now()), '{}', undefined).ok).toBe(false);
  });
});

describe('integrationUpdateSchema (S2)', () => {
  it('aceita novos flags + memberHandles', () => {
    const parsed = integrationUpdateSchema.parse({
      enabled: true,
      notifyOnMention: true,
      notifyOnAssignment: false,
      memberHandles: { 'mem-1': '@silas' },
    });
    expect(parsed.memberHandles).toEqual({ 'mem-1': '@silas' });
  });

  it('rejeita enabled não-boolean', () => {
    expect(() => integrationUpdateSchema.parse({ enabled: 'yes' })).toThrow();
  });

  it('rejeita memberHandles com valor longo demais', () => {
    expect(() =>
      integrationUpdateSchema.parse({ memberHandles: { m: 'x'.repeat(101) } })
    ).toThrow();
  });
});
