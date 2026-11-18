import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  ExternalLink,
  Download,
  Copy,
  Check,
  GitCommit,
  GitBranch,
  FileWarning,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Globe,
  Paperclip,
} from 'lucide-react';
import { api } from '../services/api';
import { TaskAttachment, TaskCommit } from '../types';
import { MarkdownView } from '../utils/markdown';
import { parseCsv } from '../utils/csv';
import { safeHtmlToReact } from '../utils/safeHtml';
import { cellText } from '../utils/sheetCell';

export type ViewerItem =
  | { kind: 'link'; url: string; title?: string }
  | { kind: 'attachment'; taskId: string; attachment: TaskAttachment }
  | { kind: 'commit'; commit: TaskCommit };

const MAX_TABLE_ROWS = 1000;
const MAX_TABLE_COLS = 60;
const MAX_TEXT_CHARS = 500_000;

// ---------------------------------------------------------------------------
// Shell

export const InAppViewer: React.FC<{ item: ViewerItem | null; onClose: () => void }> = ({ item, onClose }) => {
  // Esc fecha só o visualizador (captura antes do atalho global que fecharia a tarefa)
  useEffect(() => {
    if (!item) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-xs flex items-stretch sm:items-center justify-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex flex-col w-full sm:max-w-6xl h-full sm:h-[90vh] bg-white dark:bg-slate-900 sm:rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {item.kind === 'link' && <LinkView url={item.url} title={item.title} onClose={onClose} />}
        {item.kind === 'commit' && <CommitView commit={item.commit} onClose={onClose} />}
        {item.kind === 'attachment' && (
          <AttachmentView key={item.attachment.id} taskId={item.taskId} attachment={item.attachment} onClose={onClose} />
        )}
      </div>
    </div>
  );
};

const Header: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children?: React.ReactNode;
}> = ({ icon, title, subtitle, onClose, children }) => (
  <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 shrink-0">
    <span className="text-slate-500 shrink-0">{icon}</span>
    <div className="min-w-0 flex-1">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={title}>
        {title}
      </p>
      {subtitle && <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{subtitle}</p>}
    </div>
    <div className="flex items-center gap-1 shrink-0">{children}</div>
    <button
      type="button"
      onClick={onClose}
      className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:hover:text-slate-100 dark:hover:bg-slate-800"
      title="Fechar (Esc)"
      aria-label="Fechar"
    >
      <X className="w-4 h-4" />
    </button>
  </div>
);

const HeaderButton: React.FC<{ onClick?: () => void; href?: string; title: string; children: React.ReactNode }> = ({
  onClick,
  href,
  title,
  children,
}) => {
  const cls =
    'flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800';
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} title={title}>
      {children}
    </a>
  ) : (
    <button type="button" onClick={onClick} className={cls} title={title}>
      {children}
    </button>
  );
};

const CopyButton: React.FC<{ value: string; label?: string }> = ({ value, label = 'Copiar' }) => {
  const [copied, setCopied] = useState(false);
  return (
    <HeaderButton
      title={label}
      onClick={() => {
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      <span className="hidden sm:inline">{copied ? 'Copiado' : label}</span>
    </HeaderButton>
  );
};

// ---------------------------------------------------------------------------
// Links

const LinkView: React.FC<{ url: string; title?: string; onClose: () => void }> = ({ url, title, onClose }) => {
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const host = useMemo(() => {
    try {
      return new URL(url).host;
    } catch {
      return url;
    }
  }, [url]);

  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 4000);
    return () => clearTimeout(t);
  }, [url]);

  return (
    <>
      <Header icon={<Globe className="w-4 h-4" />} title={title || host} subtitle={url} onClose={onClose}>
        <CopyButton value={url} label="Copiar link" />
        <HeaderButton href={url} title="Abrir em nova aba">
          <ExternalLink className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Nova aba</span>
        </HeaderButton>
      </Header>
      <div
        className={`px-4 py-1.5 text-[11px] border-b shrink-0 ${
          slow && !loaded
            ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
            : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900 dark:text-slate-400 dark:border-slate-800'
        }`}
      >
        Se o conteúdo não aparecer, o site não permite ser exibido dentro de outras páginas.{' '}
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
          Abrir em nova aba
        </a>
      </div>
      <iframe
        src={url}
        title={title || host}
        onLoad={() => setLoaded(true)}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads"
        referrerPolicy="no-referrer"
        className="flex-1 w-full bg-white"
      />
    </>
  );
};

// ---------------------------------------------------------------------------
// Commits (somente dados já salvos pelo webhook)

const CommitView: React.FC<{ commit: TaskCommit; onClose: () => void }> = ({ commit, onClose }) => {
  const [firstLine, ...rest] = commit.message.split('\n');
  const body = rest.join('\n').trim();
  const when = commit.committedAt || commit.createdAt;
  return (
    <>
      <Header
        icon={<GitCommit className="w-4 h-4" />}
        title={firstLine || commit.sha.slice(0, 7)}
        subtitle={[commit.repo, commit.branch].filter(Boolean).join(' · ')}
        onClose={onClose}
      >
        <CopyButton value={commit.sha} label="Copiar SHA" />
        {commit.url && (
          <HeaderButton href={commit.url} title="O GitHub não permite exibição incorporada; abre em nova aba">
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Ver no GitHub</span>
          </HeaderButton>
        )}
      </Header>
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-3">
          {commit.authorAvatar ? (
            <img src={commit.authorAvatar} alt={commit.author || ''} className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
              <GitCommit className="w-5 h-5 text-slate-400" />
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{commit.author || 'Autor desconhecido'}</p>
            {when && (
              <p className="text-xs text-slate-500">
                {new Date(when).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Repositório</dt>
            <dd className="mt-1 font-mono text-slate-700 dark:text-slate-200 break-all">{commit.repo || '—'}</dd>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
              <GitBranch className="w-3 h-3" /> Branch
            </dt>
            <dd className="mt-1 font-mono text-slate-700 dark:text-slate-200 break-all">{commit.branch || '—'}</dd>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60">
            <dt className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">SHA</dt>
            <dd className="mt-1 font-mono text-slate-700 dark:text-slate-200 break-all">{commit.sha}</dd>
          </div>
        </dl>

        <div>
          <h4 className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5">Mensagem</h4>
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-900">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 break-words">{firstLine}</p>
            {body && (
              <pre className="mt-2 text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap break-words font-sans leading-relaxed">
                {body}
              </pre>
            )}
          </div>
        </div>

        <p className="text-[11px] text-slate-400">
          Arquivos alterados e o diff ficam disponíveis no GitHub (ele não permite ser exibido dentro de outras páginas).
        </p>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Anexos

type PreviewKind = 'image' | 'pdf' | 'text' | 'markdown' | 'csv' | 'docx' | 'xlsx' | 'none';

const previewKindOf = (a: TaskAttachment): PreviewKind => {
  const ext = (a.originalName.split('.').pop() || '').toLowerCase();
  const mime = (a.mimeType || '').toLowerCase();
  if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) return 'image';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  if (ext === 'md') return 'markdown';
  if (ext === 'csv' || mime === 'text/csv') return 'csv';
  if (ext === 'txt' || mime.startsWith('text/')) return 'text';
  if (ext === 'docx') return 'docx';
  if (ext === 'xlsx') return 'xlsx';
  return 'none';
};

type Loaded =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'image' | 'pdf'; src: string }
  | { state: 'text' | 'markdown'; text: string; truncated: boolean }
  | { state: 'table'; sheets: { name: string; rows: string[][]; truncated: boolean }[] }
  | { state: 'html'; nodes: React.ReactNode[]; warnings: number }
  | { state: 'none' };

const fetchBuffer = async (url: string): Promise<ArrayBuffer> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.arrayBuffer();
};

const decodeText = (buf: ArrayBuffer): string => {
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  // Arquivos do Excel/Bloco de Notas em Windows-1252 geram muitos "�" em UTF-8
  const bad = (utf8.match(/�/g) || []).length;
  if (bad > 0 && bad / Math.max(1, utf8.length) > 0.001) {
    try {
      return new TextDecoder('windows-1252').decode(buf);
    } catch {
      /* mantém utf-8 */
    }
  }
  return utf8;
};

const loadXlsx = async (buf: ArrayBuffer) => {
  const mod: any = await import('exceljs');
  const ExcelJS = mod.default ?? mod;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheets: { name: string; rows: string[][]; truncated: boolean }[] = [];
  wb.eachSheet((ws: any) => {
    const rows: string[][] = [];
    let truncated = false;
    const colCount = Math.min(ws.actualColumnCount || ws.columnCount || 0, MAX_TABLE_COLS);
    if (ws.columnCount > MAX_TABLE_COLS) truncated = true;
    ws.eachRow({ includeEmpty: true }, (row: any, rowNumber: number) => {
      if (rowNumber > MAX_TABLE_ROWS) {
        truncated = true;
        return;
      }
      const cells: string[] = [];
      for (let c = 1; c <= colCount; c++) {
        cells.push(cellText(row.getCell(c)));
      }
      rows.push(cells);
    });
    // remove linhas vazias do fim
    while (rows.length && rows[rows.length - 1].every((v) => !v)) rows.pop();
    sheets.push({ name: ws.name, rows, truncated });
  });
  return sheets;
};

const loadDocx = async (buf: ArrayBuffer) => {
  const mod: any = await import('mammoth');
  const mammoth = mod.default ?? mod;
  const result = await mammoth.convertToHtml({ arrayBuffer: buf });
  return { nodes: safeHtmlToReact(result.value as string), warnings: (result.messages || []).length };
};

const AttachmentView: React.FC<{ taskId: string; attachment: TaskAttachment; onClose: () => void }> = ({
  taskId,
  attachment,
  onClose,
}) => {
  const kind = previewKindOf(attachment);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [sheetIdx, setSheetIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setLoaded({ state: 'loading' });

    (async () => {
      try {
        const url = await api.getTaskAttachmentUrl(taskId, attachment.id);
        if (cancelled) return;
        setSignedUrl(url);

        if (kind === 'none') return setLoaded({ state: 'none' });
        if (kind === 'image') return setLoaded({ state: 'image', src: url });

        let buf: ArrayBuffer;
        try {
          buf = await fetchBuffer(url);
        } catch {
          // Sem CORS no storage: PDF ainda pode abrir pela URL assinada direto
          if (kind === 'pdf') return !cancelled && setLoaded({ state: 'pdf', src: url });
          throw new Error('Não foi possível carregar o arquivo para pré-visualização.');
        }
        if (cancelled) return;

        if (kind === 'pdf') {
          objectUrl = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }));
          return setLoaded({ state: 'pdf', src: objectUrl });
        }
        if (kind === 'text' || kind === 'markdown') {
          const text = decodeText(buf);
          return setLoaded({
            state: kind,
            text: text.slice(0, MAX_TEXT_CHARS),
            truncated: text.length > MAX_TEXT_CHARS,
          });
        }
        if (kind === 'csv') {
          const rows = parseCsv(decodeText(buf), MAX_TABLE_ROWS + 1);
          const truncated = rows.length > MAX_TABLE_ROWS;
          return setLoaded({
            state: 'table',
            sheets: [{ name: attachment.originalName, rows: rows.slice(0, MAX_TABLE_ROWS), truncated }],
          });
        }
        if (kind === 'docx') {
          const { nodes, warnings } = await loadDocx(buf);
          return !cancelled && setLoaded({ state: 'html', nodes, warnings });
        }
        if (kind === 'xlsx') {
          const sheets = await loadXlsx(buf);
          return !cancelled && setLoaded({ state: 'table', sheets });
        }
      } catch (err: any) {
        if (!cancelled) setLoaded({ state: 'error', message: err?.message || 'Falha ao carregar o anexo.' });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [taskId, attachment.id, kind, attempt, attachment.originalName]);

  const sizeLabel =
    attachment.sizeBytes < 1024 * 1024
      ? `${(attachment.sizeBytes / 1024).toFixed(1)} KB`
      : `${(attachment.sizeBytes / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <>
      <Header
        icon={<Paperclip className="w-4 h-4" />}
        title={attachment.originalName}
        subtitle={sizeLabel}
        onClose={onClose}
      >
        {loaded.state === 'image' && (
          <HeaderButton onClick={() => setZoomed((z) => !z)} title={zoomed ? 'Ajustar à tela' : 'Tamanho real'}>
            {zoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
          </HeaderButton>
        )}
        {signedUrl && (
          <HeaderButton href={signedUrl} title="Baixar arquivo">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Baixar</span>
          </HeaderButton>
        )}
      </Header>

      <div className="flex-1 min-h-0 overflow-auto bg-slate-100 dark:bg-slate-950">
        {loaded.state === 'loading' && (
          <div className="h-full flex items-center justify-center gap-2 text-sm text-slate-500">
            <RefreshCw className="w-4 h-4 animate-spin" /> Carregando pré-visualização…
          </div>
        )}

        {(loaded.state === 'error' || loaded.state === 'none') && (
          <div className="h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
            <FileWarning className="w-10 h-10 text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md">
              {loaded.state === 'none'
                ? 'Pré-visualização indisponível para este tipo de arquivo.'
                : loaded.message}
            </p>
            <div className="flex gap-2">
              {loaded.state === 'error' && (
                <button
                  type="button"
                  onClick={() => setAttempt((n) => n + 1)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800"
                >
                  Tentar novamente
                </button>
              )}
              {signedUrl && (
                <a
                  href={signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold rounded-md bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" /> Baixar
                </a>
              )}
            </div>
          </div>
        )}

        {loaded.state === 'image' && (
          <div className={`min-h-full p-4 flex ${zoomed ? 'items-start justify-start' : 'items-center justify-center'}`}>
            <img
              src={loaded.src}
              alt={attachment.originalName}
              onClick={() => setZoomed((z) => !z)}
              className={zoomed ? 'max-w-none cursor-zoom-out' : 'max-w-full max-h-[78vh] object-contain cursor-zoom-in'}
            />
          </div>
        )}

        {loaded.state === 'pdf' && <iframe src={loaded.src} title={attachment.originalName} className="w-full h-full bg-white" />}

        {loaded.state === 'text' && (
          <div className="p-4">
            <pre className="text-xs font-mono whitespace-pre-wrap break-words text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-4 rounded-lg border border-slate-200 dark:border-slate-800">
              {loaded.text}
            </pre>
            {loaded.truncated && <TruncatedNote />}
          </div>
        )}

        {loaded.state === 'markdown' && (
          <div className="p-4 sm:p-6">
            <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800">
              <MarkdownView source={loaded.text} className="text-sm leading-relaxed text-slate-800 dark:text-slate-200" />
            </div>
            {loaded.truncated && <TruncatedNote />}
          </div>
        )}

        {loaded.state === 'table' && (
          <SheetTabs sheets={loaded.sheets} active={Math.min(sheetIdx, loaded.sheets.length - 1)} onSelect={setSheetIdx} />
        )}

        {loaded.state === 'html' && (
          <div className="p-4 sm:p-6">
            <article className="docx-preview max-w-3xl mx-auto bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 p-6 sm:p-10 rounded-lg border border-slate-200 dark:border-slate-800 text-sm leading-relaxed">
              {loaded.nodes}
            </article>
            <p className="max-w-3xl mx-auto mt-2 text-[11px] text-slate-400">
              Pré-visualização simplificada: fontes, cores e layout de página podem diferir do Word. Baixe o arquivo para ver o original.
            </p>
          </div>
        )}
      </div>
    </>
  );
};

const TruncatedNote = () => (
  <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
    Arquivo grande: exibindo apenas o início. Baixe o arquivo para ver o conteúdo completo.
  </p>
);

const SheetTabs: React.FC<{
  sheets: { name: string; rows: string[][]; truncated: boolean }[];
  active: number;
  onSelect: (i: number) => void;
}> = ({ sheets, active, onSelect }) => {
  const sheet = sheets[active];
  if (!sheet) return <p className="p-6 text-sm text-slate-500">Planilha vazia.</p>;
  const cols = Math.max(0, ...sheet.rows.map((r) => r.length));
  const pad = (r: string[]) => Array.from({ length: cols }, (_, i) => r[i] ?? '');
  const [header, ...body] = sheet.rows;

  return (
    <div className="flex flex-col h-full">
      {sheets.length > 1 && (
        <div className="flex gap-1 px-3 pt-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-x-auto shrink-0">
          {sheets.map((s, i) => (
            <button
              key={s.name + i}
              type="button"
              onClick={() => onSelect(i)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-t-md border-b-2 whitespace-nowrap ${
                i === active
                  ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
      <div className="flex-1 overflow-auto p-3">
        {sheet.rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Planilha vazia.</p>
        ) : (
          <table className="border-collapse text-xs bg-white dark:bg-slate-900">
            <thead className="sticky top-0 z-10">
              <tr>
                <th className="sticky left-0 bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-1 text-slate-500 font-mono">
                  #
                </th>
                {pad(header || []).map((h, i) => (
                  <th
                    key={i}
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 px-2 py-1 text-left font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((r, ri) => (
                <tr key={ri} className="even:bg-slate-50 dark:even:bg-slate-800/40">
                  <td className="sticky left-0 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-1 text-slate-400 font-mono text-right">
                    {ri + 2}
                  </td>
                  {pad(r).map((v, ci) => (
                    <td
                      key={ci}
                      className="border border-slate-200 dark:border-slate-700 px-2 py-1 text-slate-700 dark:text-slate-200 align-top max-w-[24rem] whitespace-pre-wrap break-words"
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {sheet.truncated && (
          <p className="mt-2 text-[11px] text-amber-700 dark:text-amber-400">
            Exibindo até {MAX_TABLE_ROWS} linhas e {MAX_TABLE_COLS} colunas. Baixe o arquivo para ver tudo.
          </p>
        )}
      </div>
    </div>
  );
};
