import React, { useState } from 'react';
import { ArrowLeft, Save, Pin, PinOff, Sparkles, RefreshCw, X, AlertTriangle, Check, CornerDownLeft } from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { Note, NoteAiAction } from '../types';

interface NoteEditorProps {
  note: Note;
  onClose: () => void;
}

const AI_ACTIONS: { action: NoteAiAction; label: string }[] = [
  { action: 'summarize', label: 'Resumir' },
  { action: 'expand', label: 'Expandir' },
  { action: 'action_items', label: 'Itens de ação' },
];

export const NoteEditor: React.FC<NoteEditorProps> = ({ note, onClose }) => {
  const { updateNote, runNoteAi } = useAgile();

  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [pinned, setPinned] = useState(note.pinned);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [aiRunning, setAiRunning] = useState<NoteAiAction | null>(null);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const isDirty = title !== note.title || content !== note.content || pinned !== note.pinned;

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateNote(note.id, { title: title.trim() || 'Sem título', content, pinned });
      setSavedAt(new Date().toLocaleTimeString('pt-BR'));
    } catch (err: any) {
      setSaveError(err?.message || 'Falha ao salvar nota');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePin = async () => {
    const next = !pinned;
    setPinned(next);
    try {
      await updateNote(note.id, { pinned: next });
    } catch (err: any) {
      setPinned(!next);
      setSaveError(err?.message || 'Falha ao fixar nota');
    }
  };

  const runAi = async (action: NoteAiAction) => {
    setAiRunning(action);
    setAiError(null);
    try {
      // salva antes de rodar a IA para garantir que o conteúdo atual é usado
      if (isDirty) {
        await updateNote(note.id, { title: title.trim() || 'Sem título', content });
      }
      const { content: out } = await runNoteAi(note.id, action);
      setAiPreview(out);
    } catch (err: any) {
      setAiError(err?.message || 'Falha na IA');
    } finally {
      setAiRunning(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100/70 dark:bg-slate-950 p-3 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-3">
        <div className="flex items-center justify-between gap-2">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar
          </button>
          <div className="flex items-center gap-2">
            {savedAt && <span className="text-[10px] text-slate-400">Salvo às {savedAt}</span>}
            <button
              onClick={handleTogglePin}
              className={`p-2 rounded-md transition-colors ${
                pinned
                  ? 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
              }`}
              title={pinned ? 'Desfixar' : 'Fixar'}
            >
              {pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty}
              className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar
            </button>
          </div>
        </div>

        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={255}
          placeholder="Sem título"
          className="w-full text-xl font-bold bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
        />

        {/* Toolbar IA */}
        <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 px-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            IA
          </span>
          {AI_ACTIONS.map(({ action, label }) => (
            <button
              key={action}
              onClick={() => runAi(action)}
              disabled={aiRunning !== null || !content.trim()}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
            >
              {aiRunning === action ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {label}
            </button>
          ))}
        </div>

        {aiError && (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            {aiError}
          </p>
        )}

        {/* Preview da IA — nunca sobrescreve automático */}
        {aiPreview !== null && (
          <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 p-3 space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
              Sugestão da IA (o texto digitado foi preservado)
            </p>
            <div className="max-h-64 overflow-y-auto whitespace-pre-wrap text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-slate-800">
              {aiPreview}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  setContent(aiPreview);
                  setAiPreview(null);
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-1.5"
              >
                <Check className="w-3 h-3" />
                Substituir
              </button>
              <button
                onClick={() => {
                  setContent((prev) => (prev ? `${prev}\n\n${aiPreview}` : aiPreview || ''));
                  setAiPreview(null);
                }}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400 flex items-center gap-1.5"
              >
                <CornerDownLeft className="w-3 h-3" />
                Inserir abaixo
              </button>
              <button
                onClick={() => setAiPreview(null)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:text-rose-600 flex items-center gap-1.5"
              >
                <X className="w-3 h-3" />
                Descartar
              </button>
            </div>
          </div>
        )}

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Escreva sua nota aqui..."
          className="w-full min-h-[420px] text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y font-mono leading-relaxed"
        />

        {saveError && (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{saveError}</p>
        )}
      </div>
    </div>
  );
};
