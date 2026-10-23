import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/** Cliente Supabase (service role) — null se as envs não estiverem configuradas. */
export function getStorage(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export function storageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET || 'task-attachments';
}

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024; // 10 MB (Vercel body é ~4,5MB; presigned escapa disso)
export const ATTACHMENT_MAX_PER_TASK = 20;
export const SIGNED_UPLOAD_TTL_SEC = 300; // 5 min
export const SIGNED_GET_TTL_SEC = 900; // 15 min

const ALLOWED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp',
  'pdf', 'csv', 'txt', 'zip', 'md',
  'doc', 'docx', 'xls', 'xlsx',
]);

export function extensionOf(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx === -1 ? '' : filename.slice(idx + 1).toLowerCase();
}

/** Valida extensão (allowlist; svg bloqueado por XSS). */
export function isAllowedExtension(filename: string): boolean {
  return ALLOWED_EXTENSIONS.has(extensionOf(filename));
}

/** Verifica se o objeto existe no bucket. Retorna metadata ou null. */
export async function statObject(
  path: string
): Promise<{ size: number; mimetype: string } | null> {
  const supabase = getStorage();
  if (!supabase) return null;
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const base = path.slice(path.lastIndexOf('/') + 1);
  const { data, error } = await supabase.storage.from(storageBucket()).list(dir, {
    search: base,
    limit: 100,
  });
  if (error || !data) return null;
  const found = data.find((f) => f.name === base);
  if (!found) return null;
  return {
    size: (found.metadata as any)?.size ?? 0,
    mimetype: (found.metadata as any)?.mimetype ?? 'application/octet-stream',
  };
}

/** Remove objeto(s) do bucket (best-effort). */
export async function removeObject(path: string): Promise<boolean> {
  const supabase = getStorage();
  if (!supabase) return false;
  const { error } = await supabase.storage.from(storageBucket()).remove([path]);
  return !error;
}

/** Lista arquivos em um "diretório" do bucket. Pastas vêm com id null. */
export async function listObjects(
  dir: string
): Promise<Array<{ name: string; id: string | null; created_at?: string; size?: number }>> {
  const supabase = getStorage();
  if (!supabase) return [];
  const { data, error } = await supabase.storage.from(storageBucket()).list(dir, { limit: 1000 });
  if (error || !data) return [];
  return data.map((f) => ({
    name: f.name,
    id: (f as any).id ?? null,
    created_at: f.created_at ?? undefined,
    size: (f.metadata as any)?.size,
  }));
}
