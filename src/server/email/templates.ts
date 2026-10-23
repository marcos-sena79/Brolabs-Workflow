/** Templates HTML pt-BR para e-mails do sistema. */

export function renderEmail(options: {
  title: string;
  lines: string[];
  taskKey?: string;
  taskTitle?: string;
  actionLabel?: string;
  actionUrl?: string;
}): string {
  const linesHtml = options.lines.map((l) => `<p style="margin:0 0 12px;color:#334155;font-size:14px;line-height:1.6">${l}</p>`).join('\n');
  const taskHtml =
    options.taskKey || options.taskTitle
      ? `<div style="background:#f1f5f9;border-radius:8px;padding:12px 16px;margin:0 0 16px">
           ${options.taskKey ? `<p style="margin:0 0 4px;font-family:monospace;font-size:12px;color:#64748b">${options.taskKey}</p>` : ''}
           ${options.taskTitle ? `<p style="margin:0;font-weight:600;color:#0f172a;font-size:14px">${options.taskTitle}</p>` : ''}
         </div>`
      : '';
  const actionHtml =
    options.actionUrl && options.actionLabel
      ? `<p style="margin:20px 0 0"><a href="${options.actionUrl}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:10px 18px;border-radius:6px;font-size:13px;font-weight:600">${options.actionLabel}</a></p>`
      : '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<body style="margin:0;padding:24px;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden">
    <div style="background:#4f46e5;padding:18px 24px">
      <p style="margin:0;color:#fff;font-size:16px;font-weight:700">Brolabs Workflow</p>
    </div>
    <div style="padding:24px">
      <h1 style="margin:0 0 16px;font-size:18px;color:#0f172a">${options.title}</h1>
      ${taskHtml}
      ${linesHtml}
      ${actionHtml}
    </div>
    <div style="padding:14px 24px;border-top:1px solid #e2e8f0">
      <p style="margin:0;font-size:11px;color:#94a3b8">Você recebeu este e-mail porque tem permissão de leitura no quadro relacionado.</p>
    </div>
  </div>
</body>
</html>`;
}

export function renderTestEmail(toName: string): string {
  return renderEmail({
    title: `Olá, ${toName || 'usuário'}!`,
    lines: [
      'Este é um e-mail de teste do Brolabs Workflow.',
      'Se você recebeu esta mensagem, o SMTP está configurado corretamente.',
    ],
    actionLabel: 'Abrir o Workflow',
    actionUrl: process.env.APP_URL || undefined,
  });
}
