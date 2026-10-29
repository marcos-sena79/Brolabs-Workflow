/**
 * Item 3 (Onda 2) — tarefa pública com comentários anônimos.
 *
 * Cobre: link ativo/expirado/revogado, payload sem PII, sanitização de HTML
 * (XSS), toggle de comentários, rate limit por IP e expiração do link.
 * Nenhum teste toca o banco real.
 */
import { describe, expect, it } from 'vitest';
import {
  PUBLIC_LINK_DEFAULT_DAYS,
  PUBLIC_LINK_MAX_DAYS,
  PUBLIC_TOKEN_PATTERN,
  VISITOR_BODY_MAX,
  VISITOR_COMMENT_LIMIT,
  buildPublicTaskPayload,
  containsEmailLike,
  isPublicLinkActive,
  redactEmails,
  resolveExpiryDays,
  sanitizeVisitorBody,
  sanitizeVisitorName,
  stripHtml,
  visitorCommentRateState,
} from '../src/server/publicTasks';

const TOKEN = 'a'.repeat(64);

describe('link público — ativação', () => {
  it('link válido (não expirado, não revogado) está ativo', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isPublicLinkActive({ token: TOKEN, expires_at: future })).toBe(true);
  });

  it('link expirado → inativo', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isPublicLinkActive({ token: TOKEN, expires_at: past })).toBe(false);
  });

  it('link revogado → inativo', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isPublicLinkActive({ token: TOKEN, expires_at: future, revoked_at: new Date().toISOString() })).toBe(false);
  });

  it('token malformado → inativo (nunca casa com o padrão)', () => {
    expect(isPublicLinkActive({ token: 'xyz', expires_at: new Date(Date.now() + 1000).toISOString() })).toBe(false);
    expect(PUBLIC_TOKEN_PATTERN.test('a'.repeat(64))).toBe(true);
    expect(PUBLIC_TOKEN_PATTERN.test('A'.repeat(64))).toBe(false);
  });

  it('sem link → inativo', () => {
    expect(isPublicLinkActive(null)).toBe(false);
  });
});

describe('expiração do link', () => {
  it('padrão de 90 dias quando não informado', () => {
    expect(resolveExpiryDays(undefined)).toBe(PUBLIC_LINK_DEFAULT_DAYS);
    expect(resolveExpiryDays(0)).toBe(PUBLIC_LINK_DEFAULT_DAYS);
    expect(resolveExpiryDays('abc')).toBe(PUBLIC_LINK_DEFAULT_DAYS);
  });

  it('valor informado é respeitado e limitado a 1 ano', () => {
    expect(resolveExpiryDays(30)).toBe(30);
    expect(resolveExpiryDays(10_000)).toBe(PUBLIC_LINK_MAX_DAYS);
  });
});

describe('sanitização (XSS) — conteúdo salvo como texto puro', () => {
  it('remove tags e scripts', () => {
    const out = stripHtml('<script>alert(1)</script>olá<b>mundo</b>');
    expect(out).not.toContain('<script');
    expect(out).not.toContain('<b>');
    expect(out).toContain('olá');
  });

  it('script inline vira texto inerte (sem tag executável)', () => {
    const out = stripHtml('<img src=x onerror="alert(1)">texto');
    expect(out).not.toContain('<img');
    expect(out).not.toContain('onerror="alert(1)"<');
  });

  it('nomes e corpos são saneados e limitados', () => {
    expect(sanitizeVisitorName('<b>Fulano</b>')).toBe('Fulano');
    expect(sanitizeVisitorName('')).toBe('Visitante');
    expect(sanitizeVisitorName(undefined)).toBe('Visitante');
    expect(sanitizeVisitorBody('<script>x()</script>oi').startsWith('<script')).toBe(false);
    expect(sanitizeVisitorBody('a'.repeat(VISITOR_BODY_MAX + 500)).length).toBe(VISITOR_BODY_MAX);
  });

  it('corpo vazio → string vazia (rejeitado pela API)', () => {
    expect(sanitizeVisitorBody('   ')).toBe('');
    expect(sanitizeVisitorBody(null)).toBe('');
  });
});

describe('payload público — sem PII', () => {
  const payload = buildPublicTaskPayload({
    id: 'task-1',
    key: 'BRO-1',
    title: 'Tarefa pública',
    description: 'Falar com ana@empresa.com sobre o prazo',
    priority: 'high',
    issueType: 'story',
    dueDate: '2026-11-01',
    storyPoints: 3,
    tags: ['backlog'],
    subtasks: [{ title: 'Sub 1', completed: true }],
    assigneeNames: ['Ana Souza'],
    statusTitle: 'A Fazer',
  });

  it('não expõe e-mails (redige no texto)', () => {
    expect(payload.description).not.toContain('ana@empresa.com');
    expect(containsEmailLike(payload.description)).toBe(false);
  });

  it('redactEmails substitui o e-mail', () => {
    expect(redactEmails('a@b.com')).not.toContain('a@b.com');
  });

  it('não expõe anexos nem campos internos', () => {
    const json = JSON.stringify(payload);
    expect(json).not.toContain('attachments');
    expect(json).not.toContain('assigneeId');
    expect(json).not.toContain('memberId');
    expect(json).not.toContain('passwordHash');
  });

  it('mantém apenas nomes de responsáveis (sem ids/e-mails)', () => {
    expect(payload.assigneeNames).toEqual(['Ana Souza']);
    expect(JSON.stringify(payload)).not.toContain('@');
  });
});

describe('rate limit de comentários anônimos', () => {
  it('permite até o limite e bloqueia depois', () => {
    expect(visitorCommentRateState(0).allowed).toBe(true);
    expect(visitorCommentRateState(VISITOR_COMMENT_LIMIT - 1).allowed).toBe(true);
    const blocked = visitorCommentRateState(VISITOR_COMMENT_LIMIT);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMinutes).toBeGreaterThan(0);
  });
});
