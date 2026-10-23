import { Elysia, t } from 'elysia';
import { db } from '../db/client';
import { users, workspaces, workspaceMembers, roles } from '../db/schema';
import { eq, and } from 'drizzle-orm';

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
  })
  // ─── Team Members & Collaboration ──────────────────────────────────────────
  .get('/:id/members', async ({ params }) => {
    const members = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        email: users.email,
        roleId: roles.id,
        roleName: roles.name,
        invitedAt: workspaceMembers.invitedAt,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .innerJoin(roles, eq(workspaceMembers.roleId, roles.id))
      .where(eq(workspaceMembers.workspaceId, params.id));

    return members;
  })
  .post(
    '/:id/members/invite',
    async ({ params, body, set }) => {
      const { email, roleName = 'member' } = body;

      // Find role
      const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
      if (!role) {
        set.status = 400;
        return { message: `Role '${roleName}' not found.` };
      }

      // Check if user exists, if not create placeholder
      let [existingUser] = await db.select().from(users).where(eq(users.email, email));
      if (!existingUser) {
        const username = email.split('@')[0];
        [existingUser] = await db
          .insert(users)
          .values({
            email,
            displayName: username,
            // OAuth passwordless placeholder hash
            passwordHash: 'oauth_managed',
          })
          .returning();
      }

      // Check if already a member
      const [existingMember] = await db
        .select()
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, params.id),
            eq(workspaceMembers.userId, existingUser.id),
          ),
        );

      if (existingMember) {
        set.status = 409;
        return { message: 'User is already a member of this workspace' };
      }

      await db.insert(workspaceMembers).values({
        workspaceId: params.id,
        userId: existingUser.id,
        roleId: role.id,
      });

      return {
        success: true,
        member: {
          userId: existingUser.id,
          name: existingUser.displayName,
          email: existingUser.email,
          roleName: role.name,
          invitedAt: new Date().toISOString(),
        },
      };
    },
    {
      body: t.Object({
        email: t.String({ format: 'email' }),
        roleName: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    '/:id/members/:userId',
    async ({ params, body, set }) => {
      const { roleName } = body;
      const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
      if (!role) {
        set.status = 400;
        return { message: `Role '${roleName}' not found.` };
      }

      await db
        .update(workspaceMembers)
        .set({ roleId: role.id })
        .where(
          and(
            eq(workspaceMembers.workspaceId, params.id),
            eq(workspaceMembers.userId, params.userId),
          ),
        );

      return { success: true, updatedRole: roleName };
    },
    {
      body: t.Object({
        roleName: t.String(),
      }),
    },
  )
  .delete('/:id/members/:userId', async ({ params }) => {
    await db
      .delete(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, params.id),
          eq(workspaceMembers.userId, params.userId),
        ),
      );

    return { success: true };
  });

