import React, { useEffect, useState } from 'react';
import { X, Users, UserPlus, Trash2, Shield } from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { api } from '../services/api';
import { BoardMemberInfo, BoardRole } from '../types';

const ROLE_LABELS: Record<BoardRole, string> = {
  owner: 'Proprietário',
  editor: 'Editor',
  viewer: 'Visualizador',
};

const ROLE_STYLES: Record<BoardRole, string> = {
  owner: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
  editor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-400 dark:border-indigo-800',
  viewer: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
};

export const BoardAccessModal: React.FC = () => {
  const { isBoardAccessOpen, setIsBoardAccessOpen, currentBoard, myPermissions, can } =
    useAgile();

  const [boardMembers, setBoardMembers] = useState<BoardMemberInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<BoardRole>('editor');
  const [isInviting, setIsInviting] = useState(false);

  const myPerms = myPermissions[currentBoard.id];
  const canManage = can('canManageMembers');
  const canInvite = can('canInviteMember');

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await api.getBoardMembers(currentBoard.id);
      setBoardMembers(data.members);
    } catch (err: any) {
      setError(err?.message || 'Falha ao carregar membros');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isBoardAccessOpen) {
      loadMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBoardAccessOpen, currentBoard.id]);

  useEffect(() => {
    if (!isBoardAccessOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsBoardAccessOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isBoardAccessOpen, setIsBoardAccessOpen]);

  if (!isBoardAccessOpen) return null;

  const handleRoleChange = async (memberId: string, role: BoardRole) => {
    try {
      await api.updateBoardMember(currentBoard.id, memberId, { role });
      setBoardMembers((prev) =>
        prev.map((m) => (m.memberId === memberId ? { ...m, role } : m))
      );
    } catch (err: any) {
      alert(err?.message || 'Falha ao alterar papel');
    }
  };

  const handleRemove = async (m: BoardMemberInfo) => {
    if (!confirm(`Remover ${m.name} deste quadro?`)) return;
    try {
      await api.removeBoardMember(currentBoard.id, m.memberId);
      setBoardMembers((prev) => prev.filter((x) => x.memberId !== m.memberId));
    } catch (err: any) {
      alert(err?.message || 'Falha ao remover membro');
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    try {
      setIsInviting(true);
      const member = await api.inviteBoardMember(currentBoard.id, { email, role: inviteRole });
      setBoardMembers((prev) => [...prev, member]);
      setInviteEmail('');
    } catch (err: any) {
      alert(err?.message || 'Falha ao convidar membro');
    } finally {
      setIsInviting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      onClick={() => setIsBoardAccessOpen(false)}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl my-auto p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Acesso ao Quadro
              </h3>
              <p className="text-[11px] text-slate-400">
                {currentBoard.name} — papéis e permissões dos membros
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsBoardAccessOpen(false)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        {/* Members list */}
        {isLoading ? (
          <div className="py-8 text-center text-xs text-slate-400">Carregando membros…</div>
        ) : (
          <ul className="space-y-2">
            {boardMembers.map((m) => {
              return (
                <li
                  key={m.memberId}
                  className="flex items-center gap-3 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-lg"
                >
                  <img
                    src={m.avatar || '/bucket/avatars/default.svg'}
                    alt={m.name}
                    className="w-8 h-8 rounded-full object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {m.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {m.email}
                      {m.jobTitle ? ` · ${m.jobTitle}` : ''}
                    </p>
                  </div>

                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${ROLE_STYLES[m.role]}`}
                  >
                    {ROLE_LABELS[m.role]}
                  </span>

                  {canManage ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.memberId, e.target.value as BoardRole)}
                      className="text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-1.5 py-1 text-slate-600 dark:text-slate-300"
                      title="Alterar papel"
                    >
                      <option value="owner">Proprietário</option>
                      <option value="editor">Editor</option>
                      <option value="viewer">Visualizador</option>
                    </select>
                  ) : (
                    <span className="w-[92px]" />
                  )}

                  {canManage && (
                    <button
                      onClick={() => handleRemove(m)}
                      title="Remover do quadro"
                      className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </li>
              );
            })}
            {boardMembers.length === 0 && !isLoading && (
              <p className="text-xs text-slate-400 italic text-center py-4">
                Nenhum membro com acesso a este quadro.
              </p>
            )}
          </ul>
        )}

        {/* Invite */}
        {canInvite ? (
          <form onSubmit={handleInvite} className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
            <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5" />
              Convidar membro
            </label>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="email@empresa.com"
                required
                className="flex-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-3 py-2 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as BoardRole)}
                className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-2 text-slate-600 dark:text-slate-300"
              >
                <option value="editor">Editor</option>
                <option value="viewer">Visualizador</option>
                <option value="owner">Proprietário</option>
              </select>
              <button
                type="submit"
                disabled={isInviting}
                className="text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md transition-colors disabled:opacity-50"
              >
                {isInviting ? 'Enviando…' : 'Convidar'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400">
              O email precisa corresponder a um membro já cadastrado na organização.
            </p>
          </form>
        ) : (
          <p className="pt-3 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-400 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            Você pode visualizar os membros, mas não tem permissão para convidar.
          </p>
        )}

        {/* Legend */}
        <p className="text-[10px] text-slate-400 leading-relaxed">
          <strong>Proprietário:</strong> gestão total (membros, quadro, exclusão).{' '}
          <strong>Editor:</strong> cria/edita tarefas, muda status, registra horas e comentários.{' '}
          <strong>Visualizador:</strong> apenas leitura.
        </p>
      </div>
    </div>
  );
};
