import React from 'react';
import { Mail, X, ExternalLink, CheckCircle2, AtSign, ArrowRight } from 'lucide-react';
import { useAgile } from '../context/AgileContext';

export const EmailAlertToast: React.FC = () => {
  const { lastEmailAlertToast, clearEmailAlertToast, setIsEmailDrawerOpen } = useAgile();

  if (!lastEmailAlertToast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 duration-200">
      <div className="bg-slate-900 dark:bg-slate-800 text-white p-4 rounded-xl shadow-2xl border border-indigo-500/50 flex items-start gap-3">
        <div className="p-2 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30 shrink-0">
          {lastEmailAlertToast.triggerType === 'mention' ? (
            <AtSign className="w-5 h-5 text-indigo-400" />
          ) : (
            <Mail className="w-5 h-5 text-emerald-400" />
          )}
        </div>

        <div className="flex-1 min-w-0 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-100 flex items-center gap-1.5">
              <span>Alerta de Email Enviado</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-mono font-semibold">
                {lastEmailAlertToast.triggerType === 'mention' ? 'Menção' : 'Status'}
              </span>
            </span>
            <button
              onClick={clearEmailAlertToast}
              className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-slate-300 font-medium text-[11px] mt-1 line-clamp-1">
            {lastEmailAlertToast.subject}
          </p>

          <p className="text-slate-400 text-[10px] mt-0.5 truncate">
            Para: <span className="font-mono text-slate-200">{lastEmailAlertToast.recipientEmail}</span>
          </p>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={() => {
                setIsEmailDrawerOpen(true);
                clearEmailAlertToast();
              }}
              className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 hover:underline"
            >
              <span>Ver Email na Caixa de Saída</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
