import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  CalendarDays,
  CheckSquare2,
  Eye,
  Globe,
  MessageSquare,
  Send,
  ShieldAlert,
  User,
} from 'lucide-react';
import { api } from '../services/api';
import { PublicTaskData } from '../types';

type LoadStatus = 'loading' | 'ready' | 'notfound';

export const PublicTaskView: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PublicTaskData | null>(null);
  const [status, setStatus] = useState<LoadStatus>('loading');
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const load = useCallback(() => {
    if (!token) {
      setStatus('notfound');
      return;
    }
    setStatus('loading');
    api
      .getPublicTask(token)
      .then((d) => {
        setData(d);
        setStatus('ready');
      })
      .catch(() => setStatus('notfound'));
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    setSending(true);
    try {
      await api.postPublicTaskComment(token, { name, body });
      setBody('');
      setSent(true);
      load();
    } catch (err: any) {
      setFormError(err?.message || 'Não foi possível enviar o comentário');
    } finally {
      setSending(false);
    }
  };

  if (status === 'loading') {
    return (
      <div className="flex flex-col h-dvh bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-slate-300 dark:border-slate-700 border-t-indigo-600 animate-spin" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando tarefa…</p>
      </div>
    );
  }

  if (status === 'notfound' || !data) {
    return (
      <div className="flex flex-col h-dvh bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 items-center justify-center gap-3 px-6">
        <ShieldAlert className="w-10 h-10 text-slate-400" />
        <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100">Link inválido ou desativado</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md">
          Esta tarefa não está mais disponível publicamente. Peça ao responsável da tarefa um novo link.
        </p>
        <Link to="/login" className="mt-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
          Ir para o login
        </Link>
      </div>
    );
  }

  const { task, comments, allowComments } = data;

  return (
    <div className="flex flex-col min-h-dvh bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans antialiased">
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
            <Eye className="w-3 h-3" />
            Tarefa pública
          </span>
          <h1 className="text-sm sm:text-base font-bold truncate">
            <span className="font-mono text-slate-500 dark:text-slate-400 mr-1.5">{task.key}</span>
            {task.title}
          </h1>
          <span className="ml-auto hidden sm:inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Globe className="w-3 h-3" />
            Brolabs Workflow
          </span>
        </div>
      </header>

      <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            {task.statusTitle && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300">
                {task.statusTitle}
              </span>
            )}
            <span className="capitalize">Prioridade: {task.priority}</span>
            {task.dueDate && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="w-3.5 h-3.5" />
                {task.dueDate.slice(0, 10)}
              </span>
            )}
            {task.assigneeNames.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <User className="w-3.5 h-3.5" />
                {task.assigneeNames.join(', ')}
              </span>
            )}
          </div>

          {task.description && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-slate-200">
              {task.description}
            </p>
          )}

          {task.subtasks.length > 0 && (
            <ul className="space-y-1">
              {task.subtasks.map((s, i) => (
                <li key={i} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <CheckSquare2 className={`w-3.5 h-3.5 ${s.completed ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <span className={s.completed ? 'line-through opacity-70' : ''}>{s.title}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-bold">
            <MessageSquare className="w-4 h-4 text-slate-400" />
            Comentários públicos
          </h2>

          {comments.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Ainda não há comentários.</p>
          ) : (
            <ul className="space-y-2.5">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                  <p className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">{c.visitorName}</p>
                  <p className="text-sm whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200">{c.body}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(c.createdAt).toLocaleString('pt-BR')}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {allowComments ? (
            <form onSubmit={submit} className="space-y-2 pt-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                maxLength={60}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Escreva um comentário…"
                maxLength={2000}
                rows={3}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:border-indigo-400 resize-y"
              />
              {formError && <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">{formError}</p>}
              {sent && !formError && (
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Comentário enviado.</p>
              )}
              <button
                type="submit"
                disabled={sending || !body.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50 hover:bg-indigo-700"
              >
                <Send className="w-3.5 h-3.5" />
                {sending ? 'Enviando…' : 'Enviar comentário'}
              </button>
            </form>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Os comentários estão desativados para este link.
            </p>
          )}
        </section>
      </main>
    </div>
  );
};
