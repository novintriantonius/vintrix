import { pgTable, uuid, text, timestamp, boolean, integer, primaryKey } from 'drizzle-orm/pg-core';

// ─── Roles (RBAC) ─────────────────────────────────────────────────────────────
export const roles = pgTable('roles', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull().unique(), // owner | admin | member | viewer
  description: text('description'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id:           uuid('id').primaryKey().defaultRandom(),
  email:        text('email').notNull().unique(),
  passwordHash: text('password_hash'), // Nullable for passwordless OAuth (Google / GitHub)
  displayName:  text('display_name'),
  avatarUrl:    text('avatar_url'),
  provider:     text('provider').default('google').notNull(), // 'google' | 'github'
  providerId:   text('provider_id'),
  createdAt:    timestamp('created_at').defaultNow().notNull(),
  updatedAt:    timestamp('updated_at').defaultNow().notNull(),
});

// ─── Workspaces ───────────────────────────────────────────────────────────────
export const workspaces = pgTable('workspaces', {
  id:          uuid('id').primaryKey().defaultRandom(),
  name:        text('name').notNull(),
  description: text('description'),
  ownerId:     uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

// ─── Workspace Members ────────────────────────────────────────────────────────
export const workspaceMembers = pgTable('workspace_members', {
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId:      uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleId:      uuid('role_id').notNull().references(() => roles.id),
  invitedAt:   timestamp('invited_at').defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })]);

// ─── Code Sources (metadata only) ────────────────────────────────────────────
export const codeSources = pgTable('code_sources', {
  id:          uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name:        text('name').notNull(),
  type:        text('type').notNull(), // 'ssh' | 'git'
  isIndexed:   boolean('is_indexed').default(false).notNull(),
  lastIndexAt: timestamp('last_index_at'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
});

// ─── SSH Source Details (credentials encrypted AES-256-GCM) ──────────────────
export const sshSourceDetails = pgTable('ssh_source_details', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  codeSourceId:       uuid('code_source_id').notNull().references(() => codeSources.id, { onDelete: 'cascade' }).unique(),
  host:               text('host').notNull(),
  port:               integer('port').default(22).notNull(),
  username:           text('username').notNull(),
  encryptedPassword:  text('encrypted_password'),   // nullable — key-auth preferred
  encryptedPrivKey:   text('encrypted_priv_key'),   // AES-256-GCM envelope
  encryptedPassphrase:text('encrypted_passphrase'), // for encrypted private keys
  indexPaths:         text('index_paths').array().notNull().default([]),
});

// ─── Git Source Details ───────────────────────────────────────────────────────
export const gitSourceDetails = pgTable('git_source_details', {
  id:             uuid('id').primaryKey().defaultRandom(),
  codeSourceId:   uuid('code_source_id').notNull().references(() => codeSources.id, { onDelete: 'cascade' }).unique(),
  repoUrl:        text('repo_url').notNull(),
  branch:         text('branch').default('main').notNull(),
  encryptedToken: text('encrypted_token'), // AES-256-GCM envelope
  indexPaths:     text('index_paths').array().notNull().default([]),
});

// ─── AI Endpoints ─────────────────────────────────────────────────────────────
export const aiEndpoints = pgTable('ai_endpoints', {
  id:             uuid('id').primaryKey().defaultRandom(),
  workspaceId:    uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name:           text('name').notNull(),
  baseUrl:        text('base_url').notNull(),
  encryptedApiKey:text('encrypted_api_key'), // AES-256-GCM envelope
  isDefault:      boolean('is_default').default(false).notNull(),
  createdAt:      timestamp('created_at').defaultNow().notNull(),
});

// ─── AI Models ────────────────────────────────────────────────────────────────
export const aiModels = pgTable('ai_models', {
  id:         uuid('id').primaryKey().defaultRandom(),
  endpointId: uuid('endpoint_id').notNull().references(() => aiEndpoints.id, { onDelete: 'cascade' }),
  modelId:    text('model_id').notNull(),   // e.g. 'gpt-4o'
  displayName:text('display_name'),
  isEnabled:  boolean('is_enabled').default(true).notNull(),
});

// ─── Chat Sessions ────────────────────────────────────────────────────────────
export const chatSessions = pgTable('chat_sessions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId:      uuid('user_id').notNull().references(() => users.id),
  modelId:     uuid('model_id').references(() => aiModels.id),
  title:       text('title'),
  createdAt:   timestamp('created_at').defaultNow().notNull(),
});

// ─── Chat Messages ────────────────────────────────────────────────────────────
export const chatMessages = pgTable('chat_messages', {
  id:        uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role:      text('role').notNull(), // 'user' | 'assistant' | 'system'
  content:   text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ─── Codebase Knowledge Nodes ─────────────────────────────────────────────────
export const knowledgeNodes = pgTable('knowledge_nodes', {
  id:           uuid('id').primaryKey().defaultRandom(),
  workspaceId:  uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  codeSourceId: uuid('code_source_id').references(() => codeSources.id, { onDelete: 'cascade' }),
  label:        text('label').notNull(),
  kind:         text('kind').notNull(), // 'controller' | 'service' | 'database' | 'security' | 'gateway'
  filePath:     text('file_path').notNull(),
  summary:      text('summary'),
  metadata:     text('metadata'), // JSON stringified node details / AST stats
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});

// ─── Codebase Knowledge Edges (AST Dependency & Call Graphs) ──────────────────
export const knowledgeEdges = pgTable('knowledge_edges', {
  id:           uuid('id').primaryKey().defaultRandom(),
  workspaceId:  uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  sourceNodeId: uuid('source_node_id').notNull().references(() => knowledgeNodes.id, { onDelete: 'cascade' }),
  targetNodeId: uuid('target_node_id').notNull().references(() => knowledgeNodes.id, { onDelete: 'cascade' }),
  relationType: text('relation_type').default('calls').notNull(), // 'calls' | 'imports' | 'implements' | 'depends_on'
  createdAt:    timestamp('created_at').defaultNow().notNull(),
});

