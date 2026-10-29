/**
 * Item 8 (Onda 2) — resumo de comentários/worklogs com IA.
 *
 * Lógica pura (sem banco) para montar o contexto e os números do resumo:
 * o total de horas e o consolidado por pessoa são calculados **no servidor**,
 * para que o resumo possa ser conferido sem depender da IA.
 */

export const SUMMARY_MAX_COMMENT_CHARS = 400;
export const SUMMARY_MAX_COMMENTS = 40;
export const SUMMARY_MAX_WORKLOGS = 100;

export interface SummaryComment {
  authorName: string;
  text: string;
  createdAt?: string;
}

export interface SummaryWorklog {
  memberName: string;
  hours: number;
  date: string;
  comment?: string;
}

export interface SummarySource {
  comments: SummaryComment[];
  worklogs: SummaryWorklog[];
}

export interface WorklogStats {
  count: number;
  totalHours: number;
  hoursByMember: { name: string; hours: number }[];
}

export interface SummaryContext {
  context: string;
  truncated: boolean;
  stats: WorklogStats;
}

/** Consolida as horas por pessoa (soma exata dos apontamentos). */
export function computeWorklogStats(worklogs: SummaryWorklog[]): WorklogStats {
  const map = new Map<string, number>();
  let totalHours = 0;
  for (const w of worklogs) {
    const hours = Number(w.hours) || 0;
    totalHours += hours;
    const name = (w.memberName || 'Desconhecido').trim() || 'Desconhecido';
    map.set(name, (map.get(name) || 0) + hours);
  }
  const hoursByMember = [...map.entries()]
    .map(([name, hours]) => ({ name, hours: Math.round(hours * 100) / 100 }))
    .sort((a, b) => b.hours - a.hours);
  return {
    count: worklogs.length,
    totalHours: Math.round(totalHours * 100) / 100,
    hoursByMember,
  };
}

/** Sem comentários e sem worklogs não há o que resumir. */
export function isEmptySource(source: SummarySource): boolean {
  return source.comments.length === 0 && source.worklogs.length === 0;
}

/**
 * Monta o contexto textual do resumo (com truncamento sinalizado) e os números.
 * Comentários de visitante entram como "Visitante: nome".
 */
export function buildSummaryContext(source: SummarySource): SummaryContext {
  const stats = computeWorklogStats(source.worklogs);
  const truncated = source.comments.length > SUMMARY_MAX_COMMENTS || source.worklogs.length > SUMMARY_MAX_WORKLOGS;

  const comments = source.comments
    .slice(0, SUMMARY_MAX_COMMENTS)
    .map((c) => `- ${c.authorName}: ${String(c.text || '').slice(0, SUMMARY_MAX_COMMENT_CHARS)}`)
    .join('\n');

  const worklogs = source.worklogs
    .slice(0, SUMMARY_MAX_WORKLOGS)
    .map((w) => `- ${w.memberName}: ${w.hours}h em ${w.date}${w.comment ? ` — ${w.comment}` : ''}`)
    .join('\n');

  const perMember = stats.hoursByMember.map((h) => `- ${h.name}: ${h.hours}h`).join('\n') || '(nenhum)';

  const context = `COMENTÁRIOS:
${comments || '(nenhum)'}

APONTAMENTOS DE TEMPO:
${worklogs || '(nenhum)'}

TOTAL DE HORAS APONTADAS: ${stats.totalHours}
HORAS POR PESSOA:
${perMember}`;

  return { context, truncated, stats };
}
