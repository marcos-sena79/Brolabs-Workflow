import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/services/api';

class FakeXhr {
  static last: FakeXhr;
  headers: Record<string, string> = {};
  upload: { onprogress?: (event: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  status = 200;
  onload?: () => void;
  onerror?: () => void;
  constructor() { FakeXhr.last = this; }
  open = vi.fn();
  setRequestHeader(name: string, value: string) { this.headers[name] = value; }
  send() {
    this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 2 });
    this.onload?.();
  }
}

afterEach(() => vi.unstubAllGlobals());

describe('upload de anexos no navegador', () => {
  it.each([
    ['vercel_blob', true],
    [undefined, false],
  ])('mantém progresso e cabeçalhos corretos para %s', async (provider, isBlob) => {
    vi.stubGlobal('localStorage', { getItem: () => 'token' });
    vi.stubGlobal('XMLHttpRequest', FakeXhr);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ attachmentId: 'att-1', uploadUrl: 'https://storage.test/upload', provider }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ attachment: { id: 'att-1' } }) });
    vi.stubGlobal('fetch', fetchMock);
    const progress = vi.fn();
    const file = new File(['abc'], 'file.pdf', { type: 'application/pdf' });

    expect(await api.uploadTaskAttachment('task-1', file, progress)).toEqual({ id: 'att-1' });
    expect(FakeXhr.last.open).toHaveBeenCalledWith('PUT', 'https://storage.test/upload');
    expect(FakeXhr.last.headers['Content-Type']).toBe('application/pdf');
    expect(FakeXhr.last.headers['x-vercel-blob-access']).toBe(isBlob ? 'private' : undefined);
    expect(FakeXhr.last.headers['x-content-type']).toBe(isBlob ? 'application/pdf' : undefined);
    expect(progress).toHaveBeenCalledWith(50);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
