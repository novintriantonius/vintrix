import { Elysia, t } from 'elysia';
import { db } from '../db/client';
import { knowledgeNodes, knowledgeEdges, codeSources } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const graphRouter = new Elysia({ prefix: '/graph' })
  // Get knowledge graph for a workspace with optional source filtering
  .get(
    '/workspace/:workspaceId',
    async ({ params, query, set }: { params: { workspaceId: string }; query: { sourceId?: string }; set: any }) => {
      const { workspaceId } = params;
      const { sourceId } = query;

      try {
        // Query knowledge nodes
        const nodesQuery = sourceId
          ? and(eq(knowledgeNodes.workspaceId, workspaceId), eq(knowledgeNodes.codeSourceId, sourceId))
          : eq(knowledgeNodes.workspaceId, workspaceId);

        const dbNodes = await db
          .select({
            id: knowledgeNodes.id,
            workspaceId: knowledgeNodes.workspaceId,
            codeSourceId: knowledgeNodes.codeSourceId,
            label: knowledgeNodes.label,
            kind: knowledgeNodes.kind,
            nodeType: knowledgeNodes.nodeType,
            parentFilePath: knowledgeNodes.parentFilePath,
            filePath: knowledgeNodes.filePath,
            summary: knowledgeNodes.summary,
            metadata: knowledgeNodes.metadata,
            sourceName: codeSources.name,
            sourceType: codeSources.type,
          })
          .from(knowledgeNodes)
          .leftJoin(codeSources, eq(codeSources.id, knowledgeNodes.codeSourceId))
          .where(nodesQuery);

        // Query knowledge edges for this workspace
        const dbEdges = await db
          .select()
          .from(knowledgeEdges)
          .where(eq(knowledgeEdges.workspaceId, workspaceId));

        // Group nodes by file to layout parent files and subnodes visually
        const formattedNodes = dbNodes.map((n: typeof dbNodes[number], idx: number) => {
          let parsedMeta: Record<string, unknown> = {};
          try {
            if (n.metadata) parsedMeta = JSON.parse(n.metadata);
          } catch {
            // ignore
          }

          const isSubNode = !!n.parentFilePath;
          const col = idx % 4;
          const row = Math.floor(idx / 4);
          const position = (parsedMeta.position as { x: number; y: number }) || {
            x: 80 + col * 360 + (isSubNode ? 30 : 0),
            y: 50 + row * 220 + (isSubNode ? 20 : 0),
          };

          return {
            id: n.id,
            type: 'codeNode',
            position,
            data: {
              label: n.label,
              kind: n.kind,
              nodeType: n.nodeType || 'file',
              parentFilePath: n.parentFilePath,
              sourceName: n.sourceName || 'workspace-repo',
              sourceType: (n.sourceType as 'git' | 'ssh') || 'git',
              filePath: n.filePath,
              lines: (parsedMeta.lines as string) || 'L1-L150',
              methodCount: (parsedMeta.methodCount as number) || 4,
              dependencyCount: (parsedMeta.dependencyCount as number) || 2,
              status: 'synced',
              summary: n.summary || 'AST indexed component for codebase knowledge graph.',
              codeSnippet: (parsedMeta.codeSnippet as string) || `// Component: ${n.label}\n// Path: ${n.filePath}`,
              tags: (parsedMeta.tags as string[]) || ['ast', n.nodeType || 'file', n.kind],
            },
          };
        });

        const formattedEdges = dbEdges.map((e: typeof dbEdges[number]) => {
          const isContains = e.relationType === 'contains';
          return {
            id: e.id,
            source: e.sourceNodeId,
            target: e.targetNodeId,
            animated: !isContains,
            style: isContains
              ? { stroke: '#a855f7', strokeWidth: 1.5, strokeDasharray: '4 4' }
              : { stroke: '#6366f1', strokeWidth: 2 },
            data: { relationType: e.relationType },
          };
        });

        return {
          workspaceId,
          nodes: formattedNodes,
          edges: formattedEdges,
          totalNodes: formattedNodes.length,
          totalEdges: formattedEdges.length,
        };
      } catch (err: any) {
        console.error(`[Graph GET] Error for workspace ${workspaceId}:`, err.message);
        const isDbErr = err?.code === 'ECONNREFUSED' || err?.message?.includes('could not connect') || err?.message?.includes('database');
        if (isDbErr) {
          set.status = 503;
          return {
            message: 'Database unavailable. Knowledge graph cannot be loaded without a database connection.',
            error: 'database_unavailable',
          };
        }
        return {
          workspaceId,
          nodes: [],
          edges: [],
          totalNodes: 0,
          totalEdges: 0,
        };
      }
    },
    {
      params: t.Object({
        workspaceId: t.String(),
      }),
      query: t.Optional(
        t.Object({
          sourceId: t.Optional(t.String()),
        })
      ),
    }
  );
