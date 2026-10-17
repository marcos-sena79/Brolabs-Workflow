import React, { useState } from 'react';
import {
  Radio,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Code2,
  RefreshCw,
  Bell,
  Check,
  Globe,
  Settings,
  MessageSquare,
} from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { IntegrationConfig, IntegrationPlatform } from '../types';
import { formatRelativeTime } from '../utils/agileHelpers';

export const IntegrationsView: React.FC = () => {
  const {
    integrations,
    updateIntegrationConfig,
    sendTestWebhook,
    webhookLogs,
    currentBoard,
    currentUser,
  } = useAgile();

  const [testingPlatform, setTestingPlatform] = useState<IntegrationPlatform | null>(null);
  const [successPlatform, setSuccessPlatform] = useState<IntegrationPlatform | null>(null);
  const [activeTabPlatform, setActiveTabPlatform] = useState<IntegrationPlatform>('slack');

  const handleTestPing = async (platform: IntegrationPlatform) => {
    setTestingPlatform(platform);
    await new Promise((r) => setTimeout(r, 600)); // realistic dispatch feel
    await sendTestWebhook(platform);
    setTestingPlatform(null);
    setSuccessPlatform(platform);
    setTimeout(() => setSuccessPlatform(null), 3000);
  };

  // Preview payload for selected platform
  const getPayloadPreview = (platform: IntegrationPlatform) => {
    switch (platform) {
      case 'slack':
        return {
          text: `🎉 *[Brolabs Workflow]* Tarefa *ENG-101* foi finalizada!`,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: '🚀 Entrega Concluída no Sprint 24' },
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: '*Tarefa:*\nENG-101: Autenticação MFA' },
                { type: 'mrkdwn', text: '*Responsável:*\nJuliana Ferreira' },
                { type: 'mrkdwn', text: '*Horas Gastas:*\n12.5h de 16h estimadas' },
                { type: 'mrkdwn', text: '*Status:*\nConcluído ✅' },
              ],
            },
            {
              type: 'context',
              elements: [{ type: 'mrkdwn', text: 'Disparado automaticamente via Brolabs Workflow Webhook' }],
            },
          ],
        };
      case 'discord':
        return {
          content: '🔔 **Notificação Brolabs Workflow**',
          embeds: [
            {
              title: 'Tarefa ENG-101 Atualizada',
              color: 3066993, // Green
              description: 'Juliana Ferreira moveu a tarefa para Concluído.',
              fields: [
                { name: 'Horas Apontadas', value: '12.5h / 16h', inline: true },
                { name: 'Prioridade', value: 'Urgente', inline: true },
                { name: 'Quadro', value: currentBoard.name, inline: false },
              ],
              footer: { text: 'Brolabs Workflow Bot' },
            },
          ],
        };
      case 'teams':
        return {
          '@type': 'MessageCard',
          '@context': 'http://schema.org/extensions',
          summary: 'Notificação do Brolabs Workflow',
          themeColor: '0076D7',
          title: 'Card Concluído: ENG-101',
          sections: [
            {
              activityTitle: 'Lucas Santos notificou a equipe',
              activitySubtitle: new Date().toLocaleDateString('pt-BR'),
              facts: [
                { name: 'Quadro:', value: currentBoard.name },
                { name: 'Status:', value: 'Concluído' },
                { name: 'Acurácia de Horas:', value: '92%' },
              ],
            },
          ],
        };
      case 'custom':
        return {
          event: 'brolabs.task.completed',
          app: 'Brolabs Workflow',
          timestamp: new Date().toISOString(),
          actor: { id: currentUser.id, name: currentUser.name, email: currentUser.email },
          task: { key: 'ENG-101', title: 'Implementar MFA', loggedHours: 12.5, estimatedHours: 16.0 },
          board: { key: currentBoard.key, name: currentBoard.name },
        };
    }
  };

  const getPlatformIcon = (platform: IntegrationPlatform) => {
    switch (platform) {
      case 'slack':
        return '💬';
      case 'discord':
        return '🎮';
      case 'teams':
        return '👥';
      case 'custom':
        return '🌐';
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-slate-100/60 dark:bg-slate-950 p-3 sm:p-6 space-y-4 sm:space-y-6">
      {/* Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <Radio className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Canais de Comunicação & Webhooks em Tempo Real
              </h2>
              <p className="text-xs text-slate-500">
                Integração nativa com Slack, Discord, Microsoft Teams e endpoints HTTP corporativos
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Dispatcher Ativo
          </span>
        </div>
      </div>

      {/* Integration Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {integrations.map((config) => {
          const isTesting = testingPlatform === config.id;
          const isSuccess = successPlatform === config.id;

          return (
            <div
              key={config.id}
              className={`bg-white dark:bg-slate-900 rounded-xl p-5 border transition-all space-y-4 ${
                config.enabled
                  ? 'border-indigo-200 dark:border-indigo-800/80 shadow-2xs'
                  : 'border-slate-200 dark:border-slate-800 opacity-80'
              }`}
            >
              {/* Header with Switch */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl">{getPlatformIcon(config.id)}</span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{config.name}</h3>
                    <p className="text-[11px] text-slate-400">
                      {config.enabled ? `Canal: ${config.channelName}` : 'Desativado'}
                    </p>
                  </div>
                </div>

                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(e) => updateIntegrationConfig(config.id, { enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {/* Webhook URL & Channel input */}
              <div className="space-y-2.5 text-xs">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    URL do Webhook
                  </label>
                  <input
                    type="text"
                    value={config.webhookUrl}
                    onChange={(e) => updateIntegrationConfig(config.id, { webhookUrl: e.target.value })}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full font-mono text-[11px] px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                    Canal / Destino
                  </label>
                  <input
                    type="text"
                    value={config.channelName}
                    onChange={(e) => updateIntegrationConfig(config.id, { channelName: e.target.value })}
                    placeholder="#geral-alertas"
                    className="w-full text-xs px-3 py-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Notification Triggers Checkboxes */}
              <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Eventos para Disparo:
                </span>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={config.notifyOnTaskComplete}
                      onChange={(e) => updateIntegrationConfig(config.id, { notifyOnTaskComplete: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Tarefa Concluída</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={config.notifyOnWorklog}
                      onChange={(e) => updateIntegrationConfig(config.id, { notifyOnWorklog: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Horas Apontadas</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={config.notifyOnTaskBlocked}
                      onChange={(e) => updateIntegrationConfig(config.id, { notifyOnTaskBlocked: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Tarefas em Risco</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={config.notifyOnSprintStart}
                      onChange={(e) => updateIntegrationConfig(config.id, { notifyOnSprintStart: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Abertura de Sprint</span>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => setActiveTabPlatform(config.id)}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  <Code2 className="w-3.5 h-3.5" />
                  Ver Payload JSON
                </button>

                <button
                  onClick={() => handleTestPing(config.id)}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 transition-colors"
                >
                  {isTesting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : isSuccess ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Send className="w-3.5 h-3.5 text-indigo-600" />
                  )}
                  <span>{isSuccess ? 'Disparo Enviado!' : 'Testar Disparo'}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payload Previewer & Webhook Audit Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 6 Cols: JSON Payload Viewer */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <Code2 className="w-4 h-4 text-indigo-500" />
              Esquema do Payload ({activeTabPlatform.toUpperCase()})
            </h3>

            {/* Platform pills */}
            <div className="flex items-center gap-1">
              {(['slack', 'discord', 'teams', 'custom'] as IntegrationPlatform[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setActiveTabPlatform(p)}
                  className={`text-[10px] font-mono px-2 py-0.5 rounded capitalize transition-colors ${
                    activeTabPlatform === p
                      ? 'bg-indigo-600 text-white font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <pre className="p-3.5 rounded-lg bg-slate-950 text-indigo-300 font-mono text-[11px] overflow-x-auto max-h-72">
            {JSON.stringify(getPayloadPreview(activeTabPlatform), null, 2)}
          </pre>
        </div>

        {/* Right 6 Cols: Webhook Dispatch Audit Log */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 rounded-xl p-5 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Bell className="w-4 h-4 text-emerald-500" />
              Histórico de Disparos em Tempo Real ({webhookLogs.length})
            </h3>
            <span className="text-[10px] text-emerald-600 font-medium">Status 200 OK</span>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {webhookLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs space-y-1"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-800 dark:text-slate-200 uppercase font-mono text-[10px]">
                      {log.platform}
                    </span>
                    <span className="text-[10px] text-emerald-600 bg-emerald-50 dark:bg-emerald-950 px-1.5 py-0.2 rounded font-semibold">
                      {log.status === 'delivered' ? 'Entregue' : 'Simulado'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">{formatRelativeTime(log.timestamp)}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-xs leading-relaxed">{log.payloadSummary}</p>
              </div>
            ))}

            {webhookLogs.length === 0 && (
              <p className="text-xs text-slate-400 italic py-6 text-center">
                Nenhum webhook disparado recentemente. Clique em "Testar Disparo" acima.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
