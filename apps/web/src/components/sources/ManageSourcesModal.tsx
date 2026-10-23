import { useState } from 'react';
import {
  GitBranch,
  Terminal,
  ShieldCheck,
  FolderGit2,
  Trash2,
  RefreshCw,
  Plus,
  X,
  CheckCircle2,
  HardDrive,
} from 'lucide-react';

export interface CodeSourceItem {
  id: string;
  name: string;
  type: 'git' | 'ssh';
  location: string; // Repo URL or user@host
  branchOrPort?: string;
  indexPaths: string[];
  status: 'synced' | 'indexing' | 'error';
  lastSyncedAt: string;
  nodesCount: number;
}

export const INITIAL_WORKSPACE_SOURCES: CodeSourceItem[] = [
  {
    id: 'src-git-fe',
    name: 'vintrix-frontend',
    type: 'git',
    location: 'github.com/novintriantonius/vintrix-web',
    branchOrPort: 'main',
    indexPaths: ['src/components', 'src/hooks'],
    status: 'synced',
    lastSyncedAt: '10 mins ago',
    nodesCount: 3,
  },
  {
    id: 'src-git-be',
    name: 'vintrix-backend',
    type: 'git',
    location: 'github.com/novintriantonius/vintrix-api',
    branchOrPort: 'main',
    indexPaths: ['src/routes', 'src/services', 'src/db'],
    status: 'synced',
    lastSyncedAt: 'Just now',
    nodesCount: 3,
  },
  {
    id: 'src-ssh-prod',
    name: 'prod-cluster',
    type: 'ssh',
    location: 'root@192.168.1.100',
    branchOrPort: 'Port 22',
    indexPaths: ['/var/www/vintrix/config'],
    status: 'synced',
    lastSyncedAt: '1 hour ago',
    nodesCount: 1,
  },
];

interface ManageSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: CodeSourceItem[];
  onOpenAddModal: () => void;
  onDeleteSource: (sourceId: string) => void;
  onTriggerReindex: (sourceId: string) => void;
}

export function ManageSourcesModal({
  isOpen,
  onClose,
  sources,
  onOpenAddModal,
  onDeleteSource,
  onTriggerReindex,
}: ManageSourcesModalProps) {
  const [reindexingId, setReindexingId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSync = (id: string) => {
    setReindexingId(id);
    onTriggerReindex(id);
    setTimeout(() => {
      setReindexingId(null);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#080d16] border border-white/[0.08] rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-white/[0.08] flex items-center justify-between shrink-0">
          <div className="min-w-0 pr-2">
            <h3 className="text-sm sm:text-base font-semibold text-slate-100 flex items-center gap-2">
              <FolderGit2 size={18} className="text-sky-400 shrink-0" />
              <span className="truncate">Manage Workspace Sources</span>
            </h3>
            <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
              Review, re-index, or remove linked Git repositories and SSH/SFTP endpoints.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content list */}
        <div className="p-3 sm:p-6 space-y-3 overflow-y-auto flex-1">
          {sources.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/[0.08] rounded-xl text-slate-500">
              <HardDrive size={32} className="mx-auto mb-2 text-slate-600" />
              <p className="text-xs">No code sources connected to this workspace yet.</p>
            </div>
          ) : (
            sources.map((source) => {
              const isSyncing = reindexingId === source.id;

              return (
                <div
                  key={source.id}
                  className="p-4 bg-[#050912] border border-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all flex items-start justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-300">
                        {source.type === 'git' ? (
                          <GitBranch size={14} className="text-sky-400" />
                        ) : (
                          <Terminal size={14} className="text-emerald-400" />
                        )}
                      </span>
                      <h4 className="text-xs font-semibold text-slate-200 truncate">
                        {source.name}
                      </h4>
                      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 border border-white/[0.06]">
                        {source.type}
                      </span>
                      {source.branchOrPort && (
                        <span className="text-[10px] font-mono text-slate-400">
                          ({source.branchOrPort})
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-mono text-slate-400 truncate flex items-center gap-1.5">
                      <span className="truncate">{source.location}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1 text-[10px] font-mono">
                      <span className="text-slate-500">Index paths:</span>
                      {source.indexPaths.map((p) => (
                        <span
                          key={p}
                          className="px-1.5 py-0.5 rounded bg-[#0b1320] text-sky-300 border border-sky-500/20"
                        >
                          {p}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-3 pt-1 text-[10px] font-mono text-slate-500">
                      <span className="flex items-center gap-1 text-emerald-400">
                        <CheckCircle2 size={12} />
                        {source.nodesCount} AST nodes indexed
                      </span>
                      <span>•</span>
                      <span>Last synced: {source.lastSyncedAt}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSync(source.id)}
                      disabled={isSyncing}
                      title="Re-run AST indexing parser"
                      className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-sky-400 border border-white/[0.06] transition-colors disabled:opacity-50"
                    >
                      <RefreshCw size={14} className={isSyncing ? 'animate-spin text-sky-400' : ''} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSource(source.id)}
                      title="Remove source and delete associated graph nodes"
                      className="p-2 rounded-lg bg-white/[0.04] hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 border border-white/[0.06] transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-white/[0.08] bg-[#050912]/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-mono text-slate-400 order-2 sm:order-1 text-center sm:text-left">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <span>Credentials encrypted at rest (AES-256-GCM)</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end order-1 sm:order-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-initial px-3.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white transition-colors"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAddModal();
              }}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-all shadow-md shadow-sky-500/20"
            >
              <Plus size={14} />
              <span>Add New Source</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
