import { list } from '@vercel/blob';
import type { PoolClient } from 'pg';
import { pool } from './db';
import { getStorage, storageBucket, type AttachmentStorageProvider } from './storage';

const PAGE_SIZE = 25;
const MIN_AGE_MS = 24 * 60 * 60 * 1000;

interface DirectoryCursor {
  path: string;
  offset: number;
}

async function queueOrphan(
  client: PoolClient,
  provider: AttachmentStorageProvider,
  path: string,
  createdAt: Date
): Promise<void> {
  if (!Number.isFinite(createdAt.getTime())) {
    throw new Error('Storage retornou data inválida para um anexo');
  }
  if (createdAt.getTime() > Date.now() - MIN_AGE_MS) return;
  await client.query(
    `INSERT INTO attachment_cleanup_queue (storage_provider, storage_path, not_before)
     SELECT $1, $2, NOW()
     WHERE NOT EXISTS (SELECT 1 FROM task_attachments WHERE storage_provider = $1 AND storage_path = $2)
       AND NOT EXISTS (SELECT 1 FROM attachment_uploads WHERE $1 = 'vercel_blob' AND storage_path = $2)
     ON CONFLICT (storage_provider, storage_path) DO NOTHING`,
    [provider, path]
  );
}

async function scanBlob(client: PoolClient, state: unknown): Promise<string | null> {
  if (state !== null && typeof state !== 'string') throw new Error('Cursor Blob inválido');
  const result = await list({
    prefix: 'task-attachments/',
    limit: PAGE_SIZE,
    ...(state ? { cursor: state } : {}),
  });
  for (const blob of result.blobs) {
    await queueOrphan(client, 'vercel_blob', blob.pathname, blob.uploadedAt);
  }
  if (result.hasMore && !result.cursor) throw new Error('Vercel Blob não retornou cursor de paginação');
  return result.hasMore ? result.cursor! : null;
}

function isDirectoryCursor(value: unknown): value is DirectoryCursor {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.path === 'string' && typeof entry.offset === 'number' &&
    Number.isInteger(entry.offset) && entry.offset >= 0;
}

async function scanSupabase(client: PoolClient, state: unknown): Promise<DirectoryCursor[]> {
  if (!Array.isArray(state) || !state.every(isDirectoryCursor)) throw new Error('Cursor Supabase inválido');
  const directories: DirectoryCursor[] = state.length ? [...state] : [{ path: '', offset: 0 }];
  const current = directories.shift()!;
  const supabase = getStorage();
  if (!supabase) throw new Error('Supabase Storage não configurado');
  const { data, error } = await supabase.storage.from(storageBucket()).list(current.path, {
    limit: PAGE_SIZE,
    offset: current.offset,
    sortBy: { column: 'name', order: 'asc' },
  });
  if (error) throw error;
  if (data.length === PAGE_SIZE) {
    directories.unshift({ path: current.path, offset: current.offset + PAGE_SIZE });
  }
  for (const item of data) {
    const path = current.path ? `${current.path}/${item.name}` : item.name;
    if (item.id === null) {
      directories.push({ path, offset: 0 });
    } else {
      if (!item.created_at) throw new Error('Supabase não retornou data de criação de um anexo');
      await queueOrphan(client, 'supabase', path, new Date(item.created_at));
    }
  }
  return directories;
}

/** Processa uma página por chamada; o cursor transacional permite retomar no próximo cron. */
export async function reconcileAttachmentPage(provider: AttachmentStorageProvider): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO attachment_cleanup_cursors (storage_provider, state) VALUES ($1, $2::jsonb)
       ON CONFLICT (storage_provider) DO NOTHING`,
      [provider, JSON.stringify(provider === 'supabase' ? [] : null)]
    );
    const result = await client.query(
      'SELECT state FROM attachment_cleanup_cursors WHERE storage_provider = $1 FOR UPDATE SKIP LOCKED',
      [provider]
    );
    if (result.rows.length) {
      const state = provider === 'supabase'
        ? await scanSupabase(client, result.rows[0].state)
        : await scanBlob(client, result.rows[0].state);
      await client.query('UPDATE attachment_cleanup_cursors SET state = $2::jsonb WHERE storage_provider = $1',
        [provider, JSON.stringify(state)]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
