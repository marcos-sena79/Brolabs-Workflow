import React, { useEffect, useState } from 'react';
import { NotebookPen, Plus, Sparkles, RefreshCw, Pencil, Trash2, Pin, PinOff, AlertTriangle } from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { Note } from '../types';
import { NoteEditor } from './NoteEditor';

export const NotesView: React.FC = () => {
  const { notes, isNotesLoading, fetchNotes, createNote, deleteNote, createNoteFromSprint, currentBoardId } = useAgile();

  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    fetchNotes(currentBoardId);
  }, [fetchNotes, currentBoardId]);

  const handleCreate = async () => {
    setIsCreating(true);
    setErrorMessage(null);
    try {
      const note = await createNote({});
      setEditingNote(note);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao criar nota');
    } finally {
      setIsCreating(false);
    }
  };

  const handleFromSprint = async () => {
    setIsGenerating(true);
    setErrorMessage(null);
    try {
      await createNoteFromSprint();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao gerar nota da sprint');
    } finally {
      setIsGenerating(false);
    }
  };

  if (editingNote) {
    return <NoteEditor note={editingNote} onClose={() => setEditingNote(null)} />;
  }

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100/70 dark:bg-slate-950 p-3 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <NotebookPen className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Notas</h2>
              <p className="text-xs text-slate-500">Bloco de notas do quadro, com ações de IA</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleFromSprint}
              disabled={isGenerating}
              className="px-3 py-2 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400 flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              {isGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-indigo-500" />}
              Gerar da sprint
            </button>
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              {isCreating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Nova nota
            </button>
          </div>
        </div>

        {errorMessage && (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {errorMessage}
          </p>
        )}

        {isNotesLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : notes.length === 0 ? (
          <div className="py-14 text-center text-xs text-slate-400 space-y-2">
            <NotebookPen className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
            <p className="font-semibold text-slate-500 dark:text-slate-400">Criar primeira nota</p>
            <p>Registre decisões, resumos de reunião ou use a IA para resumir a sprint.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 group"
              >
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => setEditingNote(n)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2">
                      {n.pinned && <Pin className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                      <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{n.title}</h3>
                      {n.aiGenerated && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 shrink-0">
                          IA
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2 whitespace-pre-wrap">
                      {n.content ? n.content.slice(0, 220) : 'Nota vazia'}
                    </p>
                    <p className="mt-2 text-[10px] text-slate-400">
                      Atualizada {new Date(n.updatedAt).toLocaleString('pt-BR')}
                    </p>
                  </button>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setEditingNote(n)}
                      className="p-1.5 rounded text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 transition-colors"
                      title="Editar"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteNote(n.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
