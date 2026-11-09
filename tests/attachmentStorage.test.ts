import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sdk = vi.hoisted(() => ({
  issueSignedToken: vi.fn(),
  presignUrl: vi.fn(),
  head: vi.fn(),
  del: vi.fn(),
}));
vi.mock('@vercel/blob', () => sdk);

import {
  attachmentStorageProvider,
  blobDownloadUrl,
  blobStat,
  blobUploadUrl,
  deleteStoredAttachment,
  isAllowedExtension,
} from '../src/server/storage';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  sdk.issueSignedToken.mockReset().mockResolvedValue({ delegationToken: 'delegation', clientSigningToken: 'key' });
  sdk.presignUrl.mockReset().mockResolvedValue({ presignedUrl: 'https://example.test/signed' });
  sdk.head.mockReset();
  sdk.del.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('storage de anexos', () => {
  it('mantém Supabase como padrão e rejeita configuração inválida', () => {
    vi.stubEnv('ATTACHMENT_STORAGE_PROVIDER', '');
    expect(attachmentStorageProvider()).toBe('supabase');
    vi.stubEnv('ATTACHMENT_STORAGE_PROVIDER', 'vercel_blob');
    expect(attachmentStorageProvider()).toBe('vercel_blob');
    vi.stubEnv('ATTACHMENT_STORAGE_PROVIDER', 'outro');
    expect(() => attachmentStorageProvider()).toThrow();
  });

  it('restringe PUT ao caminho, tamanho exato, MIME e cinco minutos', async () => {
    await blobUploadUrl('task-attachments/a.pdf', 'application/pdf', 10 * 1024 * 1024);
    const validUntil = Date.now() + 300_000;
    expect(sdk.issueSignedToken).toHaveBeenCalledWith({
      pathname: 'task-attachments/a.pdf', operations: ['put'], validUntil,
      allowedContentTypes: ['application/pdf'], maximumSizeInBytes: 10 * 1024 * 1024,
    });
    expect(sdk.presignUrl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      operation: 'put', pathname: 'task-attachments/a.pdf', access: 'private',
      validUntil, allowOverwrite: false, addRandomSuffix: false,
    }));
  });

  it('restringe GET privado ao caminho e a quinze minutos', async () => {
    await blobDownloadUrl('task-attachments/a.pdf');
    expect(sdk.issueSignedToken).toHaveBeenCalledWith({
      pathname: 'task-attachments/a.pdf', operations: ['get'], validUntil: Date.now() + 900_000,
    });
    expect(sdk.presignUrl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      operation: 'get', pathname: 'task-attachments/a.pdf', access: 'private',
    }));
  });

  it('retorna metadados reais e propaga falhas de exclusão', async () => {
    sdk.head.mockResolvedValue({ size: 12, contentType: 'text/plain' });
    expect(await blobStat('file')).toEqual({ size: 12, mimetype: 'text/plain' });
    sdk.del.mockRejectedValue(new Error('offline'));
    await expect(deleteStoredAttachment('vercel_blob', 'file')).rejects.toThrow('offline');
  });

  it('não permite SVG por extensão', () => {
    expect(isAllowedExtension('image.svg')).toBe(false);
    expect(isAllowedExtension('file.PDF')).toBe(true);
  });
});
