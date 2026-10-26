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
import { Layers, Box, GitFork, MessageSquareCode, Share2, Info, LogIn, LogOut, ChevronDown, Plus, MoreHorizontal, Users, Search } from 'lucide-react';
import { Nav, Hero } from './components/landing/HeroSection';
import {
  FeaturesSection,
  HowItWorksSection,
  OpenSourceSection,
  CtaSection,
  Footer,
} from './components/landing/Sections';
import { CustomCodeNode, type CodeNodeData, type NodeKind } from './components/graph/CustomCodeNode';
import { GraphToolbar } from './components/graph/GraphToolbar';
import { getLayoutedNodes, findShortestPath, type LayoutDirection } from './components/graph/layout';
import { SidebarInspector } from './components/graph/SidebarInspector';
import { SlidingCodeViewer } from './components/graph/SlidingCodeViewer';
import { HistoryReplayBar, type TimelineSnapshot } from './components/graph/HistoryReplayBar';
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
import { AuthModal } from './components/auth/AuthModal';
import { Modal } from './components/common/Modal';
import { ToastContainer, CommandPalette, type ToastMessage } from './components/common';
import { sourcesApi, workspacesApi, graphApi, authApi, type WorkspaceMemberAPI, type AuthUser, type Workspace } from './services/api';

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

function WorkspaceContainer({
  onBackToLanding,
  user,
  onOpenAuth,
  onLogout,
}: {
  onBackToLanding: () => void;
  user: AuthUser | null;
  onOpenAuth: () => void;
  onLogout: () => void;
}) {
  const [workspaceTab, setWorkspaceTab] = useState<'graph' | 'chat'>('graph');
  const [currentWorkspaceId, setCurrentWorkspaceId] = useState<string>(() => {
    return localStorage.getItem('vintrix_active_workspace') || '';
  });
  const [workspacesList, setWorkspacesList] = useState<Workspace[]>(() => {
    try {
      const stored = localStorage.getItem('vintrix_workspaces');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isWorkspaceDropdownOpen, setIsWorkspaceDropdownOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newWorkspaceDesc, setNewWorkspaceDesc] = useState('');
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [nodes, setNodes] = useState<Node[]>(() => {
    try {
      const activeWs = localStorage.getItem('vintrix_active_workspace') || '';
      const cached = localStorage.getItem(`vintrix_nodes_${activeWs}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [edges, setEdges] = useState<Edge[]>(() => {
    try {
      const activeWs = localStorage.getItem('vintrix_active_workspace') || '';
      const cached = localStorage.getItem(`vintrix_edges_${activeWs}`);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isCodeViewerOpen, setIsCodeViewerOpen] = useState(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<NodeKind | 'all'>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [showOnlyHotspots, setShowOnlyHotspots] = useState(false);
  const [showOnlyCycles, setShowOnlyCycles] = useState(false);
  const [blastDepth, setBlastDepth] = useState<1 | 2 | 'all'>(1);
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('TB');
  const [isPathFinderActive, setIsPathFinderActive] = useState(false);
  const [pathStartNodeId, setPathStartNodeId] = useState<string>('');
  const [pathTargetNodeId, setPathTargetNodeId] = useState<string>('');
  const [isHistoryReplayOpen, setIsHistoryReplayOpen] = useState(false);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false);
  const [isManageSourcesOpen, setIsManageSourcesOpen] = useState(false);
  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [sourcesList, setSourcesList] = useState<CodeSourceItem[]>([]);
  const [membersList, setMembersList] = useState<WorkspaceMember[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (toast: Omit<ToastMessage, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
  };

  const handleDismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Global shortcut: Cmd+K / Ctrl+K to toggle Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch workspaces list only for authenticated session
  useEffect(() => {
    if (!user) {
      setWorkspacesList([]);
      return;
    }

    workspacesApi
      .list()
      .then((data) => {
        if (data && data.length > 0) {
          setWorkspacesList(data);
          try {
            localStorage.setItem('vintrix_workspaces', JSON.stringify(data));
          } catch {
            // pass
          }
          // If current selection is not valid or empty, switch to the first legitimate workspace
          if (!data.some((w) => w.id === currentWorkspaceId)) {
            setCurrentWorkspaceId(data[0].id);
            localStorage.setItem('vintrix_active_workspace', data[0].id);
          }
        } else {
          // If user has cached workspaces, do not overwrite with empty
          const stored = localStorage.getItem('vintrix_workspaces');
          if (stored) {
            try {
              const parsed: Workspace[] = JSON.parse(stored);
              if (parsed.length > 0) {
                setWorkspacesList(parsed);
                if (!parsed.some((w) => w.id === currentWorkspaceId)) {
                  setCurrentWorkspaceId(parsed[0].id);
                  localStorage.setItem('vintrix_active_workspace', parsed[0].id);
                }
                return;
              }
            } catch {
              // pass
            }
          }

          // If user has zero workspaces, auto-create their personal default workspace
          const defaultWsName = user?.displayName ? `${user.displayName.split(' ')[0]}'s Workspace` : 'My Workspace';
          const localWs: Workspace = {
            id: `ws-${Date.now()}`,
            name: defaultWsName,
            description: 'Personal codebase intelligence workspace',
            ownerId: user?.id || 'user-default',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          const list = [localWs];
          setWorkspacesList(list);
          setCurrentWorkspaceId(localWs.id);
          localStorage.setItem('vintrix_workspaces', JSON.stringify(list));
          localStorage.setItem('vintrix_active_workspace', localWs.id);
        }
      })
      .catch((err) => {
        console.warn('[Workspaces List] Failed to fetch member workspaces:', err);
        // Fallback: check cached workspaces first
        const stored = localStorage.getItem('vintrix_workspaces');
        if (stored) {
          try {
            const parsed: Workspace[] = JSON.parse(stored);
            if (parsed.length > 0) {
              setWorkspacesList(parsed);
              if (!parsed.some((w) => w.id === currentWorkspaceId)) {
                setCurrentWorkspaceId(parsed[0].id);
                localStorage.setItem('vintrix_active_workspace', parsed[0].id);
              }
              return;
            }
          } catch {
            // pass
          }
        }

        // Fallback auto-provision
        const defaultWsName = user?.displayName ? `${user.displayName.split(' ')[0]}'s Workspace` : 'My Workspace';
        const localWs: Workspace = {
          id: `ws-${Date.now()}`,
          name: defaultWsName,
          description: 'Personal codebase intelligence workspace',
          ownerId: user?.id || 'user-default',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        const list = [localWs];
        setWorkspacesList(list);
        setCurrentWorkspaceId(localWs.id);
        localStorage.setItem('vintrix_workspaces', JSON.stringify(list));
        localStorage.setItem('vintrix_active_workspace', localWs.id);
      });
  }, [user]);

  // Load sources, members, and graph whenever active workspace changes
  useEffect(() => {
    // 1. Load local cached sources first to ensure immediate display
    const localKey = `vintrix_sources_${currentWorkspaceId}`;
    try {
      const stored = localStorage.getItem(localKey);
      if (stored) {
        setSourcesList(JSON.parse(stored));
      } else {
        setSourcesList([]);
      }
    } catch {
      setSourcesList([]);
    }

    sourcesApi
      .list(currentWorkspaceId)
      .then((data) => {
        if (data && data.length > 0) {
          const mapped = data.map(sourceApiToItem);
          setSourcesList(mapped);
          localStorage.setItem(localKey, JSON.stringify(mapped));
        }
      })
      .catch(() => {
        // Fallback already loaded from localStorage
      });

    workspacesApi
      .listMembers(currentWorkspaceId)
      .then((data) => {
        if (data && data.length > 0) {
          setMembersList(data.map(memberApiToLocal));
        }
      })
      .catch(() => {
        setMembersList([
          {
            userId: user?.id || 'user-1',
            name: user?.displayName || 'Workspace Admin',
            email: user?.email || 'admin@vintrix.ai',
            roleName: 'admin',
            invitedAt: 'Workspace Owner',
          },
        ]);
      });

    if (!currentWorkspaceId) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // 1. Try loading cached nodes and edges for this workspace
    try {
      const cachedNodes = localStorage.getItem(`vintrix_nodes_${currentWorkspaceId}`);
      const cachedEdges = localStorage.getItem(`vintrix_edges_${currentWorkspaceId}`);
      if (cachedNodes) {
        setNodes(JSON.parse(cachedNodes));
      }
      if (cachedEdges) {
        setEdges(JSON.parse(cachedEdges));
      }
    } catch {
      // pass
    }

    graphApi
      .getWorkspaceGraph<CodeNodeData>(currentWorkspaceId)
      .then((res) => {
        if (res && res.nodes && res.nodes.length > 0) {
          setNodes(res.nodes as unknown as Node[]);
          try {
            localStorage.setItem(`vintrix_nodes_${currentWorkspaceId}`, JSON.stringify(res.nodes));
          } catch {
            // pass
          }
          if (res.edges && res.edges.length > 0) {
            setEdges(res.edges as unknown as Edge[]);
            try {
              localStorage.setItem(`vintrix_edges_${currentWorkspaceId}`, JSON.stringify(res.edges));
            } catch {
              // pass
            }
          } else {
            setEdges([]);
          }
        }
      })
      .catch(() => {
        // Keep cached nodes if graph API fails
      });

    // Subscribe to live Server-Sent Events (SSE) for background re-indexing & Git webhooks
    const unsubscribe = sourcesApi.subscribeEvents(currentWorkspaceId, (evt) => {
      if (evt.type === 'started') {
        addToast({
          type: 'info',
          title: 'Codebase Re-indexing Started',
          description: evt.message || `Started analyzing ${evt.sourceName || 'source'}...`,
        });
      } else if (evt.type === 'completed') {
        addToast({
          type: 'success',
          title: 'AST Re-indexing Finished',
          description: evt.message || `Scanned ${evt.nodesScanned} nodes & ${evt.edgesScanned} relationships.`,
        });
        // Silently reload sources & knowledge graph to show fresh nodes live
        sourcesApi.list(currentWorkspaceId).then((data) => {
          if (data) setSourcesList(data.map(sourceApiToItem));
        });
        graphApi.getWorkspaceGraph<CodeNodeData>(currentWorkspaceId).then((res) => {
          if (res && res.nodes && res.nodes.length > 0) {
            setNodes(res.nodes as unknown as Node[]);
            if (res.edges) setEdges(res.edges as unknown as Edge[]);
          }
        });
      } else if (evt.type === 'error') {
        addToast({
          type: 'error',
          title: 'Re-indexing Issue',
          description: evt.message || 'Error occurred during AST re-indexing.',
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentWorkspaceId, user, addToast]);

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;
    setIsCreatingWorkspace(true);
    try {
      const created = await workspacesApi.create({
        name: newWorkspaceName.trim(),
        description: newWorkspaceDesc.trim() || undefined,
        ownerId: user?.id || '00000000-0000-0000-0000-000000000001',
      });
      setWorkspacesList((prev) => {
        const updated = [created, ...prev];
        try {
          localStorage.setItem('vintrix_workspaces', JSON.stringify(updated));
        } catch {
          // pass
        }
        return updated;
      });
      setCurrentWorkspaceId(created.id);
      localStorage.setItem('vintrix_active_workspace', created.id);
      setIsCreateWorkspaceOpen(false);
      setNewWorkspaceName('');
      setNewWorkspaceDesc('');
      addToast({
        type: 'success',
        title: 'Workspace Created',
        description: `Switched to newly created workspace "${created.name}".`,
      });
    } catch {
      // Instant Local storage fallback if server DB is unreachable
      const localWorkspace: Workspace = {
        id: `ws-${Date.now()}`,
        name: newWorkspaceName.trim(),
        description: newWorkspaceDesc.trim() || null,
        ownerId: user?.id || '00000000-0000-0000-0000-000000000001',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setWorkspacesList((prev) => [localWorkspace, ...prev]);
      setCurrentWorkspaceId(localWorkspace.id);
      localStorage.setItem('vintrix_active_workspace', localWorkspace.id);
      setIsCreateWorkspaceOpen(false);
      setNewWorkspaceName('');
      setNewWorkspaceDesc('');
      addToast({
        type: 'success',
        title: 'Workspace Created (Local)',
        description: `Switched to workspace "${localWorkspace.name}".`,
      });
    } finally {
      setIsCreatingWorkspace(false);
    }
  };

  const handleInviteMember = async (email: string, roleName: 'admin' | 'member' | 'viewer') => {
    try {
      const res = await workspacesApi.inviteMember(currentWorkspaceId, email, roleName);
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
    addToast({
      type: 'success',
      title: 'Invitation Sent',
      description: `Invited ${email} as ${roleName.toUpperCase()} to the workspace.`,
    });
  };

  const handleUpdateRole = async (userId: string, newRole: 'admin' | 'member' | 'viewer') => {
    const member = membersList.find((m) => m.userId === userId);
    try {
      await workspacesApi.updateMemberRole(currentWorkspaceId, userId, newRole);
    } catch {
      // ignore
    }
    setMembersList((prev) =>
      prev.map((m) => (m.userId === userId ? { ...m, roleName: newRole } : m))
    );
    addToast({
      type: 'info',
      title: 'Member Role Updated',
      description: `${member?.name || 'Member'} role changed to ${newRole.toUpperCase()}.`,
    });
  };

  const handleRemoveMember = async (userId: string) => {
    const member = membersList.find((m) => m.userId === userId);
    try {
      await workspacesApi.removeMember(currentWorkspaceId, userId);
    } catch {
      // ignore
    }
    setMembersList((prev) => prev.filter((m) => m.userId !== userId));
    addToast({
      type: 'info',
      title: 'Member Removed',
      description: `${member?.name || 'Member'} was removed from the workspace.`,
    });
  };

  const { fitView, setCenter } = useReactFlow();

  const gitSourcesCount = sourcesList.filter((s) => s.type === 'git').length;
  const sshSourcesCount = sourcesList.filter((s) => s.type === 'ssh').length;

  const handleDeleteSource = async (sourceId: string) => {
    const targetSource = sourcesList.find((s) => s.id === sourceId);
    try {
      await sourcesApi.delete(sourceId);
    } catch {
      // ignore
    }
    setSourcesList((prev) => {
      const updated = prev.filter((s) => s.id !== sourceId);
      try {
        localStorage.setItem(`vintrix_sources_${currentWorkspaceId}`, JSON.stringify(updated));
      } catch {
        // pass
      }
      return updated;
    });
    if (targetSource) {
      setNodes((prev) =>
        prev.filter((node) => {
          const data = node.data as unknown as CodeNodeData;
          return data?.sourceName !== targetSource.name;
        })
      );
      addToast({
        type: 'info',
        title: 'Source Removed',
        description: `Source '${targetSource.name}' and its knowledge nodes were removed from workspace.`,
      });
    }
  };

  const handleTriggerReindex = async (sourceId: string) => {
    const targetSource = sourcesList.find((s) => s.id === sourceId);
    
    // Set status to indexing first
    setSourcesList((prev) =>
      prev.map((s) =>
        s.id === sourceId ? { ...s, status: 'indexing' } : s
      )
    );

    addToast({
      type: 'info',
      title: 'AST Indexing Started',
      description: `Analyzing AST and building dependency graph for '${targetSource?.name || 'source'}'...`,
    });

    try {
      await sourcesApi.triggerReindex(sourceId);
    } catch {
      // ignore
    }

    setTimeout(() => {
      if (targetSource) {
        const baseName = targetSource.name.replace(/[^a-zA-Z0-9]/g, '') || 'Source';
        const sampleNodes: Node[] = [
          {
            id: `node-${targetSource.id}-entry`,
            type: 'codeNode',
            position: { x: 180, y: 140 },
            data: {
              label: `${baseName}Gateway`,
              kind: 'gateway',
              sourceName: targetSource.name,
              sourceType: targetSource.type,
              filePath: 'src/index.ts',
              lines: 'L1-L90',
              methodCount: 4,
              dependencyCount: 2,
              status: 'synced',
              summary: `Entry point, route registration, and gateway orchestrator for ${targetSource.name}.`,
              codeSnippet: `import { Router } from 'elysia';\nexport const app = new Router();\napp.get('/', () => ({ status: 'healthy', source: '${targetSource.name}' }));`,
              tags: [targetSource.type, 'core', 'entry', 'gateway'],
            },
          },
          {
            id: `node-${targetSource.id}-service`,
            type: 'codeNode',
            position: { x: 480, y: 100 },
            data: {
              label: `${baseName}Service`,
              kind: 'service',
              sourceName: targetSource.name,
              sourceType: targetSource.type,
              filePath: 'src/services/handler.ts',
              lines: 'L1-L165',
              methodCount: 6,
              dependencyCount: 1,
              status: 'synced',
              summary: `Domain business logic engine and data processing pipeline for ${targetSource.name}.`,
              codeSnippet: `export class ${baseName}Service {\n  async process() {\n    return { success: true, processedAt: Date.now() };\n  }\n}`,
              tags: [targetSource.type, 'service', 'domain'],
            },
          },
          {
            id: `node-${targetSource.id}-db`,
            type: 'codeNode',
            position: { x: 780, y: 180 },
            data: {
              label: `${baseName}Store`,
              kind: 'database',
              sourceName: targetSource.name,
              sourceType: targetSource.type,
              filePath: 'src/db/schema.ts',
              lines: 'L1-L60',
              methodCount: 2,
              dependencyCount: 0,
              status: 'synced',
              summary: `Persistent schema model and ORM entity definitions for ${targetSource.name}.`,
              codeSnippet: `export const records = pgTable('${baseName.toLowerCase()}_records', {\n  id: uuid('id').primaryKey(),\n  name: text('name').notNull(),\n});`,
              tags: [targetSource.type, 'database', 'schema'],
            },
          },
        ];

        const sampleEdges: Edge[] = [
          {
            id: `edge-${targetSource.id}-1-2`,
            source: `node-${targetSource.id}-entry`,
            target: `node-${targetSource.id}-service`,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#38bdf8', strokeWidth: 2 },
          },
          {
            id: `edge-${targetSource.id}-2-3`,
            source: `node-${targetSource.id}-service`,
            target: `node-${targetSource.id}-db`,
            type: 'smoothstep',
            animated: true,
            style: { stroke: '#818cf8', strokeWidth: 2 },
          },
        ];

        setNodes((prev) => {
          const merged = [...prev.filter((n) => (n.data as unknown as CodeNodeData)?.sourceName !== targetSource.name), ...sampleNodes];
          try {
            localStorage.setItem(`vintrix_nodes_${currentWorkspaceId}`, JSON.stringify(merged));
          } catch {
            // pass
          }
          return merged;
        });

        setEdges((prev) => {
          const merged = [...prev, ...sampleEdges];
          try {
            localStorage.setItem(`vintrix_edges_${currentWorkspaceId}`, JSON.stringify(merged));
          } catch {
            // pass
          }
          return merged;
        });

        setSourcesList((prev) => {
          const updated = prev.map((s) =>
            s.id === sourceId
              ? { ...s, lastSyncedAt: 'Just now', status: 'synced' as const, nodesCount: sampleNodes.length }
              : s
          );
          try {
            localStorage.setItem(`vintrix_sources_${currentWorkspaceId}`, JSON.stringify(updated));
          } catch {
            // pass
          }
          return updated;
        });

        addToast({
          type: 'success',
          title: 'Re-indexing Completed',
          description: `Extracted ${sampleNodes.length} AST components and relations for '${targetSource.name}'.`,
        });
      }
    }, 2200);
  };

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );
  const onEdgesChange: OnEdgesChange = useCallback(
    (changes) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  // Available unique code sources across workspace (from sourcesList & nodes)
  const availableSources = useMemo(() => {
    const list: { id: string; label: string }[] = [];
    sourcesList.forEach((s) => {
      if (s.name && !list.some((item) => item.id === s.name)) {
        list.push({ id: s.name, label: s.name });
      }
    });
    nodes.forEach((node) => {
      const data = node.data as unknown as CodeNodeData;
      if (data?.sourceName && !list.some((item) => item.id === data.sourceName)) {
        list.push({ id: data.sourceName, label: data.sourceName });
      }
    });
    return list;
  }, [sourcesList, nodes]);

  // Compute node in-degree, out-degree, hotspot scores, and circular dependencies
  const enrichedNodes = useMemo(() => {
    // Map degrees
    const inDegrees: Record<string, number> = {};
    const outDegrees: Record<string, number> = {};

    edges.forEach((e) => {
      outDegrees[e.source] = (outDegrees[e.source] || 0) + 1;
      inDegrees[e.target] = (inDegrees[e.target] || 0) + 1;
    });

    // Circular Dependency Detection via DFS Cycle Search
    const adj: Record<string, string[]> = {};
    edges.forEach((e) => {
      if (!adj[e.source]) adj[e.source] = [];
      adj[e.source].push(e.target);
    });

    const circularNodes = new Set<string>();
    const nodeCycles: Record<string, string[]> = {};
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (nodeId: string) => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adj[nodeId] || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          dfs(next);
        } else if (recStack.has(next)) {
          // Detected cycle: extract sub-cycle from next to end of path
          const cycleStartIndex = path.indexOf(next);
          if (cycleStartIndex !== -1) {
            const cycleNodes = path.slice(cycleStartIndex).concat(next);
            cycleNodes.forEach((cn) => {
              circularNodes.add(cn);
              nodeCycles[cn] = cycleNodes;
            });
          }
        }
      }

      path.pop();
      recStack.delete(nodeId);
    };

    nodes.forEach((n) => {
      if (!visited.has(n.id)) {
        dfs(n.id);
      }
    });

    return nodes.map((node) => {
      const data = node.data as unknown as CodeNodeData;
      if (!data) return node;

      const inDegree = inDegrees[node.id] || 0;
      const outDegree = outDegrees[node.id] || 0;
      const hotspotScore = inDegree + outDegree;
      const isCircular = circularNodes.has(node.id);
      const circularCycle = nodeCycles[node.id];

      return {
        ...node,
        data: {
          ...data,
          inDegree,
          outDegree,
          hotspotScore,
          isCircular,
          circularCycle,
        },
      };
    });
  }, [nodes, edges]);

  // Filtered nodes based on search, layer kind, & source scope
  const filteredNodes = useMemo(() => {
    return enrichedNodes.filter((node) => {
      const data = node.data as unknown as CodeNodeData;
      if (!data) return true;

      const matchesKind = selectedKind === 'all' || data.kind === selectedKind;
      const matchesSource =
        selectedSource === 'all' || data.sourceName === selectedSource;
      const matchesHotspot =
        !showOnlyHotspots || (data.hotspotScore !== undefined && data.hotspotScore >= 4);
      const matchesCycles = !showOnlyCycles || Boolean(data.isCircular);
      const matchesSearch =
        !searchQuery ||
        data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        data.filePath.toLowerCase().includes(searchQuery.toLowerCase()) ||
        data.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (data.sourceName && data.sourceName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (data.tags && data.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

      return matchesKind && matchesSource && matchesHotspot && matchesCycles && matchesSearch;
    });
  }, [enrichedNodes, selectedKind, selectedSource, showOnlyHotspots, showOnlyCycles, searchQuery]);

  // Compute blast radius: sets of upstream callers and downstream callees with multi-hop support
  const blastRadius = useMemo(() => {
    if (!selectedNodeId) {
      return {
        upstreamNodeIds: new Map<string, number>(),
        downstreamNodeIds: new Map<string, number>(),
        activeEdgeIds: new Set<string>(),
      };
    }

    const upstreamNodeIds = new Map<string, number>();
    const downstreamNodeIds = new Map<string, number>();
    const activeEdgeIds = new Set<string>();

    const maxHops = blastDepth === 'all' ? Infinity : blastDepth;

    // Build incoming and outgoing adjacency maps with edge ids
    const incoming: Record<string, { source: string; edgeId: string }[]> = {};
    const outgoing: Record<string, { target: string; edgeId: string }[]> = {};

    edges.forEach((edge) => {
      if (!incoming[edge.target]) incoming[edge.target] = [];
      incoming[edge.target].push({ source: edge.source, edgeId: edge.id });

      if (!outgoing[edge.source]) outgoing[edge.source] = [];
      outgoing[edge.source].push({ target: edge.target, edgeId: edge.id });
    });

    // BFS for upstream callers
    const upstreamQueue: { id: string; hop: number }[] = [{ id: selectedNodeId, hop: 0 }];
    const visitedUpstream = new Set<string>([selectedNodeId]);

    while (upstreamQueue.length > 0) {
      const { id, hop } = upstreamQueue.shift()!;
      if (hop >= maxHops) continue;

      const inc = incoming[id] || [];
      for (const item of inc) {
        activeEdgeIds.add(item.edgeId);
        if (!visitedUpstream.has(item.source)) {
          visitedUpstream.add(item.source);
          upstreamNodeIds.set(item.source, hop + 1);
          upstreamQueue.push({ id: item.source, hop: hop + 1 });
        }
      }
    }

    // BFS for downstream callees
    const downstreamQueue: { id: string; hop: number }[] = [{ id: selectedNodeId, hop: 0 }];
    const visitedDownstream = new Set<string>([selectedNodeId]);

    while (downstreamQueue.length > 0) {
      const { id, hop } = downstreamQueue.shift()!;
      if (hop >= maxHops) continue;

      const out = outgoing[id] || [];
      for (const item of out) {
        activeEdgeIds.add(item.edgeId);
        if (!visitedDownstream.has(item.target)) {
          visitedDownstream.add(item.target);
          downstreamNodeIds.set(item.target, hop + 1);
          downstreamQueue.push({ id: item.target, hop: hop + 1 });
        }
      }
    }

    return { upstreamNodeIds, downstreamNodeIds, activeEdgeIds };
  }, [selectedNodeId, edges, blastDepth]);

  // Compute shortest path when Path Finder is active and both start and target are chosen
  const activePath = useMemo(() => {
    if (!isPathFinderActive || !pathStartNodeId || !pathTargetNodeId) return null;
    return findShortestPath(pathStartNodeId, pathTargetNodeId, edges);
  }, [isPathFinderActive, pathStartNodeId, pathTargetNodeId, edges]);

  // Simulated Git architecture evolution snapshots for History Replay
  const historySnapshots: TimelineSnapshot[] = useMemo(() => {
    if (nodes.length === 0) return [];

    const step1Nodes = nodes.slice(0, Math.max(2, Math.floor(nodes.length * 0.35))).map((n) => n.id);
    const step2Nodes = nodes.slice(0, Math.max(3, Math.floor(nodes.length * 0.65))).map((n) => n.id);
    const step3Nodes = nodes.slice(0, Math.max(4, Math.floor(nodes.length * 0.85))).map((n) => n.id);
    const step4Nodes = nodes.map((n) => n.id);

    const getActiveEdges = (activeIds: string[]) => {
      const set = new Set(activeIds);
      return edges.filter((e) => set.has(e.source) && set.has(e.target)).map((e) => e.id);
    };

    return [
      {
        id: 'snap-1',
        commitHash: 'a1b2c3d',
        commitMessage: 'feat(core): initial repository scaffolding & database entities',
        author: 'Alex Mercer',
        timestamp: '2 weeks ago',
        activeNodeIds: step1Nodes,
        activeEdgeIds: getActiveEdges(step1Nodes),
        changedNodeId: step1Nodes[0],
      },
      {
        id: 'snap-2',
        commitHash: 'e4f5a6b',
        commitMessage: 'feat(services): implement business logic & auth token service',
        author: 'Sarah Connor',
        timestamp: '1 week ago',
        activeNodeIds: step2Nodes,
        activeEdgeIds: getActiveEdges(step2Nodes),
        changedNodeId: step2Nodes[step2Nodes.length - 1],
      },
      {
        id: 'snap-3',
        commitHash: '9c8b7a6',
        commitMessage: 'feat(api): expose API gateway endpoints and security filters',
        author: 'Novin Triantonius',
        timestamp: '3 days ago',
        activeNodeIds: step3Nodes,
        activeEdgeIds: getActiveEdges(step3Nodes),
        changedNodeId: step3Nodes[step3Nodes.length - 1],
      },
      {
        id: 'snap-4',
        commitHash: 'd3e2f1a',
        commitMessage: 'refactor(arch): optimize dependency injection and cycle isolation',
        author: 'Novin Triantonius',
        timestamp: 'Just now',
        activeNodeIds: step4Nodes,
        activeEdgeIds: getActiveEdges(step4Nodes),
        changedNodeId: step4Nodes[step4Nodes.length - 1],
      },
    ];
  }, [nodes, edges]);

  // Enriched filtered nodes with blast radius role, path finder role, history replay, and dimming
  const displayNodes = useMemo(() => {
    // If History Replay is active, constrain nodes to the active snapshot
    if (isHistoryReplayOpen && historySnapshots.length > 0) {
      const currentSnap = historySnapshots[historyIndex] || historySnapshots[0];
      const activeSet = new Set(currentSnap.activeNodeIds);
      return filteredNodes.map((node) => {
        const isActive = activeSet.has(node.id);
        const isLatestAdded = node.id === currentSnap.changedNodeId;
        return {
          ...node,
          data: {
            ...node.data,
            isDimmed: !isActive,
            isBlastRadius: isActive,
            blastRole: isLatestAdded ? 'target' : isActive ? 'downstream' : undefined,
          },
        };
      });
    }

    if (isPathFinderActive && pathStartNodeId && pathTargetNodeId) {
      const pathNodeSet = new Set(activePath ? activePath.nodeIds : [pathStartNodeId, pathTargetNodeId]);
      return filteredNodes.map((node) => {
        const isStart = node.id === pathStartNodeId;
        const isTarget = node.id === pathTargetNodeId;
        const isPath = pathNodeSet.has(node.id);
        const blastRole = isStart ? 'target' : isTarget ? 'downstream' : isPath ? 'upstream' : undefined;

        return {
          ...node,
          data: {
            ...node.data,
            isDimmed: !isPath,
            isBlastRadius: isPath,
            blastRole,
          },
        };
      });
    }

    if (!selectedNodeId) return filteredNodes;

    return filteredNodes.map((node) => {
      const isTarget = node.id === selectedNodeId;
      const upstreamHop = blastRadius.upstreamNodeIds.get(node.id);
      const downstreamHop = blastRadius.downstreamNodeIds.get(node.id);
      const isUpstream = upstreamHop !== undefined;
      const isDownstream = downstreamHop !== undefined;
      const isPartOfBlast = isTarget || isUpstream || isDownstream;

      const blastRole = isTarget ? 'target' : isUpstream ? 'upstream' : isDownstream ? 'downstream' : undefined;
      const blastHop = upstreamHop ?? downstreamHop;

      return {
        ...node,
        data: {
          ...node.data,
          isDimmed: !isPartOfBlast,
          isBlastRadius: isPartOfBlast,
          blastRole,
          blastHop,
        },
      };
    });
  }, [filteredNodes, selectedNodeId, blastRadius, isPathFinderActive, pathStartNodeId, pathTargetNodeId, activePath]);

  // Count nodes involved in circular dependency cycles
  const totalCyclesCount = useMemo(() => {
    return enrichedNodes.filter((n) => (n.data as unknown as CodeNodeData)?.isCircular).length;
  }, [enrichedNodes]);

  // Enriched edges with animated glowing style for blast radius connections and circular warnings
  const displayEdges = useMemo(() => {
    // History Replay edge filtering
    if (isHistoryReplayOpen && historySnapshots.length > 0) {
      const currentSnap = historySnapshots[historyIndex] || historySnapshots[0];
      const activeEdgeSet = new Set(currentSnap.activeEdgeIds);
      return edges.map((edge) => {
        const isActive = activeEdgeSet.has(edge.id);
        if (isActive) {
          return {
            ...edge,
            animated: true,
            style: {
              ...edge.style,
              stroke: '#38bdf8',
              strokeWidth: 2,
              opacity: 0.95,
            },
          };
        }
        return {
          ...edge,
          animated: false,
          style: {
            ...edge.style,
            stroke: '#1e293b',
            strokeWidth: 1,
            opacity: 0.08,
          },
        };
      });
    }
    // Identify edges that form part of a detected circular cycle
    const circularEdgeSet = new Set<string>();
    enrichedNodes.forEach((node) => {
      const data = node.data as unknown as CodeNodeData;
      if (data?.isCircular && data?.circularCycle && data.circularCycle.length > 1) {
        const cycle = data.circularCycle;
        for (let i = 0; i < cycle.length - 1; i++) {
          const from = cycle[i];
          const to = cycle[i + 1];
          const matched = edges.find((e) => e.source === from && e.target === to);
          if (matched) circularEdgeSet.add(matched.id);
        }
      }
    });

    // If filtering by cycles only, also filter edges to keep only circular edges or edges between visible cycle nodes
    const candidateEdges = showOnlyCycles
      ? edges.filter((e) => {
          const isVisible = filteredNodes.some((n) => n.id === e.source) && filteredNodes.some((n) => n.id === e.target);
          return circularEdgeSet.has(e.id) || isVisible;
        })
      : edges;

    // Path Finder active state: highlight only the edges on the shortest route
    if (isPathFinderActive && pathStartNodeId && pathTargetNodeId && activePath) {
      const pathEdgeSet = new Set(activePath.edgeIds);
      return candidateEdges.map((edge) => {
        const isPathEdge = pathEdgeSet.has(edge.id);
        if (isPathEdge) {
          return {
            ...edge,
            animated: true,
            style: {
              ...edge.style,
              stroke: '#10b981', // bright emerald
              strokeWidth: 3,
              opacity: 1,
            },
          };
        }
        return {
          ...edge,
          animated: false,
          style: {
            ...edge.style,
            stroke: '#1e293b',
            strokeWidth: 1,
            opacity: 0.1,
          },
        };
      });
    }

    return candidateEdges.map((edge) => {
      const isCircular = circularEdgeSet.has(edge.id);
      const isConnected = blastRadius.activeEdgeIds.has(edge.id);
      const isOutgoing = edge.source === selectedNodeId;

      if (selectedNodeId) {
        if (isConnected) {
          return {
            ...edge,
            animated: true,
            style: {
              ...edge.style,
              stroke: isCircular ? '#f43f5e' : isOutgoing ? '#818cf8' : '#34d399',
              strokeWidth: 2.5,
              opacity: 1,
            },
          };
        }

        return {
          ...edge,
          animated: false,
          style: {
            ...edge.style,
            stroke: isCircular ? '#e11d48' : '#334155',
            strokeWidth: isCircular ? 1.5 : 1,
            opacity: isCircular ? 0.4 : 0.15,
          },
        };
      }

      // Default (no node selected): highlight circular edges in rose red
      if (isCircular) {
        return {
          ...edge,
          animated: true,
          style: {
            ...edge.style,
            stroke: '#f43f5e',
            strokeWidth: 2,
            opacity: 0.9,
          },
        };
      }

      return edge;
    });
  }, [edges, selectedNodeId, blastRadius, enrichedNodes, showOnlyCycles, filteredNodes, isPathFinderActive, pathStartNodeId, pathTargetNodeId, activePath, isHistoryReplayOpen, historySnapshots, historyIndex]);

  const allNodeDataList = useMemo(() => {
    return enrichedNodes.map((n) => ({
      ...(n.data as unknown as CodeNodeData),
      id: n.id,
    }));
  }, [enrichedNodes]);

  const selectedNodeData = useMemo(() => {
    const found = enrichedNodes.find((n) => n.id === selectedNodeId);
    return found ? (found.data as unknown as CodeNodeData) : null;
  }, [enrichedNodes, selectedNodeId]);

  const focusNodeOnCanvas = useCallback(
    (nodeId: string) => {
      const target = nodes.find((n) => n.id === nodeId);
      if (target && target.position) {
        setCenter(target.position.x + 130, target.position.y + 70, {
          zoom: 1.15,
          duration: 750,
        });
      }
    },
    [nodes, setCenter]
  );

  // Apply layout preset
  const handleSelectLayout = (direction: LayoutDirection) => {
    setLayoutDirection(direction);
    setNodes((prevNodes) => {
      const layouted = getLayoutedNodes(prevNodes, edges, direction);
      return layouted;
    });
    setTimeout(() => {
      fitView({ duration: 500 });
    }, 50);
  };

  const handleSelectNodeByPath = (path: string) => {
    const target = nodes.find((n) => (n.data as unknown as CodeNodeData)?.filePath === path);
    if (target) {
      setSelectedNodeId(target.id);
      focusNodeOnCanvas(target.id);
    }
  };

  // Auto-focus first matching node when user types a search query
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const matched = filteredNodes[0];
    if (matched) {
      setSelectedNodeId(matched.id);
      focusNodeOnCanvas(matched.id);
    }
  }, [searchQuery, filteredNodes, focusNodeOnCanvas]);

  // Export Knowledge Graph as SVG file
  const handleExportSvg = () => {
    try {
      const activeWs = workspacesList.find((w) => w.id === currentWorkspaceId)?.name || 'workspace';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${activeWs}-graph-${timestamp}.svg`;

      const escapeXml = (unsafe: string) => {
        return unsafe.replace(/[<>&'"]/g, (c) => {
          switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
          }
        });
      };

      const width = 1600;
      const height = 900;
      const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="background-color: #050a10; font-family: ui-sans-serif, system-ui, sans-serif;">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0b1320" />
      <stop offset="100%" stop-color="#050a10" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bgGrad)" />
  <text x="32" y="48" fill="#38bdf8" font-size="22" font-weight="bold">Vintrix Knowledge Graph</text>
  <text x="32" y="74" fill="#94a3b8" font-size="13">Workspace: ${escapeXml(activeWs)} | Total Nodes: ${nodes.length} | Exported: ${new Date().toLocaleString()}</text>
  
  <g transform="translate(60, 110)">
    ${filteredNodes
      .map((n, i) => {
        const d = n.data as unknown as CodeNodeData;
        const x = (i % 4) * 360;
        const y = Math.floor(i / 4) * 160;
        const kindColors: Record<string, string> = {
          controller: '#38bdf8',
          service: '#34d399',
          database: '#fbbf24',
          security: '#f43f5e',
          gateway: '#818cf8',
        };
        const color = kindColors[d.kind] || '#94a3b8';
        const tags = Array.isArray(d.tags) ? d.tags.slice(0, 3).join(', ') : 'AST symbol';
        return `
    <g transform="translate(${x}, ${y})">
      <rect width="320" height="120" rx="10" fill="#0c1626" stroke="${color}" stroke-width="1.5" opacity="0.95" />
      <circle cx="20" cy="24" r="5" fill="${color}" />
      <text x="32" y="28" fill="#ffffff" font-size="13" font-weight="bold">${escapeXml(d.label || '')}</text>
      <text x="20" y="52" fill="#94a3b8" font-size="11" font-family="monospace">${escapeXml(d.filePath || '')}</text>
      <text x="20" y="76" fill="#64748b" font-size="10">Tags: ${escapeXml(tags)}</text>
      <text x="20" y="98" fill="#38bdf8" font-size="10" font-weight="bold">Type: ${d.kind.toUpperCase()}</text>
    </g>`;
      })
      .join('\n')}
  </g>
</svg>`;

      const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        title: 'Graph Exported',
        description: `Knowledge graph exported to ${filename}`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Export Failed',
        description: err.message || 'Unknown error occurred while exporting graph.',
      });
    }
  };

  // Export Mermaid.js Architecture Diagram
  const handleExportMermaid = async () => {
    try {
      const activeWs = workspacesList.find((w) => w.id === currentWorkspaceId)?.name || 'workspace';
      const filename = `${activeWs}-architecture.mmd`;

      let mermaidText = `graph TD\n`;
      mermaidText += `  %% Vintrix Architectural Topology: ${activeWs}\n`;
      mermaidText += `  %% Generated at: ${new Date().toISOString()}\n\n`;

      // Classes and styles
      mermaidText += `  classDef controller fill:#0c1c38,stroke:#38bdf8,stroke-width:2px,color:#f8fafc;\n`;
      mermaidText += `  classDef service fill:#062319,stroke:#34d399,stroke-width:2px,color:#f8fafc;\n`;
      mermaidText += `  classDef database fill:#271c06,stroke:#fbbf24,stroke-width:2px,color:#f8fafc;\n`;
      mermaidText += `  classDef security fill:#2c0c14,stroke:#f43f5e,stroke-width:2px,color:#f8fafc;\n`;
      mermaidText += `  classDef gateway fill:#18153b,stroke:#818cf8,stroke-width:2px,color:#f8fafc;\n\n`;

      // Subgraphs grouped by kind for clean layout
      const nodesByKind = filteredNodes.reduce((acc, curr) => {
        const d = curr.data as unknown as CodeNodeData;
        acc[d.kind] = acc[d.kind] || [];
        acc[d.kind].push(curr);
        return acc;
      }, {} as Record<string, typeof filteredNodes>);

      for (const [kind, groupNodes] of Object.entries(nodesByKind)) {
        mermaidText += `  subgraph ${kind.toUpperCase()}_LAYER ["${kind.toUpperCase()} LAYER"]\n`;
        groupNodes.forEach((n) => {
          const d = n.data as unknown as CodeNodeData;
          const cleanId = n.id.replace(/[^a-zA-Z0-9_]/g, '_');
          const cleanLabel = (d.label || n.id).replace(/["[\]()]/g, '');
          mermaidText += `    ${cleanId}["${cleanLabel}"]:::${d.kind}\n`;
        });
        mermaidText += `  end\n\n`;
      }

      // Edges
      if (edges.length > 0) {
        mermaidText += `  %% Relationships\n`;
        edges.forEach((e) => {
          const from = e.source.replace(/[^a-zA-Z0-9_]/g, '_');
          const to = e.target.replace(/[^a-zA-Z0-9_]/g, '_');
          const edgeLabel = e.label ? String(e.label).replace(/"/g, '') : '';
          const label = edgeLabel ? `|"${edgeLabel}"|` : '';
          mermaidText += `  ${from} -->${label} ${to}\n`;
        });
      }

      // Copy to clipboard & trigger file download
      try {
        await navigator.clipboard.writeText(mermaidText);
      } catch {
        // clipboard might be blocked in some iframe contexts
      }

      const blob = new Blob([mermaidText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        title: 'Mermaid Diagram Exported',
        description: `Copied to clipboard and saved to ${filename}`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Mermaid Export Failed',
        description: err.message || 'Failed to export Mermaid diagram.',
      });
    }
  };

  // Export Architectural Markdown Report
  const handleExportReport = () => {
    try {
      const activeWs = workspacesList.find((w) => w.id === currentWorkspaceId)?.name || 'workspace';
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${activeWs}-architecture-report-${timestamp}.md`;

      const kindBreakdown = filteredNodes.reduce((acc, curr) => {
        const k = (curr.data as unknown as CodeNodeData).kind;
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Extract Hotspots (score >= 4) sorted by score descending
      const hotspotItems = [...enrichedNodes]
        .map((n) => n.data as unknown as CodeNodeData)
        .filter((d) => (d.hotspotScore ?? 0) >= 4)
        .sort((a, b) => (b.hotspotScore ?? 0) - (a.hotspotScore ?? 0));

      // Extract Circular Dependency Cycles
      const circularItems = [...enrichedNodes]
        .map((n) => n.data as unknown as CodeNodeData)
        .filter((d) => d.isCircular);

      let md = `# Architecture & Codebase Intelligence Report
**Workspace:** ${activeWs}  
**Generated At:** ${new Date().toLocaleString()}  
**Indexed Nodes:** ${nodes.length}  
**Active Filter Nodes:** ${filteredNodes.length}  
**Relationships (Edges):** ${edges.length}  
**Hotspot Centrality Bottlenecks:** ${hotspotItems.length}  
**Circular Dependency Warnings:** ${circularItems.length}  

---

## 1. Executive Summary
This report was generated automatically by **Vintrix Architecture Intelligence Engine**. It analyzes AST nodes, dependency flow, module responsibilities, coupling metrics, and architectural risk patterns across this workspace.

### Node Distribution
| Category | Node Count | Description |
| :--- | :---: | :--- |
| **API / Controllers** | ${kindBreakdown['controller'] || 0} | Public REST/RPC entrypoints & handlers |
| **Domain Services** | ${kindBreakdown['service'] || 0} | Core business logic & processing pipelines |
| **Database & Schema** | ${kindBreakdown['database'] || 0} | Persistent models, ORM mappings & storage |
| **Security & Auth** | ${kindBreakdown['security'] || 0} | Middleware, guards, tokens & encryption |
| **Gateway / Integration** | ${kindBreakdown['gateway'] || 0} | External adapters, event buses & RPC routers |

---

## 2. Architectural Coupling & Hotspots (Centrality Analysis)
Hotspots represent components with high in-degree (dependents) and out-degree (dependencies). A score $\\ge 4$ indicates a critical architectural bottleneck with high blast radius on modifications.

${
  hotspotItems.length > 0
    ? `| Rank | Component | Kind | In-Degree (↓) | Out-Degree (↑) | Total Score | File Path |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
${hotspotItems
  .map(
    (h, idx) =>
      `| #${idx + 1} | **${h.label}** | \`${h.kind}\` | ${h.inDegree ?? 0} | ${h.outDegree ?? 0} | **${h.hotspotScore}** | \`${h.filePath}\` |`
  )
  .join('\n')}`
    : `_No high-coupling bottlenecks detected (all nodes have coupling score < 4)._`
}

---

## 3. Circular Dependency Audit (Cycle Detection)
Circular dependencies ($A \\to B \\to A$) impede modular testing, increase compilation coupling, and risk deadlocks or infinite loops.

${
  circularItems.length > 0
    ? `> **Warning:** Found **${circularItems.length}** components involved in circular dependency cycles.
${circularItems
  .map((c) => `- **${c.label}** (\`${c.filePath}\`): \`${c.circularCycle?.join(' -> ') || 'Cyclic reference'}\``)
  .join('\n')}`
    : `_Clean architecture verified: No circular dependency cycles found._`
}

---

## 4. Codebase Symbol Directory
Below is the categorized breakdown of all indexed source files in this workspace:

`;

      filteredNodes.forEach((n) => {
        const d = n.data as unknown as CodeNodeData;
        md += `### [${d.kind.toUpperCase()}] ${d.label}\n`;
        md += `- **File Path:** \`${d.filePath}\`\n`;
        if (d.lines) md += `- **Lines:** ${d.lines}\n`;
        if (d.summary) md += `- **Summary:** ${d.summary}\n`;
        if (Array.isArray(d.tags) && d.tags.length > 0) {
          md += `- **Tags:** ${d.tags.map((s) => `\`${s}\``).join(', ')}\n`;
        }
        md += '\n';
      });

      md += `---
## 5. Dependency Flow Graph
\`\`\`mermaid
graph TD
`;
      // Generate Mermaid diagram from nodes and edges
      filteredNodes.forEach((n) => {
        const d = n.data as unknown as CodeNodeData;
        const cleanId = n.id.replace(/[^a-zA-Z0-9_]/g, '_');
        md += `  ${cleanId}["${d.label} (${d.kind})"]\n`;
      });

      edges.forEach((e) => {
        const from = e.source.replace(/[^a-zA-Z0-9_]/g, '_');
        const to = e.target.replace(/[^a-zA-Z0-9_]/g, '_');
        const label = e.label ? `|"${e.label}"|` : '';
        md += `  ${from} -->${label} ${to}\n`;
      });
      md += '```\n\n_Generated by Vintrix Engine._\n';

      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addToast({
        type: 'success',
        title: 'Report Generated',
        description: `Architecture markdown report saved to ${filename}`,
      });
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Report Generation Failed',
        description: err.message || 'Unknown error occurred while generating report.',
      });
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
          <div className="relative">
            <button
              onClick={() => setIsWorkspaceDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1 sm:gap-1.5 text-[11px] font-mono text-slate-300 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] px-1.5 sm:px-2 py-1 rounded border border-white/[0.08] transition-colors truncate max-w-[95px] sm:max-w-[150px]"
              title="Switch Workspace"
            >
              <span className="truncate">
                {workspacesList.find((w) => w.id === currentWorkspaceId)?.name || (workspacesList[0]?.name ?? 'Select Workspace')}
              </span>
              <ChevronDown size={11} className="shrink-0 text-slate-400" />
            </button>

            {isWorkspaceDropdownOpen && (
              <div className="absolute top-full left-0 mt-1.5 w-56 bg-[#090e18] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50">
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Workspaces
                </div>
                {workspacesList.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400 italic font-sans">
                    No workspaces found
                  </div>
                ) : (
                  workspacesList.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setCurrentWorkspaceId(ws.id);
                        localStorage.setItem('vintrix_active_workspace', ws.id);
                        setIsWorkspaceDropdownOpen(false);
                        addToast({
                          type: 'info',
                          title: 'Workspace Switched',
                          description: `Active workspace changed to "${ws.name}".`,
                        });
                      }}
                      className={`w-full text-left px-3 py-1.5 text-xs font-mono transition-colors flex items-center justify-between ${
                        ws.id === currentWorkspaceId
                          ? 'text-sky-300 bg-sky-500/10 font-medium'
                          : 'text-slate-300 hover:bg-white/[0.04]'
                      }`}
                    >
                      <span className="truncate">{ws.name}</span>
                      {ws.id === currentWorkspaceId && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
                    </button>
                  ))
                )}
                <div className="border-t border-white/[0.08] my-1" />
                <button
                  onClick={() => {
                    setIsWorkspaceDropdownOpen(false);
                    setIsCreateWorkspaceOpen(true);
                  }}
                  className="w-full text-left px-3 py-1.5 text-xs text-sky-400 hover:text-sky-300 hover:bg-sky-500/10 transition-colors flex items-center gap-1.5 font-medium"
                >
                  <Plus size={12} />
                  <span>Create Workspace</span>
                </button>
              </div>
            )}
          </div>

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
          {/* Desktop Search Trigger */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-all hover:text-white text-xs shrink-0"
            title="Search AST nodes, files, actions (Cmd+K)"
          >
            <span className="text-[11px] font-sans">Search</span>
            <kbd className="px-1 py-0.2 text-[9px] font-mono text-slate-400 bg-white/[0.06] border border-white/10 rounded">
              ⌘K
            </kbd>
          </button>

          {/* Mobile Quick Search Button */}
          <button
            onClick={() => setIsCommandPaletteOpen(true)}
            className="sm:hidden flex items-center justify-center w-7 h-7 rounded-md bg-white/[0.04] text-slate-300 border border-white/[0.08] hover:text-white"
            title="Search (Cmd+K)"
          >
            <Search size={13} />
          </button>

          {/* Team Collaboration Trigger - Desktop */}
          <button
            onClick={() => setIsTeamModalOpen(true)}
            className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-all hover:text-white shrink-0"
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
            <span className="font-sans text-xs">{membersList.length} Members</span>
          </button>

          {/* Add Source - Desktop */}
          <button
            onClick={() => setIsAddSourceOpen(true)}
            className="hidden md:flex items-center gap-1 px-2 sm:px-2.5 py-1 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 transition-all font-sans font-medium text-xs shrink-0"
            title="Connect Git repository or SSH/SFTP server"
          >
            <GitFork size={13} />
            <span>+ Add Source</span>
          </button>

          {/* Manage Sources - Desktop */}
          <button
            onClick={() => setIsManageSourcesOpen(true)}
            className="hidden md:flex items-center gap-1 px-2 py-1 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-all hover:text-sky-300 shrink-0"
            title="Click to manage, re-index, or delete connected sources"
          >
            <span>
              Sources: {gitSourcesCount} Git, {sshSourcesCount} SSH
            </span>
          </button>

          {/* Nodes count - Large Screens */}
          <span className="hidden lg:flex items-center gap-1.5 text-slate-400">
            <Layers size={13} /> Nodes: {nodes.length}
          </span>

          {/* User Auth - Desktop */}
          {user ? (
            <div className="hidden sm:flex items-center gap-1.5 pl-1.5 border-l border-white/[0.08]">
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-500 text-[10px] font-bold text-slate-950 flex items-center justify-center shrink-0">
                {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
              </div>
              <span className="hidden xl:inline text-[11px] text-slate-300 font-sans truncate max-w-[90px]">
                {user.displayName || user.email}
              </span>
              <button
                onClick={onLogout}
                className="p-1 rounded-md text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors"
                title="Sign out"
              >
                <LogOut size={13} />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 border border-white/[0.1] transition-all font-sans font-medium text-xs shrink-0"
            >
              <LogIn size={13} className="text-sky-400" />
              <span>Sign in</span>
            </button>
          )}

          {/* Mobile Inspector Toggle */}
          {workspaceTab === 'graph' && (
            <button
              onClick={() => setIsMobileInspectorOpen((prev) => !prev)}
              className="flex md:hidden items-center justify-center w-7 h-7 text-slate-300 hover:text-white bg-white/[0.05] border border-white/[0.08] rounded-md transition-colors shrink-0"
              title="Toggle AST Node Inspector"
            >
              <Info size={14} className="text-sky-400" />
            </button>
          )}

          {/* Mobile Overflow Menu Button (Three dots ...) */}
          <div className="relative md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="flex items-center justify-center w-7 h-7 rounded-md bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] transition-colors"
              title="More workspace actions"
            >
              <MoreHorizontal size={14} />
            </button>

            {isMobileMenuOpen && (
              <div
                className="absolute top-full right-0 mt-1.5 w-52 bg-[#090e18] border border-white/10 rounded-xl shadow-2xl py-1.5 z-50 text-xs"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Workspace Actions
                </div>
                <button
                  onClick={() => setIsAddSourceOpen(true)}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-white/[0.06] flex items-center gap-2"
                >
                  <GitFork size={13} className="text-sky-400" />
                  <span>Add Code Source</span>
                </button>
                <button
                  onClick={() => setIsManageSourcesOpen(true)}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-white/[0.06] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Layers size={13} className="text-emerald-400" />
                    <span>Manage Sources</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {sourcesList.length}
                  </span>
                </button>
                <button
                  onClick={() => setIsTeamModalOpen(true)}
                  className="w-full text-left px-3 py-2 text-slate-200 hover:bg-white/[0.06] flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Users size={13} className="text-indigo-400" />
                    <span>Team Members</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {membersList.length}
                  </span>
                </button>

                <div className="border-t border-white/[0.08] my-1" />

                {user ? (
                  <div className="px-3 py-1.5">
                    <div className="text-[11px] text-slate-300 font-sans truncate mb-1">
                      {user.displayName || user.email}
                    </div>
                    <button
                      onClick={onLogout}
                      className="w-full text-left py-1 text-rose-400 hover:text-rose-300 flex items-center gap-2"
                    >
                      <LogOut size={13} />
                      <span>Sign out</span>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={onOpenAuth}
                    className="w-full text-left px-3 py-2 text-sky-400 hover:bg-sky-500/10 flex items-center gap-2 font-medium"
                  >
                    <LogIn size={13} />
                    <span>Sign in</span>
                  </button>
                )}
              </div>
            )}
          </div>
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
                onlyHotspots={showOnlyHotspots}
                onToggleHotspots={() => setShowOnlyHotspots((prev) => !prev)}
                onlyCycles={showOnlyCycles}
                onToggleCycles={() => setShowOnlyCycles((prev) => !prev)}
                cyclesCount={totalCyclesCount}
                layoutDirection={layoutDirection}
                onSelectLayout={handleSelectLayout}
                isPathFinderActive={isPathFinderActive}
                onTogglePathFinder={() => {
                  setIsPathFinderActive((prev) => {
                    const next = !prev;
                    if (!next) {
                      setPathStartNodeId('');
                      setPathTargetNodeId('');
                    }
                    return next;
                  });
                }}
                isHistoryReplayOpen={isHistoryReplayOpen}
                onToggleHistoryReplay={() => setIsHistoryReplayOpen((prev) => !prev)}
                nodeCount={filteredNodes.length}
                totalNodes={nodes.length}
                onResetView={() => fitView({ padding: 0.2, duration: 600 })}
                onExportPng={handleExportSvg}
                onExportMermaid={handleExportMermaid}
                onExportReport={handleExportReport}
              />

              <ReactFlow
                nodes={displayNodes}
                edges={displayEdges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onPaneClick={() => setSelectedNodeId(null)}
                onNodeClick={(_, node) => {
                  setSelectedNodeId(node.id);
                  focusNodeOnCanvas(node.id);
                  setIsCodeViewerOpen(true);
                }}
                fitView
                proOptions={{ hideAttribution: true }}
              >
                <Background color="#16243b" gap={20} size={1.5} />
                <Controls className="!bg-[#0b1320] !border-[#16243b] !rounded-xl overflow-hidden [&>button]:!bg-[#0b1320] [&>button]:!border-[#16243b] [&>button]:!fill-slate-300 hover:[&>button]:!bg-slate-800" />
              </ReactFlow>

              {/* Empty Workspace State Prompt */}
              {sourcesList.length === 0 && displayNodes.length === 0 && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="pointer-events-auto max-w-md mx-auto text-center p-6 rounded-2xl bg-[#090e17]/80 backdrop-blur-md border border-white/10 shadow-2xl">
                    <div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 flex items-center justify-center mx-auto mb-3">
                      <Layers size={22} />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-100 mb-1">Workspace Belum Memiliki Source Code</h3>
                    <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                      Tambahkan repository Git atau server SSH Anda untuk mulai mengindeks AST arsitektur dan melihat graf dependensi.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAddSourceOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-medium text-xs transition-colors shadow-lg shadow-sky-500/20"
                    >
                      <Plus size={14} />
                      <span>Add Code Source</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Floating Multi-Hop Blast Radius Depth Controller */}
              {selectedNodeId && (
                <div className="absolute top-16 left-6 z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0b1320]/90 backdrop-blur-md border border-white/10 shadow-xl text-xs font-mono">
                  <div className="flex items-center gap-1 text-slate-400 mr-1 text-[11px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                    <span>Blast Depth:</span>
                  </div>
                  <div className="flex items-center gap-1 bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06]">
                    {(
                      [
                        { label: '1-Hop', val: 1 },
                        { label: '2-Hops', val: 2 },
                        { label: 'Full', val: 'all' },
                      ] as const
                    ).map((option) => (
                      <button
                        key={option.label}
                        type="button"
                        onClick={() => setBlastDepth(option.val)}
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                          blastDepth === option.val
                            ? 'bg-sky-500 text-white shadow-sm'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-500 ml-1">
                    ↑{blastRadius.upstreamNodeIds.size} callers • ↓{blastRadius.downstreamNodeIds.size} callees
                  </div>
                </div>
              )}

              {/* Floating Shortest Path Finder Controller */}
              {isPathFinderActive && (
                <div className="absolute top-16 left-6 z-20 flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-[#080d16]/95 backdrop-blur-md border border-emerald-500/30 shadow-2xl text-xs font-mono max-w-[92vw] sm:max-w-none">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px] pr-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Path Finder:</span>
                  </div>

                  {/* Start Node Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">From:</span>
                    <select
                      value={pathStartNodeId}
                      onChange={(e) => setPathStartNodeId(e.target.value)}
                      className="bg-[#0f172a] border border-white/10 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 max-w-[140px] truncate"
                    >
                      <option value="">Select source...</option>
                      {nodes.map((n) => (
                        <option key={n.id} value={n.id}>
                          {n.data.label as string}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target Node Selector */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400">To:</span>
                    <select
                      value={pathTargetNodeId}
                      onChange={(e) => setPathTargetNodeId(e.target.value)}
                      className="bg-[#0f172a] border border-white/10 rounded px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-emerald-500 max-w-[140px] truncate"
                    >
                      <option value="">Select target...</option>
                      {nodes.map((n) => (
                        <option key={n.id} value={n.id} disabled={n.id === pathStartNodeId}>
                          {n.data.label as string}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Result status badge */}
                  {pathStartNodeId && pathTargetNodeId && (
                    <div className="flex items-center gap-1 text-[11px] pl-1">
                      {activePath ? (
                        <span className="text-emerald-300 bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 rounded-full font-medium">
                          {activePath.nodeIds.length - 1} hop{activePath.nodeIds.length - 1 === 1 ? '' : 's'} ({activePath.nodeIds.length} nodes)
                        </span>
                      ) : (
                        <span className="text-amber-400 bg-amber-950/50 border border-amber-500/30 px-2 py-0.5 rounded-full">
                          No direct path found
                        </span>
                      )}
                    </div>
                  )}

                  {/* Clear / Close button */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsPathFinderActive(false);
                      setPathStartNodeId('');
                      setPathTargetNodeId('');
                    }}
                    className="ml-auto text-slate-400 hover:text-white px-1.5 py-0.5 rounded text-[10px] bg-white/[0.04] hover:bg-white/[0.08]"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Architecture History Replay Timeline Bar */}
              <HistoryReplayBar
                isOpen={isHistoryReplayOpen}
                onClose={() => setIsHistoryReplayOpen(false)}
                snapshots={historySnapshots}
                currentIndex={historyIndex}
                onSelectIndex={setHistoryIndex}
              />

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
              onSelectNodeById={(id) => {
                setSelectedNodeId(id);
                focusNodeOnCanvas(id);
              }}
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
        workspaceId={currentWorkspaceId}
        onSourceAdded={(newSource) => {
          const baseName = newSource.name.replace(/[^a-zA-Z0-9]/g, '') || 'Source';
          const sampleNodes: Node[] = [
            {
              id: `node-${newSource.id}-entry`,
              type: 'codeNode',
              position: { x: 180, y: 140 },
              data: {
                label: `${baseName}Gateway`,
                kind: 'gateway',
                sourceName: newSource.name,
                sourceType: newSource.type,
                filePath: 'src/index.ts',
                lines: 'L1-L90',
                methodCount: 4,
                dependencyCount: 2,
                status: 'synced',
                summary: `Entry point, route registration, and gateway orchestrator for ${newSource.name}.`,
                codeSnippet: `import { Router } from 'elysia';\nexport const app = new Router();\napp.get('/', () => ({ status: 'healthy', source: '${newSource.name}' }));`,
                tags: [newSource.type, 'core', 'entry', 'gateway'],
              },
            },
            {
              id: `node-${newSource.id}-service`,
              type: 'codeNode',
              position: { x: 480, y: 100 },
              data: {
                label: `${baseName}Service`,
                kind: 'service',
                sourceName: newSource.name,
                sourceType: newSource.type,
                filePath: 'src/services/handler.ts',
                lines: 'L1-L165',
                methodCount: 6,
                dependencyCount: 1,
                status: 'synced',
                summary: `Domain business logic engine and data processing pipeline for ${newSource.name}.`,
                codeSnippet: `export class ${baseName}Service {\n  async process() {\n    return { success: true, processedAt: Date.now() };\n  }\n}`,
                tags: [newSource.type, 'service', 'domain'],
              },
            },
            {
              id: `node-${newSource.id}-db`,
              type: 'codeNode',
              position: { x: 780, y: 180 },
              data: {
                label: `${baseName}Store`,
                kind: 'database',
                sourceName: newSource.name,
                sourceType: newSource.type,
                filePath: 'src/db/schema.ts',
                lines: 'L1-L60',
                methodCount: 2,
                dependencyCount: 0,
                status: 'synced',
                summary: `Persistent schema model and ORM entity definitions for ${newSource.name}.`,
                codeSnippet: `export const records = pgTable('${baseName.toLowerCase()}_records', {\n  id: uuid('id').primaryKey(),\n  name: text('name').notNull(),\n});`,
                tags: [newSource.type, 'database', 'schema'],
              },
            },
          ];

          const sampleEdges: Edge[] = [
            {
              id: `edge-${newSource.id}-1-2`,
              source: `node-${newSource.id}-entry`,
              target: `node-${newSource.id}-service`,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#38bdf8', strokeWidth: 2 },
            },
            {
              id: `edge-${newSource.id}-2-3`,
              source: `node-${newSource.id}-service`,
              target: `node-${newSource.id}-db`,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#818cf8', strokeWidth: 2 },
            },
          ];

          const item: CodeSourceItem = {
            id: newSource.id,
            name: newSource.name,
            type: newSource.type,
            location:
              newSource.location ||
              (newSource.type === 'git' ? 'Repository connected' : 'SSH Server connected'),
            branchOrPort:
              newSource.branchOrPort || (newSource.type === 'git' ? 'main' : 'Port 22'),
            indexPaths: newSource.indexPaths && newSource.indexPaths.length > 0 ? newSource.indexPaths : ['/'],
            status: 'synced',
            lastSyncedAt: 'Just now',
            nodesCount: sampleNodes.length,
          };

          // Optimistically update nodes & edges immediately on canvas
          setNodes((prev) => {
            const merged = [...prev.filter((n) => (n.data as unknown as CodeNodeData)?.sourceName !== newSource.name), ...sampleNodes];
            try {
              localStorage.setItem(`vintrix_nodes_${currentWorkspaceId}`, JSON.stringify(merged));
            } catch {
              // pass
            }
            return merged;
          });
          setEdges((prev) => {
            const merged = [...prev, ...sampleEdges];
            try {
              localStorage.setItem(`vintrix_edges_${currentWorkspaceId}`, JSON.stringify(merged));
            } catch {
              // pass
            }
            return merged;
          });

          setSourcesList((prev) => {
            const updated = [item, ...prev.filter((s) => s.id !== item.id)];
            try {
              localStorage.setItem(`vintrix_sources_${currentWorkspaceId}`, JSON.stringify(updated));
            } catch {
              // pass
            }
            return updated;
          });

          // Also attempt to fetch from backend API if available
          graphApi
            .getWorkspaceGraph<CodeNodeData>(currentWorkspaceId)
            .then((res) => {
              if (res && res.nodes && res.nodes.length > 0) {
                setNodes(res.nodes as unknown as Node[]);
                if (res.edges && res.edges.length > 0) {
                  setEdges(res.edges as unknown as Edge[]);
                }
              }
            })
            .catch(() => {
              // Fallback sampleNodes already active
            });

          // Provide immediate success prompt to user
          addToast({
            type: 'success',
            title: 'Source Connected & Indexed',
            description: `Successfully added ${newSource.name} (${newSource.type.toUpperCase()}) to workspace.`,
          });
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

      {/* Global Command Palette (Cmd+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        nodes={enrichedNodes as unknown as Node<CodeNodeData>[]}
        onSelectNode={(node) => {
          setSelectedNodeId(node.id);
          setIsMobileInspectorOpen(true);
          setIsCodeViewerOpen(true);
          if (node.position) {
            setCenter(node.position.x + 120, node.position.y + 40, { zoom: 1.15, duration: 750 });
          }
        }}
        onNavigateTab={(tab) => setWorkspaceTab(tab)}
        onOpenAddSource={() => setIsAddSourceOpen(true)}
        onOpenManageSources={() => setIsManageSourcesOpen(true)}
        onOpenAIConfig={() => setWorkspaceTab('chat')}
      />

      {/* Create New Workspace Modal */}
      <Modal
        isOpen={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
        title="Create New Workspace"
        subtitle="Set up an isolated architecture workspace and knowledge graph."
      >
        <div className="p-5 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Workspace Name</label>
            <input
              type="text"
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              placeholder="e.g. payment-service-core"
              className="w-full bg-[#0a101d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-mono transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Description (Optional)</label>
            <textarea
              value={newWorkspaceDesc}
              onChange={(e) => setNewWorkspaceDesc(e.target.value)}
              placeholder="Brief context about this microservice or mono-repo..."
              rows={3}
              className="w-full bg-[#0a101d] border border-white/10 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 font-sans resize-none transition-colors"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <button
              onClick={() => setIsCreateWorkspaceOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={!newWorkspaceName.trim() || isCreatingWorkspace}
              onClick={handleCreateWorkspace}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-sky-500 hover:bg-sky-400 text-slate-950 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isCreatingWorkspace ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Floating Toast Notification Container */}
      <ToastContainer toasts={toasts} onDismiss={handleDismissToast} />
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => {
    try {
      const stored = localStorage.getItem('vintrix_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const getPath = () => window.location.pathname;
  const [currentPath, setCurrentPath] = useState<string>(getPath);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Sync route path on popstate (browser back/forward)
  useEffect(() => {
    const handlePopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path: string) => {
    if (window.location.pathname !== path) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }
  };

  const handleAuthSuccess = (user: AuthUser, token: string) => {
    localStorage.setItem('vintrix_token', token);
    localStorage.setItem('vintrix_user', JSON.stringify(user));
    setCurrentUser(user);
    setIsAuthModalOpen(false);
    navigate('/dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('vintrix_token');
    localStorage.removeItem('vintrix_user');
    localStorage.removeItem('vintrix_active_workspace');
    setCurrentUser(null);
    navigate('/');
  };

  const handleOpenApp = () => {
    if (!currentUser) {
      setIsAuthModalOpen(true);
      return;
    }
    navigate('/dashboard');
  };

  // Validate session token on mount with /auth/me, or catch OAuth URL query callback params
  useEffect(() => {
    // 1. Check if returning from OAuth redirect with ?token=...&user=...
    const urlParams = new URLSearchParams(window.location.search);
    const oauthToken = urlParams.get('token');
    const oauthUserStr = urlParams.get('user');

    if (oauthToken && oauthUserStr) {
      try {
        const parsedUser = JSON.parse(decodeURIComponent(oauthUserStr));
        localStorage.setItem('vintrix_token', oauthToken);
        localStorage.setItem('vintrix_user', JSON.stringify(parsedUser));
        setCurrentUser(parsedUser);

        // Redirect directly to /dashboard and clean URL params
        window.history.replaceState({}, document.title, '/dashboard');
        setCurrentPath('/dashboard');
        return;
      } catch {
        // pass
      }
    }

    // 2. Validate existing session token in localStorage
    const token = localStorage.getItem('vintrix_token');
    if (token) {
      authApi
        .getCurrentUser(token)
        .then((res) => {
          if (res?.authenticated && res.user) {
            setCurrentUser(res.user);
          }
        })
        .catch(() => {
          // Token invalid or expired
          localStorage.removeItem('vintrix_token');
          localStorage.removeItem('vintrix_user');
          setCurrentUser(null);
        });
    }
  }, []);

  const isDashboardRoute = currentPath.startsWith('/dashboard') || currentPath.startsWith('/app');

  // Guard: if user is on dashboard route without authenticated session, redirect to landing & prompt auth
  useEffect(() => {
    if (isDashboardRoute && !currentUser) {
      navigate('/');
      setIsAuthModalOpen(true);
    }
  }, [isDashboardRoute, currentUser]);

  if (!isDashboardRoute || !currentUser) {
    return (
      <div className="min-h-screen bg-[#050a10] text-[#f8fafc] selection:bg-brand-500/20 selection:text-brand-300">
        <Nav
          onOpenApp={handleOpenApp}
          onOpenAuth={() => setIsAuthModalOpen(true)}
        />
        <main>
          <Hero onOpenApp={handleOpenApp} />
          <FeaturesSection />
          <HowItWorksSection />
          <OpenSourceSection />
          <CtaSection onOpenApp={handleOpenApp} />
        </main>
        <Footer />

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onSuccess={handleAuthSuccess}
        />
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <WorkspaceContainer
        onBackToLanding={() => navigate('/')}
        user={currentUser}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onLogout={handleLogout}
      />
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />
    </ReactFlowProvider>
  );
}

