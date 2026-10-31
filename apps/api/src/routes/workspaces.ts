import { Elysia, t } from 'elysia';
import { jwt } from '@elysiajs/jwt';
import { db } from '../db/client';
import { users, workspaces, workspaceMembers, roles } from '../db/schema';
import { eq, and, inArray } from 'drizzle-orm';

const DEFAULT_ROLE_NAME = 'owner';

/** Detect whether an error is a database connectivity failure (not a query/type error) */
function isDbOffline(err: any): boolean {
  const msg = err?.message ?? '';
  return (
    err?.code === 'ECONNREFUSED' ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('connection refused') ||
    msg.includes('terminating connection') ||
    msg.includes('could not connect to server') ||
    msg.includes('Connection terminated unexpectedly')
  );
}

export const workspacesRouter = new Elysia({ prefix: '/workspaces' })
  .use(
    jwt({
      name: 'jwt',
      secret: process.env.JWT_SECRET || 'vintrix-super-secure-jwt-secret-oauth-key-32b',
    })
  )
  .derive(async ({ jwt, headers, set }) => {
    const authHeader = headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { currentUser: null };
    }
    const token = authHeader.slice(7);
    const payload = await jwt.verify(token);
    if (!payload || !payload.sub) {
      return { currentUser: null };
    }
    return {
      currentUser: {
        id: String(payload.sub),
        email: payload.email as string,
        name: payload.name as string,
      },
    };
  })
  .get('/', async ({ currentUser, set }) => {
    if (!currentUser) {
      set.status = 401;
      return { message: 'Unauthorized: Session authentication required to access workspaces' };
    }

    try {
      const ownedWorkspaces = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.ownerId, currentUser.id));

      const memberRows = await db
        .select({ workspaceId: workspaceMembers.workspaceId })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, currentUser.id));

      const memberWorkspaceIds = memberRows.map((r) => r.workspaceId);

      let memberWorkspaces: (typeof workspaces.$inferSelect)[] = [];
      if (memberWorkspaceIds.length > 0) {
        memberWorkspaces = await db
          .select()
          .from(workspaces)
          .where(inArray(workspaces.id, memberWorkspaceIds));
      }

      const map = new Map<string, typeof workspaces.$inferSelect>();
      ownedWorkspaces.forEach((w) => map.set(w.id, w));
      memberWorkspaces.forEach((w) => map.set(w.id, w));

      if (map.size === 0) {
        try {
          const defaultName = currentUser.name ? `${currentUser.name.split(' ')[0]}'s Workspace` : 'My Workspace';
          const [newWs] = await db
            .insert(workspaces)
            .values({
              name: defaultName,
              description: 'Personal codebase intelligence workspace',
              ownerId: currentUser.id,
            })
            .returning();

          if (newWs) {
            map.set(newWs.id, newWs);
            const [ownerRole] = await db.select().from(roles).where(eq(roles.name, DEFAULT_ROLE_NAME));
            if (ownerRole) {
              await db.insert(workspaceMembers).values({
                workspaceId: newWs.id,
                userId: currentUser.id,
                roleId: ownerRole.id,
              });
            }
          }
        } catch (err) {
          console.warn('[Workspaces GET] Auto-provision workspace failed:', err);
        }
      }

      return Array.from(map.values());
    } catch (dbErr: any) {
      console.error('[Workspaces GET] Error querying workspaces:', dbErr.message);
      if (isDbOffline(dbErr)) {
        set.status = 503;
        return { message: 'Database unavailable. Please start the database and try again.' };
      }
      set.status = 500;
      return { message: `Gagal memuat workspace: ${dbErr.message}` };
    }
  })
  .post(
    '/',
    async ({ body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { message: 'Unauthorized: Session authentication required' };
      }

      const { name, description } = body;
      const ownerId = currentUser.id;

      try {
        const [workspace] = await db
          .insert(workspaces)
          .values({ name, description, ownerId })
          .returning();

        const [ownerRole] = await db.select().from(roles).where(eq(roles.name, DEFAULT_ROLE_NAME));
        if (ownerRole) {
          await db.insert(workspaceMembers).values({
            workspaceId: workspace.id,
            userId: ownerId,
            roleId: ownerRole.id,
          });
        }

        return workspace;
      } catch (dbErr: any) {
        console.error('[Workspaces POST] Database unavailable:', dbErr.message);
        set.status = 503;
        return { message: 'Database unavailable. Workspace cannot be created without a database connection. Please start the database and try again.' };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        description: t.Optional(t.String()),
        ownerId: t.Optional(t.String()),
      }),
    },
  )
  .get('/:id', async ({ params, currentUser, set }) => {
    if (!currentUser) {
      set.status = 401;
      return { message: 'Unauthorized: Session authentication required' };
    }

    try {
      const [workspace] = await db.select().from(workspaces).where(eq(workspaces.id, params.id));
      if (!workspace) {
        set.status = 404;
        return { message: 'Workspace not found' };
      }

      const isOwner = workspace.ownerId === currentUser.id;
      if (!isOwner) {
        const [membership] = await db
          .select()
          .from(workspaceMembers)
          .where(
            and(
              eq(workspaceMembers.workspaceId, workspace.id),
              eq(workspaceMembers.userId, currentUser.id),
            ),
          );

        if (!membership) {
          set.status = 403;
          return { message: 'Forbidden: You are not a member of this workspace' };
        }
      }

      return workspace;
    } catch (dbErr: any) {
      console.error('[Workspaces GET /:id] Error:', dbErr.message);
      if (isDbOffline(dbErr)) {
        set.status = 503;
        return { message: 'Database unavailable. Please start the database and try again.' };
      }
      set.status = 404;
      return { message: 'Workspace not found' };
    }
  })
  // ─── Team Members & Collaboration ──────────────────────────────────────────
  .get('/:id/members', async ({ params, set }) => {
    try {
      const members = await db
        .select({
          userId: users.id,
          email: users.email,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          roleId: roles.id,
          roleName: roles.name,
          invitedAt: workspaceMembers.invitedAt,
        })
        .from(workspaceMembers)
        .innerJoin(users, eq(workspaceMembers.userId, users.id))
        .innerJoin(roles, eq(workspaceMembers.roleId, roles.id))
        .where(eq(workspaceMembers.workspaceId, params.id));

      return members;
    } catch (err: any) {
      console.error('[Workspace Members GET] Error:', err.message);
      if (isDbOffline(err)) {
        set.status = 503;
        return { message: 'Database unavailable. Please start the database and try again.' };
      }
      return [];
    }
  })
  .post(
    '/:id/members/invite',
    async ({ params, body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { message: 'Unauthorized: Session authentication required' };
      }
      const { email, roleName = 'member' } = body;

      try {
        const [role] = await db.select().from(roles).where(eq(roles.name, roleName));
        if (!role) {
          set.status = 400;
          return { message: `Role '${roleName}' not found.` };
        }

        let [existingUser] = await db.select().from(users).where(eq(users.email, email));
        if (!existingUser) {
          const username = email.split('@')[0];
          [existingUser] = await db
            .insert(users)
            .values({
              email,
              displayName: username,
              passwordHash: 'oauth_managed',
            })
            .returning();
        }

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
      } catch (dbErr: any) {
        console.error('[Workspace Members Invite] Database unavailable:', dbErr.message);
        set.status = 503;
        return { message: 'Database unavailable. Member cannot be invited without a database connection.' };
      }
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
    async ({ params, body, currentUser, set }) => {
      if (!currentUser) {
        set.status = 401;
        return { message: 'Unauthorized: Session authentication required' };
      }
      const { roleName } = body;

      try {
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
      } catch (dbErr: any) {
        console.error('[Workspace Members PATCH] Database unavailable:', dbErr.message);
        set.status = 503;
        return { message: 'Database unavailable. Role cannot be updated without a database connection.' };
      }
    },
    {
      body: t.Object({
        roleName: t.String(),
      }),
    },
  )
  .delete('/:id/members/:userId', async ({ params, currentUser, set }) => {
    if (!currentUser) {
      set.status = 401;
      return { message: 'Unauthorized: Session authentication required' };
    }

    try {
      await db
        .delete(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, params.id),
            eq(workspaceMembers.userId, params.userId),
          ),
        );

      return { success: true };
    } catch (dbErr: any) {
      console.error('[Workspace Members DELETE] Database unavailable:', dbErr.message);
      set.status = 503;
      return { message: 'Database unavailable. Member cannot be removed without a database connection.' };
    }
  });
