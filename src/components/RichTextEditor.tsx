import React, { useRef, useState } from 'react';
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Code,
  Link as LinkIcon,
  Table,
  Eye,
  Pencil,
} from 'lucide-react';
import { MarkdownView } from '../utils/markdown';
import { htmlToMarkdown } from '../utils/htmlToMarkdown';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}

type Mode = 'edit' | 'preview';

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ value, onChange, placeholder, rows = 6 }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  /** true quando o usuário usou Ctrl+Shift+V (colar como texto puro). */
  const plainPasteRef = useRef(false);
  const [mode, setMode] = useState<Mode>(value?.trim() ? 'preview' : 'edit');

  const restoreSelection = (start: number, end: number) => {
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
    });
  };

  /** Envolve a seleção com marcadores (ex.: **negrito**). Alterna se já estiver envolvida. */
  const wrap = (before: string, after = before, fallback = 'texto') => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const text = value || '';
    const selected = text.slice(s, e);

    if (text.slice(s - before.length, s) === before && text.slice(e, e + after.length) === after) {
      const next = text.slice(0, s - before.length) + selected + text.slice(e + after.length);
      onChange(next);
      restoreSelection(s - before.length, e - before.length);
      return;
    }

    const inner = selected || fallback;
    const next = text.slice(0, s) + before + inner + after + text.slice(e);
    onChange(next);
    restoreSelection(s + before.length, s + before.length + inner.length);
  };

  /** Aplica (ou remove) um prefixo em cada linha selecionada (ex.: "- ", "> "). */
  const prefixLines = (prefix: string | ((idx: number) => string), matcher: RegExp) => {
    const el = ref.current;
    if (!el) return;
    const text = value || '';
    const { selectionStart: s, selectionEnd: e } = el;
    const lineStart = text.lastIndexOf('\n', s - 1) + 1;
    const nl = text.indexOf('\n', e);
    const lineEnd = nl === -1 ? text.length : nl;
    const lines = text.slice(lineStart, lineEnd).split('\n');
    const allHave = lines.every((l) => matcher.test(l));
    const updated = lines
      .map((l, idx) => (allHave ? l.replace(matcher, '') : (typeof prefix === 'function' ? prefix(idx) : prefix) + l.replace(matcher, '')))
      .join('\n');
    const next = text.slice(0, lineStart) + updated + text.slice(lineEnd);
    onChange(next);
    restoreSelection(lineStart, lineStart + updated.length);
  };

  const insertLink = () => {
    const el = ref.current;
    if (!el) return;
    const url = window.prompt('URL do link:', 'https://');
    if (!url) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const text = value || '';
    const label = text.slice(s, e) || 'link';
    const md = `[${label}](${url.trim()})`;
    onChange(text.slice(0, s) + md + text.slice(e));
    restoreSelection(s + 1, s + 1 + label.length);
  };

  const insertCode = () => {
    const el = ref.current;
    if (!el) return;
    const text = value || '';
    const selected = text.slice(el.selectionStart, el.selectionEnd);
    if (selected.includes('\n')) wrap('```\n', '\n```', 'código');
    else wrap('`', '`', 'código');
  };

  const insertTable = () => {
    const el = ref.current;
    if (!el) return;
    const text = value || '';
    const s = el.selectionEnd;
    const before = text.slice(0, s);
    const lead = !before ? '' : before.endsWith('\n\n') ? '' : before.endsWith('\n') ? '\n' : '\n\n';
    const tpl = '| Coluna 1 | Coluna 2 | Coluna 3 |\n| --- | --- | --- |\n|  |  |  |\n';
    const after = text.slice(s);
    const trail = after && !after.startsWith('\n') ? '\n' : '';
    onChange(before + lead + tpl + trail + after);
    const start = s + lead.length + 2;
    restoreSelection(start, start + 'Coluna 1'.length);
  };

  const tools: { icon: React.ElementType; title: string; action: () => void }[] = [
    { icon: Bold, title: 'Negrito (Ctrl+B)', action: () => wrap('**') },
    { icon: Italic, title: 'Itálico (Ctrl+I)', action: () => wrap('*') },
    { icon: Strikethrough, title: 'Tachado', action: () => wrap('~~') },
    { icon: Heading2, title: 'Título', action: () => prefixLines('## ', /^#{1,3}\s+/) },
    { icon: List, title: 'Lista', action: () => prefixLines('- ', /^\s*[-*]\s+(?!\[[ xX]\])/) },
    { icon: ListOrdered, title: 'Lista numerada', action: () => prefixLines((n) => `${n + 1}. `, /^\s*\d+[.)]\s+/) },
    { icon: ListChecks, title: 'Checklist', action: () => prefixLines('- [ ] ', /^\s*[-*]\s+\[[ xX]\]\s+/) },
    { icon: Quote, title: 'Citação', action: () => prefixLines('> ', /^\s*>\s?/) },
    { icon: Code, title: 'Código', action: insertCode },
    { icon: LinkIcon, title: 'Link (Ctrl+K)', action: insertLink },
    { icon: Table, title: 'Tabela', action: insertTable },
  ];

  /** Ao colar conteúdo rico (Word, Google Docs, web), converte o HTML para Markdown. */
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const plain = plainPasteRef.current;
    plainPasteRef.current = false;
    if (plain) return;

    const html = e.clipboardData.getData('text/html');
    if (!html) return;
    const md = htmlToMarkdown(html);
    if (!md) return;

    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = el;
    const text = value || '';
    onChange(text.slice(0, s) + md + text.slice(end));
    const caret = s + md.length;
    restoreSelection(caret, caret);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'v') {
      plainPasteRef.current = e.shiftKey;
    } else if (k === 'b') {
      e.preventDefault();
      wrap('**');
    } else if (k === 'i') {
      e.preventDefault();
      wrap('*');
    } else if (k === 'k') {
      e.preventDefault();
      insertLink();
    }
  };

  const tabCls = (active: boolean) =>
    `flex items-center gap-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
      active
        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-300 shadow-sm'
        : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
    }`;

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700/80 bg-slate-50 dark:bg-slate-800/60 focus-within:ring-2 focus-within:ring-indigo-500/30 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-1 px-1.5 py-1 border-b border-slate-200 dark:border-slate-700/80">
        <div className="flex flex-wrap items-center gap-0.5">
          {mode === 'edit' &&
            tools.map(({ icon: Icon, title, action }) => (
              <button
                key={title}
                type="button"
                title={title}
                aria-label={title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={action}
                className="p-1.5 rounded text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700"
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
            ))}
        </div>
        <div className="flex items-center gap-0.5 bg-slate-200/60 dark:bg-slate-900/60 rounded p-0.5">
          <button type="button" className={tabCls(mode === 'edit')} onClick={() => setMode('edit')}>
            <Pencil className="w-3 h-3" /> Editar
          </button>
          <button type="button" className={tabCls(mode === 'preview')} onClick={() => setMode('preview')}>
            <Eye className="w-3 h-3" /> Visualizar
          </button>
        </div>
      </div>

      {mode === 'edit' ? (
        <textarea
          ref={ref}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          title="Colar mantém a formatação (Word, Google Docs). Ctrl+Shift+V cola como texto puro."
          placeholder={placeholder}
          className="block w-full text-xs text-slate-800 dark:text-slate-200 bg-transparent p-3 focus:bg-white dark:focus:bg-slate-800 focus:outline-none resize-y font-mono leading-relaxed"
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          title="Clique para editar"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest('a')) return;
            setMode('edit');
            requestAnimationFrame(() => ref.current?.focus());
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setMode('edit');
          }}
          className="p-3 min-h-[6rem] cursor-text text-xs text-slate-800 dark:text-slate-200 leading-relaxed"
        >
          {value?.trim() ? (
            <MarkdownView source={value} />
          ) : (
            <span className="text-slate-400 italic">{placeholder || 'Sem descrição.'}</span>
          )}
        </div>
      )}
    </div>
  );
};
