import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Layers, Box, GitFork, MessageSquareCode, Share2, Info } from 'lucide-react';
import { Nav, Hero } from './components/landing/HeroSection';
import {
  FeaturesSection,
  HowItWorksSection,
  OpenSourceSection,
  CtaSection,
  Footer,
} from './components/landing/Sections';
import { CustomCodeNode, type CodeNodeData, type NodeKind } from './components/graph/CustomCodeNode';
import { INITIAL_WORKSPACE_NODES, INITIAL_WORKSPACE_EDGES } from './components/graph/mockData';
import { GraphToolbar } from './components/graph/GraphToolbar';
import { SidebarInspector } from './components/graph/SidebarInspector';
import { SlidingCodeViewer } from './components/graph/SlidingCodeViewer';
import { ChatboxView } from './components/chat/ChatboxView';
import { AddSourceModal } from './components/sources/AddSourceModal';
import {
  ManageSourcesModal,
  type CodeSourceItem,
} from './components/sources/ManageSourcesModal';
import {
  WorkspaceTeamModal,
  type WorkspaceMember,
} from './components/workspace/WorkspaceTeamModal';
import { sourcesApi, workspacesApi, type WorkspaceMemberAPI } from './services/api';

// Default workspace ID — in production this comes from auth session
const DEFAULT_WORKSPACE_ID = '00000000-0000-0000-0000-000000000001';

const nodeTypes = {
  codeNode: CustomCodeNode,
};

function sourceApiToItem(s: {
  id: string;
  name: string;
  type: string;
  isIndexed: boolean;
  lastIndexAt: string | null;
  host?: string | null;
  port?: number | null;
  repoUrl?: string | null;
  branch?: string | null;
}): CodeSourceItem {
  const isGit = s.type === 'git';
  return {
    id: s.id,
    name: s.name,
    type: s.type as 'git' | 'ssh',
    location: isGit ? (s.repoUrl ?? 'unknown') : `${s.host ?? 'unknown'}`,
    branchOrPort: isGit ? (s.branch ?? 'main') : `Port ${s.port ?? 22}`,
    indexPaths: [],
    status: s.isIndexed ? 'synced' : 'indexing',
    lastSyncedAt: s.lastIndexAt ? new Date(s.lastIndexAt).toLocaleString() : 'Never',
    nodesCount: 0,
  };
}

function memberApiToLocal(m: WorkspaceMemberAPI): WorkspaceMember {
  return {
    userId: m.userId,
    name: m.displayName ?? m.email.split('@')[0],
    email: m.email,
    roleName: m.roleName as WorkspaceMember['roleName'],
    invitedAt: new Date(m.invitedAt).toLocaleDateString(),
  };
}

function WorkspaceContainer({ onBackToLanding }: { onBackToLanding: () => void }) {
  const [workspaceTab, setWorkspaceTab] = useState<'graph' | 'chat'>('graph');
  const [nodes, setNodes] = useState<Node[]>(INITIAL_WORKSPACE_NODES as unknown as Node[]);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_WORKSPACE_EDGES);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(INITIAL_WORKSPACE_NODES[0].id);
  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<NodeKind | 'all'>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isManageSourcesOpen, setIsManageSourcesOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [sourcesList, setSourcesList] = useState<CodeSourceItem[]>([]);
  const [membersList, setMembersList] = useState<WorkspaceMember[]>([]);

  // Load initial sources and members from backend API
  useEffect(() => {
    sourcesApi
      .list(DEFAULT_WORKSPACE_ID)
      .then((data) => {
        if (data && data.length > 0) {
          setSourcesList(data.map(sourceApiToItem));
        }
      })
      .catch(() => {
        // Fallback default sample source when backend not running
        setSourcesList([
          {
            id: 'src-1',
            name: 'vintrix-web',
            type: 'git',
            location: 'github.com/novintriantonius/vintrix',
            branchOrPort: 'main',
            indexPaths: ['apps/web/src/'],
            status: 'synced',
            lastSyncedAt: 'Just now',
            nodesCount: 4,
          },
          {
            id: 'src-2',
            name: 'vintrix-api',
            type: 'git',
            location: 'github.com/novintriantonius/vintrix',
            branchOrPort: 'main',
            indexPaths: ['apps/api/src/'],
            status: 'synced',
            lastSyncedAt: 'Just now',
            nodesCount: 3,
          },
        ]);
      });

    workspacesApi
      .listMembers(DEFAULT_WORKSPACE_ID)
      .then((data) => {
        if (data && data.length > 0) {
          setMembersList(data.map(memberApiToLocal));
        }
      })
      .catch(() => {
        // Fallback default sample members
        setMembersList([
          {
            userId: 'user-1',
            name: 'Novin Triantonius',
            email: 'novin@vintrix.ai',
            roleName: 'admin',
            invitedAt: 'Workspace Owner',
          },
        ]);
      });
  }, []);

  const handleInviteMember = async (email: string, roleName: 'admin' | 'member' | 'viewer') => {
    try {
      const res = await workspacesApi.inviteMember(DEFAULT_WORKSPACE_ID, email, roleName);
      if (res.member) {
        setMembersList((prev) => [...prev, memberApiToLocal(res.member)]);
      }
    } catch {
      // Local optimistic update
      const newMember: WorkspaceMember = {
        userId: `user-${Date.now()}`,
        name: email.split('@')[0],
        email,
        roleName,
        invitedAt: 'Just now',
      };
      setMembersList((prev) => [...prev, newMember]);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'member' | 'viewer') => {
    try {
      await workspacesApi.updateMemberRole(DEFAULT_WORKSPACE_ID, userId, newRole);
    } catch {
      // ignore
    }
    setMembersList((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, roleName: newRole } : m))
    );
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await workspacesApi.removeMember(DEFAULT_WORKSPACE_ID, userId);
    } catch {
      // ignore
    }
    setMembersList((prev) => prev.filter((m) => m.userId !== userId));
  };

  const { fitView } = useReactFlow();

  const gitSourcesCount = sourcesList.filter((s) => s.type === 'git').length;
  const sshSourcesCount = sourcesList.filter((s) => s.type === 'ssh').length;

  const handleDeleteSource = async (sourceId: string) => {
    const targetSource = sourcesList.find((s) => s.id === sourceId);
    try {
      await sourcesApi.delete(sourceId);
    } catch {
      // ignore
    }
    setSourcesList((prev) => prev.filter((s) => s.id !== sourceId));
    if (targetSource) {
      setNodes((prev) =>
        prev.filter((node) => {
          const data = node.data as unknown as CodeNodeData;
          return data?.sourceName !== targetSource.name;
        })
      );
    }
  };

  const handleTriggerReindex = async (sourceId: string) => {
    try {
      await sourcesApi.triggerReindex(sourceId);
    } catch {
      // ignore
    }
    setSourcesList((prev) =>
      prev.map((s) =>
        s.id === sourceId
          ? { ...s, lastSyncedAt: 'Just now', status: 'synced' }
          : s
      )
    );
  };

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Available unique code sources across workspace
  const availableSources = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    nodes.forEach((node) => {
      const data = node.data as unknown as CodeNodeData;
      if (data?.sourceName && !list.some((item) => item.id === data.sourceName)) {
        list.push({ id: data.sourceName, label: data.sourceName });
      }
    });
    return list;
  }, [nodes]);

  // Filtered nodes based on search, layer kind, & source scope
  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const data = node.data as unknown as CodeNodeData;
      if (!data) return true;

      const matchesKind = selectedKind === 'all' || data.kind === selectedKind;
      const matchesSource =
        selectedSource === 'all' || data.sourceName === selectedSource;
      const matchesSearch =
        !searchQuery ||
        data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        data.filePath.toLowerCase().includes(searchQuery.toLowerCase()) ||
        data.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (data.sourceName && data.sourceName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (data.tags && data.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

      return matchesKind && matchesSource && matchesSearch;
    });
  }, [nodes, selectedKind, selectedSource, searchQuery]);

  const allNodeDataList = useMemo(() => {
    return nodes.map((n) => n.data as unknown as CodeNodeData);
  }, [nodes]);

  const selectedNodeData = useMemo(() => {
    const found = nodes.find((n) => n.id === selectedNodeId);
    return found ? (found.data as unknown as CodeNodeData) : null;
  }, [nodes, selectedNodeId]);

  const handleSelectNodeByPath = (path: string) => {
    const target = nodes.find((n) => (n.data as unknown as CodeNodeData)?.filePath === path);
    if (target) {
      setSelectedNodeId(target.id);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#050a10] text-[#e0e0e0] font-sans overflow-hidden">
      {/* Top Header */}
      <header className="absolute top-0 left-0 right-0 h-12 bg-[#070b12] border-b border-white/[0.08] flex items-center justify-between px-2 sm:px-4 z-30">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-1.5 font-semibold text-xs text-slate-100 hover:text-white transition-colors p-1 -ml-1 rounded-lg hover:bg-white/[0.04] shrink-0 group"
            title="Vintrix - Back to Landing"
          >
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-sm shadow-sky-500/20 group-hover:scale-105 transition-transform shrink-0">
              <Box size={14} className="text-slate-950" />
            </div>
            <span className="font-bold text-sm tracking-tight text-white">Vintrix</span>
          </button>
          <span className="text-[10px] font-mono text-slate-400 bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06] hidden md:inline truncate max-w-[120px]">
            vintrix-monorepo
          </span>

          <div className="w-px h-3.5 bg-white/[0.08] shrink-0 hidden sm:block" />

          {/* Mode Switcher: Knowledge Graph vs AI Chatbox */}
          <div className="flex items-center bg-[#0d1422] border border-white/[0.06] p-0.5 rounded-lg shrink-0">
            <button
              onClick={() => setWorkspaceTab('graph')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                workspaceTab === 'graph'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Share2 size={12} />
              <span className="hidden sm:inline">Graph</span>
            </button>
            <button
              onClick={() => setWorkspaceTab('chat')}
              className={`flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                workspaceTab === 'chat'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <MessageSquareCode size={12} />
              <span className="hidden sm:inline">Chat</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 text-xs font-mono text-slate-400 shrink-0">
          {/* Team Collaboration Trigger */}
          <button
            onClick={() => setIsTeamModalOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-all hover:text-white shrink-0"
            title="Invite team members and manage permissions"
          >
            <div className="flex -space-x-1.5 overflow-hidden">
              {membersList.slice(0, 3).map((m) => (
                <div
                  key={m.userId}
                  className="w-4 h-4 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 border border-[#080d16] text-[8px] font-bold flex items-center justify-center text-white shrink-0"
                >
                  {m.name[0]}
                </div>
              ))}
            </div>
            <span className="font-sans text-xs hidden sm:inline">{membersList.length} Members</span>
          </button>

          <button
            onClick={() => setIsAddSourceOpen(true)}
            className="flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 transition-all font-sans font-medium text-xs shrink-0"
            title="Connect Git repository or SSH/SFTP server"
          >
            <GitFork size={13} />
            <span className="hidden sm:inline">+ Add Source</span>
          </button>
          <button
            onClick={() => setIsManageSourcesOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-all hover:text-sky-300 shrink-0"
            title="Click to manage, re-index, or delete connected sources"
          >
            <span className="hidden sm:inline">
              Sources: {gitSourcesCount} Git, {sshSourcesCount} SSH
            </span>
            <span className="sm:hidden text-[11px]">{sourcesList.length} src</span>
          </button>
          <span className="hidden md:flex items-center gap-1.5 text-slate-400">
            <Layers size={13} /> Nodes: {nodes.length}
          </span>

          {/* Mobile Inspector Toggle */}
          {workspaceTab === 'graph' && (
            <button
              onClick={() => setIsMobileInspectorOpen((prev) => !prev)}
              className="flex md:hidden items-center gap-1 p-1.5 text-slate-300 hover:text-white bg-white/[0.05] border border-white/[0.08] rounded-md transition-colors shrink-0"
              title="Toggle AST Node Inspector"
            >
              <Info size={14} className="text-sky-400" />
            </button>
          )}
        </div>
      </header>

      {/* Workspace Content: Graph Canvas OR AI Chatbox */}
      <div className="flex-1 h-[calc(100vh-48px)] mt-12 relative flex">
        {workspaceTab === 'graph' ? (
          <>
            <div className="flex-1 h-full relative">
              <GraphToolbar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedKind={selectedKind}
                onKindSelect={setSelectedKind}
                selectedSource={selectedSource}
                onSourceSelect={setSelectedSource}
                availableSources={availableSources}
                nodeCount={filteredNodes.length}
                totalNodes={nodes.length}
                onResetView={() => fitView({ padding: 0.2, duration: 600 })}
              />

              <ReactFlow
                nodes={filteredNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={(_, node) => {
                  setSelectedNodeId(node.id);
                  setIsCodeViewerOpen(true);
                }}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#16243b" gap={20} size={1.5} />
                <Controls className="!bg-[#0b1320] !border-[#16243b] !rounded-xl overflow-hidden [&>button]:!bg-[#0b1320] [&>button]:!border-[#16243b] [&>button]:!fill-slate-300 hover:[&>button]:!bg-slate-800" />
              </ReactFlow>

              {/* Bottom Sliding Code Viewer Drawer */}
              <SlidingCodeViewer
                node={selectedNodeData}
                isOpen={isCodeViewerOpen}
                onClose={() => setIsCodeViewerOpen(false)}
              />
            </div>

            {/* Right Sidebar Inspector */}
            <SidebarInspector
              selectedNode={selectedNodeData}
              onSelectNodeByPath={handleSelectNodeByPath}
              allNodes={allNodeDataList}
              isOpenMobile={isMobileInspectorOpen}
              onCloseMobile={() => setIsMobileInspectorOpen(false)}
            />
          </>
        ) : (
          <ChatboxView />
        )}
      </div>

      {/* Connect Code Source Modal */}
      <AddSourceModal
        isOpen={isAddSourceOpen}
        onClose={() => setIsAddSourceOpen(false)}
        workspaceId={DEFAULT_WORKSPACE_ID}
        onSourceAdded={(newSource) => {
          const item: CodeSourceItem = {
            id: newSource.id,
            name: newSource.name,
            type: newSource.type,
            location: newSource.type === 'git' ? 'Repository connected' : 'SSH Server connected',
            branchOrPort: newSource.type === 'git' ? 'main' : 'Port 22',
            indexPaths: ['src/'],
            status: 'synced',
            lastSyncedAt: 'Just now',
            nodesCount: 1,
          };
          setSourcesList((prev) => [item, ...prev]);
        }}
      />

      {/* Manage Workspace Sources Modal */}
      <ManageSourcesModal
        isOpen={isManageSourcesOpen}
        onClose={() => setIsManageSourcesOpen(false)}
        sources={sourcesList}
        onOpenAddModal={() => setIsAddSourceOpen(true)}
        onDeleteSource={handleDeleteSource}
        onTriggerReindex={handleTriggerReindex}
      />

      {/* Workspace Team Collaboration Modal */}
      <WorkspaceTeamModal
        isOpen={isTeamModalOpen}
        onClose={() => setIsTeamModalOpen(false)}
        workspaceName="vintrix-workspace"
        members={membersList}
        onInviteMember={handleInviteMember}
        onUpdateRole={handleUpdateRole}
        onRemoveMember={handleRemoveMember}
      />
    </div>
  );
}

export default function App() {
  const [view, setView] = useState<'landing' | 'app'>('landing');

  if (view === 'landing') {
    return (
      <div className="min-h-screen bg-[#050a10] text-[#f8fafc] selection:bg-brand-500/20 selection:text-brand-300">
        <Nav onOpenApp={() => setView('app')} />
        <main>
          <Hero onOpenApp={() => setView('app')} />
          <FeaturesSection />
          <HowItWorksSection />
          <OpenSourceSection />
          <CtaSection onOpenApp={() => setView('app')} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <WorkspaceContainer onBackToLanding={() => setView('landing')} />
    </ReactFlowProvider>
  );
}

