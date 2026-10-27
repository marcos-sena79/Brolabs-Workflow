import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { pool, query } from '../src/server/db';

const USAGE = `Uso:
  npm run create-user -- --name "Nome" --email "a@b.com" --password "Senha" [opções]

Opções:
  --id <id>             (padrão: mem-<uuid curto>)
  --avatar <caminho>
  --role <cargo>
  --department <depto>
  --capacity <horas>    (padrão: 40)
  --active <true|false> (padrão: true)
  --update              atualiza o usuário se o e-mail já existir`;

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const key = argv[i].slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = 'true';
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  if (!a.name || !a.email || !a.password) {
    console.error('Parâmetros obrigatórios: --name, --email, --password\n\n' + USAGE);
    process.exit(1);
  }

  const id = a.id || `mem-${crypto.randomUUID().slice(0, 8)}`;
  const capacity = a.capacity ? Number(a.capacity) : 40;
  if (!Number.isFinite(capacity)) throw new Error('--capacity inválido');
  const active = a.active ? a.active !== 'false' : true;
  const passwordHash = await bcrypt.hash(a.password, 12);

  const conflict = a.update
    ? `ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, avatar = EXCLUDED.avatar, role = EXCLUDED.role,
         department = EXCLUDED.department, weekly_capacity_hours = EXCLUDED.weekly_capacity_hours,
         active = EXCLUDED.active, password_hash = EXCLUDED.password_hash`
    : '';

  const res = await query(
    `INSERT INTO members (id, name, email, avatar, role, department, weekly_capacity_hours, active, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ${conflict}
     RETURNING id, email`,
    [id, a.name, a.email.toLowerCase(), a.avatar || null, a.role || null, a.department || null, capacity, active, passwordHash]
  );
  console.log(`Usuário salvo: ${res.rows[0].id} <${res.rows[0].email}>`);
}

main()
  .catch((err) => {
    console.error('Erro:', err.code === '23505' ? 'ID ou e-mail já existe (use --update)' : err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
