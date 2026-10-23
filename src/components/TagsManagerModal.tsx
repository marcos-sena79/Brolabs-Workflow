import React, { useState } from 'react';
import { X, Plus, Pencil, Trash2, Check, Tag as TagIcon } from 'lucide-react';
import { useAgile } from '../context/AgileContext';

const PRESET_COLORS = ['#64748b', '#3b82f6', '#eab308', '#8b5cf6', '#10b981', '#ef4444', '#ec4899', '#06b6d4'];

export const TagsManagerModal: React.FC = () => {
  const { isTagsManagerOpen, setIsTagsManagerOpen, tagCatalog, createTag, updateTag, deleteTag } = useAgile();

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');
  const [createError, setCreateError] = useState('');
  const [busy, setBusy] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#64748b');
  const [editError, setEditError] = useState('');

  if (!isTagsManagerOpen) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setCreateError('');
    try {
      await createTag({ name, color: newColor });
      setNewName('');
    } catch (err: any) {
      setCreateError(err?.message || 'Falha ao criar etiqueta');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (id: string, name: string, color: string) => {
    setEditingId(id);
    setEditName(name);
    setEditColor(color);
    setEditError('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    setBusy(true);
    setEditError('');
    try {
      await updateTag(editingId, { name: editName.trim(), color: editColor });
      setEditingId(null);
    } catch (err: any) {
      setEditError(err?.message || 'Falha ao atualizar etiqueta');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string, name: string, usageCount: number) => {
    const question =
      usageCount > 0
        ? `A etiqueta "${name}" está usada em ${usageCount} tarefa(s).\n\nRemover das tarefas e excluir definitivamente?`
        : `Excluir a etiqueta "${name}"?`;
    if (!confirm(question)) return;
    setBusy(true);
    try {
      await deleteTag(id, usageCount > 0);
    } catch (err: any) {
      alert(err?.message || 'Falha ao excluir etiqueta');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg my-auto p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TagIcon className="w-4 h-4 text-indigo-500" />
              Etiquetas
            </h3>
            <p className="text-[11px] text-slate-400">
              Catálogo global — cores valem em todo o quadro (item 2.2)
            </p>
          </div>
          <button
            onClick={() => setIsTagsManagerOpen(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Create form */}
        <form onSubmit={handleCreate} className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nova etiqueta (ex.: Backend)"
              maxLength={60}
              className="flex-1 min-w-40 text-xs px-3 py-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="flex items-center gap-1">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewColor(c)}
                  className={`w-5 h-5 rounded-full ring-1 transition-transform ${
                    newColor === c ? 'ring-2 ring-slate-900 dark:ring-white scale-110' : 'ring-slate-900/10 dark:ring-white/20'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              Criar
            </button>
          </div>
          {createError && <p className="text-[11px] text-rose-500">{createError}</p>}
        </form>

        {/* Tags grid */}
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {tagCatalog.length === 0 && (
            <div className="py-8 text-center border-2 border-dashed border-slate-300/60 dark:border-slate-800 rounded-lg">
              <p className="text-xs text-slate-400">Nenhuma etiqueta</p>
            </div>
          )}

          {tagCatalog.map((tag) => {
            const isEditing = editingId === tag.id;
            const isOrphan = Boolean(tag.orphan);
            return (
              <div
                key={tag.id}
                className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 space-y-2"
              >
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={60}
                        className="flex-1 min-w-36 text-xs font-semibold px-2 py-1.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        onClick={handleSaveEdit}
                        disabled={busy || !editName.trim()}
                        className="p-1.5 rounded text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-40"
                        title="Salvar"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded text-slate-400 hover:text-slate-600"
                        title="Cancelar"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={`w-5 h-5 rounded-full ring-1 ${
                            editColor === c ? 'ring-2 ring-slate-900 dark:ring-white scale-110' : 'ring-slate-900/10 dark:ring-white/20'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    {editError && <p className="text-[11px] text-rose-500">{editError}</p>}
                    <p className="text-[10px] text-slate-400">
                      Renomear atualiza todas as tarefas que usam esta etiqueta.
                    </p>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full shrink-0 ring-1 ring-slate-900/10 dark:ring-white/20"
                      style={{ backgroundColor: tag.color }}
                    />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {tag.name}
                    </span>
                    {isOrphan && (
                      <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                        órfã
                      </span>
                    )}
                    <span className="text-[10px] text-slate-400 ml-auto shrink-0">
                      {tag.usageCount} {tag.usageCount === 1 ? 'tarefa' : 'tarefas'}
                    </span>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        onClick={() => startEdit(tag.id, tag.name, tag.color)}
                        disabled={busy || isOrphan}
                        className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 rounded"
                        title={isOrphan ? 'Etiqueta órfã — crie uma com o mesmo nome para editá-la' : 'Editar'}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(tag.id, tag.name, tag.usageCount)}
                        disabled={busy || isOrphan}
                        className="p-1 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded"
                        title={isOrphan ? 'Etiqueta órfã — crie uma com o mesmo nome para excluí-la' : 'Excluir'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
