import type { Node, Edge } from '@xyflow/react';
import type { CodeNodeData } from './CustomCodeNode';

export const INITIAL_WORKSPACE_NODES: Node<CodeNodeData>[] = [
  // ── Frontend Repo Source (apps/web) ──────────────────────────────────────────
  {
    id: 'fe-app',
    type: 'codeNode',
    position: { x: 80, y: 40 },
    data: {
      label: 'WorkspaceContainer',
      kind: 'gateway',
      sourceName: 'vintrix-frontend',
      sourceType: 'git',
      filePath: 'src/App.tsx',
      lines: 'L1-L240',
      methodCount: 4,
      dependencyCount: 2,
      status: 'synced',
      summary: 'Frontend root view container, switches between Knowledge Graph canvas and AI Chatbox copilot.',
      codeSnippet: `export function WorkspaceContainer() {
  const [tab, setTab] = useState<'graph' | 'chat'>('graph');
  return <div className="workspace">{tab === 'graph' ? <Graph /> : <Chat />}</div>;
}`,
      tags: ['react', 'ui-core', 'frontend'],
    },
  },
  {
    id: 'fe-api-client',
    type: 'codeNode',
    position: { x: 80, y: 320 },
    data: {
      label: 'WorkspaceApiClient',
      kind: 'service',
      sourceName: 'vintrix-frontend',
      sourceType: 'git',
      filePath: 'src/services/api.ts',
      lines: 'L1-L95',
      methodCount: 5,
      dependencyCount: 1,
      status: 'synced',
      summary: 'HTTP client consuming backend REST endpoints with JWT bearer token attach & error retry.',
      codeSnippet: `export const apiClient = {
  getWorkspace: (id: string) => fetch(\`/workspaces/\${id}\`),
  chatCompletion: (payload: ChatPayload) => fetch('/ai/chat/completions', { method: 'POST', body: JSON.stringify(payload) })
};`,
      tags: ['fetch', 'api-client', 'frontend'],
    },
  },

  // ── Backend Repo Source (apps/api) ───────────────────────────────────────────
  {
    id: 'ctrl-workspaces',
    type: 'codeNode',
    position: { x: 480, y: 40 },
    data: {
      label: 'WorkspaceRouter',
      kind: 'controller',
      sourceName: 'vintrix-backend',
      sourceType: 'git',
      filePath: 'src/routes/workspaces.ts',
      lines: 'L1-L165',
      methodCount: 5,
      dependencyCount: 2,
      status: 'synced',
      summary: 'REST endpoints for multi-repo workspace CRUD, team collaboration, and code sources linkage.',
      codeSnippet: `export const workspaceRoutes = new Elysia({ prefix: '/workspaces' })
  .get('/', async ({ user }) => {
    return workspaceService.getUserWorkspaces(user.id);
  });`,
      tags: ['workspace', 'rbac', 'team', 'backend'],
    },
  },
  {
    id: 'ctrl-auth',
    type: 'codeNode',
    position: { x: 880, y: 40 },
    data: {
      label: 'AuthController',
      kind: 'controller',
      sourceName: 'vintrix-backend',
      sourceType: 'git',
      filePath: 'src/routes/auth.ts',
      lines: 'L1-L148',
      methodCount: 4,
      dependencyCount: 2,
      status: 'synced',
      summary: 'Handles OAuth callback handlers (Google & GitHub) and JWT workspace session tokens.',
      codeSnippet: `export const authRoutes = new Elysia({ prefix: '/auth' })
  .get('/callback/github', async ({ query, jwt }) => {
    const user = await oauthService.handleGithub(query.code);
    return { token: await jwt.sign({ sub: user.id }) };
  });`,
      tags: ['oauth', 'jwt', 'rest-api', 'backend'],
    },
  },
  {
    id: 'sec-crypto',
    type: 'codeNode',
    position: { x: 480, y: 320 },
    data: {
      label: 'CryptoEngine',
      kind: 'security',
      sourceName: 'vintrix-backend',
      sourceType: 'git',
      filePath: 'src/services/crypto.ts',
      lines: 'L1-L112',
      methodCount: 4,
      dependencyCount: 1,
      status: 'synced',
      summary: 'AES-256-GCM envelope encryption with PBKDF2 310,000 iterations for secure SSH/Git credentials (ISO/IEC 27001).',
      codeSnippet: `export async function encryptCredential(plainText: string, masterKey: string) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  return JSON.stringify({ salt, iv, ciphertext, tag });
}`,
      tags: ['iso-27001', 'aes-256-gcm', 'crypto', 'backend'],
    },
  },

  // ── Remote Infrastructure / SSH Source (Production Server) ───────────────────
  {
    id: 'srv-ssh',
    type: 'codeNode',
    position: { x: 880, y: 320 },
    data: {
      label: 'SSHClusterService',
      kind: 'service',
      sourceName: 'prod-cluster (ssh)',
      sourceType: 'ssh',
      filePath: 'src/services/ssh.ts',
      lines: 'L1-L84',
      methodCount: 2,
      dependencyCount: 1,
      status: 'synced',
      summary: 'SFTP file tree crawler and remote command execution runner for deployed production services.',
      codeSnippet: `export async function listRemoteDirectory(conn: SSHConfig, path: string) {
  const client = new Client();
  return client.sftp().readdir(path);
}`,
      tags: ['sftp', 'ssh2', 'remote-fs', 'infra'],
    },
  },

  // ── Database & Persistence Layer (Shared Workspace Core) ─────────────────────
  {
    id: 'repo-db',
    type: 'codeNode',
    position: { x: 480, y: 600 },
    data: {
      label: 'DatabaseSchema',
      kind: 'database',
      sourceName: 'vintrix-backend',
      sourceType: 'git',
      filePath: 'src/db/schema.ts',
      lines: 'L1-L210',
      methodCount: 11,
      dependencyCount: 0,
      status: 'synced',
      summary: 'PostgreSQL schema definitions via Drizzle ORM: workspaces, code_sources, knowledge_nodes, and AI sessions.',
      codeSnippet: `export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});`,
      tags: ['postgres', 'drizzle-orm', 'database'],
    },
  },
];

export const INITIAL_WORKSPACE_EDGES: Edge[] = [
  // Cross-Repo Link: Frontend UI -> Frontend API Client -> Backend WorkspaceRouter
  {
    id: 'e-fe-app-client',
    source: 'fe-app',
    target: 'fe-api-client',
    animated: true,
    style: { stroke: '#a78bfa', strokeWidth: 1.5 },
  },
  {
    id: 'e-client-backend',
    source: 'fe-api-client',
    target: 'ctrl-workspaces',
    animated: true,
    style: { stroke: '#38bdf8', strokeWidth: 1.5, strokeDasharray: '4,4' },
  },

  // Backend Internal Linkages
  {
    id: 'e-workspaces-crypto',
    source: 'ctrl-workspaces',
    target: 'sec-crypto',
    animated: true,
    style: { stroke: '#38bdf8', strokeWidth: 1.5 },
  },
  {
    id: 'e-crypto-db',
    source: 'sec-crypto',
    target: 'repo-db',
    animated: true,
    style: { stroke: '#f43f5e', strokeWidth: 1.5 },
  },
  {
    id: 'e-workspaces-ssh',
    source: 'ctrl-workspaces',
    target: 'srv-ssh',
    animated: true,
    style: { stroke: '#38bdf8', strokeWidth: 1.5 },
  },
  {
    id: 'e-auth-db',
    source: 'ctrl-auth',
    target: 'repo-db',
    animated: true,
    style: { stroke: '#38bdf8', strokeWidth: 1.5 },
  },
];
