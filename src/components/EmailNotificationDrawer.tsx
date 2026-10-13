import React, { useState } from 'react';
import {
  X,
  Mail,
  Send,
  AtSign,
  ArrowRight,
  Settings,
  CheckCircle2,
  Trash2,
  Check,
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Inbox,
  Filter,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { formatRelativeTime } from '../utils/agileHelpers';
import { EmailNotification } from '../types';

export const EmailNotificationDrawer: React.FC = () => {
  const {
    isEmailDrawerOpen,
    setIsEmailDrawerOpen,
    emailNotifications,
    emailSettings,
    updateEmailSettings,
    triggerEmailAlert,
    markAllEmailsAsRead,
    clearEmailHistory,
    currentUser,
    currentBoard,
    members,
    setSelectedTaskModalId,
  } = useAgile();

  const [activeTab, setActiveTab] = useState<'outbox' | 'settings'>('outbox');
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'status_change' | 'mention'>('all');

  // Test email form state
  const [testEmailRecipient, setTestEmailRecipient] = useState('mssvenicius@gmail.com');
  const [testTriggerType, setTestTriggerType] = useState<'status_change' | 'mention'>('status_change');
  const [testSending, setTestSending] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);

  if (!isEmailDrawerOpen) return null;

  const filteredEmails = emailNotifications.filter((em) => {
    if (filterType === 'all') return true;
    return em.triggerType === filterType;
  });

  const unreadCount = emailNotifications.filter((e) => !e.read).length;

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmailRecipient.trim()) return;

    setTestSending(true);
    await new Promise((r) => setTimeout(r, 500));

    if (testTriggerType === 'status_change') {
      triggerEmailAlert({
        triggerType: 'status_change',
        taskId: 'task-1',
        taskKey: 'ENG-101',
        taskTitle: 'Implementar autenticação de dois fatores (TOTP / Authenticator)',
        recipientEmail: testEmailRecipient.trim(),
        recipientName: 'Usuário',
        senderName: currentUser.name,
        subject: `[Brolabs Workflow] Status alterado: ENG-101 para "Code Review / QA"`,
        contentPreview: `${currentUser.name} moveu a tarefa ENG-101 para "Code Review / QA".`,
        htmlBody: `
          <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
            <div style="background: #4f46e5; padding: 12px 16px; border-radius: 6px; color: #ffffff; margin-bottom: 16px;">
              <h2 style="margin: 0; font-size: 16px;">Brolabs Workflow • Atualização de Status</h2>
            </div>
            <p style="font-size: 14px; color: #1e293b;">Olá <strong>Colaborador</strong>,</p>
            <p style="font-size: 14px; color: #334155;">A tarefa <strong>ENG-101 (Implementar autenticação MFA)</strong> teve seu status alterado para <strong>Code Review / QA</strong> por <strong>${currentUser.name}</strong>.</p>
            <div style="background: #f8fafc; border-left: 4px solid #4f46e5; padding: 12px; margin: 16px 0;">
              <p style="margin: 0; font-size: 13px; color: #475569;">Quadro: <strong>${currentBoard.name}</strong></p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569;">Prioridade: <strong>Urgente</strong></p>
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Você está recebendo este email porque está configurado para receber notificações de tarefas no Brolabs Workflow.</p>
          </div>
        `,
      });
    } else {
      triggerEmailAlert({
        triggerType: 'mention',
        taskId: 'task-1',
        taskKey: 'ENG-101',
        taskTitle: 'Implementar autenticação de dois fatores (TOTP / Authenticator)',
        recipientEmail: testEmailRecipient.trim(),
        recipientName: 'Usuário',
        senderName: currentUser.name,
        subject: `[Brolabs Workflow] ${currentUser.name} mencionou você na tarefa ENG-101`,
        contentPreview: `${currentUser.name} mencionou você em um comentário: "@Equipe, por favor validem os testes de TOTP..."`,
        htmlBody: `
          <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; rounded: 8px;">
            <div style="background: #4f46e5; padding: 12px 16px; border-radius: 6px; color: #ffffff; margin-bottom: 16px;">
              <h2 style="margin: 0; font-size: 16px;">Brolabs Workflow • Menção em Comentário</h2>
            </div>
            <p style="font-size: 14px; color: #1e293b;">Olá <strong>Colaborador</strong>,</p>
            <p style="font-size: 14px; color: #334155;"><strong>${currentUser.name}</strong> mencionou você na tarefa <strong>ENG-101</strong>:</p>
            <div style="background: #f1f5f9; border-left: 4px solid #3b82f6; padding: 12px; margin: 16px 0; font-style: italic;">
              "@Equipe, por favor validem os testes de expiração de token TOTP para podermos aprovar o PR."
            </div>
            <p style="font-size: 12px; color: #94a3b8; margin-top: 24px;">Brolabs Workflow • Alertas Automáticos</p>
          </div>
        `,
      });
    }

    setTestSending(false);
    setTestSuccess(true);
    setTimeout(() => setTestSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex justify-end">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <span>Notificações por Email</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold">
                  {emailNotifications.length} enviados
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Alertas automáticos de mudança de status e menções (@)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab(activeTab === 'outbox' ? 'settings' : 'outbox')}
              className={`p-1.5 rounded-md transition-colors ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200/60'
              }`}
              title="Configurações de Email"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsEmailDrawerOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1.5 rounded-md"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 text-xs font-semibold px-4 pt-2 gap-4">
          <button
            onClick={() => setActiveTab('outbox')}
            className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'outbox'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Inbox className="w-3.5 h-3.5" />
            <span>Caixa de Saída (Outbox)</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-2 transition-colors border-b-2 flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>Configurações & Disparo</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTab === 'outbox' ? (
            <>
              {/* Filter controls */}
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      filterType === 'all'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Todos ({emailNotifications.length})
                  </button>
                  <button
                    onClick={() => setFilterType('status_change')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      filterType === 'status_change'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Status
                  </button>
                  <button
                    onClick={() => setFilterType('mention')}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      filterType === 'mention'
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Menções @
                  </button>
                </div>

                {emailNotifications.length > 0 && (
                  <button
                    onClick={clearEmailHistory}
                    className="text-[11px] text-slate-400 hover:text-rose-500 flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    Limpar
                  </button>
                )}
              </div>

              {/* Emails List */}
              <div className="space-y-3">
                {filteredEmails.map((email) => {
                  const isExpanded = expandedEmailId === email.id;
                  return (
                    <div
                      key={email.id}
                      className="bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden text-xs transition-all"
                    >
                      {/* Card summary row */}
                      <div
                        onClick={() => setExpandedEmailId(isExpanded ? null : email.id)}
                        className="p-3 cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800 transition-colors space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                email.triggerType === 'mention'
                                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300'
                                  : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                              }`}
                            >
                              {email.triggerType === 'mention' ? '@ Menção' : 'Status Alterado'}
                            </span>
                            <span className="font-mono text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                              {email.taskKey}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-slate-400 text-[10px]">
                            <span>{formatRelativeTime(email.timestamp)}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </div>

                        <p className="font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                          {email.subject}
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5">
                          <span>
                            Para: <span className="font-mono text-slate-700 dark:text-slate-300">{email.recipientEmail}</span>
                          </span>
                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Disparado
                          </span>
                        </div>
                      </div>

                      {/* Expanded Email Body Preview */}
                      {isExpanded && (
                        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-3">
                          <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-[11px] space-y-1 font-mono text-slate-600 dark:text-slate-300">
                            <div><strong>De:</strong> {emailSettings.senderName} &lt;{emailSettings.senderEmail}&gt;</div>
                            <div><strong>Para:</strong> {email.recipientName} &lt;{email.recipientEmail}&gt;</div>
                            <div><strong>Assunto:</strong> {email.subject}</div>
                            <div><strong>Data:</strong> {new Date(email.timestamp).toLocaleString('pt-BR')}</div>
                          </div>

                          <div
                            className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 text-xs bg-slate-50/50 dark:bg-slate-950/40"
                            dangerouslySetInnerHTML={{ __html: email.htmlBody }}
                          />

                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                setSelectedTaskModalId(email.taskId);
                                setIsEmailDrawerOpen(false);
                              }}
                              className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded text-[11px] font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-1"
                            >
                              <span>Abrir Tarefa {email.taskKey}</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredEmails.length === 0 && (
                  <div className="py-12 text-center text-xs text-slate-400 space-y-2">
                    <Mail className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                    <p>Nenhuma notificação por email encontrada nesta categoria.</p>
                    <p className="text-[11px] text-slate-500">
                      Mova uma tarefa de coluna ou mencione alguém com @ no comentário para disparar um alerta!
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Settings & Manual Test Tab */
            <div className="space-y-6">
              {/* Settings Card */}
              <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Preferências de Envio Automático
                </h4>

                <div className="space-y-3 text-xs">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        Sistema de Emails Ativo
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Habilitar geração e despacho de alertas automáticos
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailSettings.enabled}
                      onChange={(e) => updateEmailSettings({ enabled: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-200 dark:border-slate-700/60">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        Alertas de Mudança de Status
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Dispara email para o responsável e relator quando o status da tarefa é alterado
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailSettings.notifyOnStatusChange}
                      onChange={(e) => updateEmailSettings({ notifyOnStatusChange: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between cursor-pointer pt-2 border-t border-slate-200 dark:border-slate-700/60">
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">
                        Alertas de Menções (@membro)
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Dispara email imediato ao membro marcado em comentários
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={emailSettings.notifyOnMentions}
                      onChange={(e) => updateEmailSettings({ notifyOnMentions: e.target.checked })}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 space-y-2 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Remetente Oficial
                    </label>
                    <input
                      type="text"
                      value={emailSettings.senderName}
                      onChange={(e) => updateEmailSettings({ senderName: e.target.value })}
                      className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                      Email de Envio
                    </label>
                    <input
                      type="email"
                      value={emailSettings.senderEmail}
                      onChange={(e) => updateEmailSettings({ senderEmail: e.target.value })}
                      className="w-full text-xs font-mono px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Test Email Dispatcher */}
              <div className="bg-indigo-50/50 dark:bg-indigo-950/30 p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 space-y-3">
                <h4 className="text-xs font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-indigo-600" />
                  Testar Disparo de Email Agora
                </h4>

                <form onSubmit={handleSendTestEmail} className="space-y-3 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Destinatário de Teste
                    </label>
                    <input
                      type="email"
                      required
                      value={testEmailRecipient}
                      onChange={(e) => setTestEmailRecipient(e.target.value)}
                      placeholder="usuario@empresa.com"
                      className="w-full text-xs font-mono px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                      Tipo de Alerta
                    </label>
                    <select
                      value={testTriggerType}
                      onChange={(e) => setTestTriggerType(e.target.value as any)}
                      className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                    >
                      <option value="status_change">Mudança de Status da Tarefa</option>
                      <option value="mention">Menção em Comentário (@Usuário)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={testSending}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    {testSending ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : testSuccess ? (
                      <Check className="w-3.5 h-3.5 text-emerald-300" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>{testSuccess ? 'Email Enviado com Sucesso!' : 'Enviar Email de Teste'}</span>
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
