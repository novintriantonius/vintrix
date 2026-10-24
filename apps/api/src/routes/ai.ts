import { Elysia, t } from 'elysia';
import { db } from '../db/client';
import { aiEndpoints, aiModels, chatSessions, chatMessages, knowledgeNodes } from '../db/schema';
import { encryptCredential, decryptCredential } from '../services/crypto';
import { retrieveRelevantContext } from '../services/retrieval';
import { eq, desc } from 'drizzle-orm';

const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY ?? 'vintrix-dev-master-key-must-be-32-chars!!';

export const aiRouter = new Elysia({ prefix: '/ai' })
  // List endpoints for a workspace
  .get('/endpoints/:workspaceId', async ({ params }) => {
    return db
      .select({
        id: aiEndpoints.id,
        name: aiEndpoints.name,
        baseUrl: aiEndpoints.baseUrl,
        isDefault: aiEndpoints.isDefault,
        createdAt: aiEndpoints.createdAt,
      })
      .from(aiEndpoints)
      .where(eq(aiEndpoints.workspaceId, params.workspaceId));
  })
  // Add custom OpenAI-compatible endpoint
  .post(
    '/endpoints',
    async ({ body }) => {
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
  .get('/models/:endpointId', async ({ params }) => {
    return db.select().from(aiModels).where(eq(aiModels.endpointId, params.endpointId));
  })
  // Add model to endpoint
  .post(
    '/models',
    async ({ body }) => {
      const [model] = await db
        .insert(aiModels)
        .values({
          endpointId: body.endpointId,
          modelId: body.modelId,
          displayName: body.displayName,
        })
        .returning();
      return model;
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
  .get('/workspaces/:workspaceId/sessions', async ({ params }) => {
    return db
      .select()
      .from(chatSessions)
      .where(eq(chatSessions.workspaceId, params.workspaceId))
      .orderBy(desc(chatSessions.createdAt));
  })
  // Create a chat session
  .post(
    '/sessions',
    async ({ body }) => {
      const [session] = await db
        .insert(chatSessions)
        .values({
          workspaceId: body.workspaceId,
          userId: body.userId,
          modelId: body.modelId,
          title: body.title ?? 'New Codebase Chat',
        })
        .returning();
      return session;
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
        userId: t.String({ format: 'uuid' }),
        modelId: t.Optional(t.String({ format: 'uuid' })),
        title: t.Optional(t.String()),
      }),
    },
  )
  // Get messages for a session
  .get('/sessions/:sessionId/messages', async ({ params }) => {
    return db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.sessionId, params.sessionId))
      .orderBy(chatMessages.createdAt);
  })
  // Chat completion endpoint (with decrypted API key + Codebase Knowledge Graph Context injection)
  .post(
    '/chat',
    async ({ body, set }) => {
      const { sessionId, workspaceId, modelId, message } = body;

      // 1. Resolve model & endpoint
      let model = await db
        .select()
        .from(aiModels)
        .where(eq(aiModels.id, modelId))
        .limit(1)
        .then((rows) => rows[0]);

      // Allow fallback lookup by modelId string if UUID query didn't match directly
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

      const [endpoint] = await db
        .select()
        .from(aiEndpoints)
        .where(eq(aiEndpoints.id, model.endpointId))
        .limit(1);

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
          codebaseContext =
            `\n\n[General Codebase Architecture Context]:\n` +
            fallbackNodes
              .map((n) => `- [${n.kind.toUpperCase()}] ${n.label} (${n.filePath}): ${n.summary ?? 'No summary'}`)
              .join('\n');
        }
      }

      const systemPrompt = `You are Vintrix AI, an expert software architect assisting engineers with multi-repo codebase comprehension and system architecture.
Always provide precise file:line references for your architectural explanations and answers.
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
      const [model] = await db.select().from(aiModels).where(eq(aiModels.id, modelId));
      if (!model) {
        set.status = 404;
        return new Response(JSON.stringify({ error: 'AI Model configuration not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const [endpoint] = await db
        .select()
        .from(aiEndpoints)
        .where(eq(aiEndpoints.id, model.endpointId));
      if (!endpoint) {
        set.status = 404;
        return new Response(JSON.stringify({ error: 'AI Endpoint configuration not found' }), {
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

      // 2. Persist user message
      await db.insert(chatMessages).values({
        sessionId,
        role: 'user',
        content: message,
      });

      // 3. Retrieve Knowledge Graph context via BM25 hybrid ranking
      const retrieved = await retrieveRelevantContext(workspaceId, message, 8);

      let astContext = '';
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

        astContext = fallbackNodes
          .map((n) => `[${n.kind.toUpperCase()}] ${n.label} (${n.filePath}): ${n.summary}`)
          .join('\n');
      }

      const systemPrompt = `You are Vintrix AI Copilot, an elite code intelligence assistant.
Answer questions accurately based on the indexed Knowledge Graph:
${astContext.length > 0 ? astContext : 'No specific AST indexed yet.'}

Provide clear architecture diagrams, file:line references, and actionable code solutions.`;

      // 4. Retrieve recent history
      const history = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.sessionId, sessionId))
        .orderBy(chatMessages.createdAt)
        .limit(10);

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
              await db.insert(chatMessages).values({
                sessionId,
                role: 'assistant',
                content: fullAssistantReply,
              });
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
