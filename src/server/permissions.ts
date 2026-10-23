import { query } from './db';

export type PermissionFlag =
  | 'canCreateTask'
  | 'canEditTask'
  | 'canChangeStatus'
  | 'canAddComment'
  | 'canLogWork'
  | 'canInviteMember'
  | 'canManageMembers'
  | 'canManageBoard'
  | 'canDeleteTask';

export const ALL_FLAGS: PermissionFlag[] = [
  'canCreateTask',
  'canEditTask',
  'canChangeStatus',
  'canAddComment',
  'canLogWork',
  'canInviteMember',
  'canManageMembers',
  'canManageBoard',
  'canDeleteTask',
];

export type RoleName = 'owner' | 'editor' | 'viewer';

const OWNER_FLAGS: Record<PermissionFlag, boolean> = {
  canCreateTask: true,
  canEditTask: true,
  canChangeStatus: true,
  canAddComment: true,
  canLogWork: true,
  canInviteMember: true,
  canManageMembers: true,
  canManageBoard: true,
  canDeleteTask: true,
};

const EDITOR_FLAGS: Record<PermissionFlag, boolean> = {
  canCreateTask: true,
  canEditTask: true,
  canChangeStatus: true,
  canAddComment: true,
  canLogWork: true,
  canInviteMember: false,
  canManageMembers: false,
  canManageBoard: false,
  canDeleteTask: false,
};

const VIEWER_FLAGS: Record<PermissionFlag, boolean> = {
  canCreateTask: false,
  canEditTask: false,
  canChangeStatus: false,
  canAddComment: false,
  canLogWork: false,
  canInviteMember: false,
  canManageMembers: false,
  canManageBoard: false,
  canDeleteTask: false,
};

const ROLE_FLAGS: Record<RoleName, Record<PermissionFlag, boolean>> = {
  owner: OWNER_FLAGS,
  editor: EDITOR_FLAGS,
  viewer: VIEWER_FLAGS,
};

export interface EffectivePermissions extends Record<PermissionFlag, boolean> {
  role: RoleName;
  isAdmin: boolean;
  hasBoardAccess: boolean;
}

declare global {
  namespace Express {
    interface Request {
      boardPermissions?: EffectivePermissions;
    }
  }
}

function safeJson(val: any): Record<string, unknown> {
  if (!val) return {};
  if (typeof val === 'object') return val;
  try {
    return JSON.parse(val);
  } catch {
    return {};
  }
}

/** Resolve as permissões efetivas de um membro num board. null = sem acesso. */
export async function resolvePermissions(
  memberId: string,
  boardId: string
): Promise<EffectivePermissions | null> {
  const memberRes = await query('SELECT system_role FROM members WHERE id = $1', [memberId]);
  const systemRole = memberRes.rows[0]?.system_role;
  if (systemRole === 'admin') {
    return { ...OWNER_FLAGS, role: 'owner', isAdmin: true, hasBoardAccess: true };
  }

  const bm = await query(
    'SELECT role, permissions FROM board_members WHERE board_id = $1 AND member_id = $2',
    [boardId, memberId]
  );
  if (bm.rows.length === 0) return null;

  const role = (bm.rows[0].role || 'viewer') as RoleName;
  const base = ROLE_FLAGS[role] ?? VIEWER_FLAGS;
  const overrides = safeJson(bm.rows[0].permissions);
  const eff: Record<PermissionFlag, boolean> = { ...base };
  for (const flag of ALL_FLAGS) {
    if (typeof overrides[flag] === 'boolean') eff[flag] = overrides[flag];
  }
  return { ...eff, role, isAdmin: false, hasBoardAccess: true };
}

function extractBoardId(req: any): string | undefined {
  return (
    req.params?.boardId ||
    req.params?.id ||
    req.body?.boardId ||
    req.query?.boardId ||
    undefined
  );
}

/** Middleware: exige flag efetiva no board da request. Cacheia em req.boardPermissions. */
export function requireBoardPermission(flag: PermissionFlag) {
  return async (req: any, res: any, next: any) => {
    try {
      const boardId = extractBoardId(req);
      if (!boardId) {
        return res.status(400).json({ error: 'board_id ausente na requisição' });
      }
      if (req.boardPermissions?.hasBoardAccess) {
        if (!req.boardPermissions[flag]) {
          return res.status(403).json({ error: 'Sem permissão para esta ação', required: flag });
        }
        return next();
      }
      const eff = await resolvePermissions(req.memberId, boardId);
      if (!eff) {
        return res.status(403).json({ error: 'Sem acesso a este quadro' });
      }
      req.boardPermissions = eff;
      if (!eff[flag]) {
        return res.status(403).json({ error: 'Sem permissão para esta ação', required: flag });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Middleware: qualquer membro com acesso ao board (leitura). */
export function requireBoardAccess() {
  return async (req: any, res: any, next: any) => {
    try {
      const boardId = extractBoardId(req);
      if (!boardId) {
        return res.status(400).json({ error: 'board_id ausente na requisição' });
      }
      if (req.boardPermissions?.hasBoardAccess) return next();
      const eff = await resolvePermissions(req.memberId, boardId);
      if (!eff) {
        return res.status(403).json({ error: 'Sem acesso a este quadro' });
      }
      req.boardPermissions = eff;
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Middleware: exige system_role='admin'. */
export function requireAdmin() {
  return async (req: any, res: any, next: any) => {
    try {
      const memberRes = await query('SELECT system_role FROM members WHERE id = $1', [req.memberId]);
      if (memberRes.rows[0]?.system_role !== 'admin') {
        return res.status(403).json({ error: 'Requer perfil administrador' });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
