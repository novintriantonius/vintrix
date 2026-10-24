/**
 * Vintrix API Client
 * Typed fetch wrapper targeting the ElysiaJS backend at /api/v1
 */

const BASE = '/api/v1';

async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as { message?: string }).message ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// ─── Workspace Types ──────────────────────────────────────────────────────────

export interface Workspace {
  id: string;
  name: string;
  description: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMemberAPI {
  userId: string;
  displayName: string | null;
  email: string;
  roleId: string;
  roleName: string;
  invitedAt: string;
}

// ─── Workspace API ────────────────────────────────────────────────────────────

export const workspacesApi = {
  list: () => request<Workspace[]>('/workspaces'),

  get: (id: string) => request<Workspace>(`/workspaces/${id}`),

  create: (body: { name: string; description?: string; ownerId: string }) =>
    request<Workspace>('/workspaces', { method: 'POST', body: JSON.stringify(body) }),

  listMembers: (workspaceId: string) =>
    request<WorkspaceMemberAPI[]>(`/workspaces/${workspaceId}/members`),

  inviteMember: (workspaceId: string, email: string, roleName: string) =>
    request<{ success: boolean; member: WorkspaceMemberAPI }>(
      `/workspaces/${workspaceId}/members/invite`,
      { method: 'POST', body: JSON.stringify({ email, roleName }) },
    ),

  updateMemberRole: (workspaceId: string, userId: string, roleName: string) =>
    request<{ success: boolean; updatedRole: string }>(
      `/workspaces/${workspaceId}/members/${userId}`,
      { method: 'PATCH', body: JSON.stringify({ roleName }) },
    ),

  removeMember: (workspaceId: string, userId: string) =>
    request<{ success: boolean }>(
      `/workspaces/${workspaceId}/members/${userId}`,
      { method: 'DELETE' },
    ),
};

// ─── Source Types ─────────────────────────────────────────────────────────────

export interface CodeSource {
  id: string;
  workspaceId: string;
  name: string;
  type: 'ssh' | 'git';
  isIndexed: boolean;
  lastIndexAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CodeSourceWithDetails extends CodeSource {
  host?: string;
  port?: number;
  repoUrl?: string;
  branch?: string;
  indexPaths: string[];
}

// ─── Sources API ──────────────────────────────────────────────────────────────

export const sourcesApi = {
  list: (workspaceId: string) =>
    request<CodeSourceWithDetails[]>(`/sources/workspace/${workspaceId}`),

  addGit: (body: {
    workspaceId: string;
    name: string;
    repoUrl: string;
    branch: string;
    token?: string;
    indexPaths?: string[];
  }) => request<{ id: string; name: string; type: string }>(
    '/sources/git',
    { method: 'POST', body: JSON.stringify(body) },
  ),

  addSSH: (body: {
    workspaceId: string;
    name: string;
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
    indexPaths?: string[];
  }) => request<{ id: string; name: string; type: string }>(
    '/sources/ssh',
    { method: 'POST', body: JSON.stringify(body) },
  ),

  testSSH: (body: {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
  }) => request<{ success: boolean; message?: string; error?: string }>(
    '/sources/ssh/test',
    { method: 'POST', body: JSON.stringify(body) },
  ),

  browseSSH: (body: {
    host: string;
    port: number;
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
    path?: string;
  }) => request<{ currentPath: string; directories: string[]; files: string[] }>(
    '/sources/ssh/browse',
    { method: 'POST', body: JSON.stringify(body) },
  ),

  triggerReindex: (sourceId: string) =>
    request<{ success: boolean }>(`/sources/${sourceId}/reindex`, { method: 'POST' }),

  delete: (sourceId: string) =>
    request<{ success: boolean }>(`/sources/${sourceId}`, { method: 'DELETE' }),

  subscribeEvents: (workspaceId: string, onEvent: (event: any) => void) => {
    const url = `${BASE}/sources/events?workspaceId=${encodeURIComponent(workspaceId)}`;
    const eventSource = new EventSource(url);

    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        onEvent(data);
      } catch {
        // ignore non-json
      }
    };

    return () => {
      eventSource.close();
    };
  },
};

// ─── AI Types ─────────────────────────────────────────────────────────────────

export interface AIEndpointAPI {
  id: string;
  name: string;
  baseUrl: string;
  isDefault: boolean;
  createdAt: string;
}

export interface AIModelAPI {
  id: string;
  endpointId: string;
  modelId: string;
  displayName: string | null;
  isEnabled: boolean;
}

// ─── AI API ───────────────────────────────────────────────────────────────────

export const aiApi = {
  listEndpoints: (workspaceId: string) =>
    request<AIEndpointAPI[]>(`/ai/endpoints/${workspaceId}`),

  addEndpoint: (body: {
    workspaceId: string;
    name: string;
    baseUrl: string;
    apiKey?: string;
    isDefault?: boolean;
  }) => request<{ id: string; name: string; baseUrl: string }>(
    '/ai/endpoints',
    { method: 'POST', body: JSON.stringify(body) },
  ),

  listModels: (endpointId: string) =>
    request<AIModelAPI[]>(`/ai/models/${endpointId}`),

  addModel: (body: { endpointId: string; modelId: string; displayName?: string }) =>
    request<AIModelAPI>('/ai/models', { method: 'POST', body: JSON.stringify(body) }),

  listSessions: (workspaceId: string) =>
    request<Array<{ id: string; title: string | null; createdAt: string }>>(
      `/ai/sessions/${workspaceId}`,
    ),

  createSession: (body: {
    workspaceId: string;
    userId: string;
    modelId?: string;
    title?: string;
  }) => request<{ id: string; title: string | null; createdAt: string }>(
    '/ai/sessions',
    { method: 'POST', body: JSON.stringify(body) },
  ),

  chat: (body: {
    sessionId: string;
    workspaceId: string;
    modelId: string;
    message: string;
  }) => request<{ message: { id: string; content: string; createdAt: string } }>(
    '/ai/chat',
    { method: 'POST', body: JSON.stringify(body) },
  ),
};

// ─── Passwordless OAuth API ───────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  provider: 'google' | 'github';
}

export const authApi = {
  getProviders: () =>
    request<{ providers: Array<{ id: string; name: string; authUrl: string; enabled: boolean }> }>(
      '/auth/providers'
    ),

  signInWithOAuth: (body: {
    provider: 'google' | 'github';
    code?: string;
    email?: string;
    name?: string;
    avatarUrl?: string;
  }) =>
    request<{ token: string; user: AuthUser }>('/auth/callback', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getCurrentUser: (token: string) =>
    request<{ authenticated: boolean; user: AuthUser }>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    }),
};

// ─── Knowledge Graph API ──────────────────────────────────────────────────────

export interface GraphResponse<TNodeData = unknown> {
  workspaceId: string;
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: TNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    animated?: boolean;
    style?: Record<string, unknown>;
    data?: Record<string, unknown>;
  }>;
  totalNodes: number;
  totalEdges: number;
}

export const graphApi = {
  getWorkspaceGraph: <T = unknown>(workspaceId: string, sourceId?: string) => {
    const query = sourceId ? `?sourceId=${encodeURIComponent(sourceId)}` : '';
    return request<GraphResponse<T>>(`/graph/workspace/${workspaceId}${query}`);
  },
};
