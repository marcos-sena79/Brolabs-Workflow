import React, { useState } from 'react';
import { CalendarRange, Flag, X } from 'lucide-react';
import type { Sprint } from '../types';
import { validateSprintFields } from '../utils/sprints';

const inputClass =
  'w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500';
const labelClass = 'block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1';

const ModalShell: React.FC<{
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ title, subtitle, icon, onClose, children }) => (
  <div
    className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
    onMouseDown={(e) => e.target === e.currentTarget && onClose()}
  >
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl max-w-md w-full p-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">{icon}</div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{title}</h3>
            <p className="text-[11px] text-slate-400">{subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export interface SprintFormValues {
  name: string;
  goal: string;
  startDate: string;
  endDate: string;
}

export const SprintFormModal: React.FC<{
  mode: 'create' | 'edit';
  initial: SprintFormValues;
  onClose: () => void;
  onSubmit: (values: SprintFormValues) => Promise<void>;
}> = ({ mode, initial, onClose, onSubmit }) => {
  const [values, setValues] = useState<SprintFormValues>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (field: keyof SprintFormValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateSprintFields(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ ...values, name: values.name.trim() });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar sprint');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell
      title={mode === 'create' ? 'Nova Sprint' : 'Editar Sprint'}
      subtitle={mode === 'create' ? 'A sprint é criada como planejada' : 'Nome, objetivo e período'}
      icon={<CalendarRange className="w-5 h-5" />}
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="space-y-4 mt-4">
        <div>
          <label className={labelClass} htmlFor="sprint-name">Nome da Sprint</label>
          <input id="sprint-name" type="text" required autoFocus maxLength={255} value={values.name} onChange={set('name')} placeholder="Ex: Sprint 2" className={inputClass} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} htmlFor="sprint-start">Início</label>
            <input id="sprint-start" type="date" value={values.startDate} onChange={set('startDate')} className={inputClass} />
          </div>
          <div>
            <label className={labelClass} htmlFor="sprint-end">Término</label>
            <input id="sprint-end" type="date" value={values.endDate} min={values.startDate || undefined} onChange={set('endDate')} className={inputClass} />
          </div>
        </div>
        <div>
          <label className={labelClass} htmlFor="sprint-goal">Objetivo da Sprint</label>
          <textarea id="sprint-goal" rows={3} maxLength={5000} value={values.goal} onChange={set('goal')} placeholder="O que o time pretende entregar nesta iteração..." className={inputClass} />
        </div>

        {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
            Cancelar
          </button>
          <button type="submit" disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-md shadow-xs">
            {saving ? 'Salvando...' : mode === 'create' ? 'Criar Sprint' : 'Salvar'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

export const CompleteSprintModal: React.FC<{
  sprint: Sprint;
  doneCount: number;
  pendingCount: number;
  plannedSprints: Sprint[];
  onClose: () => void;
  onConfirm: (moveToSprintId: string | null) => Promise<void>;
}> = ({ sprint, doneCount, pendingCount, plannedSprints, onClose, onConfirm }) => {
  const [target, setTarget] = useState<string>(plannedSprints[0]?.id ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      await onConfirm(target || null);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao concluir sprint');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Concluir ${sprint.name}`} subtitle="Encerra a sprint ativa" icon={<Flag className="w-5 h-5" />} onClose={onClose}>
      <div className="space-y-4 mt-4 text-xs text-slate-700 dark:text-slate-300">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-3">
            <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{doneCount}</p>
            <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">concluídas ficam no histórico</p>
          </div>
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 p-3">
            <p className="text-lg font-bold text-amber-700 dark:text-amber-300">{pendingCount}</p>
            <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">pendentes serão movidas</p>
          </div>
        </div>

        {pendingCount > 0 && (
          <div>
            <label className={labelClass} htmlFor="complete-target">Mover tarefas pendentes para</label>
            <select id="complete-target" value={target} onChange={(e) => setTarget(e.target.value)} className={inputClass}>
              {plannedSprints.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
              <option value="">Backlog de Produto</option>
            </select>
          </div>
        )}

        {error && <p className="text-rose-600 dark:text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md">
            Cancelar
          </button>
          <button type="button" onClick={handleConfirm} disabled={saving} className="px-4 py-2 font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-md shadow-xs">
            {saving ? 'Concluindo...' : 'Concluir Sprint'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
};
