import { useState } from 'react';
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
  const [copiedWebhookId, setCopiedWebhookId] = useState<string | null>(null);

  const handleSync = (id: string) => {
    setReindexingId(id);
    onTriggerReindex(id);
    setTimeout(() => {
      setReindexingId(null);
    }, 1200);
  };

  const copyWebhookUrl = (id: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const apiUrl = origin.replace(':3000', ':3001');
    const webhookUrl = `${apiUrl}/sources/webhook?sourceId=${id}`;
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhookId(id);
    setTimeout(() => setCopiedWebhookId(null), 2000);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="2xl"
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
            const isSyncing = reindexingId === source.id;

            return (
              <div
                key={source.id}
                className="p-3.5 bg-[#050912] border border-white/[0.06] hover:border-white/[0.12] rounded-xl transition-all flex items-start justify-between gap-4"
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

                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1.5">
                      {isSyncing || source.status === 'indexing' ? (
                        <>
                          <RefreshCw size={12} className="text-amber-400 animate-spin" />
                          <span className="text-amber-300 font-medium">Indexing AST & Parsing AST...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={12} className="text-emerald-400" />
                          <span className="text-emerald-400">{source.status === 'synced' ? 'Indexed' : 'Syncing'}</span>
                        </>
                      )}
                    </span>
                    <span>•</span>
                    <span className="font-mono text-[10px]">{source.lastSyncedAt}</span>
                    {source.nodesCount > 0 && (
                      <>
                        <span>•</span>
                        <span className="font-mono text-[10px] text-sky-400">{source.nodesCount} indexed components</span>
                      </>
                    )}
                  </div>
                  {(isSyncing || source.status === 'indexing') && (
                    <div className="pt-2">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono mb-1">
                        <span>AST Tree-sitter tokenization</span>
                        <span className="text-amber-300">In progress...</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-sky-400 to-indigo-500 rounded-full animate-pulse w-3/4" />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {source.type === 'git' && (
                    <button
                      type="button"
                      onClick={() => copyWebhookUrl(source.id)}
                      title="Copy Git Webhook URL for GitHub/GitLab automated push re-indexing"
                      aria-label="Copy Webhook URL"
                      className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-sky-300 transition-colors border border-white/[0.06] flex items-center gap-1"
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
                    className="p-2 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white transition-colors border border-white/[0.06] disabled:opacity-50"
                  >
                    <RefreshCw size={13} className={isSyncing ? 'animate-spin text-sky-400' : ''} />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSource(source.id)}
                    title="Delete Source"
                    aria-label={`Delete ${source.name}`}
                    className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 transition-colors border border-rose-500/20"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Modal>
  );
}
