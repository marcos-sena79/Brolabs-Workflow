# Anexos de tarefas e Vercel Blob

Os anexos existentes permanecem no bucket privado Supabase. Novos anexos podem
ser enviados a um store privado do Vercel Blob; a aplicação lista e acessa os
dois provedores. Avatares não usam esta configuração.

## Preparação

1. Aplique as migrations com `npm run migrate` antes de ativar o novo provedor.
2. Crie um Vercel Blob Store **privado** e conecte-o aos ambientes apropriados.
   Configure `BLOB_READ_WRITE_TOKEN` no servidor ou use OIDC da Vercel com
   `BLOB_STORE_ID` e token OIDC gerenciado pela Vercel (disponível no contexto
   da requisição ou em `VERCEL_OIDC_TOKEN`). Para desenvolvimento local, configure
   credenciais adequadas ao ambiente. Nunca coloque credenciais em variáveis
   `VITE_` ou no código cliente.
3. Mantenha `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e
   `SUPABASE_STORAGE_BUCKET` enquanto existirem arquivos legados ou pendências
   de limpeza. Configure `CRON_SECRET` no servidor e no projeto Vercel.
4. Homologue no ambiente de preview e altere
   `ATTACHMENT_STORAGE_PROVIDER=vercel_blob` para ativar novos uploads. O padrão
   `supabase` permite ativação gradual. `/api/health` informa o estado de
   configuração do provedor selecionado e do legado, sem verificar conectividade.

Se a rota de upload retornar 503, consulte a mensagem JSON da resposta: para
`Vercel Blob não configurado`, confirme que o store está conectado ao projeto e
ao ambiente correto e que `BLOB_STORE_ID` e o OIDC gerenciado pela Vercel estão
disponíveis, ou configure o token de leitura/escrita. Se a mensagem mencionar
Supabase, confirme também `ATTACHMENT_STORAGE_PROVIDER=vercel_blob`; quando
essa variável não está definida, o provedor selecionado é Supabase. Faça um
novo deploy após alterar variáveis do projeto. Não compartilhe os valores dos
tokens ao investigar.

O navegador envia o arquivo diretamente para o Blob usando uma URL restrita ao
caminho, MIME, tamanho e prazo. As regras existentes continuam: 10 MiB por
arquivo, 20 anexos por tarefa, extensões permitidas e SVG bloqueado. A
confirmação verifica metadados reais. O download usa URL privada temporária de
15 minutos; qualquer pessoa com o link pode usá-lo até expirar. Não registre
URLs assinadas em logs nem as trate como revogáveis imediatamente.

## Limpeza e operação

`vercel.json` agenda `/api/cron/cleanup-attachments` diariamente. Chamadas
manuais exigem `Authorization: Bearer <CRON_SECRET>`. O cron remove até 25
itens da fila por execução e examina uma página de até 25 objetos por provedor,
com cursores persistidos; arquivos com menos de 24 horas não são considerados
órfãos. Uploads expirados são enfileirados após a janela de segurança. Assim,
a limpeza não é imediata e o tempo até concluir uma varredura depende do volume.
Monitore falhas HTTP, duração, uso do Blob e crescimento da fila
`attachment_cleanup_queue`; execute o cron adicionalmente por mecanismo
autenticado caso a frequência diária não acompanhe a demanda. Verifique a
disponibilidade e os limites de cron do plano Vercel antes do deploy.

Os gatilhos de banco preservam tarefas de limpeza mesmo quando uma tarefa ou
quadro é excluído. Erros de exclusão são retornados ao usuário ou mantidos na
fila para nova tentativa; não remova credenciais do provedor enquanto houver
dados ou pendências correspondentes.

## Rollback

Para suspender novos uploads ao Blob, volte
`ATTACHMENT_STORAGE_PROVIDER=supabase` e faça um novo deploy. Os registros
Blob já criados continuam acessíveis e exigem as credenciais Blob. Não reverta
a migration enquanto existirem anexos Blob, uploads pendentes ou itens na fila;
o script de reversão bloqueia essas situações. A reversão da aplicação para
uma versão anterior que não reconhece o discriminador de provedor não é
segura enquanto existirem anexos Blob.

Consulte [URLs assinadas](https://vercel.com/docs/vercel-blob/vercel-signed-urls),
[armazenamento privado](https://vercel.com/docs/vercel-blob/private-storage)
e [uso e preços](https://vercel.com/docs/vercel-blob/usage-and-pricing).
