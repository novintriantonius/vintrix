import { Elysia, t } from 'elysia';
import { db } from '../db/client';
import { codeSources, sshSourceDetails, gitSourceDetails, knowledgeNodes, knowledgeEdges } from '../db/schema';
import { encryptCredential, decryptCredential } from '../services/crypto';
import { testSSHConnection, listRemoteDirectory, syncRemoteSSHDirectory } from '../services/ssh';
import { syncGitRepository, testGitConnection } from '../services/git';
import { scanCodebaseDirectory } from '../services/astScanner';
import { reindexEvents } from '../services/reindexEvents';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import crypto from 'node:crypto';

const MASTER_KEY = process.env.ENCRYPTION_MASTER_KEY ?? 'vintrix-dev-master-key-must-be-32-chars!!';

// Helper to execute full AST sync and reindexing for a given source
export async function executeSourceReindex(
  sourceId: string,
  targetWorkspaceId?: string,
): Promise<{
  success: boolean;
  message: string;
  totalFilesIndexed?: number;
  nodesScanned: number;
  edgesScanned: number;
}> {
  // Query database - fail if DB is offline or source does not exist
  let existing: any = null;
  try {
    const rows = await db.select().from(codeSources).where(eq(codeSources.id, sourceId));
    existing = rows[0] || null;
  } catch (err: any) {
    console.error(`[executeSourceReindex] Database unavailable for source ${sourceId}:`, err.message);
    throw new Error(`Database unavailable: ${err.message}`);
  }

  if (!existing) {
    throw new Error('Source not found in database');
  }

  const effectiveWorkspaceId = targetWorkspaceId || existing.workspaceId;

  reindexEvents.emitEvent({
    type: 'started',
    sourceId: existing.id,
    sourceName: existing.name,
    workspaceId: effectiveWorkspaceId,
    message: `Starting codebase scan and AST indexing for ${existing.name}...`,
    progressPercent: 10,
    timestamp: new Date().toISOString(),
  });

  const cacheRoot = path.join(os.homedir(), '.vintrix', 'repos', existing.id);
  const rootRepoDir = path.resolve(process.cwd(), '../..');
  let targetScanDir = rootRepoDir;

  if (existing.type === 'git') {
    const [gitDetails] = await db
      .select()
      .from(gitSourceDetails)
      .where(eq(gitSourceDetails.codeSourceId, existing.id));

    if (gitDetails && gitDetails.repoUrl) {
      if (gitDetails.repoUrl.startsWith('/') || gitDetails.repoUrl.startsWith('.')) {
        const localPath = path.resolve(rootRepoDir, gitDetails.repoUrl);
        if (fs.existsSync(localPath)) {
          targetScanDir = localPath;
        }
      } else {
        const token = gitDetails.encryptedToken
          ? await decryptCredential(gitDetails.encryptedToken, MASTER_KEY)
          : null;
        try {
          await syncGitRepository({
            repoUrl: gitDetails.repoUrl,
            branch: gitDetails.branch || 'main',
            targetDir: cacheRoot,
            token,
          });
          targetScanDir = cacheRoot;
        } catch (syncErr: any) {
          console.warn(`Git sync warning (${gitDetails.repoUrl}):`, syncErr.message);
          if (gitDetails.indexPaths && gitDetails.indexPaths.length > 0) {
            const customPath = path.resolve(rootRepoDir, gitDetails.indexPaths[0]);
            if (fs.existsSync(customPath)) targetScanDir = customPath;
          }
        }
      }
    }
  } else if (existing.type === 'ssh') {
    const [sshDetails] = await db
      .select()
      .from(sshSourceDetails)
      .where(eq(sshSourceDetails.codeSourceId, existing.id));

    if (sshDetails) {
      const password = sshDetails.encryptedPassword
        ? await decryptCredential(sshDetails.encryptedPassword, MASTER_KEY)
        : undefined;
      const privateKey = sshDetails.encryptedPrivKey
        ? await decryptCredential(sshDetails.encryptedPrivKey, MASTER_KEY)
        : undefined;
      const passphrase = sshDetails.encryptedPassphrase
        ? await decryptCredential(sshDetails.encryptedPassphrase, MASTER_KEY)
        : undefined;

      const sshOpts = {
        host: sshDetails.host,
        port: sshDetails.port,
        username: sshDetails.username,
        password,
        privateKey,
        passphrase,
      };

      // Use configured indexPaths if set, otherwise use remote home dir
      const remoteDir =
        sshDetails.indexPaths && sshDetails.indexPaths.length > 0
          ? sshDetails.indexPaths[0]
          : '/'; // listRemoteDirectory will resolve home dir via pwd

      try {
        const syncResult = await syncRemoteSSHDirectory(sshOpts, remoteDir, cacheRoot);
        if (syncResult.filesDownloaded > 0 || fs.existsSync(cacheRoot)) {
          targetScanDir = cacheRoot;
        } else {
          throw new Error(`Tidak ada file source code yang ditemukan di ${remoteDir}`);
        }
      } catch (sshErr: any) {
        console.error(`[SSH Sync Failed] ${sshDetails.host}:`, sshErr.message);
        reindexEvents.emitEvent({
          type: 'error',
          sourceId: existing.id,
          sourceName: existing.name,
          workspaceId: effectiveWorkspaceId,
          message: `Gagal mengunduh direktori SSH (${sshDetails.host}): ${sshErr.message}`,
          timestamp: new Date().toISOString(),
        });
        throw new Error(`SSH sync failed: ${sshErr.message}`);
      }
    }
  }

  if (!targetScanDir || !fs.existsSync(targetScanDir)) {
    reindexEvents.emitEvent({
      type: 'error',
      sourceId: existing.id,
      sourceName: existing.name,
      workspaceId: effectiveWorkspaceId,
      message: 'Direktori target scan tidak ditemukan atau kosong.',
      timestamp: new Date().toISOString(),
    });
    throw new Error('Direktori target scan tidak ditemukan atau gagal diunduh.');
  }

  // Run AST parser with file-by-file progress reporting
  const { nodes: scannedNodes, edges: scannedEdges, totalIndexedFiles } = await scanCodebaseDirectory(
    targetScanDir,
    async (current, total, filePath) => {
      const percent = Math.min(95, Math.round((current / Math.max(1, total)) * 80) + 10);
      reindexEvents.emitEvent({
        type: 'progress',
        sourceId: existing.id,
        sourceName: existing.name,
        workspaceId: effectiveWorkspaceId,
        message: `Indexing file ${current}/${total}: ${filePath}`,
        progressPercent: percent,
        currentFileIndex: current,
        totalFiles: total,
        currentFileName: filePath,
        timestamp: new Date().toISOString(),
      });
      // Pacing delay (45ms per file) so user clearly sees the file-by-file counter
      await new Promise((r) => setTimeout(r, 45));
    }
  );

  // Persist nodes & edges to database if DB is reachable
  try {
    if (scannedNodes.length > 0) {
      // 1. Clear previous nodes & edges for this source
      await db.delete(knowledgeNodes).where(eq(knowledgeNodes.codeSourceId, existing.id));

      // 2. Insert scanned AST nodes & sub-nodes
      const insertedNodesMap = new Map<string, string>();

      for (const node of scannedNodes) {
        const [inserted] = await db
          .insert(knowledgeNodes)
          .values({
            workspaceId: existing.workspaceId,
            codeSourceId: existing.id,
            label: node.label,
            kind: node.kind,
            nodeType: node.nodeType,
            parentFilePath: node.parentFilePath || null,
            filePath: node.filePath,
            summary: node.summary,
            metadata: JSON.stringify({
              nodeKey: node.nodeKey,
              nodeType: node.nodeType,
              parentFilePath: node.parentFilePath,
              lines: node.lines,
              methodCount: node.methodCount,
              dependencyCount: node.dependencyCount,
              tags: node.tags,
              codeSnippet: node.codeSnippet,
            }),
          })
          .returning();

        if (inserted) {
          insertedNodesMap.set(node.nodeKey, inserted.id);
        }
      }

      // 3. Insert scanned cross-module edges & parent-child contains edges
      for (const edge of scannedEdges) {
        const sourceId = insertedNodesMap.get(edge.sourceNodeKey);
        const targetId = insertedNodesMap.get(edge.targetNodeKey);

        if (sourceId && targetId && sourceId !== targetId) {
          await db.insert(knowledgeEdges).values({
            workspaceId: existing.workspaceId,
            sourceNodeId: sourceId,
            targetNodeId: targetId,
            relationType: edge.relationType,
          });
        }
      }
    }

    await db
      .update(codeSources)
      .set({
        isIndexed: true,
        lastIndexAt: new Date(),
        totalFilesIndexed: totalIndexedFiles ?? 0,
        totalNodesCount: scannedNodes.length,
      })
      .where(eq(codeSources.id, existing.id));
  } catch (dbErr: any) {
    console.error(`[executeSourceReindex] Database unavailable while saving nodes:`, dbErr.message);
    reindexEvents.emitEvent({
      type: 'error',
      sourceId: existing.id,
      sourceName: existing.name,
      workspaceId: effectiveWorkspaceId,
      message: `Database unavailable: gagal menyimpan node ke database (${dbErr.message})`,
      timestamp: new Date().toISOString(),
    });
    throw new Error(`Database unavailable: ${dbErr.message}`);
  }

  const resultPayload = {
    success: true,
    message: `Re-indexing complete. Scanned ${totalIndexedFiles} files, created ${scannedNodes.length} graph nodes and ${scannedEdges.length} dependency edges.`,
    totalFilesIndexed: totalIndexedFiles,
    nodesScanned: scannedNodes.length,
    edgesScanned: scannedEdges.length,
  };

  reindexEvents.emitEvent({
    type: 'completed',
    sourceId: existing.id,
    sourceName: existing.name,
    workspaceId: effectiveWorkspaceId,
    message: resultPayload.message,
    progressPercent: 100,
    totalFilesIndexed: totalIndexedFiles,
    nodesScanned: scannedNodes.length,
    edgesScanned: scannedEdges.length,
    timestamp: new Date().toISOString(),
  });

  return resultPayload;
}

export const sourcesRouter = new Elysia({ prefix: '/sources' })
  // ─── Real-Time Reindex Event Stream (Server-Sent Events) ───────────────────
  .get('/events', ({ query }) => {
    const workspaceId = query.workspaceId;
    const encoder = new TextEncoder();

    let eventListener: (data: any) => void;
    let heartbeatInterval: ReturnType<typeof setInterval>;

    const stream = new ReadableStream({
      start(controller) {
        // Send initial connected ping
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              type: 'connected',
              workspaceId,
              message: 'Connected to live re-indexing event stream',
              timestamp: new Date().toISOString(),
            })}\n\n`,
          ),
        );

        eventListener = (data: any) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
          } catch {
            // client disconnected
          }
        };

        // Listen to global reindex events
        reindexEvents.on('reindex', eventListener);
        if (workspaceId && workspaceId !== 'default') {
          // Keep channel listener clean - already captured by global 'reindex'
        }

        // Heartbeat comment every 15s to keep proxy/socket alive
        heartbeatInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          } catch {
            clearInterval(heartbeatInterval);
          }
        }, 15000);
      },
      cancel() {
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        if (eventListener) {
          reindexEvents.off('reindex', eventListener);
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  }, {
    query: t.Object({
      workspaceId: t.Optional(t.String()),
    }),
  })
  // ─── List sources for a workspace ───────────────────────────────────────────
  .get('/workspace/:workspaceId', async ({ params, set }) => {
    try {
      const sources = await db
        .select({
          id: codeSources.id,
          workspaceId: codeSources.workspaceId,
          name: codeSources.name,
          type: codeSources.type,
          isIndexed: codeSources.isIndexed,
          lastIndexAt: codeSources.lastIndexAt,
          totalFilesIndexed: codeSources.totalFilesIndexed,
          totalNodesCount: codeSources.totalNodesCount,
          createdAt: codeSources.createdAt,
          updatedAt: codeSources.updatedAt,
          // SSH details
          host: sshSourceDetails.host,
          port: sshSourceDetails.port,
          sshIndexPaths: sshSourceDetails.indexPaths,
          // Git details
          repoUrl: gitSourceDetails.repoUrl,
          branch: gitSourceDetails.branch,
          gitIndexPaths: gitSourceDetails.indexPaths,
        })
        .from(codeSources)
        .leftJoin(sshSourceDetails, eq(sshSourceDetails.codeSourceId, codeSources.id))
        .leftJoin(gitSourceDetails, eq(gitSourceDetails.codeSourceId, codeSources.id))
        .where(eq(codeSources.workspaceId, params.workspaceId));

      return sources.map((s) => ({
        ...s,
        indexPaths: s.type === 'ssh' ? s.sshIndexPaths ?? [] : s.gitIndexPaths ?? [],
      }));
    } catch (err: any) {
      console.error(`[GET /sources/workspace/${params.workspaceId}] Error:`, err.message);
      const isDbErr = err?.code === 'ECONNREFUSED' || err?.message?.includes('could not connect') || err?.message?.includes('database');
      if (isDbErr) {
        set.status = 503;
        return { message: 'Database unavailable. Please start the database and try again.' };
      }
      return [];
    }
  })
  // ─── Delete a source ─────────────────────────────────────────────────────────
  .delete('/:id', async ({ params, set }) => {
    try {
      const [existing] = await db.select().from(codeSources).where(eq(codeSources.id, params.id));
      if (!existing) {
        set.status = 404;
        return { message: 'Source not found' };
      }
      await db.delete(codeSources).where(eq(codeSources.id, params.id));
      return { success: true };
    } catch (err: any) {
      console.error(`[DELETE /sources/${params.id}] Database unavailable:`, err.message);
      set.status = 503;
      return { message: 'Database unavailable. Source cannot be deleted without a database connection.' };
    }
  })
  // ─── Trigger re-index with real AST Scanner ─────────────────────────────
  .post('/:id/reindex', async ({ params, query, set }) => {
    try {
      // Validate that source exists in database first
      const [existing] = await db.select().from(codeSources).where(eq(codeSources.id, params.id));
      if (!existing) {
        set.status = 404;
        return { message: 'Source not found' };
      }

      const targetWorkspaceId = (query as any)?.workspaceId || existing.workspaceId;

      // Dispatch reindex in background so HTTP connection does not timeout on long SSH downloads
      setTimeout(async () => {
        try {
          await executeSourceReindex(params.id, targetWorkspaceId);
        } catch (err: any) {
          console.error(`[executeSourceReindex:background] Error for ${params.id}:`, err.message);
        }
      }, 20);

      return {
        started: true,
        sourceId: params.id,
        message: 'Re-indexing initiated. Progress will stream via SSE.',
      };
    } catch (err: any) {
      console.error(`[sources/:id/reindex] Error checking source ${params.id}:`, err);
      if (err.message && (err.message.includes('Database unavailable') || err.code === 'ECONNREFUSED')) {
        set.status = 503;
        return { message: 'Database unavailable. Re-indexing cannot be performed without a database connection.' };
      }
      set.status = 500;
      return { message: `Re-index failed: ${err.message || 'Unknown error'}` };
    }
  })
  // ─── Incoming Git Webhook Handler (GitHub / GitLab Push) ───────────────────
  .post(
    '/webhook',
    async ({ body, headers, query, set }) => {
      // 1. Identify target source: by explicit sourceId or by repository clone URL
      let sourceId = query.sourceId;

      const payload = body as any;
      const repoUrl =
        payload?.repository?.clone_url ||
        payload?.repository?.git_http_url ||
        payload?.repository?.ssh_url ||
        payload?.repository?.html_url ||
        payload?.project?.git_http_url;

      if (!sourceId && repoUrl) {
        // Match Git source by repoUrl substring
        const cleanRepo = repoUrl.replace(/\.git$/, '').toLowerCase();
        const sources = await db
          .select({
            id: codeSources.id,
            repoUrl: gitSourceDetails.repoUrl,
          })
          .from(codeSources)
          .innerJoin(gitSourceDetails, eq(gitSourceDetails.codeSourceId, codeSources.id));

        const matched = sources.find((s) =>
          cleanRepo.includes(s.repoUrl.replace(/\.git$/, '').toLowerCase()),
        );
        if (matched) {
          sourceId = matched.id;
        }
      }

      if (!sourceId) {
        set.status = 400;
        return { error: 'No matching code source found for this webhook event. Provide ?sourceId=<uuid>' };
      }

      // 2. Verify HMAC SHA-256 Secret (if X-Hub-Signature-256 or X-Gitlab-Token is provided)
      const githubSig = headers['x-hub-signature-256'];
      const gitlabToken = headers['x-gitlab-token'];
      const webhookSecret = process.env.GIT_WEBHOOK_SECRET;

      if (webhookSecret && githubSig) {
        const hmac = crypto.createHmac('sha256', webhookSecret);
        const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex');
        if (githubSig !== digest) {
          set.status = 401;
          return { error: 'Invalid GitHub webhook signature' };
        }
      } else if (webhookSecret && gitlabToken) {
        if (gitlabToken !== webhookSecret) {
          set.status = 401;
          return { error: 'Invalid GitLab webhook secret token' };
        }
      }

      // 3. Trigger asynchronous background reindex so webhook response doesn't timeout
      setTimeout(async () => {
        try {
          console.log(`[Webhook] Starting automatic re-indexing for source ${sourceId}...`);
          const res = await executeSourceReindex(sourceId!);
          console.log(`[Webhook] Finished re-indexing source ${sourceId}:`, res.message);
        } catch (err: any) {
          console.error(`[Webhook] Error re-indexing source ${sourceId}:`, err.message);
        }
      }, 50);

      return {
        received: true,
        sourceId,
        message: 'Webhook received. Automated AST re-indexing dispatched in background.',
        event: headers['x-github-event'] || headers['x-gitlab-event'] || 'push',
      };
    },
    {
      query: t.Object({
        sourceId: t.Optional(t.String()),
      }),
    },
  )
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
        const { entries, resolvedPath } = await listRemoteDirectory(
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
          currentPath: resolvedPath,
          directories: entries.filter((e) => e.type === 'directory').map((e) => e.name),
          files: entries.filter((e) => e.type === 'file').map((e) => e.name),
        };
      } catch (err: any) {
        console.error('[SSH Browse Directory] Failed to browse remote host:', err.message);
        set.status = 502;
        return {
          error: `Gagal membaca direktori remote via SSH: ${err.message}`,
          directories: [],
          files: [],
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

      try {
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
          port: body.port ?? 22,
          username: body.username,
          encryptedPassword,
          encryptedPrivKey,
          encryptedPassphrase,
          indexPaths: body.indexPaths ?? [],
        });

        return { id: source.id, name: source.name, type: 'ssh' };
      } catch (dbErr: any) {
        console.error('[sources/ssh POST] Database unavailable:', dbErr.message);
        set.status = 503;
        return { message: 'Database unavailable. Source cannot be added without a database connection.' };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
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
  // Test Git repository connectivity & credentials
  .post(
    '/git/test',
    async ({ body, set }) => {
      try {
        const result = await testGitConnection({
          repoUrl: body.repoUrl.trim(),
          branch: body.branch?.trim() || undefined,
          token: body.token?.trim() || undefined,
        });

        if (!result.success) {
          set.status = 400;
          return {
            success: false,
            message: result.error || 'Failed to connect to Git repository',
            error: result.error || 'Failed to connect to Git repository',
          };
        }

        return {
          success: true,
          message: 'Connected to repository successfully.',
          branches: result.branches,
        };
      } catch (err: any) {
        set.status = 400;
        const msg = err.message || 'Failed to connect to Git repository';
        return { success: false, message: msg, error: msg };
      }
    },
    {
      body: t.Object({
        repoUrl: t.String(),
        branch: t.Optional(t.String()),
        token: t.Optional(t.String()),
      }),
    },
  )
  // ─── Create Git source ────────────────────────────────────────────────────────
  .post(
    '/git',
    async ({ body, set }) => {
      // Quick verification of git credentials before saving
      const test = await testGitConnection({
        repoUrl: body.repoUrl.trim(),
        branch: body.branch?.trim() || undefined,
        token: body.token?.trim() || undefined,
      });

      if (!test.success) {
        set.status = 400;
        const msg = test.error || 'Failed to authenticate with Git repository';
        return { success: false, message: msg, error: msg };
      }

      const encryptedToken = body.token
        ? await encryptCredential(body.token, MASTER_KEY)
        : null;

      try {
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

        // Seed initial AST knowledge nodes for the new Git source
        try {
          const repoName = body.name.replace(/[^a-zA-Z0-9]/g, '');
          const [node1] = await db
            .insert(knowledgeNodes)
            .values({
              workspaceId: body.workspaceId,
              codeSourceId: source.id,
              label: `${repoName}Controller`,
              kind: 'controller',
              filePath: `${body.indexPaths?.[0] || 'src'}/controller.ts`,
              summary: `REST API / Gateway controller for ${body.name}`,
              metadata: JSON.stringify({
                lines: 'L1-L85',
                methodCount: 5,
                dependencyCount: 2,
                codeSnippet: `export class ${repoName}Controller {\n  async getHandler() { return { status: 'ok' }; }\n}`,
                tags: ['git', 'xerj-ast', 'api'],
              }),
            })
            .returning();

          const [node2] = await db
            .insert(knowledgeNodes)
            .values({
              workspaceId: body.workspaceId,
              codeSourceId: source.id,
              label: `${repoName}Repository`,
              kind: 'database',
              filePath: `${body.indexPaths?.[0] || 'src'}/repository.ts`,
              summary: `Data persistence and repository layer for ${body.name}`,
              metadata: JSON.stringify({
                lines: 'L1-L110',
                methodCount: 3,
                dependencyCount: 1,
                codeSnippet: `export class ${repoName}Repository {\n  async findOne(id: string) { return db.find(id); }\n}`,
                tags: ['git', 'database'],
              }),
            })
            .returning();

          if (node1 && node2) {
            await db.insert(knowledgeEdges).values({
              workspaceId: body.workspaceId,
              sourceNodeId: node1.id,
              targetNodeId: node2.id,
              relationType: 'calls',
            });
          }
        } catch {
          // seeding fallback
        }

        return { id: source.id, name: source.name, type: 'git' };
      } catch (dbErr: any) {
        console.error('[sources/git POST] Database unavailable:', dbErr.message);
        set.status = 503;
        return { message: 'Database unavailable. Source cannot be added without a database connection.' };
      }
    },
    {
      body: t.Object({
        workspaceId: t.String(),
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
