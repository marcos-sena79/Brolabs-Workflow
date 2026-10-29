import type { Board, Member } from '../types';

/**
 * Fonte de verdade dos dados iniciais do app (boards/membros/tarefas).
 *
 * Regras (Onda 2 — remoção de fallbacks demo):
 * - O backend é a única fonte de verdade: a resposta de GET /api/initial-state
 *   substitui integralmente o estado (inclusive com listas vazias).
 * - Nenhum board/membro fictício é exibido durante loading, erro ou vazio.
 * - EMPTY_BOARD/EMPTY_MEMBER são placeholders vazios (strings vazias, listas
 *   vazias) usados apenas para evitar crashes de tipagem em memos derivados
 *   quando ainda não existe dado real — nunca são renderizados, pois o App
 *   gateia loading/erro/vazio antes de montar a UI.
 */

export const EMPTY_BOARD: Board = {
  id: '',
  key: '',
  name: '',
  description: '',
  sprintName: '',
  sprintGoal: '',
  sprintStartDate: '',
  sprintEndDate: '',
  columns: [],
  epics: [],
};

export const EMPTY_MEMBER: Member = {
  id: '',
  name: '',
  email: '',
  avatar: '',
  role: '',
  department: '',
  weeklyCapacityHours: 0,
  active: false,
};

export type AppStatus = 'loading' | 'error' | 'empty' | 'ready';

/**
 * Decide qual estado global o App deve exibir.
 *
 * - Sem boards ainda: loading enquanto busca; se a API falhou → erro;
 *   se respondeu com zero boards → vazio (não cria board automaticamente).
 * - Com boards (carga inicial concluída): ready. Refetches posteriores não
 *   desmontam a UI; falha de refetch fica visível no badge do Navbar.
 */
export function deriveAppStatus(state: {
  isLoading: boolean;
  dbConnected: boolean;
  boards: Board[];
}): AppStatus {
  if (state.boards.length > 0) return 'ready';
  if (state.isLoading) return 'loading';
  return state.dbConnected ? 'empty' : 'error';
}

export interface InitialStateLike {
  boards?: Board[] | null;
  members?: Member[] | null;
  currentBoardId?: string | null;
  currentUserId?: string | null;
}

export interface ResolvedInitialCollections {
  boards: Board[];
  members: Member[];
  currentBoardId: string;
  currentUserId: string;
}

/**
 * Converte a resposta de /api/initial-state em coleções de estado.
 *
 * - Listas ausentes/vazias viram [] (nunca preserva placeholder anterior).
 * - currentBoardId só é honrado se existir na resposta; caso contrário,
 *   usa-se deterministicamente o primeiro board (ou '' se não houver).
 * - currentUserId honra o servidor; fallback é o primeiro membro da resposta.
 */
export function resolveInitialState(data: InitialStateLike): ResolvedInitialCollections {
  const boards = Array.isArray(data.boards) ? data.boards : [];
  const members = Array.isArray(data.members) ? data.members : [];

  const requestedBoardId = typeof data.currentBoardId === 'string' ? data.currentBoardId : '';
  const currentBoardId =
    requestedBoardId && boards.some((b) => b.id === requestedBoardId)
      ? requestedBoardId
      : boards[0]?.id ?? '';

  const requestedUserId = typeof data.currentUserId === 'string' ? data.currentUserId : '';
  const currentUserId = requestedUserId || members[0]?.id || '';

  return { boards, members, currentBoardId, currentUserId };
}
