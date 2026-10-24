import { db } from '../db/client';
import { knowledgeNodes } from '../db/schema';
import { eq } from 'drizzle-orm';

export interface RetrievedContext {
  id: string;
  label: string;
  kind: string;
  filePath: string;
  summary: string;
  score: number;
  lines?: string;
  codeSnippet?: string;
  tags?: string[];
}

/**
 * Tokenize a text query or document string into lowercased terms.
 * Supports alphanumeric words, camelCase splits, and path separators.
 */
export function tokenize(text: string): string[] {
  if (!text) return [];
  // Split camelCase words and replace forward slashes/dots with spaces
  const expanded = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[/\\.]/g, ' ');

  return expanded
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

/**
 * Computes BM25 score for a document against a query term list.
 * k1 = 1.2, b = 0.75
 */
export function computeBM25Score(
  queryTokens: string[],
  docTokens: string[],
  docLen: number,
  avgDocLen: number,
  termDocFrequencies: Map<string, number>,
  totalDocs: number,
): number {
  const k1 = 1.2;
  const b = 0.75;

  // Term frequency in doc
  const tfMap = new Map<string, number>();
  for (const t of docTokens) {
    tfMap.set(t, (tfMap.get(t) || 0) + 1);
  }

  let score = 0;
  for (const qTerm of queryTokens) {
    const tf = tfMap.get(qTerm) || 0;
    if (tf === 0) continue;

    const df = termDocFrequencies.get(qTerm) || 1;
    // Standard Robertson-Sparck Jones IDF
    const idf = Math.log(1 + (totalDocs - df + 0.5) / (df + 0.5));

    const numerator = tf * (k1 + 1);
    const denominator = tf + k1 * (1 - b + (b * docLen) / Math.max(avgDocLen, 1));
    score += idf * (numerator / denominator);
  }

  return score;
}

/**
 * Hybrid retrieval engine over a workspace's AST knowledge nodes.
 * Combines exact symbol matching, BM25 lexical ranking, and path hierarchy proximity.
 */
export async function retrieveRelevantContext(
  workspaceId: string,
  userQuery: string,
  topK = 8,
): Promise<RetrievedContext[]> {
  const queryTokens = tokenize(userQuery);
  if (queryTokens.length === 0) return [];

  // 1. Fetch all knowledge nodes for the given workspace
  const nodes = await db
    .select()
    .from(knowledgeNodes)
    .where(eq(knowledgeNodes.workspaceId, workspaceId));

  if (nodes.length === 0) return [];

  // 2. Preprocess documents and build term document frequencies
  const processedDocs: Array<{
    node: typeof nodes[0];
    tokens: string[];
    parsedMeta: any;
    docLen: number;
  }> = [];

  const termDocFrequencies = new Map<string, number>();
  let totalTokensCount = 0;

  for (const node of nodes) {
    let parsedMeta: any = {};
    try {
      if (node.metadata) parsedMeta = JSON.parse(node.metadata);
    } catch {
      // ignore
    }

    const docText = `${node.label} ${node.kind} ${node.filePath} ${node.summary ?? ''} ${(parsedMeta.tags || []).join(' ')} ${parsedMeta.codeSnippet ?? ''}`;
    const tokens = tokenize(docText);
    totalTokensCount += tokens.length;

    const uniqueTermsInDoc = new Set(tokens);
    for (const term of uniqueTermsInDoc) {
      termDocFrequencies.set(term, (termDocFrequencies.get(term) || 0) + 1);
    }

    processedDocs.push({
      node,
      tokens,
      parsedMeta,
      docLen: tokens.length,
    });
  }

  const avgDocLen = totalTokensCount / processedDocs.length;
  const totalDocs = processedDocs.length;

  // 3. Score each document with BM25 + Exact Symbol & Path Bonus
  const scoredResults: RetrievedContext[] = [];

  for (const doc of processedDocs) {
    let score = computeBM25Score(
      queryTokens,
      doc.tokens,
      doc.docLen,
      avgDocLen,
      termDocFrequencies,
      totalDocs,
    );

    const lowerQuery = userQuery.toLowerCase();
    const lowerLabel = doc.node.label.toLowerCase();
    const lowerPath = doc.node.filePath.toLowerCase();

    // Exact symbol or filename match bonus
    if (lowerQuery.includes(lowerLabel) || lowerLabel.includes(lowerQuery)) {
      score += 4.5;
    }
    if (lowerQuery.includes(lowerPath)) {
      score += 3.0;
    }

    // Kind match bonus (e.g. user asks for "controller", "auth", "db", "service")
    if (lowerQuery.includes(doc.node.kind.toLowerCase())) {
      score += 1.5;
    }

    if (score > 0) {
      scoredResults.push({
        id: doc.node.id,
        label: doc.node.label,
        kind: doc.node.kind,
        filePath: doc.node.filePath,
        summary: doc.node.summary || '',
        score,
        lines: doc.parsedMeta.lines,
        codeSnippet: doc.parsedMeta.codeSnippet,
        tags: doc.parsedMeta.tags,
      });
    }
  }

  // 4. Sort descending by relevance score
  scoredResults.sort((a, b) => b.score - a.score);

  return scoredResults.slice(0, topK);
}
