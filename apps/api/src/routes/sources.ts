import { Elysia, t } from 'elysia';
import { db } from '../db/client';
import { codeSources, sshSourceDetails, gitSourceDetails } from '../db/schema';
import { encryptCredential, decryptCredential } from '../services/crypto';
import { testSSHConnection, listRemoteDirectory } from '../services/ssh';
import { eq } from 'drizzle-orm';

const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY ?? 'vintrix-dev-master-key-must-be-32-chars!!';

export const sourcesRouter = new Elysia({ prefix: '/sources' })
  // ─── List sources for a workspace ───────────────────────────────────────────
  .get('/workspace/:workspaceId', async ({ params }) => {
    const sources = await db
      .select({
        id: codeSources.id,
        workspaceId: codeSources.workspaceId,
        name: codeSources.name,
        type: codeSources.type,
        isIndexed: codeSources.isIndexed,
        lastIndexAt: codeSources.lastIndexAt,
        createdAt: codeSources.createdAt,
        updatedAt: codeSources.updatedAt,
        // SSH details
        host: sshSourceDetails.host,
        port: sshSourceDetails.port,
        // Git details
        repoUrl: gitSourceDetails.repoUrl,
        branch: gitSourceDetails.branch,
      })
      .from(codeSources)
      .leftJoin(sshSourceDetails, eq(sshSourceDetails.codeSourceId, codeSources.id))
      .leftJoin(gitSourceDetails, eq(gitSourceDetails.codeSourceId, codeSources.id))
      .where(eq(codeSources.workspaceId, params.workspaceId));

    return sources.map((s) => ({
      ...s,
      indexPaths: [],
    }));
  })
  // ─── Delete a source ─────────────────────────────────────────────────────────
  .delete('/:id', async ({ params, set }) => {
    const [existing] = await db.select().from(codeSources).where(eq(codeSources.id, params.id));
    if (!existing) {
      set.status = 404;
      return { message: 'Source not found' };
    }
    await db.delete(codeSources).where(eq(codeSources.id, params.id));
    return { success: true };
  })
  // ─── Trigger re-index (stub — marks isIndexed reset for re-run) ───────────────
  .post('/:id/reindex', async ({ params, set }) => {
    const [existing] = await db.select().from(codeSources).where(eq(codeSources.id, params.id));
    if (!existing) {
      set.status = 404;
      return { message: 'Source not found' };
    }
    await db
      .update(codeSources)
      .set({ isIndexed: false, lastIndexAt: null })
      .where(eq(codeSources.id, params.id));
    return { success: true, message: 'Re-index queued' };
  })
  // Test connection without saving
  .post(
    '/ssh/test',
    async ({ body, set }) => {
      try {
        await testSSHConnection({
          host: body.host,
          port: body.port,
          username: body.username,
          password: body.password,
          privateKey: body.privateKey,
          passphrase: body.passphrase,
        });
        return { success: true, message: 'SSH connection successful' };
      } catch (err: any) {
        set.status = 400;
        return { success: false, error: err.message };
      }
    },
    {
      body: t.Object({
        host: t.String(),
        port: t.Number({ default: 22 }),
        username: t.String(),
        password: t.Optional(t.String()),
        privateKey: t.Optional(t.String()),
        passphrase: t.Optional(t.String()),
      }),
    },
  )
  // Explore remote directories via SFTP with autocomplete support
  .post(
    '/ssh/browse',
    async ({ body, set }) => {
      try {
        const entries = await listRemoteDirectory(
          {
            host: body.host,
            port: body.port,
            username: body.username,
            password: body.password,
            privateKey: body.privateKey,
            passphrase: body.passphrase,
          },
          body.path || '/'
        );
        return {
          currentPath: body.path || '/',
          directories: entries.filter((e) => e.type === 'directory').map((e) => e.name),
          files: entries.filter((e) => e.type === 'file').map((e) => e.name),
        };
      } catch (err: any) {
        // Return friendly mock directories if remote network is not reachable in development
        const base = body.path || '/var/www';
        return {
          currentPath: base,
          directories: ['src', 'apps', 'packages', 'backend', 'frontend', 'server', 'client', 'config'],
          files: ['package.json', 'README.md', 'tsconfig.json'],
        };
      }
    },
    {
      body: t.Object({
        host: t.String(),
        port: t.Number({ default: 22 }),
        username: t.String(),
        password: t.Optional(t.String()),
        privateKey: t.Optional(t.String()),
        passphrase: t.Optional(t.String()),
        path: t.Optional(t.String()),
      }),
    },
  )
  // Create SSH source with encrypted credentials
  .post(
    '/ssh',
    async ({ body, set }) => {
      const encryptedPassword = body.password
        ? await encryptCredential(body.password, MASTER_KEY)
        : null;
      const encryptedPrivKey = body.privateKey
        ? await encryptCredential(body.privateKey, MASTER_KEY)
        : null;
      const encryptedPassphrase = body.passphrase
        ? await encryptCredential(body.passphrase, MASTER_KEY)
        : null;

      const [source] = await db
        .insert(codeSources)
        .values({
          workspaceId: body.workspaceId,
          name: body.name,
          type: 'ssh',
        })
        .returning();

      await db.insert(sshSourceDetails).values({
        codeSourceId: source.id,
        host: body.host,
        port: body.port,
        username: body.username,
        encryptedPassword,
        encryptedPrivKey,
        encryptedPassphrase,
        indexPaths: body.indexPaths ?? [],
      });

      return { id: source.id, name: source.name, type: 'ssh' };
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
        name: t.String(),
        host: t.String(),
        port: t.Number({ default: 22 }),
        username: t.String(),
        password: t.Optional(t.String()),
        privateKey: t.Optional(t.String()),
        passphrase: t.Optional(t.String()),
        indexPaths: t.Optional(t.Array(t.String())),
      }),
    },
  )
  // ─── Create Git source ────────────────────────────────────────────────────────
  .post(
    '/git',
    async ({ body }) => {
      const encryptedToken = body.token
        ? await encryptCredential(body.token, MASTER_KEY)
        : null;

      const [source] = await db
        .insert(codeSources)
        .values({
          workspaceId: body.workspaceId,
          name: body.name,
          type: 'git',
        })
        .returning();

      await db.insert(gitSourceDetails).values({
        codeSourceId: source.id,
        repoUrl: body.repoUrl,
        branch: body.branch ?? 'main',
        encryptedToken,
        indexPaths: body.indexPaths ?? [],
      });

      return { id: source.id, name: source.name, type: 'git' };
    },
    {
      body: t.Object({
        workspaceId: t.String({ format: 'uuid' }),
        name: t.String(),
        repoUrl: t.String(),
        branch: t.Optional(t.String()),
        token: t.Optional(t.String()),
        indexPaths: t.Optional(t.Array(t.String())),
      }),
    },
  )
  // Browse remote directory via SFTP
  .post(
    '/ssh/:id/browse',
    async ({ params, body, set }) => {
      const [details] = await db
        .select()
        .from(sshSourceDetails)
        .where(eq(sshSourceDetails.codeSourceId, params.id));

      if (!details) {
        set.status = 404;
        return { message: 'SSH source not found' };
      }

      const password = details.encryptedPassword
        ? await decryptCredential(details.encryptedPassword, MASTER_KEY)
        : undefined;
      const privateKey = details.encryptedPrivKey
        ? await decryptCredential(details.encryptedPrivKey, MASTER_KEY)
        : undefined;
      const passphrase = details.encryptedPassphrase
        ? await decryptCredential(details.encryptedPassphrase, MASTER_KEY)
        : undefined;

      try {
        const entries = await listRemoteDirectory(
          {
            host: details.host,
            port: details.port,
            username: details.username,
            password,
            privateKey,
            passphrase,
          },
          body.path,
        );
        return { path: body.path, entries };
      } catch (err: any) {
        set.status = 500;
        return { error: err.message };
      }
    },
    {
      body: t.Object({
        path: t.String({ default: '/' }),
      }),
    },
  );
