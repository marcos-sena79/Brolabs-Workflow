import React from 'react';

/**
 * Renderizador Markdown leve e seguro (gera elementos React, nunca HTML cru).
 * Suporta: títulos (#, ##, ###), negrito, itálico, tachado, código inline,
 * blocos de código (```), listas (-, *, 1.), checklist (- [ ] / - [x]),
 * citações (>), linha horizontal (---) e links [texto](url).
 */

const SAFE_URL = /^(https?:\/\/|mailto:)/i;

const INLINE_RE =
  /(`[^`\n]+`)|(\*\*[^*\n]+?\*\*)|(~~[^~\n]+?~~)|(\*[^*\n]+?\*)|(_[^_\n]+?_)|(\[[^\]\n]+\]\([^)\s]+\))|(https?:\/\/[^\s<>()]+)/g;

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;
  INLINE_RE.lastIndex = 0;
  const re = new RegExp(INLINE_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    if (m[1]) {
      out.push(
        <code key={key} className="px-1 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700/70 font-mono text-[0.95em]">
          {tok.slice(1, -1)}
        </code>,
      );
    } else if (m[2]) {
      out.push(<strong key={key}>{renderInline(tok.slice(2, -2), key)}</strong>);
    } else if (m[3]) {
      out.push(<s key={key}>{renderInline(tok.slice(2, -2), key)}</s>);
    } else if (m[4] || m[5]) {
      out.push(<em key={key}>{renderInline(tok.slice(1, -1), key)}</em>);
    } else if (m[6]) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!;
      const href = lm[2];
      out.push(
        SAFE_URL.test(href) ? (
          <a key={key} href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline">
            {renderInline(lm[1], key)}
          </a>
        ) : (
          tok
        ),
      );
    } else if (m[7]) {
      out.push(
        <a key={key} href={tok} target="_blank" rel="noopener noreferrer" className="text-indigo-600 dark:text-indigo-400 underline break-all">
          {tok}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
};

const withBreaks = (lines: string[], keyPrefix: string): React.ReactNode[] =>
  lines.flatMap((line, idx) => [
    ...(idx > 0 ? [<br key={`${keyPrefix}-br-${idx}`} />] : []),
    ...renderInline(line, `${keyPrefix}-${idx}`),
  ]);

type ListKind = 'ul' | 'ol' | 'check';

const LIST_ITEM = {
  check: /^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/,
  ul: /^\s*[-*]\s+(.*)$/,
  ol: /^\s*\d+[.)]\s+(.*)$/,
};

const listKindOf = (line: string): ListKind | null => {
  if (LIST_ITEM.check.test(line)) return 'check';
  if (LIST_ITEM.ul.test(line)) return 'ul';
  if (LIST_ITEM.ol.test(line)) return 'ol';
  return null;
};

// --- Tabelas (sintaxe GFM) -------------------------------------------------

type Align = 'left' | 'center' | 'right' | undefined;

const TABLE_SEP = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;

/** Divide uma linha de tabela em células; `\|` é um pipe literal. */
export const splitTableRow = (line: string): string[] => {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells: string[] = [];
  let cur = '';
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '\\' && s[k + 1] === '|') {
      cur += '|';
      k++;
    } else if (s[k] === '|') {
      cells.push(cur.trim());
      cur = '';
    } else cur += s[k];
  }
  cells.push(cur.trim());
  return cells;
};

const isTableStart = (lines: string[], idx: number) =>
  idx + 1 < lines.length &&
  lines[idx].includes('|') &&
  lines[idx + 1].includes('|') &&
  TABLE_SEP.test(lines[idx + 1]) &&
  !TABLE_SEP.test(lines[idx]);

const alignOf = (sep: string): Align => {
  const t = sep.trim();
  const l = t.startsWith(':');
  const r = t.endsWith(':');
  return l && r ? 'center' : r ? 'right' : l ? 'left' : undefined;
};

const ALIGN_CLS: Record<string, string> = { left: 'text-left', center: 'text-center', right: 'text-right' };

const renderTable = (header: string[], aligns: Align[], rows: string[][], key: string) => {
  const cols = header.length;
  const norm = (r: string[]) => Array.from({ length: cols }, (_, c) => r[c] ?? '');
  const cell = 'border border-slate-200 dark:border-slate-700 px-2 py-1 align-top';
  return (
    <div key={key} className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left">
        <thead className="bg-slate-100 dark:bg-slate-800">
          <tr>
            {header.map((h, c) => (
              <th key={c} className={`${cell} font-semibold ${ALIGN_CLS[aligns[c] || 'left']}`}>
                {renderInline(h, `${key}-h${c}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="even:bg-slate-50/60 dark:even:bg-slate-800/30">
              {norm(r).map((v, c) => (
                <td key={c} className={`${cell} ${ALIGN_CLS[aligns[c] || 'left']}`}>
                  {renderInline(v, `${key}-${ri}-${c}`)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export const renderMarkdown = (source: string): React.ReactNode[] => {
  const lines = (source || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;
  let b = 0;

  while (i < lines.length) {
    const line = lines[i];
    const key = `b${b++}`;

    if (!line.trim()) {
      i++;
      continue;
    }

    // Bloco de código
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++; // fecha ```
      blocks.push(
        <pre key={key} className="p-2.5 rounded-md bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto whitespace-pre">
          {code.join('\n')}
        </pre>,
      );
      continue;
    }

    // Tabela
    if (isTableStart(lines, i)) {
      const header = splitTableRow(line);
      const aligns = splitTableRow(lines[i + 1]).map(alignOf);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitTableRow(lines[i++]));
      blocks.push(renderTable(header, aligns, rows, key));
      continue;
    }

    // Título
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls =
        level === 1
          ? 'text-base font-bold'
          : level === 2
            ? 'text-sm font-bold'
            : 'text-xs font-bold uppercase tracking-wide';
      const Tag = (`h${level + 2}`) as 'h3' | 'h4' | 'h5';
      blocks.push(
        <Tag key={key} className={`${cls} text-slate-900 dark:text-slate-100`}>
          {renderInline(h[2], key)}
        </Tag>,
      );
      i++;
      continue;
    }

    // Linha horizontal
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      blocks.push(<hr key={key} className="border-slate-200 dark:border-slate-700" />);
      i++;
      continue;
    }

    // Citação
    if (/^\s*>/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quote.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push(
        <blockquote key={key} className="border-l-4 border-indigo-300 dark:border-indigo-700 pl-3 text-slate-600 dark:text-slate-300 italic">
          {withBreaks(quote, key)}
        </blockquote>,
      );
      continue;
    }

    // Listas
    const kind = listKindOf(line);
    if (kind) {
      const items: React.ReactNode[] = [];
      let n = 0;
      while (i < lines.length && listKindOf(lines[i]) === kind) {
        const ik = `${key}-${n++}`;
        if (kind === 'check') {
          const cm = LIST_ITEM.check.exec(lines[i])!;
          const done = cm[1].toLowerCase() === 'x';
          items.push(
            <li key={ik} className="flex items-start gap-1.5 list-none">
              <input type="checkbox" checked={done} readOnly disabled className="mt-0.5 accent-indigo-600" />
              <span className={done ? 'line-through text-slate-400' : ''}>{renderInline(cm[2], ik)}</span>
            </li>,
          );
        } else {
          const content = (kind === 'ul' ? LIST_ITEM.ul : LIST_ITEM.ol).exec(lines[i])![1];
          items.push(<li key={ik}>{renderInline(content, ik)}</li>);
        }
        i++;
      }
      if (kind === 'ol') {
        blocks.push(<ol key={key} className="list-decimal pl-5 space-y-0.5">{items}</ol>);
      } else if (kind === 'ul') {
        blocks.push(<ul key={key} className="list-disc pl-5 space-y-0.5">{items}</ul>);
      } else {
        blocks.push(<ul key={key} className="space-y-0.5">{items}</ul>);
      }
      continue;
    }

    // Parágrafo: linhas consecutivas até linha vazia ou outro bloco
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*(-{3,}|\*{3,})\s*$/.test(lines[i]) &&
      !listKindOf(lines[i]) &&
      !isTableStart(lines, i)
    ) {
      para.push(lines[i++]);
    }
    blocks.push(<p key={key}>{withBreaks(para, key)}</p>);
  }

  return blocks;
};

export const MarkdownView: React.FC<{ source: string; className?: string }> = ({ source, className = '' }) => (
  <div className={`space-y-2 break-words ${className}`}>{renderMarkdown(source)}</div>
);
