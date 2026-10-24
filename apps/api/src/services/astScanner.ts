import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

export interface ScannedASTNode {
  label: string;
  kind: 'controller' | 'service' | 'database' | 'security' | 'gateway';
  filePath: string;
  summary: string;
  lines: string;
  methodCount: number;
  dependencyCount: number;
  tags: string[];
  codeSnippet: string;
  importedModules: string[];
}

export interface ScannedASTResult {
  nodes: ScannedASTNode[];
  edges: {
    sourceFilePath: string;
    targetFilePath: string;
    relationType: 'calls' | 'imports' | 'implements' | 'depends_on';
    label?: string;
  }[];
}

/**
 * Infer the architectural role/kind of an AST source file based on keywords, decorators, and imports
 */
function inferNodeKind(
  filePath: string,
  exportedSymbols: string[],
  imports: string[]
): 'controller' | 'service' | 'database' | 'security' | 'gateway' {
  const lowerPath = filePath.toLowerCase();
  const allText = `${lowerPath} ${exportedSymbols.join(' ').toLowerCase()} ${imports.join(' ').toLowerCase()}`;

  if (
    lowerPath.includes('/routes/') ||
    lowerPath.includes('controller') ||
    lowerPath.includes('router') ||
    lowerPath.includes('endpoint') ||
    allText.includes('elysia') ||
    allText.includes('express') ||
    allText.includes('fastify')
  ) {
    return 'controller';
  }

  if (
    lowerPath.includes('auth') ||
    lowerPath.includes('guard') ||
    lowerPath.includes('crypto') ||
    lowerPath.includes('security') ||
    lowerPath.includes('jwt') ||
    lowerPath.includes('token')
  ) {
    return 'security';
  }

  if (
    lowerPath.includes('schema') ||
    lowerPath.includes('model') ||
    lowerPath.includes('entity') ||
    lowerPath.includes('migration') ||
    lowerPath.includes('/db/') ||
    allText.includes('drizzle') ||
    allText.includes('prisma') ||
    allText.includes('typeorm') ||
    allText.includes('postgres')
  ) {
    return 'database';
  }

  if (
    lowerPath.includes('gateway') ||
    lowerPath.includes('proxy') ||
    lowerPath.includes('nginx') ||
    lowerPath.includes('client') ||
    lowerPath.includes('fetch')
  ) {
    return 'gateway';
  }

  return 'service';
}

/**
 * Scan a single TypeScript or JavaScript file using TypeScript AST parser
 */
export function scanSourceFile(filePath: string, rootDir: string): ScannedASTNode | null {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');

    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true
    );

    const exportedSymbols: string[] = [];
    const importedModules: string[] = [];
    let methodCount = 0;

    function visit(node: ts.Node) {
      // Collect import declarations
      if (ts.isImportDeclaration(node)) {
        if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
          importedModules.push(node.moduleSpecifier.text);
        }
      }

      // Collect exported functions
      if (ts.isFunctionDeclaration(node) && node.name) {
        methodCount++;
        const isExported =
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
        if (isExported) {
          exportedSymbols.push(node.name.text);
        }
      }

      // Collect exported variable / const declarations (e.g. `export const authRouter = ...`)
      if (ts.isVariableStatement(node)) {
        const isExported =
          node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
        if (isExported) {
          node.declarationList.declarations.forEach((decl) => {
            if (ts.isIdentifier(decl.name)) {
              exportedSymbols.push(decl.name.text);
              methodCount++;
            }
          });
        }
      }

      // Collect classes and methods
      if (ts.isClassDeclaration(node)) {
        if (node.name) {
          exportedSymbols.push(node.name.text);
        }
        node.members.forEach((member) => {
          if (ts.isMethodDeclaration(member)) {
            methodCount++;
          }
        });
      }

      ts.forEachChild(node, visit);
    }

    visit(sourceFile);

    const totalLines = fileContent.split('\n').length;
    const kind = inferNodeKind(relativePath, exportedSymbols, importedModules);
    const label = path.basename(filePath, path.extname(filePath));

    // Summary calculation
    const summary = `${exportedSymbols.length > 0 ? `Exports: ${exportedSymbols.slice(0, 4).join(', ')}. ` : ''}${importedModules.length} dependencies linked.`;

    // First 15 lines as preview snippet
    const codeSnippet = fileContent.split('\n').slice(0, 15).join('\n');

    return {
      label: label.charAt(0).toUpperCase() + label.slice(1),
      kind,
      filePath: relativePath,
      summary,
      lines: `L1-L${totalLines}`,
      methodCount: Math.max(methodCount, 1),
      dependencyCount: importedModules.length,
      tags: exportedSymbols.length > 0 ? exportedSymbols : ['module', kind],
      codeSnippet,
      importedModules,
    };
  } catch (err) {
    console.warn(`[AST Scanner] Error scanning ${filePath}:`, err);
    return null;
  }
}

/**
 * Recursively find all supported code files (.ts, .tsx, .js, .jsx) in target directory
 */
function findCodeFiles(dir: string, baseDir = dir): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Ignore non-source folders
      if (['node_modules', '.git', 'dist', 'build', '.drizzle', '.turbo'].includes(entry.name)) {
        continue;
      }
      results = results.concat(findCodeFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (['.ts', '.tsx', '.js', '.jsx'].includes(ext) && !entry.name.endsWith('.d.ts')) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Scan directory and build the full AST Knowledge Graph (Nodes and Edges)
 */
export function scanCodebaseDirectory(targetDir: string): ScannedASTResult {
  const files = findCodeFiles(targetDir);
  const nodes: ScannedASTNode[] = [];
  const pathToNodeMap = new Map<string, ScannedASTNode>();

  for (const file of files) {
    const scanned = scanSourceFile(file, targetDir);
    if (scanned) {
      nodes.push(scanned);
      pathToNodeMap.set(scanned.filePath, scanned);
    }
  }

  // Resolve Edges based on relative imports
  const edges: ScannedASTResult['edges'] = [];

  for (const node of nodes) {
    const nodeDir = path.dirname(node.filePath);

    for (const imp of node.importedModules) {
      if (imp.startsWith('.')) {
        // Local relative import
        const resolvedPath = path.normalize(path.join(nodeDir, imp)).replace(/\\/g, '/');

        // Check matching node (exact or with extensions)
        const possibleMatches = [
          resolvedPath,
          `${resolvedPath}.ts`,
          `${resolvedPath}.tsx`,
          `${resolvedPath}.js`,
          `${resolvedPath}/index.ts`,
          `${resolvedPath}/index.js`,
        ];

        for (const match of possibleMatches) {
          if (pathToNodeMap.has(match) && match !== node.filePath) {
            edges.push({
              sourceFilePath: node.filePath,
              targetFilePath: match,
              relationType: 'imports',
              label: 'imports',
            });
            break;
          }
        }
      }
    }
  }

  return { nodes, edges };
}
