export type RoleName = 'owner' | 'admin' | 'editor' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export type SourceType = 'git' | 'ssh';
export type IndexStatus = 'idle' | 'syncing' | 'indexing' | 'ready' | 'failed';

export interface CodeSource {
  id: string;
  workspaceId: string;
  name: string;
  type: SourceType;
  indexStatus: IndexStatus;
  lastIndexedAt?: string;
  errorMessage?: string;
}

export interface Citation {
  source: string;
  file: string;
  lines: string;
  symbol?: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
  createdAt: string;
}

// Graph Node/Edge structure for React Flow Knowledge Graph
export interface GraphNode {
  id: string;
  label: string;
  type: 'file' | 'class' | 'function';
  layer: 'api' | 'service' | 'data' | 'ui' | 'utility';
  path: string;
  lines?: { start: number; end: number };
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: 'calls' | 'imports' | 'inherits';
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
