import React from 'react';
import { X, Keyboard, Command, Sparkles } from 'lucide-react';
import { useAgile } from '../context/AgileContext';

export const ShortcutsModal: React.FC = () => {
  const { isShortcutsModalOpen, setIsShortcutsModalOpen } = useAgile();

  if (!isShortcutsModalOpen) return null;

  const viewShortcuts = [
    { key: '1', sequence: 'G depois K', label: 'Quadro Kanban', desc: 'Acessar quadro de fluxo ágil' },
    { key: '2', sequence: 'G depois B', label: 'Backlog & Lista', desc: 'Planejamento e refinamento de sprints' },
    { key: '3', sequence: 'G depois D', label: 'Acompanhamento Diário', desc: 'Daily Standup e visão do dia' },
    { key: '4', sequence: 'G depois T', label: 'Gestão de Horas', desc: 'Estimadas x Realizadas e variância' },
    { key: '5', sequence: 'G depois R', label: 'Relatórios de Produtividade', desc: 'Burndown, velocidade e métricas' },
    { key: '6', sequence: 'G depois M', label: 'Desempenho por Membro', desc: 'Capacidade e entregas individuais' },
    { key: '7', sequence: 'G depois I', label: 'Canais de Comunicação', desc: 'Webhooks Slack, Discord e Teams' },
  ];

  const actionShortcuts = [
    { key: 'C', label: 'Criar Tarefa', desc: 'Abre o formulário de novo item' },
    { key: '⌘K / Ctrl+K', label: 'Paleta de Comandos', desc: 'Busca rápida de ações e navegação' },
    { key: '/', label: 'Focar Busca', desc: 'Posiciona o cursor na barra de pesquisa' },
    { key: 'T', label: 'Iniciar/Pausar Cronômetro', desc: 'Controle de tempo em tempo real' },
    { key: 'M', label: 'Minhas Tarefas', desc: 'Alterna filtro de tarefas atribuídas a você' },
    { key: 'E', label: 'Alertas de Email', desc: 'Abre caixa de saída e preferências de email' },
    { key: '?', label: 'Guia de Atalhos', desc: 'Exibe esta janela de atalhos' },
    { key: 'Esc', label: 'Fechar Modais', desc: 'Fecha qualquer janela ou formulário ativo' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl my-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                Atalhos de Teclado
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-semibold">
                  Jira Style
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Navegue e execute ações no Brolabs Workflow com rapidez sem tirar as mãos do teclado
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsShortcutsModalOpen(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Columns */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Navegação */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Navegação entre Visões
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Teclas 1-7 ou G + Tecla</span>
            </div>

            <div className="space-y-2">
              {viewShortcuts.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                >
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
                    <p className="text-[10px] text-slate-400">{item.desc}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <kbd className="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded shadow-2xs">
                      {item.key}
                    </kbd>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Ações Comuns */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Ações Globais
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Comandos Rápidos</span>
            </div>

            <div className="space-y-2">
              {actionShortcuts.map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800"
                >
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{item.label}</p>
                    <p className="text-[10px] text-slate-400">{item.desc}</p>
                  </div>
                  <kbd className="px-2 py-0.5 text-[11px] font-mono font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded shadow-2xs shrink-0">
                    {item.key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer tip */}
        <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Pressione <kbd className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">?</kbd> em qualquer momento para abrir esta ajuda</span>
          <button
            onClick={() => setIsShortcutsModalOpen(false)}
            className="px-3 py-1 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700"
          >
            Entendi (Esc)
          </button>
        </div>
      </div>
    </div>
  );
};
