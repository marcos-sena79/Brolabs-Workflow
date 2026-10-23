import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, ArrowUp, ArrowDown, CheckCircle2, Circle, Globe, Link2, Copy, Check } from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { api } from '../services/api';
import { BoardShareInfo, Column } from '../types';

const PRESET_COLORS = ['#64748b', '#3b82f6', '#eab308', '#8b5cf6', '#10b981', '#ef4444', '#ec4899', '#06b6d4'];

export const BoardSettingsModal: React.FC = () => {
  const {
    isBoardSettingsOpen,
    setIsBoardSettingsOpen,
    currentBoard,
    boardTasks,
    addColumn,
    updateColumn,
    reorderColumns,
    deleteColumn,
    refetchDbData,
  } = useAgile();

  const [newTitle, setNewTitle] = useState('');
  const [newColor, setNewColor] = useState('#64748b');
  const [newWip, setNewWip] = useState('');
  const [newIsDone, setNewIsDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deletingColumnId, setDeletingColumnId] = useState<string | null>(null);
  const [reassignTarget, setReassignTarget] = useState('');
  const [share, setShare] = useState<BoardShareInfo | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareError, setShareError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isBoardSettingsOpen || !currentBoard?.id) return;
    let cancelled = false;
    setShareError('');
    api
      .getBoardShare(currentBoard.id)
      .then((s) => {
        if (!cancelled) setShare(s);
      })
      .catch((err) => {
        if (!cancelled) setShareError(err?.message || 'Falha ao carregar link público');
      });
    return () => {
      cancelled = true;
    };
  }, [isBoardSettingsOpen, currentBoard?.id]);

  if (!isBoardSettingsOpen) return null;

  const columns = [...currentBoard.columns].sort((a, b) => a.order - b.order);

  const handleVersionError = async (err: any) => {
    if (err?.message?.includes('modificado por outro usuário') || err?.message?.includes('409')) {
      await refetchDbData();
    }
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err: any) {
      await handleVersionError(err);
    } finally {
      setBusy(false);
    }
  };

  const handleAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    run(async () => {
      await addColumn({
        title,
        accentColor: newColor,
        wipLimit: newWip ? parseInt(newWip, 10) : null,
        isDone: newIsDone,
      });
      setNewTitle('');
      setNewWip('');
      setNewIsDone(false);
    });
  };

  const handleMove = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;
    const order = columns.map((c) => c.id);
    [order[index], order[target]] = [order[target], order[index]];
    run(() => reorderColumns(order));
  };

  const handleDeleteClick = (col: Column) => {
    const count = boardTasks.filter((t) => t.statusId === col.id).length;
    if (count === 0) {
      if (confirm(`Remover a coluna "${col.title}"?`)) {
        setDeletingColumnId(null);
        run(() => deleteColumn(col.id));
      }
      return;
    }
    setDeletingColumnId(col.id);
    setReassignTarget('');
  };

  const confirmDeleteWithReassign = () => {
    if (!deletingColumnId || !reassignTarget) return;
    run(async () => {
      await deleteColumn(deletingColumnId, reassignTarget);
      setDeletingColumnId(null);
      setReassignTarget('');
    });
  };

  const isPublic = share?.visibility === 'public';

  const runShare = async (fn: () => Promise<void>) => {
    setShareBusy(true);
    setShareError('');
    try {
      await fn();
    } catch (err: any) {
      setShareError(err?.message || 'Falha na operação do link público');
    } finally {
      setShareBusy(false);
    }
  };

  const handleToggleShare = () =>
    runShare(async () => {
      if (isPublic) {
        await api.revokeBoardShare(currentBoard.id);
        setShare({ visibility: 'private', token: null, url: null, expiresAt: null });
      } else {
        setShare(await api.createBoardShare(currentBoard.id));
      }
    });

  const handleRevokeShare = () =>
    runShare(async () => {
      await api.revokeBoardShare(currentBoard.id);
      setShare({ visibility: 'private', token: null, url: null, expiresAt: null });
    });

  const handleCopyLink = async () => {
    if (!share?.url) return;
    try {
      await navigator.clipboard.writeText(share.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareError('Não foi possível copiar — copie manualmente');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl my-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Colunas do Quadro
            </h3>
            <p className="text-[11px] text-slate-400">
              {currentBoard.name} — personalize etapas, limites WIP e ordem do fluxo
            </p>
          </div>
          <button
            onClick={() => setIsBoardSettingsOpen(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Columns list */}
        <div className="space-y-2">
          {columns.map((col, index) => (
            <div
              key={col.id}
              className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="w-3 h-3 rounded-full shrink-0 ring-1 ring-slate-900/10 dark:ring-white/20"
                  style={{ backgroundColor: col.accentColor }}
                />
                <input
                  defaultValue={col.title}
                  onBlur={(e) => {
                    const title = e.target.value.trim();
                    if (title && title !== col.title) {
                      run(() => updateColumn(col.id, { title }));
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                  }}
                  className="text-xs font-semibold px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
                  disabled={busy}
                />
                <label className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  WIP máx:
                  <input
                    type="number"
                    min={1}
                    defaultValue={col.wipLimit ?? ''}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      const wipLimit = val ? parseInt(val, 10) : null;
                      const current = col.wipLimit ?? null;
                      if (wipLimit !== current && (wipLimit === null || !isNaN(wipLimit))) {
                        run(() => updateColumn(col.id, { wipLimit }));
                      }
                    }}
                    className="w-16 px-1.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    disabled={busy}
                  />
                </label>

                <button
                  onClick={() =>
                    run(() => updateColumn(col.id, col.isDone ? { isDone: false } : { isDone: true }))
                  }
                  className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded transition-colors ${
                    col.isDone
                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                      : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                  title="Marcar como coluna de conclusão"
                  disabled={busy}
                >
                  {col.isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                  Concluído
                </button>

                <div className="flex items-center gap-0.5 ml-auto">
                  <button
                    onClick={() => handleMove(index, -1)}
                    disabled={busy || index === 0}
                    className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 rounded"
                    title="Mover para esquerda"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMove(index, 1)}
                    disabled={busy || index === columns.length - 1}
                    className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 rounded"
                    title="Mover para direita"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDeleteClick(col)}
                    disabled={busy || columns.length <= 1}
                    className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded"
                    title="Remover coluna"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline reassign UI */}
              {deletingColumnId === col.id && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 flex-wrap">
                  <span className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                    Esta coluna possui tarefas. Mover para:
                  </span>
                  <select
                    value={reassignTarget}
                    onChange={(e) => setReassignTarget(e.target.value)}
                    className="text-xs px-2 py-1 rounded bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 focus:outline-none"
                  >
                    <option value="">Selecione a coluna de destino…</option>
                    {columns
                      .filter((c) => c.id !== col.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.title}
                        </option>
                      ))}
                  </select>
                  <button
                    onClick={confirmDeleteWithReassign}
                    disabled={!reassignTarget || busy}
                    className="text-[11px] font-semibold px-2 py-1 rounded bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40"
                  >
                    Mover e remover
                  </button>
                  <button
                    onClick={() => setDeletingColumnId(null)}
                    className="text-[11px] text-slate-500 hover:text-slate-700 px-2 py-1"
                  >
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Add column */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
            Nova Coluna
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
              }}
              placeholder="Nome da coluna (ex.: Em Design)"
              maxLength={100}
              className="text-xs px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56"
            />
            <select
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="text-xs px-2 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none"
            >
              {PRESET_COLORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              placeholder="WIP"
              value={newWip}
              onChange={(e) => setNewWip(e.target.value)}
              className="w-16 text-xs px-2 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none"
            />
            <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={newIsDone}
                onChange={(e) => setNewIsDone(e.target.checked)}
                className="accent-emerald-600"
              />
              Coluna de conclusão
            </label>
            <button
              onClick={handleAdd}
              disabled={busy || !newTitle.trim()}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 ml-auto"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2">
            Limite de 30 colunas. Alterações são aplicadas imediatamente no quadro.
          </p>
        </div>

        {/* Quadro público/privado (item 1.2) */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Quadro público</p>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                role="switch"
                aria-checked={Boolean(isPublic)}
                onClick={handleToggleShare}
                disabled={shareBusy || !share}
                className={`relative w-9 h-5 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
                  isPublic ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'
                }`}
                title={isPublic ? 'Desativar quadro público' : 'Ativar quadro público'}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${
                    isPublic ? 'left-[18px]' : 'left-0.5'
                  }`}
                />
              </button>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Globe className={`w-3.5 h-3.5 ${isPublic ? 'text-emerald-500' : 'text-slate-400'}`} />
                  {isPublic ? 'Quadro público ativo' : 'Quadro privado'}
                </p>
                <p className="text-[10px] text-slate-400">
                  Qualquer pessoa com o link pode ver tarefas e nomes (somente leitura).
                </p>
              </div>
            </div>
          </div>

          {isPublic && (
            <div className="flex items-center gap-2 flex-wrap p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
              {share?.url ? (
                <>
                  <span className="inline-flex items-center gap-1.5 text-slate-400 shrink-0">
                    <Link2 className="w-3.5 h-3.5" />
                  </span>
                  <input
                    readOnly
                    value={share.url}
                    onFocus={(e) => e.target.select()}
                    className="flex-1 min-w-40 text-[11px] font-mono px-2 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none"
                  />
                  <button
                    onClick={handleCopyLink}
                    disabled={shareBusy}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copiado' : 'Copiar link'}
                  </button>
                  <button
                    onClick={handleRevokeShare}
                    disabled={shareBusy}
                    className="text-[11px] font-semibold px-2.5 py-1.5 rounded text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 disabled:opacity-40"
                  >
                    Revogar link
                  </button>
                </>
              ) : (
                <button
                  onClick={() => runShare(async () => setShare(await api.createBoardShare(currentBoard.id)))}
                  disabled={shareBusy}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Gerar link
                </button>
              )}
              {share?.expiresAt && (
                <span className="text-[10px] text-slate-400">
                  expira em {new Date(share.expiresAt).toLocaleDateString('pt-BR')}
                </span>
              )}
            </div>
          )}

          {shareError && <p className="text-[10px] text-rose-500">{shareError}</p>}
        </div>
      </div>
    </div>
  );
};
