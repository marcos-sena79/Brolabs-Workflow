import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ list: vi.fn(), connect: vi.fn(), supabaseList: vi.fn() }));
vi.mock('@vercel/blob', () => ({ list: mocks.list }));
vi.mock('../src/server/db', () => ({ pool: { connect: mocks.connect } }));
vi.mock('../src/server/storage', () => ({
  getStorage: () => ({ storage: { from: () => ({ list: mocks.supabaseList }) } }),
  storageBucket: () => 'task-attachments',
}));

import { reconcileAttachmentPage } from '../src/server/attachmentReconciliation';

let state: unknown;
const query = vi.fn();
const release = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  state = null;
  query.mockImplementation(async (sql: string) => {
    if (sql.startsWith('SELECT state')) return { rows: [{ state }] };
    return { rows: [] };
  });
  mocks.connect.mockResolvedValue({ query, release });
});

describe('reconciliação de anexos', () => {
  it('paginação Blob enfileira apenas objetos antigos e persiste o cursor', async () => {
    mocks.list.mockResolvedValue({
      blobs: [
        { pathname: 'task-attachments/old', uploadedAt: new Date(Date.now() - 172_800_000) },
        { pathname: 'task-attachments/new', uploadedAt: new Date() },
      ],
      hasMore: true, cursor: 'next-page',
    });
    await reconcileAttachmentPage('vercel_blob');
    expect(mocks.list).toHaveBeenCalledWith({ prefix: 'task-attachments/', limit: 25 });
    const queued = query.mock.calls.filter(([sql]) => sql.includes('INSERT INTO attachment_cleanup_queue'));
    expect(queued).toHaveLength(1);
    expect(queued[0][1]).toEqual(['vercel_blob', 'task-attachments/old']);
    expect(queued[0][0]).toContain('NOT EXISTS');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE attachment_cleanup_cursors'), ['vercel_blob', '"next-page"']);
    expect(release).toHaveBeenCalled();
  });

  it('percorre pastas Supabase mesmo quando o quadro não existe mais', async () => {
    state = [{ path: '', offset: 0 }];
    mocks.supabaseList.mockResolvedValue({ data: [{ id: null, name: 'board-deleted' }], error: null });
    await reconcileAttachmentPage('supabase');
    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE attachment_cleanup_cursors'), [
      'supabase', JSON.stringify([{ path: 'board-deleted', offset: 0 }]),
    ]);
  });

  it('reverte a página e propaga erros de listagem', async () => {
    mocks.list.mockRejectedValue(new Error('offline'));
    await expect(reconcileAttachmentPage('vercel_blob')).rejects.toThrow('offline');
    expect(query).toHaveBeenCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalled();
  });
});
