import { Elysia, t } from 'elysia';
import { db } from '../db/client';
import { aiEndpoints, aiModels, chatSessions, chatMessages, knowledgeNodes, users, workspaces } from '../db/schema';
import { encryptCredential, decryptCredential } from '../services/crypto';
import { retrieveRelevantContext } from '../services/retrieval';
import { eq, desc } from 'drizzle-orm';

const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY ?? 'vintrix-dev-master-key-must-be-32-chars!!';

export const aiRouter = new Elysia({ prefix: '/ai' })
  // Fetch available models from an OpenAI-compatible endpoint
  .post(
    '/probe-models',
    async ({ body, set }) => {
      try {
        let cleanBase = body.baseUrl.trim();
        if (cleanBase.endsWith('/')) {
          cleanBase = cleanBase.slice(0, -1);
        }
        const modelsUrl = `${cleanBase}/models`;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (body.apiKey && body.apiKey.trim()) {
          headers['Authorization'] = `Bearer ${body.apiKey.trim()}`;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);

        const res = await fetch(modelsUrl, {
          method: 'GET',
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          set.status = res.status;
          return {
            success: false,
            message: `Endpoint returned HTTP ${res.status}: ${errText.slice(0, 150) || res.statusText}`,
          };
        }

        const data = await res.json() as any;
        let modelList: string[] = [];

        if (Array.isArray(data?.data)) {
          modelList = data.data.map((m: any) => m.id || m.name).filter(Boolean);
        } else if (Array.isArray(data?.models)) {
          modelList = data.models.map((m: any) => m.name || m.id).filter(Boolean);
        } else if (Array.isArray(data)) {
          modelList = data.map((m: any) => (typeof m === 'string' ? m : m.id || m.name)).filter(Boolean);
        }

        return {
          success: true,
          models: modelList.sort(),
          message: `Discovered ${modelList.length} models from endpoint.`,
        };
      } catch (err: any) {
        set.status = 502;
        return {
          success: false,
          models: [],
          message: `Failed to fetch models: ${err.message || 'Connection failed or timed out'}`,
        };
      }
    },
    {
      body: t.Object({
        baseUrl: t.String(),
        apiKey: t.Optional(t.String()),
      }),
    },
  )
  // List endpoints for a workspace
  .get('/endpoints/:workspaceId', async ({ params, set }) => {
    try {
      return await db
        .select({
          id: aiEndpoints.id,
          name: aiEndpoints.name,
          baseUrl: aiEndpoints.baseUrl,
          isDefault: aiEndpoints.isDefault,
          createdAt: aiEndpoints.createdAt,
        })
        .from(aiEndpoints)
        .where(eq(aiEndpoints.workspaceId, params.workspaceId));
    } catch (err: any) {
      console.error('[AI Endpoints GET] Database unavailable:', err.message);
      set.status = 503;
      return { message: 'Database unavailable. Cannot retrieve AI endpoints without database.' };
    }
  })
  // Add custom OpenAI-compatible endpoint
  .post(
    '/endpoints',
    async ({ body, set }) => {
      try {
        const encryptedApiKey = body.apiKey
          ? await encryptCredential(body.apiKey, MASTER_KEY)
          : null;

        const [endpoint] = await db
          .insert(aiEndpoints)
          .values({
            workspaceId: body.workspaceId,
            name: body.name,
            baseUrl: body.baseUrl,
            encryptedApiKey,
            isDefault: body.isDefault ?? false,
          })
          .returning();

        return { id: endpoint.id, name: endpoint.name, baseUrl: endpoint.baseUrl };
      } catch (err: any) {
        console.error('[AI Endpoints POST] Database unavailable:', err.message);
        set.status = 503;
        return { message: 'Database unavailable. AI endpoint cannot be saved without database.' };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
        name: t.String(),
        baseUrl: t.String(),
        apiKey: t.Optional(t.String()),
        isDefault: t.Optional(t.Boolean()),
      }),
    },
  )
  // List models for an endpoint
  .get('/models/:endpointId', async ({ params, set }) => {
    try {
      return await db.select().from(aiModels).where(eq(aiModels.endpointId, params.endpointId));
    } catch (err: any) {
      console.error('[AI Models GET] Database unavailable:', err.message);
      set.status = 503;
      return { message: 'Database unavailable. Cannot retrieve AI models.' };
    }
  })
  // Add model to endpoint
  .post(
    '/models',
    async ({ body, set }) => {
      try {
        const [model] = await db
          .insert(aiModels)
          .values({
            endpointId: body.endpointId,
            modelId: body.modelId,
            displayName: body.displayName,
          })
          .returning();
        return model;
      } catch (err: any) {
        console.error('[AI Models POST] Database unavailable:', err.message);
        set.status = 503;
        return { message: 'Database unavailable. Cannot save AI model.' };
      }
    },
    {
      body: t.Object({
        endpointId: t.String({ format: 'uuid' }),
        modelId: t.String(),
        displayName: t.Optional(t.String()),
      }),
    },
  )
  // List chat sessions for a workspace
  .get('/workspaces/:workspaceId/sessions', async ({ params, set }) => {
    try {
      return await db
        .select()
        .from(chatSessions)
        .where(eq(chatSessions.workspaceId, params.workspaceId))
        .orderBy(desc(chatSessions.createdAt));
    } catch (err: any) {
      console.error('[AI Sessions GET] Database unavailable:', err.message);
      set.status = 503;
      return { message: 'Database unavailable. Cannot retrieve chat sessions.' };
    }
  })
  // Create a chat session
  .post(
    '/sessions',
    async ({ body, set }) => {
      try {
        let validUserId = body.userId;

        // If userId is missing or placeholder, resolve from workspace owner or any existing user
        if (!validUserId || validUserId === '00000000-0000-0000-0000-000000000001') {
          const wsRows = await db
            .select({ ownerId: workspaces.ownerId })
            .from(workspaces)
            .where(eq(workspaces.id, body.workspaceId))
            .limit(1);

          if (wsRows[0]?.ownerId) {
            validUserId = wsRows[0].ownerId;
          } else {
            const anyUser = await db.select({ id: users.id }).from(users).limit(1);
            if (anyUser[0]?.id) {
              validUserId = anyUser[0].id;
            } else {
              // Ensure at least one system user exists in DB to satisfy FK constraint
              const [sysUser] = await db
                .insert(users)
                .values({
                  email: 'system@vintrix.local',
                  displayName: 'Vintrix User',
                })
                .returning({ id: users.id });
              validUserId = sysUser.id;
            }
          }
        }

        const [session] = await db
          .insert(chatSessions)
          .values({
            workspaceId: body.workspaceId,
            userId: validUserId,
            modelId: body.modelId ?? undefined,
            title: body.title ?? 'New Codebase Chat',
          })
          .returning();
        return session;
      } catch (err: any) {
        console.error('[AI Sessions POST] Database insert error:', err.message);
        set.status = 503;
        return { message: `Database error: ${err.message}` };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
        userId: t.Optional(t.String()),
        modelId: t.Optional(t.String()),
        title: t.Optional(t.String()),
      }),
    },
  )
  // Get messages for a session
  .get('/sessions/:sessionId/messages', async ({ params, set }) => {
    try {
      return await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, params.sessionId))
        .orderBy(chatMessages.createdAt);
    } catch (err: any) {
      console.error('[AI Messages GET] Database unavailable:', err.message);
      set.status = 503;
      return { message: 'Database unavailable. Cannot retrieve chat messages.' };
    }
  })
  // Delete a chat session
  .delete('/sessions/:sessionId', async ({ params, set }) => {
    try {
      await db.delete(chatSessions).where(eq(chatSessions.id, params.sessionId));
      return { success: true };
    } catch (err: any) {
      console.error('[AI Sessions DELETE] Database error:', err.message);
      set.status = 503;
      return { message: 'Database unavailable. Cannot delete session.' };
    }
  })
  // Chat completion endpoint (with decrypted API key + Codebase Knowledge Graph Context injection)
  .post(
    '/chat',
    async ({ body, set }) => {
      const { sessionId, workspaceId, modelId, message } = body;

      // 1. Resolve model & endpoint
      let model: any = null;
      let endpoint: any = null;
      try {
        model = await db
          .select()
          .from(aiModels)
          .where(eq(aiModels.id, modelId))
          .limit(1)
          .then((rows) => rows[0]);

        if (!model) {
          model = await db
            .select()
            .from(aiModels)
            .where(eq(aiModels.modelId, modelId))
            .limit(1)
            .then((rows) => rows[0]);
        }

        if (!model) {
          set.status = 404;
          return { error: `Model '${modelId}' not found. Please register this model or an endpoint first.` };
        }

        const endpointRows = await db
          .select()
          .from(aiEndpoints)
          .where(eq(aiEndpoints.id, model.endpointId))
          .limit(1);
        endpoint = endpointRows[0];
      } catch (err: any) {
        console.error('[AI Chat] Database unavailable:', err.message);
        set.status = 503;
        return { error: 'Database unavailable. AI chat cannot proceed without database.' };
      }

      if (!endpoint) {
        set.status = 404;
        return { error: 'AI Endpoint not found' };
      }

      let apiKey = '';
      if (endpoint.encryptedApiKey) {
        try {
          apiKey = await decryptCredential(endpoint.encryptedApiKey, MASTER_KEY);
        } catch {
          set.status = 500;
          return { error: 'Failed to decrypt API Key' };
        }
      }

      // 2. Fetch workspace codebase context via BM25 & symbol hybrid retrieval
      const retrieved = await retrieveRelevantContext(workspaceId, message, 8);

      let codebaseContext = '';
      if (retrieved.length > 0) {
        codebaseContext =
          `\n\n[Relevant Codebase AST Context - BM25 Ranked]:\n` +
          retrieved
            .map((n) => {
              const lineRef = n.lines ? ` (${n.lines})` : '';
              const snippet = n.codeSnippet
                ? `\n  Snippet:\n  \`\`\`\n  ${n.codeSnippet.split('\n').slice(0, 8).join('\n  ')}\n  \`\`\``
                : '';
              return `- [${n.kind.toUpperCase()}] ${n.label} in \`${n.filePath}\`${lineRef}: ${n.summary}${snippet}`;
            })
            .join('\n\n');
      } else {
        // Fallback to top general nodes if no specific search matched
        const fallbackNodes = await db
          .select({
            label: knowledgeNodes.label,
            kind: knowledgeNodes.kind,
            filePath: knowledgeNodes.filePath,
            summary: knowledgeNodes.summary,
          })
          .from(knowledgeNodes)
          .where(eq(knowledgeNodes.workspaceId, workspaceId))
          .limit(10);

        if (fallbackNodes.length > 0) {
          const safeNodes = fallbackNodes.filter((n) => {
            const p = `${n.filePath} ${n.label}`.toLowerCase();
            return (
              !p.includes('.env') &&
              !p.includes('.pem') &&
              !p.includes('.key') &&
              !p.includes('id_rsa') &&
              !p.includes('credentials') &&
              !p.includes('secret')
            );
          });
          codebaseContext =
            `\n\n[General Codebase Architecture Context]:\n` +
            safeNodes
              .map((n) => `- [${n.kind.toUpperCase()}] ${n.label} (${n.filePath}): ${n.summary ?? 'No summary'}`)
              .join('\n');
        }
      }

      const systemPrompt = `You are Vintrix AI, an expert software architecture intelligence assistant.
Analyze codebases, visualize architectures, and help cross-functional teams (including Product Managers and engineers) understand complex multi-repository systems.

[RESPONSE TONE & AUDIENCE ADAPTATION (IMPORTANT)]:
1. DEFAULT AUDIENCE: Product Managers and non-technical stakeholders.
   - Deliver clear, high-level, business-impact focused explanations in plain, easy-to-understand language.
   - Explain *what* the system or feature does, *why* it works that way, user workflows, and practical implications rather than low-level technical jargon or code snippets.
2. TECHNICAL EXCEPTION:
   - Only include low-level code implementation, AST structures, internal function traces, or deep technical syntax WHEN the user's prompt explicitly asks for technical details (e.g., asking for code, implementation, syntax, database schema, debugging, or specific function logic).
   - Even when technical details are requested, provide a brief high-level summary upfront.

[SECURITY & PRIVACY ENFORCEMENT - STRICT READ-ONLY & ZERO CONFIDENTIAL DATA]:
1. You are strictly in READ-ONLY mode. You cannot execute or suggest executing write commands, git push, commits, remote changes, or SSH shell commands.
2. NEVER disclose, print, inspect, search for, or echo credentials, passwords, auth tokens, private keys (e.g. id_rsa, PEM, SSH keys), API keys, or confidential environment variables (.env).
3. If asked about passwords, secrets, or confidential keys, explicitly refuse and explain that confidential credentials are restricted and sanitized by security policy.
${codebaseContext}`;

      // 3. Save user message to session
      await db.insert(chatMessages).values({
        sessionId,
        role: 'user',
        content: message,
      });

      // 4. Get previous conversation history (up to last 10 messages)
      const history = await db
        .select({ role: chatMessages.role, content: chatMessages.content })
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.createdAt)
        .limit(10);

      const messagesPayload = [
        { role: 'system', content: systemPrompt },
        ...history.map((h) => ({ role: h.role, content: h.content })),
      ];

      // 5. Send completion request to OpenAI-compatible base URL
      const targetUrl = `${endpoint.baseUrl.replace(/\/+$/, '')}/chat/completions`;
      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: model.modelId,
            messages: messagesPayload,
            temperature: 0.2,
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          set.status = response.status;
          return { error: `Upstream AI provider error: ${errText}` };
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const assistantReply = data.choices?.[0]?.message?.content ?? 'No response received from AI model.';

        // 6. Save assistant message
        const [savedAssistantMsg] = await db
          .insert(chatMessages)
          .values({
            sessionId,
            role: 'assistant',
            content: assistantReply,
          })
          .returning();

        return {
          message: savedAssistantMsg,
        };
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err);
        set.status = 502;
        return { error: `Failed to connect to AI Endpoint: ${errMessage}` };
      }
    },
    {
      body: t.Object({
        sessionId: t.String(),
        workspaceId: t.String({ format: 'uuid' }),
        modelId: t.String(),
        message: t.String({ minLength: 1 }),
      }),
    },
  )
  // ─── Real-Time Streaming Chat (Server-Sent Events) ───────────────────
  .post(
    '/chat/stream',
    async ({ body, set }) => {
      const { sessionId, workspaceId, modelId, message } = body;

      // 1. Resolve custom model & endpoint
      let model: any = null;
      let endpoint: any = null;

      try {
        // Try finding by UUID primary key
        model = await db
          .select()
          .from(aiModels)
          .where(eq(aiModels.id, modelId))
          .limit(1)
          .then((rows) => rows[0]);

        // Try finding by model identifier (e.g. 'gpt-4o' or custom model id)
        if (!model) {
          model = await db
            .select()
            .from(aiModels)
            .where(eq(aiModels.modelId, modelId))
            .limit(1)
            .then((rows) => rows[0]);
        }

        // If still not found, check if an endpoint exists for this workspace or any default endpoint
        if (!model) {
          const endpoints = await db
            .select()
            .from(aiEndpoints)
            .where(eq(aiEndpoints.workspaceId, workspaceId))
            .limit(1);

          if (endpoints[0]) {
            endpoint = endpoints[0];
            // Auto-register model with this endpoint
            const [createdModel] = await db
              .insert(aiModels)
              .values({
                endpointId: endpoint.id,
                modelId: modelId,
                displayName: modelId,
              })
              .returning();
            model = createdModel;
          }
        }

        if (model && !endpoint) {
          const endpointRows = await db
            .select()
            .from(aiEndpoints)
            .where(eq(aiEndpoints.id, model.endpointId))
            .limit(1);
          endpoint = endpointRows[0];
        }
      } catch (err: any) {
        console.error('[AI Chat Stream] DB resolution error:', err.message);
      }

      if (!model || !endpoint) {
        // Last fallback: check any available endpoint in the system
        try {
          const anyEndpoints = await db.select().from(aiEndpoints).limit(1);
          if (anyEndpoints[0]) {
            endpoint = anyEndpoints[0];
            model = { modelId: modelId };
          }
        } catch {}
      }

      if (!endpoint) {
        set.status = 404;
        return new Response(JSON.stringify({ error: `AI Endpoint for model '${modelId}' not found. Please add an AI endpoint first.` }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      let apiKey = '';
      if (endpoint.encryptedApiKey) {
        try {
          apiKey = await decryptCredential(endpoint.encryptedApiKey, MASTER_KEY);
        } catch {
          return new Response(JSON.stringify({ error: 'Failed to decrypt API Key' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      // 2. Persist user message if session exists
      try {
        await db.insert(chatMessages).values({
          sessionId,
          role: 'user',
          content: message,
        });
      } catch (err: any) {
        // If session UUID does not exist, ignore foreign key issue for ephemeral sessions
        console.warn('[AI Chat Stream] Could not persist user message:', err.message);
      }

      // 3. Retrieve Knowledge Graph context via BM25 hybrid ranking
      let astContext = '';
      try {
        const retrieved = await retrieveRelevantContext(workspaceId, message, 8);
        if (retrieved.length > 0) {
          astContext = retrieved
            .map((n) => {
              const lineRef = n.lines ? ` (${n.lines})` : '';
              return `[${n.kind.toUpperCase()}] ${n.label} in ${n.filePath}${lineRef}: ${n.summary}`;
            })
            .join('\n');
        } else {
          const fallbackNodes = await db
            .select()
            .from(knowledgeNodes)
            .where(eq(knowledgeNodes.workspaceId, workspaceId))
            .limit(10);
          const safeNodes = fallbackNodes.filter((n) => {
            const p = `${n.filePath} ${n.label}`.toLowerCase();
            return (
              !p.includes('.env') &&
              !p.includes('.pem') &&
              !p.includes('.key') &&
              !p.includes('id_rsa') &&
              !p.includes('credentials') &&
              !p.includes('secret')
            );
          });
          astContext = safeNodes
            .map((n) => `[${n.kind.toUpperCase()}] ${n.label} (${n.filePath}): ${n.summary}`)
            .join('\n');
        }
      } catch (err: any) {
        console.warn('[AI Chat Stream] Context retrieval failed:', err.message);
      }

      const systemPrompt = `You are Vintrix AI, an expert software architecture intelligence assistant.
Analyze codebases, visualize architectures, and help cross-functional teams (including Product Managers and engineers) understand complex multi-repository systems.

[RESPONSE TONE & AUDIENCE ADAPTATION (IMPORTANT)]:
1. DEFAULT AUDIENCE: Product Managers and non-technical stakeholders.
   - Deliver clear, high-level, business-impact focused explanations in plain, easy-to-understand language.
   - Explain *what* the system or feature does, *why* it works that way, user workflows, and practical implications rather than low-level technical jargon or code snippets.
2. TECHNICAL EXCEPTION:
   - Only include low-level code implementation, AST structures, internal function traces, or deep technical syntax WHEN the user's prompt explicitly asks for technical details (e.g., asking for code, implementation, syntax, database schema, debugging, or specific function logic).
   - Even when technical details are requested, provide a brief high-level summary upfront.

[SECURITY & PRIVACY ENFORCEMENT - STRICT READ-ONLY & ZERO CONFIDENTIAL DATA]:
1. You are strictly in READ-ONLY mode. You cannot execute or suggest executing write commands, git push, commits, remote changes, or SSH shell commands.
2. NEVER disclose, print, inspect, search for, or echo credentials, passwords, auth tokens, private keys (e.g. id_rsa, PEM, SSH keys), API keys, or confidential environment variables (.env).
3. If asked about passwords, secrets, or confidential keys, explicitly refuse and explain that confidential credentials are restricted and sanitized by security policy.

Answer accurately based on the indexed Knowledge Graph:
${astContext.length > 0 ? astContext : 'No specific AST indexed yet.'}`;

      // 4. Retrieve recent session memory (conversation context)
      let history: Array<{ role: string; content: string }> = [];
      try {
        const historyRows = await db
          .select({
            role: chatMessages.role,
            content: chatMessages.content,
          })
          .from(chatMessages)
          .where(eq(chatMessages.sessionId, sessionId))
          .orderBy(chatMessages.createdAt)
          .limit(20);
        history = historyRows;
      } catch {
        // Ignore — ephemeral session has no history
      }

      const messagesPayload = [
        { role: 'system', content: systemPrompt },
        ...history.map((h) => ({ role: h.role, content: h.content })),
      ];

      const targetUrl = `${endpoint.baseUrl.replace(/\/+$/, '')}/chat/completions`;

      try {
        const response = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify({
            model: model.modelId,
            messages: messagesPayload,
            temperature: 0.2,
            stream: true,
          }),
        });

        if (!response.ok || !response.body) {
          const errText = await response.text();
          return new Response(JSON.stringify({ error: `Upstream AI provider error: ${errText}` }), {
            status: response.status || 502,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let fullAssistantReply = '';

        const transformStream = new TransformStream({
          async transform(chunk, controller) {
            const text = decoder.decode(chunk, { stream: true });
            const lines = text.split('\n');

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed || trimmed === 'data: [DONE]') continue;
              if (trimmed.startsWith('data: ')) {
                try {
                  const parsed = JSON.parse(trimmed.slice(6));
                  const delta = parsed.choices?.[0]?.delta?.content || '';
                  if (delta) {
                    fullAssistantReply += delta;
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ token: delta })}\n\n`));
                  }
                } catch {
                  // pass malformed partial lines
                }
              }
            }
          },
          async flush(controller) {
            // Persist assistant message once stream completes
            if (fullAssistantReply.trim().length > 0) {
              try {
                await db.insert(chatMessages).values({
                  sessionId,
                  role: 'assistant',
                  content: fullAssistantReply,
                });
              } catch (err: any) {
                console.warn('[AI Chat Stream] Could not persist assistant message:', err.message);
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          },
        });

        return new Response(response.body.pipeThrough(transformStream), {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          },
        });
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : String(err);
        return new Response(JSON.stringify({ error: `Failed to connect to AI: ${errMessage}` }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    },
    {
      body: t.Object({
        sessionId: t.String(),
        workspaceId: t.String({ format: 'uuid' }),
        modelId: t.String(),
        message: t.String({ minLength: 1 }),
      }),
    },
  );
