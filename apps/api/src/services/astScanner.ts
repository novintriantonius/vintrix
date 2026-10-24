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
  exportedSymbols: string[];
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
    lowerPath.includes('token') ||
    lowerPath.includes('middleware')
  ) {
    return 'security';
  }

  if (
    lowerPath.includes('schema') ||
    lowerPath.includes('model') ||
    lowerPath.includes('entity') ||
    lowerPath.includes('migration') ||
    lowerPath.includes('repository') ||
    lowerPath.includes('/db/') ||
    allText.includes('drizzle') ||
    allText.includes('prisma') ||
    allText.includes('typeorm') ||
    allText.includes('postgres') ||
    allText.includes('gorm') ||
    allText.includes('sqlalchemy') ||
    allText.includes('diesel')
  ) {
    return 'database';
  }

  if (
    lowerPath.includes('gateway') ||
    lowerPath.includes('proxy') ||
    lowerPath.includes('nginx') ||
    lowerPath.includes('client') ||
    lowerPath.includes('fetch') ||
    lowerPath.includes('http')
  ) {
    return 'gateway';
  }

  return 'service';
}

/**
 * Extract symbols and imports from Python source files (.py)
 */
function scanPythonFile(fileContent: string): {
  exportedSymbols: string[];
  importedModules: string[];
  methodCount: number;
} {
  const exportedSymbols: string[] = [];
  const importedModules: string[] = [];
  let methodCount = 0;

  const lines = fileContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // Def function
    const defMatch = trimmed.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
    if (defMatch) {
      methodCount++;
      if (!defMatch[1].startsWith('_')) {
        exportedSymbols.push(defMatch[1]);
      }
    }

    // Class definition
    const classMatch = trimmed.match(/^class\s+([a-zA-Z0-9_]+)/);
    if (classMatch) {
      if (!classMatch[1].startsWith('_')) {
        exportedSymbols.push(classMatch[1]);
      }
    }

    // Imports: import foo / from foo import bar
    const importMatch = trimmed.match(/^import\s+([a-zA-Z0-9_.,\s]+)/);
    if (importMatch) {
      const mods = importMatch[1].split(',').map((m) => m.trim().split(' ')[0]);
      importedModules.push(...mods);
    }
    const fromImportMatch = trimmed.match(/^from\s+([a-zA-Z0-9_.]+)\s+import/);
    if (fromImportMatch) {
      importedModules.push(fromImportMatch[1]);
    }
  }

  return { exportedSymbols, importedModules, methodCount };
}

/**
 * Extract symbols and imports from Go source files (.go)
 */
function scanGoFile(fileContent: string): {
  exportedSymbols: string[];
  importedModules: string[];
  methodCount: number;
} {
  const exportedSymbols: string[] = [];
  const importedModules: string[] = [];
  let methodCount = 0;

  const lines = fileContent.split('\n');
  let inImportBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Multi-line import block
    if (trimmed === 'import (') {
      inImportBlock = true;
      continue;
    }
    if (inImportBlock) {
      if (trimmed === ')') {
        inImportBlock = false;
        continue;
      }
      const impMatch = trimmed.match(/"([^"]+)"/);
      if (impMatch) importedModules.push(impMatch[1]);
      continue;
    }

    // Single-line import
    const singleImp = trimmed.match(/^import\s+"([^"]+)"/);
    if (singleImp) {
      importedModules.push(singleImp[1]);
    }

    // Functions & methods: func Foo(...) or func (r *Receiver) Foo(...)
    const funcMatch = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(/);
    if (funcMatch) {
      methodCount++;
      const name = funcMatch[1];
      // In Go, exported symbols start with an uppercase letter
      if (/^[A-Z]/.test(name)) {
        exportedSymbols.push(name);
      }
    }

    // Struct / Interface type definitions
    const typeMatch = trimmed.match(/^type\s+([A-Za-z0-9_]+)\s+(?:struct|interface)/);
    if (typeMatch) {
      const name = typeMatch[1];
      if (/^[A-Z]/.test(name)) {
        exportedSymbols.push(name);
      }
    }
  }

  return { exportedSymbols, importedModules, methodCount };
}

/**
 * Extract symbols and imports from Rust source files (.rs)
 */
function scanRustFile(fileContent: string): {
  exportedSymbols: string[];
  importedModules: string[];
  methodCount: number;
} {
  const exportedSymbols: string[] = [];
  const importedModules: string[] = [];
  let methodCount = 0;

  const lines = fileContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();

    // use declarations: use crate::foo::Bar; or pub use ...
    const useMatch = trimmed.match(/^(?:pub\s+)?use\s+([^;]+);/);
    if (useMatch) {
      importedModules.push(useMatch[1].trim());
    }

    // Public functions: pub fn foo(...) or fn foo(...)
    const fnMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?fn\s+([a-zA-Z0-9_]+)\s*(?:<[^>]+>)?\s*\(/);
    if (fnMatch) {
      methodCount++;
      if (trimmed.startsWith('pub ')) {
        exportedSymbols.push(fnMatch[1]);
      }
    }

    // Struct / Enum / Trait
    const structMatch = trimmed.match(/^(?:pub(?:\([^)]+\))?\s+)?(?:struct|enum|trait)\s+([a-zA-Z0-9_]+)/);
    if (structMatch) {
      if (trimmed.startsWith('pub ')) {
        exportedSymbols.push(structMatch[1]);
      }
    }
  }

  return { exportedSymbols, importedModules, methodCount };
}

/**
 * Scan a single code file (TypeScript, JavaScript, Python, Go, Rust)
 */
export function scanSourceFile(filePath: string, rootDir: string): ScannedASTNode | null {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).toLowerCase();

    let exportedSymbols: string[] = [];
    let importedModules: string[] = [];
    let methodCount = 0;

    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) {
      const sourceFile = ts.createSourceFile(
        filePath,
        fileContent,
        ts.ScriptTarget.Latest,
        true
      );

      function visit(node: ts.Node) {
        if (ts.isImportDeclaration(node)) {
          if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
            importedModules.push(node.moduleSpecifier.text);
          }
        }
        if (ts.isFunctionDeclaration(node) && node.name) {
          methodCount++;
          const isExported =
            node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
          if (isExported) exportedSymbols.push(node.name.text);
        }
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
        if (ts.isClassDeclaration(node)) {
          if (node.name) exportedSymbols.push(node.name.text);
          node.members.forEach((member) => {
            if (ts.isMethodDeclaration(member)) methodCount++;
          });
        }
        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
    } else if (ext === '.py') {
      const py = scanPythonFile(fileContent);
      exportedSymbols = py.exportedSymbols;
      importedModules = py.importedModules;
      methodCount = py.methodCount;
    } else if (ext === '.go') {
      const go = scanGoFile(fileContent);
      exportedSymbols = go.exportedSymbols;
      importedModules = go.importedModules;
      methodCount = go.methodCount;
    } else if (ext === '.rs') {
      const rs = scanRustFile(fileContent);
      exportedSymbols = rs.exportedSymbols;
      importedModules = rs.importedModules;
      methodCount = rs.methodCount;
    }

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
      exportedSymbols,
    };
  } catch (err) {
    console.warn(`[AST Scanner] Error scanning ${filePath}:`, err);
    return null;
  }
}

/**
 * Recursively find all supported code files (.ts, .tsx, .js, .jsx, .py, .go, .rs) in target directory
 */
const SUPPORTED_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.py',
  '.go',
  '.rs',
]);

function findCodeFiles(dir: string, baseDir = dir): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Ignore non-source folders
      if (
        [
          'node_modules',
          '.git',
          'dist',
          'build',
          '.drizzle',
          '.turbo',
          '__pycache__',
          '.pytest_cache',
          'venv',
          '.venv',
          'target',
        ].includes(entry.name)
      ) {
        continue;
      }
      results = results.concat(findCodeFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      if (SUPPORTED_EXTENSIONS.has(ext) && !entry.name.endsWith('.d.ts')) {
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

        // Check matching node (exact or with multi-language extensions)
        const possibleMatches = [
          resolvedPath,
          `${resolvedPath}.ts`,
          `${resolvedPath}.tsx`,
          `${resolvedPath}.js`,
          `${resolvedPath}.jsx`,
          `${resolvedPath}.py`,
          `${resolvedPath}.go`,
          `${resolvedPath}.rs`,
          `${resolvedPath}/index.ts`,
          `${resolvedPath}/index.js`,
          `${resolvedPath}/__init__.py`,
          `${resolvedPath}/mod.rs`,
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
