import React, { useState } from 'react';
import { X, Plus, Sparkles } from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { IssueType, Priority } from '../types';
import { IssueTypeIcon } from './AgileIcons';

export const CreateTaskModal: React.FC = () => {
  const {
    isCreateModalOpen,
    setIsCreateModalOpen,
    tasks,
    currentBoard,
    members,
    currentUser,
    createTask,
    addSubtask,
    addDependency,
  } = useAgile();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [issueType, setIssueType] = useState<IssueType>('story');
  const [priority, setPriority] = useState<Priority>('medium');
  const [statusId, setStatusId] = useState(currentBoard.columns[1]?.id || 'col-todo');
  const [assigneeId, setAssigneeId] = useState(currentUser.id);
  const [epicId, setEpicId] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('8');
  const [storyPoints, setStoryPoints] = useState('5');
  const [dueDate, setDueDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [tagInput, setTagInput] = useState('Backend, Feature');
  const [quickSubtasksInput, setQuickSubtasksInput] = useState('');
  const [initialBlockerTaskId, setInitialBlockerTaskId] = useState('');

  if (!isCreateModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const created = createTask({
      title: title.trim(),
      description: description.trim(),
      issueType,
      priority,
      statusId,
      assigneeId,
      epicId: epicId || undefined,
      estimatedHours: parseFloat(estimatedHours) || 0,
      storyPoints: parseInt(storyPoints) || 0,
      dueDate,
      tags,
    });

    // Add initial blocker dependency if selected
    if (initialBlockerTaskId) {
      addDependency(created.id, initialBlockerTaskId, 'is_blocked_by');
    }

    // Add quick subtasks if entered
    if (quickSubtasksInput.trim()) {
      const subtaskLines = quickSubtasksInput
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      subtaskLines.forEach((line) => {
        addSubtask(created.id, line, 2, assigneeId);
      });
    }

    // Reset and close
    setTitle('');
    setDescription('');
    setQuickSubtasksInput('');
    setInitialBlockerTaskId('');
    setIsCreateModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-2xl my-auto p-6">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950 flex items-center justify-center text-indigo-600">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Criar Nova Tarefa</h3>
              <p className="text-[11px] text-slate-400">Quadro: {currentBoard.name}</p>
            </div>
          </div>
          <button
            onClick={() => setIsCreateModalOpen(false)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Issue Type & Status */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Tipo de Item
              </label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value as IssueType)}
                className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="story">História (Story)</option>
                <option value="task">Tarefa (Task)</option>
                <option value="bug">Bug</option>
                <option value="epic">Épico (Epic)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Coluna Inicial
              </label>
              <select
                value={statusId}
                onChange={(e) => setStatusId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {currentBoard.columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Título da Tarefa *
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Integrar webhook de notificação do Teams e Slack"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Descrição detalhada
            </label>
            <textarea
              rows={3}
              placeholder="Contexto, critérios de aceite, links de documentação..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Assignee, Priority & Epic */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Responsável
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Prioridade
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="lowest">Muito Baixa</option>
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="urgent">Urgente</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Épico
              </label>
              <select
                value={epicId}
                onChange={(e) => setEpicId(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="">Sem Épico</option>
                {currentBoard.epics?.map((ep) => (
                  <option key={ep.id} value={ep.id}>
                    {ep.key}: {ep.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Time Tracking (Estimativa) & Due Date */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Horas Estimadas *
              </label>
              <input
                type="number"
                step="0.5"
                min="0.5"
                required
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Story Points
              </label>
              <input
                type="number"
                min="0"
                value={storyPoints}
                onChange={(e) => setStoryPoints(e.target.value)}
                className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Data de Entrega
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Initial Blocker / Dependency Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Dependência / Blocker Inicial (Opcional)
            </label>
            <select
              value={initialBlockerTaskId}
              onChange={(e) => setInitialBlockerTaskId(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="">Nenhum (Tarefa independente)</option>
              {tasks
                .filter((t) => t.boardId === currentBoard.id)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    Bloqueada por: [{t.key}] {t.title.length > 50 ? `${t.title.substring(0, 50)}...` : t.title}
                  </option>
                ))}
            </select>
          </div>

          {/* Quick Subtasks Batch Adder */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Sub-tarefas Iniciais (Uma por linha - Opcional)
            </label>
            <textarea
              rows={2}
              placeholder="Ex:&#10;Criar schema do banco&#10;Implementar controller REST&#10;Escrever testes unitários"
              value={quickSubtasksInput}
              onChange={(e) => setQuickSubtasksInput(e.target.value)}
              className="w-full text-xs font-mono px-3 py-2 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-xs transition-colors"
            >
              Criar Tarefa
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
