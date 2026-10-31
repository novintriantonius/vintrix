import { useState, useEffect } from 'react';
import {
  GitBranch,
  Terminal,
  FolderGit2,
  Trash2,
  RefreshCw,
  Plus,
  CheckCircle2,
  HardDrive,
  Webhook,
  Check,
} from 'lucide-react';
import { Modal } from '../common';

export interface CodeSourceItem {
  id: string;
  name: string;
  type: 'git' | 'ssh';
  location: string;
  branchOrPort?: string;
  indexPaths: string[];
  status: 'synced' | 'indexing' | 'error';
  lastSyncedAt: string;
  nodesCount: number;
  filesIndexedCount?: number;
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

export interface SourceProgressInfo {
  current: number;
  total: number;
  percent: number;
  currentFileName?: string;
}

interface ManageSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  sources: CodeSourceItem[];
  reindexProgress?: Record<string, SourceProgressInfo>;
  onOpenAddModal: () => void;
  onDeleteSource: (sourceId: string) => void;
  onTriggerReindex: (sourceId: string) => void;
}

export function ManageSourcesModal({
  isOpen,
  onClose,
  sources,
  reindexProgress = {},
  onOpenAddModal,
  onDeleteSource,
  onTriggerReindex,
}: ManageSourcesModalProps) {
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const [copiedWebhookId, setCopiedWebhookId] = useState<string | null>(null);

  useEffect(() => {
    // Only clear reindexingId if reindexing is no longer marked active
    const currentSource = sources.find((s) => s.id === reindexingId);
    if (reindexingId && currentSource && currentSource.status !== 'indexing' && !reindexProgress[reindexingId]) {
      const timer = setTimeout(() => {
        setReindexingId(null);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [reindexingId, reindexProgress, sources]);

  const handleSync = (id: string) => {
    setReindexingId(id);
    onTriggerReindex(id);
  };

  const copyWebhookUrl = (id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const apiUrl = origin.includes(':5173') ? origin : origin.replace(':3000', ':3001');
    const webhookUrl = `${apiUrl}/sources/webhook?sourceId=${id}`;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhookId(id);
    setTimeout(() => setCopiedWebhookId(null), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="4xl"
      icon={<FolderGit2 size={18} />}
      title="Manage Workspace Sources"
      subtitle="Review, re-index, or remove linked Git repositories and SSH/SFTP endpoints."
      footer={
        <div className="flex items-center justify-between">
          <div className="text-[11px] text-slate-400 font-mono">
            {sources.length} active {sources.length === 1 ? 'source' : 'sources'} in workspace
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAddModal();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors shadow-sm"
          >
            <Plus size={14} /> Add Another Source
          </button>
        </div>
      }
    >
      <div className="p-4 sm:p-6 space-y-3 max-h-[60vh] overflow-y-auto">
        {sources.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-white/[0.08] rounded-xl text-slate-500">
            <HardDrive size={32} className="mx-auto mb-2 text-slate-600" />
            <p className="text-xs">No code sources connected to this workspace yet.</p>
          </div>
        ) : (
          sources.map((source) => {
            const progress = reindexProgress[source.id];
            const hasActiveProgress = Boolean(progress);
            // Only show syncing state if user explicitly triggered reindex OR progress is actively streaming
            const isSyncing = (reindexingId === source.id && source.status === 'indexing') || hasActiveProgress;

            return (
              <div
                key={source.id}
                className="relative p-4 bg-[#050912] border border-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all flex flex-col justify-between"
              >
                {/* Fixed Top-Right Action Buttons */}
                <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 z-10">
                  {source.type === 'git' && (
                    <button
                      type="button"
                      onClick={() => copyWebhookUrl(source.id)}
                      title="Copy Git Webhook URL for GitHub/GitLab automated push re-indexing"
                      aria-label="Copy Webhook URL"
                      className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-sky-300 transition-colors border border-white/[0.06] flex items-center gap-1"
                    >
                      {copiedWebhookId === source.id ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Webhook size={13} />
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSync(source.id)}
                    disabled={isSyncing}
                    title="Trigger AST Re-index"
                    aria-label={`Re-index ${source.name}`}
                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors border border-white/[0.06] disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={isSyncing ? 'animate-spin text-sky-400' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSource(source.id)}
                    title="Delete Source"
                    aria-label={`Delete ${source.name}`}
                    className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors border border-rose-500/20"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="space-y-1.5 w-full pr-28">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-slate-300">
                      {source.type === 'git' ? (
                        <GitBranch size={14} className="text-sky-400" />
                      ) : (
                        <Terminal size={14} className="text-emerald-400" />
                      )}
                    </span>
                    <h4 className="text-xs font-semibold text-slate-200 truncate">{source.name}</h4>
                    <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 border border-white/[0.06]">
                      {source.type}
                    </span>
                    {source.branchOrPort && (
                      <span className="text-[10px] font-mono text-slate-400">
                        ({source.branchOrPort})
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] font-mono text-slate-400 truncate">
                    {source.location}
                  </div>

                  {source.indexPaths && source.indexPaths.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {source.indexPaths.map((p, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-slate-300 border border-white/[0.06]"
                        >
                          <span className="text-sky-400">/</span>
                          {p.startsWith('/') ? p.slice(1) : p}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1.5">
                      {isSyncing ? (
                        <>
                          <RefreshCw size={12} className="text-amber-400 animate-spin" />
                          <span className="text-amber-300 font-medium">
                            {progress
                              ? `Indexing ${progress.current} / ${progress.total} files (${progress.percent}%)`
                              : 'Connecting & scanning repository...'}
                          </span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">Indexed</span>
                        </>
                      )}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[10px]">{source.lastSyncedAt}</span>
                    {!isSyncing && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-sky-400 font-medium">
                          {source.nodesCount} nodes
                        </span>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-emerald-400/90 font-medium">
                          {source.filesIndexedCount ?? 0} files indexed
                        </span>
                      </>
                    )}
                  </div>
                  {isSyncing && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                        <span className="truncate max-w-[280px] text-slate-300 flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                          {progress?.currentFileName
                            ? `${progress.currentFileName}`
                            : 'Scanning codebase AST...'}
                        </span>
                        <span className="text-amber-300 shrink-0 font-medium font-mono">
                          {progress
                            ? `${progress.current}/${progress.total} (${progress.percent}%)`
                            : 'Preparing AST scan...'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full transition-all duration-200"
                          style={{
                            width: `${progress?.percent ?? 8}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
