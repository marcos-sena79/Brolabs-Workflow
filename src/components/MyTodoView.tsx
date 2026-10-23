import React, { useEffect, useState } from 'react';
import { ListTodo, Plus, Check, Trash2, RefreshCw, CalendarClock, AlertTriangle, Link2 } from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { DailyTodo, TodoSuggestion } from '../types';

export const MyTodoView: React.FC = () => {
  const {
    dailyTodos,
    todoSuggestions,
    isTodosLoading,
    fetchDailyTodos,
    refetchDbData,
    createDailyTodo,
    toggleDailyTodo,
    deleteDailyTodo,
    createTodoFromTask,
    setSelectedTaskModalId,
  } = useAgile();

  const [newTitle, setNewTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [linkedIds, setLinkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchDailyTodos();
    // sugestões dependem das tasks — garante que estão frescas
    refetchDbData();
  }, [fetchDailyTodos, refetchDbData]);

  const today = new Date().toISOString().slice(0, 10);

  const pending = dailyTodos.filter((t) => !t.done);
  const done = dailyTodos.filter((t) => t.done);
  const overdue = todoSuggestions.filter((s) => s.isOverdue);
  const dueToday = todoSuggestions.filter((s) => !s.isOverdue);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    setIsCreating(true);
    setErrorMessage(null);
    try {
      await createDailyTodo({ title });
      setNewTitle('');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao criar item');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLink = async (s: TodoSuggestion) => {
    setLinkedIds((prev) => new Set(prev).add(s.id));
    try {
      await createTodoFromTask(s.id);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Falha ao vincular tarefa');
    } finally {
      setLinkedIds((prev) => {
        const next = new Set(prev);
        next.delete(s.id);
        return next;
      });
    }
  };

  const renderSuggestion = (s: TodoSuggestion) => (
    <li
      key={s.id}
      className="flex items-center gap-3 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
    >
      <button
        onClick={() => handleLink(s)}
        disabled={linkedIds.has(s.id)}
        title="Adicionar à minha To-Do"
        className="shrink-0 w-6 h-6 rounded-md border border-slate-300 dark:border-slate-600 text-slate-400 hover:text-indigo-600 hover:border-indigo-400 flex items-center justify-center transition-colors disabled:opacity-50"
      >
        {linkedIds.has(s.id) ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
      </button>
      <button
        onClick={() => setSelectedTaskModalId(s.id)}
        className="flex-1 min-w-0 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">{s.key}</span>
          {s.isOverdue && (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-3 h-3" />
              Atrasada
            </span>
          )}
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 truncate">{s.title}</p>
        <p className="text-[10px] text-slate-400">
          {s.boardKey} • {s.statusTitle} • vence {s.dueDate}
        </p>
      </button>
    </li>
  );

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100/70 dark:bg-slate-950 p-3 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2">
          <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
            <ListTodo className="w-5 h-5" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">Minha To-Do</h2>
            <p className="text-xs text-slate-500">{new Date(today + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          </div>
        </div>

        {/* Input */}
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            maxLength={200}
            placeholder="O que precisa ser feito hoje?"
            className="flex-1 text-sm px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            disabled={isCreating || !newTitle.trim()}
            className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            {isCreating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar
          </button>
        </form>

        {errorMessage && (
          <p className="text-xs text-rose-600 dark:text-rose-400 font-semibold">{errorMessage}</p>
        )}

        {/* Pendentes */}
        <section className="space-y-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Pendentes ({pending.length})
          </h3>
          {isTodosLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
              ))}
            </div>
          ) : pending.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400 space-y-1">
              <ListTodo className="w-7 h-7 mx-auto text-slate-300 dark:text-slate-700" />
              <p className="font-semibold text-slate-500 dark:text-slate-400">Lista livre — adicione um item</p>
              <p>Use o campo acima ou vincule uma tarefa sugerida abaixo.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {pending.map((t: DailyTodo) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 group"
                >
                  <button
                    onClick={() => toggleDailyTodo(t.id, true)}
                    aria-label="Marcar como concluído"
                    className="shrink-0 w-5 h-5 rounded-md border-2 border-slate-300 dark:border-slate-600 hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center justify-center transition-all"
                  >
                    <Check className="w-3 h-3 text-transparent" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-200 truncate">{t.title}</p>
                    {t.sourceTaskId && (
                      <button
                        onClick={() => setSelectedTaskModalId(t.sourceTaskId!)}
                        className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline"
                      >
                        <Link2 className="w-2.5 h-2.5" />
                        Vinculada a uma tarefa
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => deleteDailyTodo(t.id)}
                    aria-label="Remover item"
                    className="shrink-0 p-1.5 rounded text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Concluídos */}
        {done.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Concluídos ({done.length})</h3>
            <ul className="space-y-2">
              {done.map((t: DailyTodo) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/60 dark:bg-slate-900/40 opacity-70"
                >
                  <button
                    onClick={() => toggleDailyTodo(t.id, false)}
                    aria-label="Desmarcar"
                    className="shrink-0 w-5 h-5 rounded-md bg-indigo-600 border-2 border-indigo-600 flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-white" />
                  </button>
                  <p className="flex-1 min-w-0 text-sm text-slate-500 dark:text-slate-400 line-through truncate">{t.title}</p>
                  <button
                    onClick={() => deleteDailyTodo(t.id)}
                    aria-label="Remover item"
                    className="shrink-0 p-1.5 rounded text-slate-300 hover:text-rose-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sugestões: atrasadas + vencendo hoje */}
        {(overdue.length > 0 || dueToday.length > 0) && (
          <section className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            {overdue.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Atrasadas ({overdue.length})
                </h3>
                <ul className="space-y-2">{overdue.map(renderSuggestion)}</ul>
              </div>
            )}
            {dueToday.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" />
                  Vencendo hoje ({dueToday.length})
                </h3>
                <ul className="space-y-2">{dueToday.map(renderSuggestion)}</ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};
