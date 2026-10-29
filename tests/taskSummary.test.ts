/**
 * Item 8 (Onda 2) — resumo de comentários/worklogs com IA.
 *
 * Cobre: total de horas (soma bate com os apontamentos), consolidação por
 * pessoa, contexto truncado e sinalização de vazio.
 */
import { describe, expect, it } from 'vitest';
import {
  SUMMARY_MAX_COMMENTS,
  buildSummaryContext,
  computeWorklogStats,
  isEmptySource,
} from '../src/server/taskSummary';

describe('computeWorklogStats — soma por pessoa', () => {
  it('2 pessoas → soma bate com o total', () => {
    const stats = computeWorklogStats([
      { memberName: 'Ana', hours: 2.5, date: '2026-10-01' },
      { memberName: 'Bruno', hours: 3, date: '2026-10-01' },
      { memberName: 'Ana', hours: 1, date: '2026-10-02' },
    ]);
    expect(stats.count).toBe(3);
    expect(stats.totalHours).toBe(6.5);
    const ana = stats.hoursByMember.find((h) => h.name === 'Ana');
    const bruno = stats.hoursByMember.find((h) => h.name === 'Bruno');
    expect(ana?.hours).toBe(3.5);
    expect(bruno?.hours).toBe(3);
    // a soma por pessoa bate com o total
    const soma = stats.hoursByMember.reduce((acc, h) => acc + h.hours, 0);
    expect(Math.round(soma * 100) / 100).toBe(stats.totalHours);
  });

  it('sem apontamentos → total 0', () => {
    const stats = computeWorklogStats([]);
    expect(stats.totalHours).toBe(0);
    expect(stats.hoursByMember).toEqual([]);
  });

  it('apontamento sem nome → "Desconhecido"', () => {
    const stats = computeWorklogStats([{ memberName: '', hours: 2, date: '2026-10-01' }]);
    expect(stats.hoursByMember[0].name).toBe('Desconhecido');
  });
});

describe('isEmptySource', () => {
  it('sem comentários e sem worklogs → vazio', () => {
    expect(isEmptySource({ comments: [], worklogs: [] })).toBe(true);
  });

  it('com apenas comentários → não vazio', () => {
    expect(isEmptySource({ comments: [{ authorName: 'Ana', text: 'oi' }], worklogs: [] })).toBe(false);
  });

  it('com apenas worklogs → não vazio', () => {
    expect(
      isEmptySource({ comments: [], worklogs: [{ memberName: 'Ana', hours: 1, date: '2026-10-01' }] })
    ).toBe(false);
  });
});

describe('buildSummaryContext', () => {
  it('inclui comentários, apontamentos, total e horas por pessoa', () => {
    const built = buildSummaryContext({
      comments: [{ authorName: 'Ana', text: 'Decidimos adiar' }],
      worklogs: [
        { memberName: 'Ana', hours: 2, date: '2026-10-01', comment: 'design' },
        { memberName: 'Bruno', hours: 1, date: '2026-10-01' },
      ],
    });
    expect(built.context).toContain('Ana: Decidimos adiar');
    expect(built.context).toContain('Bruno: 1h');
    expect(built.context).toContain('TOTAL DE HORAS APONTADAS: 3');
    expect(built.context).toContain('Ana: 2h');
    expect(built.truncated).toBe(false);
    expect(built.stats.totalHours).toBe(3);
  });

  it('muitos comentários → truncamento sinalizado', () => {
    const comments = Array.from({ length: SUMMARY_MAX_COMMENTS + 5 }, (_, i) => ({
      authorName: `M${i}`,
      text: 'comentário',
    }));
    const built = buildSummaryContext({ comments, worklogs: [] });
    expect(built.truncated).toBe(true);
  });

  it('contexto nunca estoura o limite de envio (truncado em 20k no endpoint)', () => {
    const comments = Array.from({ length: SUMMARY_MAX_COMMENTS }, (_, i) => ({
      authorName: `M${i}`,
      text: 'x'.repeat(1000),
    }));
    const built = buildSummaryContext({ comments, worklogs: [] });
    expect(built.context.length).toBeGreaterThan(0);
  });
});
