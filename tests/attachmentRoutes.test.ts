import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  connect: vi.fn(),
  blobUploadUrl: vi.fn(),
  blobDownloadUrl: vi.fn(),
  blobStat: vi.fn(),
  deleteStoredAttachment: vi.fn(),
}));
vi.mock('../src/server/db', () => ({ query: mocks.query, pool: { connect: mocks.connect } }));
vi.mock('../src/server/initDb', () => ({ initializeDatabase: vi.fn().mockResolvedValue(undefined), seedDatabase: vi.fn() }));
vi.mock('../src/server/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/server/storage')>()),
  blobUploadUrl: mocks.blobUploadUrl,
  blobDownloadUrl: mocks.blobDownloadUrl,
  blobStat: mocks.blobStat,
  deleteStoredAttachment: mocks.deleteStoredAttachment,
}));

let server: Server;
let baseUrl: string;
let token: string;
let boardAccess = true;
let rows: Record<string, unknown>[];
let pending: Record<string, unknown>[];
let txCount: number;
const transactionQuery = vi.fn();

beforeAll(async () => {
  vi.stubEnv('VERCEL', '1');
  vi.stubEnv('ATTACHMENT_STORAGE_PROVIDER', 'vercel_blob');
  vi.stubEnv('BLOB_READ_WRITE_TOKEN', 'test-token');
  const { generateToken } = await import('../src/server/auth');
  token = generateToken('member-1');
  const { default: app } = await import('../server');
  server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
    listener.once('error', reject);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No test port');
  baseUrl = `http://127.0.0.1:${address.port}`;
}, 30000);

afterAll(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  vi.unstubAllEnvs();
});

beforeEach(() => {
  boardAccess = true;
  rows = [];
  pending = [];
  txCount = 0;
  vi.clearAllMocks();
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT * FROM tasks')) return { rows: [{ id: 'task-1', board_id: 'board-1' }] };
    if (sql.includes('FROM members')) return { rows: [{ system_role: boardAccess ? 'admin' : 'member' }] };
    if (sql.includes('FROM board_members')) return { rows: [] };
    if (sql.includes('FROM attachment_uploads')) return { rows: pending };
    if (sql.includes('FROM task_attachments')) return { rows };
    return { rows: [] };
  });
  transactionQuery.mockImplementation(async (sql: string) => {
    if (sql.includes('SELECT id FROM tasks')) return { rows: [{ id: 'task-1' }] };
    if (sql.includes('AS n')) return { rows: [{ n: txCount }] };
    return { rows: [] };
  });
  mocks.connect.mockResolvedValue({ query: transactionQuery, release: vi.fn() });
  mocks.blobUploadUrl.mockResolvedValue('https://blob.test/upload');
  mocks.blobDownloadUrl.mockResolvedValue('https://blob.test/download');
  mocks.deleteStoredAttachment.mockResolvedValue(undefined);
});

function request(path: string, method = 'GET', body?: object, authorized = true) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authorized ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('rotas de anexos', () => {
  const uploadPath = '/api/tasks/task-1/attachments/upload-url';
  const file = { filename: 'report.pdf', mimeType: 'application/pdf', sizeBytes: 10 * 1024 * 1024 };

  it('exige autenticação e acesso ao quadro', async () => {
    expect((await request(uploadPath, 'POST', file, false)).status).toBe(401);
    boardAccess = false;
    expect((await request(uploadPath, 'POST', file)).status).toBe(403);
    expect(mocks.blobUploadUrl).not.toHaveBeenCalled();
  });

  it('aceita exatamente 10 MiB e reserva sob bloqueio antes de assinar', async () => {
    const response = await request(uploadPath, 'POST', file);
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ provider: 'vercel_blob', uploadUrl: 'https://blob.test/upload' });
    expect(transactionQuery.mock.calls.some(([sql]) => sql.includes('FOR UPDATE'))).toBe(true);
    expect(transactionQuery.mock.calls.some(([sql]) => sql.includes('INSERT INTO attachment_uploads'))).toBe(true);
    expect(mocks.blobUploadUrl).toHaveBeenCalledWith(expect.stringMatching(/^task-attachments\//), file.mimeType, file.sizeBytes);
  });

  it('recusa arquivo acima de 10 MiB, SVG e limite de 20', async () => {
    expect((await request(uploadPath, 'POST', { ...file, sizeBytes: file.sizeBytes + 1 })).status).toBe(413);
    expect((await request(uploadPath, 'POST', { ...file, filename: 'image.svg', mimeType: 'image/svg+xml' })).status).toBe(415);
    txCount = 20;
    expect((await request(uploadPath, 'POST', file)).status).toBe(409);
    expect(mocks.blobUploadUrl).not.toHaveBeenCalled();
  });

  it('impede confirmar tentativa pertencente a outro usuário', async () => {
    pending = [{ id: 'att-1', uploader_id: 'other', original_name: file.filename, mime_type: file.mimeType, size_bytes: file.sizeBytes }];
    const response = await request('/api/tasks/task-1/attachments/confirm', 'POST', { attachmentId: 'att-1', ...file });
    expect(response.status).toBe(403);
    expect(mocks.blobStat).not.toHaveBeenCalled();
  });

  it('rejeita confirmação quando o tamanho real difere', async () => {
    pending = [{
      id: 'att-1', task_id: 'task-1', board_id: 'board-1', uploader_id: 'member-1',
      original_name: file.filename, mime_type: file.mimeType, size_bytes: file.sizeBytes,
      storage_path: 'task-attachments/att-1.pdf', expires_at: new Date(Date.now() + 60_000),
    }];
    mocks.blobStat.mockResolvedValue({ size: file.sizeBytes - 1, mimetype: file.mimeType });
    const response = await request('/api/tasks/task-1/attachments/confirm', 'POST', { attachmentId: 'att-1', ...file });
    expect(response.status).toBe(422);
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it('confirma os metadados do upload reservado', async () => {
    const upload = {
      id: 'att-1', task_id: 'task-1', board_id: 'board-1', uploader_id: 'member-1',
      original_name: file.filename, mime_type: file.mimeType, size_bytes: file.sizeBytes,
      storage_path: 'task-attachments/att-1.pdf', expires_at: new Date(Date.now() + 60_000),
    };
    pending = [upload];
    mocks.blobStat.mockResolvedValue({ size: file.sizeBytes, mimetype: file.mimeType });
    transactionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes('SELECT id FROM tasks')) return { rows: [{ id: 'task-1' }] };
      if (sql.includes('SELECT * FROM attachment_uploads')) return { rows: [upload] };
      if (sql.includes('INSERT INTO task_attachments')) return { rows: [upload] };
      return { rows: [] };
    });
    const response = await request('/api/tasks/task-1/attachments/confirm', 'POST', { attachmentId: 'att-1', ...file });
    expect(response.status).toBe(201);
    expect((await response.json()).attachment.id).toBe('att-1');
    expect(transactionQuery.mock.calls.some(([sql]) => sql === 'COMMIT')).toBe(true);
  });

  it('assina download Blob privado e não expõe o caminho na listagem', async () => {
    rows = [{ id: 'att-1', task_id: 'task-1', board_id: 'board-1', storage_provider: 'vercel_blob', storage_path: 'private/path', mime_type: file.mimeType, size_bytes: 10 }];
    const list = await request('/api/tasks/task-1/attachments');
    expect(JSON.stringify(await list.json())).not.toContain('private/path');
    const download = await request('/api/tasks/task-1/attachments/att-1/url');
    expect(await download.json()).toEqual({ url: 'https://blob.test/download', expiresIn: 900 });
    expect(mocks.blobDownloadUrl).toHaveBeenCalledWith('private/path');
  });

  it('mantém o registro quando a exclusão no storage falha', async () => {
    rows = [{ storage_provider: 'vercel_blob', storage_path: 'private/path' }];
    mocks.deleteStoredAttachment.mockRejectedValue(new Error('offline'));
    const response = await request('/api/tasks/task-1/attachments/att-1', 'DELETE');
    expect(response.status).toBe(500);
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith('DELETE FROM task_attachments'))).toBe(false);
  });
});
