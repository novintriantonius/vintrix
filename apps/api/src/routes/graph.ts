import { Elysia, t } from 'elysia';
import { db } from '../db/client';
import { knowledgeNodes, knowledgeEdges, codeSources } from '../db/schema';
import { eq, and } from 'drizzle-orm';

export const graphRouter = new Elysia({ prefix: '/graph' })
  // Get knowledge graph for a workspace with optional source filtering
  .get(
    '/workspace/:workspaceId',
    async ({ params, query }: { params: { workspaceId: string }; query: { sourceId?: string } }) => {
      const { workspaceId } = params;
      const { sourceId } = query;

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

      // Calculate auto layout positions or parse from metadata
      const formattedNodes = dbNodes.map((n: typeof dbNodes[number], idx: number) => {
        let parsedMeta: Record<string, unknown> = {};
        try {
          if (n.metadata) parsedMeta = JSON.parse(n.metadata);
        } catch {
          // ignore
        }

        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const position = (parsedMeta.position as { x: number; y: number }) || {
          x: 100 + col * 400,
          y: 60 + row * 260,
        };

        return {
          id: n.id,
          type: 'codeNode',
          position,
          data: {
            label: n.label,
            kind: n.kind,
            sourceName: n.sourceName || 'workspace-repo',
            sourceType: (n.sourceType as 'git' | 'ssh') || 'git',
            filePath: n.filePath,
            lines: (parsedMeta.lines as string) || 'L1-L150',
            methodCount: (parsedMeta.methodCount as number) || 4,
            dependencyCount: (parsedMeta.dependencyCount as number) || 2,
            status: 'synced',
            summary: n.summary || 'AST indexed component for codebase knowledge graph.',
            codeSnippet: (parsedMeta.codeSnippet as string) || `// Component: ${n.label}\n// Path: ${n.filePath}`,
            tags: (parsedMeta.tags as string[]) || ['xerj-ast', n.kind],
          },
        };
      });

      const formattedEdges = dbEdges.map((e: typeof dbEdges[number]) => ({
        id: e.id,
        source: e.sourceNodeId,
        target: e.targetNodeId,
        animated: true,
        style: { stroke: '#6366f1', strokeWidth: 2 },
        data: { relationType: e.relationType },
      }));

      return {
        workspaceId,
        nodes: formattedNodes,
        edges: formattedEdges,
        totalNodes: formattedNodes.length,
        totalEdges: formattedEdges.length,
      };
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
