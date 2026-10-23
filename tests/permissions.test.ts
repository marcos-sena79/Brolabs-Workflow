import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock('../src/server/db', () => ({ query: queryMock }));

import {
  ALL_FLAGS,
  requireBoardPermission,
  resolvePermissions,
  type EffectivePermissions,
} from '../src/server/permissions';

function seedDb({ systemRole = 'member', boardRow = null as any } = {}) {
  queryMock.mockImplementation((sql: string) => {
    if (sql.includes('FROM members')) {
      return Promise.resolve({ rows: systemRole ? [{ system_role: systemRole }] : [] });
    }
    if (sql.includes('FROM board_members')) {
      return Promise.resolve({ rows: boardRow ? [boardRow] : [] });
    }
    return Promise.resolve({ rows: [] });
  });
}

beforeEach(() => {
  queryMock.mockReset();
});

describe('resolvePermissions', () => {
  it('admin: bypass com todas as flags e isAdmin', async () => {
    seedDb({ systemRole: 'admin' });
    const eff = await resolvePermissions('m1', 'b1');
    expect(eff).not.toBeNull();
    expect(eff!.isAdmin).toBe(true);
    expect(eff!.role).toBe('owner');
    for (const f of ALL_FLAGS) expect(eff![f]).toBe(true);
    expect(queryMock).toHaveBeenCalledTimes(1);
  });

  it('sem membership no board: null', async () => {
    seedDb({ boardRow: null });
    expect(await resolvePermissions('m1', 'b1')).toBeNull();
  });

  it('owner: todas as flags, sem isAdmin', async () => {
    seedDb({ boardRow: { role: 'owner', permissions: null } });
    const eff = (await resolvePermissions('m1', 'b1'))!;
    expect(eff.role).toBe('owner');
    expect(eff.isAdmin).toBe(false);
    for (const f of ALL_FLAGS) expect(eff[f]).toBe(true);
  });

  it('editor: cria/edita, mas não convida/não gerencia/não deleta', async () => {
    seedDb({ boardRow: { role: 'editor', permissions: null } });
    const eff = (await resolvePermissions('m1', 'b1'))!;
    expect(eff.canCreateTask).toBe(true);
    expect(eff.canEditTask).toBe(true);
    expect(eff.canChangeStatus).toBe(true);
    expect(eff.canInviteMember).toBe(false);
    expect(eff.canManageBoard).toBe(false);
    expect(eff.canDeleteTask).toBe(false);
  });

  it('viewer: nenhuma flag', async () => {
    seedDb({ boardRow: { role: 'viewer', permissions: null } });
    const eff = (await resolvePermissions('m1', 'b1'))!;
    for (const f of ALL_FLAGS) expect(eff[f]).toBe(false);
  });

  it('override booleano no permissions sobrescreve a role', async () => {
    seedDb({ boardRow: { role: 'editor', permissions: '{"canManageBoard":true,"canDeleteTask":true}' } });
    const eff = (await resolvePermissions('m1', 'b1'))!;
    expect(eff.canManageBoard).toBe(true);
    expect(eff.canDeleteTask).toBe(true);
    expect(eff.canInviteMember).toBe(false);
  });

  it('override não-booleano é ignorado', async () => {
    seedDb({ boardRow: { role: 'viewer', permissions: '{"canCreateTask":"yes"}' } });
    const eff = (await resolvePermissions('m1', 'b1'))!;
    expect(eff.canCreateTask).toBe(false);
  });

  it('role desconhecida cai em viewer', async () => {
    seedDb({ boardRow: { role: 'anything', permissions: null } });
    const eff = (await resolvePermissions('m1', 'b1'))!;
    expect(eff.role).toBe('anything');
    for (const f of ALL_FLAGS) expect(eff[f]).toBe(false);
  });
});

function fakeRes() {
  const res: any = { statusCode: 200, body: null };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: any) => ((res.body = b), res);
  return res;
}

describe('requireBoardPermission', () => {
  it('400 quando não há board_id', async () => {
    seedDb();
    const res = fakeRes();
    const next = vi.fn();
    await requireBoardPermission('canManageBoard')({ params: {}, memberId: 'm1' }, res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it('403 para editor sem canManageBoard', async () => {
    seedDb({ boardRow: { role: 'editor', permissions: null } });
    const res = fakeRes();
    const next = vi.fn();
    await requireBoardPermission('canManageBoard')(
      { params: { boardId: 'b1' }, memberId: 'm1' },
      res,
      next
    );
    expect(res.statusCode).toBe(403);
    expect(res.body.required).toBe('canManageBoard');
    expect(next).not.toHaveBeenCalled();
  });

  it('usa req.boardPermissions em cache sem consultar o banco', async () => {
    const cached = { hasBoardAccess: true, canManageBoard: false } as EffectivePermissions;
    const res = fakeRes();
    const next = vi.fn();
    await requireBoardPermission('canManageBoard')(
      { params: { boardId: 'b1' }, memberId: 'm1', boardPermissions: cached },
      res,
      next
    );
    expect(res.statusCode).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('segue para next() quando a flag é permitida', async () => {
    seedDb({ boardRow: { role: 'owner', permissions: null } });
    const res = fakeRes();
    const next = vi.fn();
    await requireBoardPermission('canManageBoard')(
      { params: { boardId: 'b1' }, memberId: 'm1' },
      res,
      next
    );
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.body).toBeNull();
  });

  it('403 quando o membro não tem acesso ao quadro', async () => {
    seedDb({ boardRow: null });
    const res = fakeRes();
    const next = vi.fn();
    await requireBoardPermission('canManageBoard')(
      { params: { boardId: 'b1' }, memberId: 'm1' },
      res,
      next
    );
    expect(res.statusCode).toBe(403);
    expect(res.body.error).toContain('acesso');
    expect(next).not.toHaveBeenCalled();
  });
});
