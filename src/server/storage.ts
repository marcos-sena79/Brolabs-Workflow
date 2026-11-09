import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { del, head, issueSignedToken, presignUrl } from '@vercel/blob';
import { getVercelOidcTokenSync } from '@vercel/oidc';

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
export const UPLOAD_CONFIRM_TTL_SEC = 900; // Inclui tempo para concluir e confirmar o upload.

export type AttachmentStorageProvider = 'supabase' | 'vercel_blob';

export function attachmentStorageProvider(): AttachmentStorageProvider {
  const provider = process.env.ATTACHMENT_STORAGE_PROVIDER || 'supabase';
  if (provider !== 'supabase' && provider !== 'vercel_blob') {
    throw new Error('ATTACHMENT_STORAGE_PROVIDER deve ser supabase ou vercel_blob');
  }
  return provider;
}

export function blobConfigured(): boolean {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return true;
  if (!process.env.BLOB_STORE_ID?.trim()) return false;
  try {
    return Boolean(getVercelOidcTokenSync().trim());
  } catch (error) {
    if (error instanceof Error && error.message === "The 'x-vercel-oidc-token' header is missing from the request.") {
      return false;
    }
    throw error;
  }
}

export async function blobUploadUrl(pathname: string, mimeType: string, sizeBytes: number): Promise<string> {
  const validUntil = Date.now() + SIGNED_UPLOAD_TTL_SEC * 1000;
  const token = await issueSignedToken({
    pathname,
    operations: ['put'],
    validUntil,
    allowedContentTypes: [mimeType],
    maximumSizeInBytes: sizeBytes,
  });
  const result = await presignUrl(token, {
    operation: 'put',
    pathname,
    access: 'private',
    validUntil,
    allowedContentTypes: [mimeType],
    maximumSizeInBytes: sizeBytes,
    allowOverwrite: false,
    addRandomSuffix: false,
  });
  return result.presignedUrl;
}

export async function blobDownloadUrl(pathname: string): Promise<string> {
  const validUntil = Date.now() + SIGNED_GET_TTL_SEC * 1000;
  const token = await issueSignedToken({ pathname, operations: ['get'], validUntil });
  const result = await presignUrl(token, { operation: 'get', pathname, access: 'private', validUntil });
  return result.presignedUrl;
}

export async function blobStat(pathname: string): Promise<{ size: number; mimetype: string }> {
  const result = await head(pathname);
  return { size: result.size, mimetype: result.contentType };
}

export async function deleteStoredAttachment(provider: AttachmentStorageProvider, pathname: string): Promise<void> {
  if (provider === 'vercel_blob') {
    await del(pathname);
  } else if (!(await removeObject(pathname))) {
    throw new Error('Falha ao remover anexo do Supabase Storage');
  }
}

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
  if (error) throw error;
  if (!data) throw new Error('Supabase não retornou os metadados do anexo');
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
