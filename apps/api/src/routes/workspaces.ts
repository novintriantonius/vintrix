import { Elysia, t } from 'elysia';
import { db } from '../db/client';
import { users, workspaces, workspaceMembers, roles } from '../db/schema';
import { eq } from 'drizzle-orm';

const DEFAULT_ROLE_NAME = 'owner';

export const workspacesRouter = new Elysia({ prefix: '/workspaces' })
  .get('/', async () => {
    return db.select().from(workspaces);
  })
  .post(
    '/',
    async ({ body }) => {
      const { name, description, ownerId } = body;

      const [workspace] = await db
        .insert(workspaces)
        .values({ name, description, ownerId })
        .returning();

      // Assign owner role
      const [ownerRole] = await db.select().from(roles).where(eq(roles.name, DEFAULT_ROLE_NAME));
      if (ownerRole) {
        await db.insert(workspaceMembers).values({
          workspaceId: workspace.id,
          userId: ownerId,
          roleId: ownerRole.id,
        });
      }

      return workspace;
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        ownerId: t.String({ format: 'uuid' }),
      }),
    },
  )
  .get('/:id', async ({ params, set }) => {
    const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, params.id));
    if (!workspace) {
      set.status = 404;
      return { message: 'Workspace not found' };
    }
    return workspace;
  });
