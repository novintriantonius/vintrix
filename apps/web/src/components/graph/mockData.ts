import type { Node, Edge } from '@xyflow/react';
import type { CodeNodeData } from './CustomCodeNode';

export const INITIAL_WORKSPACE_NODES: Node<CodeNodeData>[] = [
  // Layer 1: API / Controllers (Top)
  {
    id: 'ctrl-auth',
    type: 'codeNode',
    position: { x: 180, y: 40 },
    data: {
      label: 'AuthController',
      kind: 'controller',
      filePath: 'src/routes/auth.ts',
      lines: 'L1-L148',
      methodCount: 4,
      dependencyCount: 3,
      status: 'synced',
      summary: 'Handles user registration, authentication challenges, JWT tokens generation and Elysia type validation.',
      codeSnippet: `export const authRoutes = new Elysia({ prefix: '/auth' })
  .post('/login', async ({ body, jwt, set }) => {
    const user = await authService.authenticate(body.email, body.password);
    return { token: await jwt.sign({ sub: user.id }) };
  });`,
      tags: ['elysia', 'jwt', 'rest-api'],
    },
  },
  {
    id: 'ctrl-workspaces',
    type: 'codeNode',
    position: { x: 620, y: 40 },
    data: {
      label: 'WorkspaceRouter',
      kind: 'controller',
      filePath: 'src/routes/workspaces.ts',
      lines: 'L1-L165',
      methodCount: 5,
      dependencyCount: 2,
      status: 'synced',
      summary: 'REST endpoints for workspace CRUD, team member invitations, and remote repository linkages.',
      codeSnippet: `export const workspaceRoutes = new Elysia({ prefix: '/workspaces' })
  .get('/', async ({ user }) => {
    return workspaceService.getUserWorkspaces(user.id);
  });`,
      tags: ['workspace', 'rbac', 'team'],
    },
  },

  // Layer 2: Core Domain Services & Security Engine (Middle)
  {
    id: 'srv-auth',
    type: 'codeNode',
    position: { x: 100, y: 320 },
    data: {
      label: 'AuthService',
      kind: 'service',
      filePath: 'src/services/auth.ts',
      lines: 'L12-L96',
      methodCount: 3,
      dependencyCount: 2,
      status: 'synced',
      summary: 'Business logic for password verification, session tokens, and workspace membership check.',
      codeSnippet: `export class AuthService {
  async authenticate(email: string, pass: string) {
    const user = await userRepo.findByEmail(email);
    if (!verifyHash(pass, user.passwordHash)) throw new Error('Invalid credentials');
    return user;
  }
}`,
      tags: ['service', 'logic'],
    },
  },
  {
    id: 'sec-crypto',
    type: 'codeNode',
    position: { x: 480, y: 320 },
    data: {
      label: 'CryptoEngine',
      kind: 'security',
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
      tags: ['iso-27001', 'aes-256-gcm', 'crypto'],
    },
  },
  {
    id: 'srv-ssh',
    type: 'codeNode',
    position: { x: 860, y: 320 },
    data: {
      label: 'SSHExplorerService',
      kind: 'service',
      filePath: 'src/services/ssh.ts',
      lines: 'L1-L84',
      methodCount: 2,
      dependencyCount: 1,
      status: 'synced',
      summary: 'Provides non-blocking SSH key authentication, remote terminal probing, and SFTP file tree traversal.',
      codeSnippet: `export async function listRemoteDirectory(conn: SSHConfig, path: string) {
  const client = new Client();
  return client.sftp().readdir(path);
}`,
      tags: ['sftp', 'ssh2', 'remote-fs'],
    },
  },

  // Layer 3: Database & Persistence Layer (Bottom)
  {
    id: 'repo-db',
    type: 'codeNode',
    position: { x: 380, y: 600 },
    data: {
      label: 'DatabaseSchema',
      kind: 'database',
      filePath: 'src/db/schema.ts',
      lines: 'L1-L210',
      methodCount: 11,
      dependencyCount: 0,
      status: 'synced',
      summary: 'PostgreSQL schema definitions via Drizzle ORM: workspaces, roles, code_sources, ssh_source_details, and ai_endpoints.',
      codeSnippet: `export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  ownerId: uuid('owner_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});`,
      tags: ['postgres', 'drizzle-orm'],
    },
  },
];

export const INITIAL_WORKSPACE_EDGES: Edge[] = [
  {
    id: 'e-ctrl-auth-srv',
    source: 'ctrl-auth',
    target: 'srv-auth',
    animated: true,
    style: { stroke: '#38bdf8', strokeWidth: 1.5, strokeDasharray: '4 4' },
  },
  {
    id: 'e-ctrl-ws-srv-ssh',
    source: 'ctrl-workspaces',
    target: 'srv-ssh',
    animated: true,
    style: { stroke: '#38bdf8', strokeWidth: 1.5, strokeDasharray: '4 4' },
  },
  {
    id: 'e-srv-auth-sec',
    source: 'srv-auth',
    target: 'sec-crypto',
    style: { stroke: '#f43f5e', strokeWidth: 1.5 },
  },
  {
    id: 'e-srv-ssh-sec',
    source: 'srv-ssh',
    target: 'sec-crypto',
    animated: true,
    style: { stroke: '#f43f5e', strokeWidth: 1.5 },
  },
  {
    id: 'e-srv-auth-db',
    source: 'srv-auth',
    target: 'repo-db',
    style: { stroke: '#34d399', strokeWidth: 1.5 },
  },
  {
    id: 'e-ctrl-ws-db',
    source: 'ctrl-workspaces',
    target: 'repo-db',
    style: { stroke: '#fbbf24', strokeWidth: 1.5 },
  },
];
