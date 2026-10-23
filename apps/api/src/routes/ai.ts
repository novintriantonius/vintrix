import { Elysia, t } from 'elysia';
import { db } from '../db/client';
import { aiEndpoints, aiModels } from '../db/schema';
import { encryptCredential } from '../services/crypto';
import { eq } from 'drizzle-orm';

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
  );
