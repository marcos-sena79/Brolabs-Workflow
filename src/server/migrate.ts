import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { pool, query } from './db';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'migrations');

interface MigrationFile {
  version: string;
  name: string;
  upPath: string;
  downPath: string | null;
  checksum: string;
}

function loadMigrations(): MigrationFile[] {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.up.sql'))
    .sort();
  return files.map((file) => {
    const match = file.match(/^(\d+)_(.+)\.up\.sql$/);
    if (!match) {
      throw new Error(`Nome de migration inválido: ${file} (esperado NNNN_nome.up.sql)`);
    }
    const [, version, name] = match;
    const upPath = path.join(MIGRATIONS_DIR, file);
    const downPath = path.join(MIGRATIONS_DIR, `${version}_${name}.down.sql`);
    const content = fs.readFileSync(upPath, 'utf8');
    return {
      version,
      name,
      upPath,
      downPath: fs.existsSync(downPath) ? downPath : null,
      checksum: crypto.createHash('sha256').update(content).digest('hex'),
    };
  });
}

async function ensureMigrationsTable(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(20) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      checksum VARCHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function getApplied(): Promise<Map<string, { checksum: string }>> {
  const res = await query('SELECT version, checksum FROM schema_migrations ORDER BY version ASC');
  return new Map(res.rows.map((r: any) => [r.version, { checksum: r.checksum }]));
}

export async function migrateUp(): Promise<string[]> {
  await ensureMigrationsTable();
  const applied = await getApplied();
  const migrations = loadMigrations();
  const executed: string[] = [];

  for (const m of migrations) {
    const already = applied.get(m.version);
    if (already) {
      if (already.checksum !== m.checksum) {
        console.warn(
          `⚠️  Migration ${m.version}_${m.name} foi alterada após aplicada (checksum divergente).`
        );
      }
      continue;
    }
    const sql = fs.readFileSync(m.upPath, 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (version, name, checksum) VALUES ($1, $2, $3)',
        [m.version, m.name, m.checksum]
      );
      await client.query('COMMIT');
      console.log(`✅ Applied ${m.version}_${m.name}`);
      executed.push(`${m.version}_${m.name}`);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`❌ Failed ${m.version}_${m.name}: ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }
  if (executed.length === 0) {
    console.log('ℹ️  Nenhuma migration pendente.');
  }
  return executed;
}

export async function migrateDown(steps = 1): Promise<string[]> {
  await ensureMigrationsTable();
  const res = await query(
    'SELECT version, name FROM schema_migrations ORDER BY version DESC LIMIT $1',
    [steps]
  );
  const reverted: string[] = [];

  for (const row of res.rows) {
    const migration = loadMigrations().find((m) => m.version === row.version);
    if (!migration) {
      throw new Error(`Arquivos de migration não encontrados para ${row.version}_${row.name}`);
    }
    if (!migration.downPath) {
      throw new Error(`Migration ${row.version}_${row.name} não possui .down.sql`);
    }
    const sql = fs.readFileSync(migration.downPath, 'utf8');
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('DELETE FROM schema_migrations WHERE version = $1', [row.version]);
      await client.query('COMMIT');
      console.log(`↩️  Reverted ${row.version}_${row.name}`);
      reverted.push(`${row.version}_${row.name}`);
    } catch (err: any) {
      await client.query('ROLLBACK');
      console.error(`❌ Rollback failed ${row.version}_${row.name}: ${err.message}`);
      throw err;
    } finally {
      client.release();
    }
  }
  return reverted;
}

/** Resumo compacto para /api/health: 'up-to-date' ou 'pending:N'. */
export async function migrationsSummary(): Promise<string> {
  await ensureMigrationsTable();
  const applied = await getApplied();
  const pending = loadMigrations().filter((m) => !applied.has(m.version));
  return pending.length === 0 ? 'up-to-date' : `pending:${pending.length}`;
}

export async function migrateStatus(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getApplied();
  const migrations = loadMigrations();
  console.log('Version   Status    Name');
  console.log('------------------------------------------');
  for (const m of migrations) {
    const status = applied.has(m.version) ? 'applied' : 'pending';
    console.log(`${m.version.padEnd(9)} ${status.padEnd(9)} ${m.name}`);
  }
  for (const [version] of applied) {
    if (!migrations.find((m) => m.version === version)) {
      console.log(`${version.padEnd(9)} ${'applied'.padEnd(9)} (arquivos ausentes)`);
    }
  }
}

async function main() {
  const cmd = process.argv[2] || 'up';
  try {
    if (cmd === 'up') {
      await migrateUp();
    } else if (cmd === 'down') {
      const steps = parseInt(process.argv[3] || '1', 10);
      await migrateDown(steps);
    } else if (cmd === 'status') {
      await migrateStatus();
    } else {
      console.error(`Comando desconhecido: ${cmd} (use up | down [n] | status)`);
      process.exitCode = 1;
    }
  } catch {
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

// Executa a CLI apenas quando chamado diretamente (tsx src/server/migrate.ts),
// nunca quando importado pelo server.ts (ex.: migrationsSummary p/ /api/health).
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  main();
}
