/**
 * Testes do fluxo de dados iniciais (remoção de fallbacks demo).
 *
 * Cenários exigidos:
 * 1. Loading sem placeholder: status 'loading' sem boards → App não monta UI.
 * 2. Resposta com 2 boards reais → ambos preservados + seleção determinística.
 * 3. Resposta vazia → estado vazio (não cria board, não preserva placeholder).
 * 4. Erro de API → estado de erro (não exibe dados demo).
 *
 * Tudo puro/mocked: nenhum teste conecta ao banco real.
 */
import { describe, it, expect } from 'vitest';
import type { Board, Member } from '../src/types';
import {
  EMPTY_BOARD,
  EMPTY_MEMBER,
  deriveAppStatus,
  resolveInitialState,
} from '../src/utils/initialDataFlow';

const makeBoard = (id: string, name: string): Board => ({
  id,
  key: id.replace('board-', '').slice(0, 3).toUpperCase(),
  name,
  description: '',
  sprintName: 'S1',
  sprintGoal: '',
  sprintStartDate: '2026-01-01',
  sprintEndDate: '2026-01-14',
  columns: [{ id: 'col-todo', title: 'A Fazer', order: 0, accentColor: '#3b82f6' }],
  epics: [],
});

const makeMember = (id: string, name: string): Member => ({
  id,
  name,
  email: `${id}@example.com`,
  avatar: '',
  role: 'Dev',
  department: 'Eng',
  weeklyCapacityHours: 40,
  active: true,
});

describe('placeholders vazios (nunca são dados fictícios)', () => {
  it('EMPTY_BOARD não contém conteúdo demo', () => {
    expect(EMPTY_BOARD.id).toBe('');
    expect(EMPTY_BOARD.name).toBe('');
    expect(EMPTY_BOARD.key).toBe('');
    expect(EMPTY_BOARD.columns).toEqual([]);
    expect(EMPTY_BOARD.epics).toEqual([]);
  });

  it('EMPTY_MEMBER não contém conteúdo demo', () => {
    expect(EMPTY_MEMBER.id).toBe('');
    expect(EMPTY_MEMBER.name).toBe('');
    expect(EMPTY_MEMBER.email).toBe('');
  });
});

describe('deriveAppStatus — gates do App', () => {
  it('1. loading sem placeholder: busca em andamento sem boards → loading', () => {
    expect(deriveAppStatus({ isLoading: true, dbConnected: true, boards: [] })).toBe('loading');
    // inclusive se o fetch ainda nem começou (estado inicial do contexto)
    expect(deriveAppStatus({ isLoading: true, dbConnected: false, boards: [] })).toBe('loading');
  });

  it('4. erro de API sem dados → erro (não ready com conteúdo demo)', () => {
    expect(deriveAppStatus({ isLoading: false, dbConnected: false, boards: [] })).toBe('error');
  });

  it('3. resposta vazia com API saudável → empty (não cria board automaticamente)', () => {
    expect(deriveAppStatus({ isLoading: false, dbConnected: true, boards: [] })).toBe('empty');
  });

  it('com boards reais → ready, mesmo durante refetch (não desmonta a UI)', () => {
    const boards = [makeBoard('board-a', 'Alpha'), makeBoard('board-b', 'Beta')];
    expect(deriveAppStatus({ isLoading: false, dbConnected: true, boards })).toBe('ready');
    // refetch em andamento com dados já carregados continua ready
    expect(deriveAppStatus({ isLoading: true, dbConnected: true, boards })).toBe('ready');
  });
});

describe('resolveInitialState — backend é a fonte de verdade', () => {
  it('2. resposta com 2 boards reais → ambos preservados', () => {
    const a = makeBoard('board-a', 'Alpha');
    const b = makeBoard('board-b', 'Beta');
    const resolved = resolveInitialState({
      boards: [a, b],
      members: [],
      currentBoardId: 'board-b',
      currentUserId: '',
    });
    expect(resolved.boards).toHaveLength(2);
    expect(resolved.boards.map((x) => x.id)).toEqual(['board-a', 'board-b']);
    // seleção honrada quando o board existe na resposta
    expect(resolved.currentBoardId).toBe('board-b');
  });

  it('2b. seleção preservada somente se existir na resposta; senão, determinística', () => {
    const a = makeBoard('board-a', 'Alpha');
    const b = makeBoard('board-b', 'Beta');
    // board pedido não está na resposta (ex.: revogado) → primeiro board
    const resolved = resolveInitialState({
      boards: [a, b],
      currentBoardId: 'board-que-nao-existe',
    });
    expect(resolved.currentBoardId).toBe('board-a');
    // sem seleção → primeiro board
    const resolved2 = resolveInitialState({ boards: [a, b] });
    expect(resolved2.currentBoardId).toBe('board-a');
  });

  it('3. resposta vazia → coleções vazias e seleção vazia (sem placeholder anterior)', () => {
    const resolved = resolveInitialState({
      boards: [],
      members: [],
      currentBoardId: '',
      currentUserId: '',
    });
    expect(resolved.boards).toEqual([]);
    expect(resolved.members).toEqual([]);
    expect(resolved.currentBoardId).toBe('');
    expect(resolved.currentUserId).toBe('');
  });

  it('campos nulos/ausentes não quebram e viram coleções vazias', () => {
    const resolved = resolveInitialState({});
    expect(resolved.boards).toEqual([]);
    expect(resolved.members).toEqual([]);
    expect(resolved.currentBoardId).toBe('');
    expect(resolved.currentUserId).toBe('');
  });

  it('currentUserId honra o servidor; fallback determinístico no primeiro membro', () => {
    const m1 = makeMember('mem-1', 'Ana');
    const m2 = makeMember('mem-2', 'Bruno');
    expect(resolveInitialState({ members: [m1, m2], currentUserId: 'mem-2' }).currentUserId).toBe('mem-2');
    expect(resolveInitialState({ members: [m1, m2] }).currentUserId).toBe('mem-1');
    expect(resolveInitialState({ members: [] }).currentUserId).toBe('');
  });
});
