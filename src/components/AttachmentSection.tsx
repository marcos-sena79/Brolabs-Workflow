import React, { useEffect, useRef, useState } from 'react';
import { Paperclip, UploadCloud, Trash2, Download, FileText, File as FileIcon, Image as ImageIcon } from 'lucide-react';
import { useAgile } from '../context/AgileContext';
import { api } from '../services/api';
import { Task } from '../types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentIcon({ mimeType, className }: { mimeType: string; className?: string }) {
  if (mimeType.startsWith('image/')) return <ImageIcon className={className} />;
  if (mimeType === 'application/pdf' || mimeType.startsWith('text/')) return <FileText className={className} />;
  return <FileIcon className={className} />;
}

export const AttachmentSection: React.FC<{ task: Task }> = ({ task }) => {
  const {
    attachmentsByTask,
    isAttachmentsLoading,
    fetchTaskAttachments,
    uploadTaskAttachment,
    deleteTaskAttachment,
    can,
  } = useAgile();

  const attachments = attachmentsByTask[task.id] || [];
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const canEdit = can('canEditTask', task.boardId);

  useEffect(() => {
    fetchTaskAttachments(task.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.id]);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    for (const file of Array.from(files)) {
      try {
        setUploadProgress(0);
        await uploadTaskAttachment(task.id, file, setUploadProgress);
      } catch (err: any) {
        alert(err?.message || 'Falha no upload do anexo');
      } finally {
        setUploadProgress(null);
      }
    }
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleDownload = async (attachmentId: string) => {
    try {
      const url = await api.getTaskAttachmentUrl(task.id, attachmentId);
      window.open(url, '_blank', 'noopener');
    } catch (err: any) {
      alert(err?.message || 'Falha ao baixar anexo');
    }
  };

  const handleDelete = async (attachmentId: string, name: string) => {
    if (!confirm(`Remover o anexo "${name}"?`)) return;
    try {
      await deleteTaskAttachment(task.id, attachmentId);
    } catch (err: any) {
      alert(err?.message || 'Falha ao remover anexo');
    }
  };

  return (
    <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center gap-2 mb-3">
        <Paperclip className="w-4 h-4 text-slate-400" />
        <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          Anexos
        </h4>
        {attachments.length > 0 && (
          <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
            {attachments.length}
          </span>
        )}
      </div>

      {canEdit && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex items-center justify-center gap-2 border-2 border-dashed rounded-lg px-3 py-4 mb-3 cursor-pointer transition-colors ${
            isDragOver
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30'
              : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-500'
          }`}
        >
          {uploadProgress === null ? (
            <>
              <UploadCloud className="w-4 h-4 text-slate-400" />
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Arraste arquivos ou clique para anexar (até 10 MB)
              </span>
            </>
          ) : (
            <div className="w-full max-w-xs">
              <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                <span>Enviando…</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-indigo-600 h-full rounded-full transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>
      )}

      {isAttachmentsLoading && attachments.length === 0 && (
        <p className="text-[11px] text-slate-400">Carregando anexos…</p>
      )}

      {!isAttachmentsLoading && attachments.length === 0 && (
        <p className="text-[11px] text-slate-400 italic">Nenhum anexo nesta tarefa.</p>
      )}

      <ul className="space-y-1.5">
        {attachments.map((att) => (
          <li
            key={att.id}
            className="flex items-center gap-2.5 px-2.5 py-2 bg-slate-50 dark:bg-slate-800/60 rounded-lg group"
          >
            <AttachmentIcon
              mimeType={att.mimeType}
              className="w-4 h-4 text-slate-400 shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
                {att.originalName}
              </p>
              <p className="text-[10px] text-slate-400">
                {formatBytes(att.sizeBytes)} · {new Date(att.createdAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
            <button
              onClick={() => handleDownload(att.id)}
              title="Baixar"
              className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            {canEdit && (
              <button
                onClick={() => handleDelete(att.id, att.originalName)}
                title="Remover anexo"
                className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};
