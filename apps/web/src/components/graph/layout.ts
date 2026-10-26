import type { Node, Edge } from '@xyflow/react';

export type LayoutDirection = 'TB' | 'LR' | 'GRID' | 'RADIAL';

interface LayoutOptions {
  nodeWidth?: number;
  nodeHeight?: number;
  rankSep?: number;
  nodeSep?: number;
}

/**
 * Calculates topological level (rank) for each node using longest-path algorithm
 */
function computeRanks(nodes: Node[], edges: Edge[]): Map<string, number> {
  const inDegree: Record<string, number> = {};
  const adj: Record<string, string[]> = {};

  nodes.forEach((n) => {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  });

  edges.forEach((e) => {
    if (adj[e.source] && inDegree[e.target] !== undefined) {
      adj[e.source].push(e.target);
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    }
  });

  const ranks = new Map<string, number>();
  const queue: { id: string; rank: number }[] = [];

  // Start with root nodes (inDegree === 0)
  nodes.forEach((n) => {
    if ((inDegree[n.id] || 0) === 0) {
      queue.push({ id: n.id, rank: 0 });
      ranks.set(n.id, 0);
    }
  });

  // If there's a pure cycle and no inDegree === 0, seed with first node
  if (queue.length === 0 && nodes.length > 0) {
    queue.push({ id: nodes[0].id, rank: 0 });
    ranks.set(nodes[0].id, 0);
  }

  // BFS with longest path updating
  const visitedCount: Record<string, number> = {};
  while (queue.length > 0) {
    const { id, rank } = queue.shift()!;
    visitedCount[id] = (visitedCount[id] || 0) + 1;

    // Safety guard against infinite loops in cyclic graphs
    if (visitedCount[id] > nodes.length * 2) continue;

    const neighbors = adj[id] || [];
    for (const next of neighbors) {
      const currentRank = ranks.get(next) ?? -1;
      if (rank + 1 > currentRank) {
        ranks.set(next, rank + 1);
        queue.push({ id: next, rank: rank + 1 });
      }
    }
  }

  // Assign fallback rank for any disconnected component
  nodes.forEach((n) => {
    if (!ranks.has(n.id)) ranks.set(n.id, 0);
  });

  return ranks;
}

/**
 * Deterministic layout calculation for ReactFlow nodes without external heavy C++ / wasm dependencies.
 */
export function getLayoutedNodes(
  nodes: Node[],
  edges: Edge[],
  direction: LayoutDirection = 'TB',
  options: LayoutOptions = {}
): Node[] {
  if (nodes.length === 0) return [];

  const {
    nodeWidth = 280,
    nodeHeight = 150,
    rankSep = 180,
    nodeSep = 60,
  } = options;

  if (direction === 'GRID') {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    return nodes.map((node, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      return {
        ...node,
        position: {
          x: col * (nodeWidth + nodeSep),
          y: row * (nodeHeight + rankSep / 2),
        },
      };
    });
  }

  if (direction === 'RADIAL') {
    const count = nodes.length;
    const radius = Math.max(300, (count * (nodeWidth + nodeSep)) / (2 * Math.PI));
    return nodes.map((node, index) => {
      const angle = (index / count) * 2 * Math.PI;
      return {
        ...node,
        position: {
          x: Math.round(radius * Math.cos(angle) + radius),
          y: Math.round(radius * Math.sin(angle) + radius),
        },
      };
    });
  }

  // Hierarchical: TB (Top-to-Bottom) or LR (Left-to-Right)
  const ranks = computeRanks(nodes, edges);
  const levels: Record<number, Node[]> = {};

  nodes.forEach((node) => {
    const rank = ranks.get(node.id) || 0;
    if (!levels[rank]) levels[rank] = [];
    levels[rank].push(node);
  });

  const levelKeys = Object.keys(levels)
    .map(Number)
    .sort((a, b) => a - b);

  const positionedNodes: Node[] = [];

  if (direction === 'TB') {
    levelKeys.forEach((lvl) => {
      const rowNodes = levels[lvl];
      const totalWidth = rowNodes.length * nodeWidth + (rowNodes.length - 1) * nodeSep;
      const startX = -totalWidth / 2;

      rowNodes.forEach((node, colIndex) => {
        positionedNodes.push({
          ...node,
          position: {
            x: Math.round(startX + colIndex * (nodeWidth + nodeSep)),
            y: Math.round(lvl * (nodeHeight + rankSep)),
          },
        });
      });
    });
  } else {
    // LR: Left to Right
    levelKeys.forEach((lvl) => {
      const colNodes = levels[lvl];
      const totalHeight = colNodes.length * nodeHeight + (colNodes.length - 1) * nodeSep;
      const startY = -totalHeight / 2;

      colNodes.forEach((node, rowIndex) => {
        positionedNodes.push({
          ...node,
          position: {
            x: Math.round(lvl * (nodeWidth + rankSep)),
            y: Math.round(startY + rowIndex * (nodeHeight + nodeSep)),
          },
        });
      });
    });
  }

  return positionedNodes;
}

/**
 * Finds the shortest directed dependency path from startNodeId to targetNodeId using BFS.
 * Returns the ordered node IDs and edge IDs in the path.
 */
export function findShortestPath(
  startNodeId: string,
  targetNodeId: string,
  edges: Edge[]
): { nodeIds: string[]; edgeIds: string[] } | null {
  if (startNodeId === targetNodeId) {
    return { nodeIds: [startNodeId], edgeIds: [] };
  }

  const adj: Record<string, { target: string; edgeId: string }[]> = {};
  edges.forEach((e) => {
    if (!adj[e.source]) adj[e.source] = [];
    adj[e.source].push({ target: e.target, edgeId: e.id });
  });

  const queue: { current: string; pathNodes: string[]; pathEdges: string[] }[] = [
    { current: startNodeId, pathNodes: [startNodeId], pathEdges: [] },
  ];
  const visited = new Set<string>([startNodeId]);

  while (queue.length > 0) {
    const { current, pathNodes, pathEdges } = queue.shift()!;
    const neighbors = adj[current] || [];

    for (const { target, edgeId } of neighbors) {
      if (target === targetNodeId) {
        return {
          nodeIds: [...pathNodes, target],
          edgeIds: [...pathEdges, edgeId],
        };
      }

      if (!visited.has(target)) {
        visited.add(target);
        queue.push({
          current: target,
          pathNodes: [...pathNodes, target],
          pathEdges: [...pathEdges, edgeId],
        });
      }
    }
  }

  return null;
}
