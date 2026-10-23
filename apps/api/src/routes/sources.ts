import { Elysia, t } from 'elysia';
import { db } from '../db/client';
import { codeSources, sshSourceDetails } from '../db/schema';
import { encryptCredential, decryptCredential } from '../services/crypto';
import { testSSHConnection, listRemoteDirectory, type SSHConnectOptions } from '../services/ssh';
import { eq } from 'drizzle-orm';

const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY ?? 'vintrix-dev-master-key-must-be-32-chars!!';

export const sourcesRouter = new Elysia({ prefix: '/sources' })
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
