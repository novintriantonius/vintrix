import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Node type aligned with Understand Anything philosophy:
 * - file: standard source code files (.ts, .js, .py, .go, etc.)
 * - function: extracted significant function sub-node
 * - class: extracted significant class sub-node
 * - config: configuration files (.json, .yaml, .toml, .env*)
 * - document: documentation files (.md, .txt)
 * - service: infra files (Dockerfile, docker-compose)
 * - pipeline: CI/CD files (.github/workflows, Jenkinsfile)
 * - schema: data schema files (.sql, .graphql, .proto, .prisma)
 * - endpoint: OpenAPI/Swagger API specs
 * - resource: Infrastructure as Code (*.tf, CloudFormation)
 */
export type GraphNodeType =
  | 'file'
  | 'function'
  | 'class'
  | 'config'
  | 'document'
  | 'service'
  | 'pipeline'
  | 'schema'
  | 'endpoint'
  | 'resource'
  | 'module';

export interface SignificantEntity {
  name: string;
  type: 'function' | 'class';
  lineStart: number;
  lineEnd: number;
  snippet: string;
}

export interface ScannedFileDetail {
  node: ScannedASTNode;
  significantEntities: SignificantEntity[];
}

export interface ScannedASTNode {
  id?: string;
  label: string;
  /** Architectural role for visual grouping/coloring */
  kind: 'controller' | 'service' | 'database' | 'security' | 'gateway';
  /** Semantic node type for graph layout and rendering */
  nodeType: GraphNodeType;
  /** Unique key for graph referencing: either filePath or filePath#entityName */
  nodeKey: string;
  /** Whether this is a sub-node (function/class) of a parent file node */
  parentFilePath?: string;
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
    sourceNodeKey: string;
    targetNodeKey: string;
    relationType: 'calls' | 'imports' | 'implements' | 'depends_on' | 'contains';
    label?: string;
  }[];
  /** Total files scanned regardless of whether they were rendered as graph nodes */
  totalIndexedFiles: number;
}

/**
 * Infer the semantic GraphNodeType based on file path, name, and extension
 */
function inferGraphNodeType(filePath: string): GraphNodeType {
  const lower = filePath.toLowerCase();
  const basename = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  // Pipeline: CI/CD configs
  if (
    lower.includes('/.github/workflows/') ||
    lower.includes('/.gitlab-ci') ||
    basename === 'Jenkinsfile' ||
    lower.includes('/.circleci/') ||
    lower.includes('/bitbucket-pipelines.yml')
  ) return 'pipeline';

  // Service: Dockerfile, docker-compose, K8s manifests
  if (
    basename.startsWith('Dockerfile') ||
    basename.startsWith('docker-compose') ||
    lower.includes('/k8s/') ||
    lower.includes('/kubernetes/')
  ) return 'service';

  // Resource: Terraform, CloudFormation
  if (ext === '.tf' || ext === '.tfvars' || lower.includes('cloudformation')) return 'resource';

  // Schema: SQL, GraphQL, Protobuf, Prisma
  if (['.sql', '.graphql', '.gql', '.proto', '.prisma'].includes(ext)) return 'schema';

  // Document: Markdown, txt, rst
  if (['.md', '.mdx', '.txt', '.rst'].includes(ext)) return 'document';

  // Config: JSON, YAML, TOML, env files, config files
  if (
    ['.json', '.yaml', '.yml', '.toml', '.ini', '.env'].includes(ext) ||
    basename.startsWith('.env') ||
    basename === 'Makefile' ||
    ['.eslintrc', '.prettierrc', '.babelrc'].some(rc => basename.includes(rc))
  ) return 'config';

  // Default: standard code file
  return 'file';
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
 * Scan a single code file and extract high-level file metadata + significant entities (functions, classes)
 */
export function scanSourceFile(filePath: string, rootDir: string): ScannedFileDetail | null {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    const ext = path.extname(filePath).toLowerCase();

    let exportedSymbols: string[] = [];
    let importedModules: string[] = [];
    let methodCount = 0;
    const significantEntities: SignificantEntity[] = [];

    const lines = fileContent.split('\n');
    const totalLines = lines.length;

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
          if (isExported) {
            exportedSymbols.push(node.name.text);
            const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
            const snippet = lines.slice(startLine, Math.min(startLine + 10, endLine + 1)).join('\n');
            significantEntities.push({
              name: node.name.text,
              type: 'function',
              lineStart: startLine + 1,
              lineEnd: endLine + 1,
              snippet,
            });
          }
        }
        if (ts.isVariableStatement(node)) {
          const isExported =
            node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
          if (isExported) {
            node.declarationList.declarations.forEach((decl) => {
              if (ts.isIdentifier(decl.name)) {
                exportedSymbols.push(decl.name.text);
                methodCount++;
                if (decl.initializer && (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))) {
                  const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(decl.getStart());
                  const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(decl.getEnd());
                  const snippet = lines.slice(startLine, Math.min(startLine + 10, endLine + 1)).join('\n');
                  significantEntities.push({
                    name: decl.name.text,
                    type: 'function',
                    lineStart: startLine + 1,
                    lineEnd: endLine + 1,
                    snippet,
                  });
                }
              }
            });
          }
        }
        if (ts.isClassDeclaration(node)) {
          if (node.name) {
            exportedSymbols.push(node.name.text);
            const { line: startLine } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            const { line: endLine } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
            const snippet = lines.slice(startLine, Math.min(startLine + 10, endLine + 1)).join('\n');
            significantEntities.push({
              name: node.name.text,
              type: 'class',
              lineStart: startLine + 1,
              lineEnd: endLine + 1,
              snippet,
            });
          }
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
      // Extract top level python defs / classes
      lines.forEach((l, idx) => {
        const fnMatch = l.match(/^def\s+([a-zA-Z0-9_]+)\s*\(/);
        if (fnMatch && !fnMatch[1].startsWith('_')) {
          significantEntities.push({
            name: fnMatch[1],
            type: 'function',
            lineStart: idx + 1,
            lineEnd: idx + 15,
            snippet: lines.slice(idx, idx + 10).join('\n'),
          });
        }
        const clsMatch = l.match(/^class\s+([a-zA-Z0-9_]+)/);
        if (clsMatch && !clsMatch[1].startsWith('_')) {
          significantEntities.push({
            name: clsMatch[1],
            type: 'class',
            lineStart: idx + 1,
            lineEnd: idx + 20,
            snippet: lines.slice(idx, idx + 10).join('\n'),
          });
        }
      });
    } else if (ext === '.go') {
      const go = scanGoFile(fileContent);
      exportedSymbols = go.exportedSymbols;
      importedModules = go.importedModules;
      methodCount = go.methodCount;
      lines.forEach((l, idx) => {
        const fnMatch = l.match(/^func\s+(?:\([^)]+\)\s+)?([A-Z][a-zA-Z0-9_]*)\s*\(/);
        if (fnMatch) {
          significantEntities.push({
            name: fnMatch[1],
            type: 'function',
            lineStart: idx + 1,
            lineEnd: idx + 15,
            snippet: lines.slice(idx, idx + 10).join('\n'),
          });
        }
        const structMatch = l.match(/^type\s+([A-Z][a-zA-Z0-9_]*)\s+(?:struct|interface)/);
        if (structMatch) {
          significantEntities.push({
            name: structMatch[1],
            type: 'class',
            lineStart: idx + 1,
            lineEnd: idx + 15,
            snippet: lines.slice(idx, idx + 10).join('\n'),
          });
        }
      });
    } else if (ext === '.rs') {
      const rs = scanRustFile(fileContent);
      exportedSymbols = rs.exportedSymbols;
      importedModules = rs.importedModules;
      methodCount = rs.methodCount;
      lines.forEach((l, idx) => {
        const fnMatch = l.match(/^pub\s+fn\s+([a-zA-Z0-9_]+)/);
        if (fnMatch) {
          significantEntities.push({
            name: fnMatch[1],
            type: 'function',
            lineStart: idx + 1,
            lineEnd: idx + 15,
            snippet: lines.slice(idx, idx + 10).join('\n'),
          });
        }
        const structMatch = l.match(/^pub\s+(?:struct|enum|trait)\s+([a-zA-Z0-9_]+)/);
        if (structMatch) {
          significantEntities.push({
            name: structMatch[1],
            type: 'class',
            lineStart: idx + 1,
            lineEnd: idx + 15,
            snippet: lines.slice(idx, idx + 10).join('\n'),
          });
        }
      });
    } else if (ext === '.php') {
      // PHP Scanner for Laravel / Symfony / WordPress
      lines.forEach((l, idx) => {
        // Classes, Interfaces, Traits
        const clsMatch = l.match(/(?:abstract\s+|final\s+)?(?:class|interface|trait)\s+([a-zA-Z0-9_]+)/i);
        if (clsMatch) {
          exportedSymbols.push(clsMatch[1]);
          significantEntities.push({
            name: clsMatch[1],
            type: 'class',
            lineStart: idx + 1,
            lineEnd: Math.min(idx + 25, totalLines),
            snippet: lines.slice(idx, idx + 10).join('\n'),
          });
        }
        // Public Functions/Methods
        const fnMatch = l.match(/(?:public\s+)?function\s+([a-zA-Z0-9_]+)\s*\(/i);
        if (fnMatch) {
          methodCount++;
          const fnName = fnMatch[1];
          if (!fnName.startsWith('__')) {
            exportedSymbols.push(fnName);
            if (fnName !== 'construct' && fnName !== 'destruct') {
              significantEntities.push({
                name: fnName,
                type: 'function',
                lineStart: idx + 1,
                lineEnd: Math.min(idx + 20, totalLines),
                snippet: lines.slice(idx, idx + 10).join('\n'),
              });
            }
          }
        }
        // Namespace & Use / Require
        const useMatch = l.match(/use\s+([^;]+);/i);
        if (useMatch) {
          importedModules.push(useMatch[1].trim());
        }
      });
    } else {
      // Generic scanner for other code, config, script, and markup files
      for (const line of lines) {
        const trimmed = line.trim();
        const impMatch = trimmed.match(/(?:import|require|include|from|source|\. )\s+['"]?([^'"\s;]+)['"]?/i);
        if (impMatch && impMatch[1]) {
          importedModules.push(impMatch[1]);
        }
      }
      exportedSymbols = [path.basename(filePath)];
      methodCount = 1;
    }

    const kind = inferNodeKind(relativePath, exportedSymbols, importedModules);
    const nodeType = inferGraphNodeType(relativePath);
    const label = path.basename(filePath, path.extname(filePath));

    // Summary calculation
    const summary = `${exportedSymbols.length > 0 ? `Exports: ${exportedSymbols.slice(0, 4).join(', ')}. ` : ''}${importedModules.length} dependencies linked.`;

    // First 15 lines as preview snippet
    const codeSnippet = lines.slice(0, 15).join('\n');

    return {
      node: {
        label: label.charAt(0).toUpperCase() + label.slice(1),
        kind,
        nodeType,
        nodeKey: relativePath,
        filePath: relativePath,
        summary,
        lines: `L1-L${totalLines}`,
        methodCount: Math.max(methodCount, 1),
        dependencyCount: importedModules.length,
        tags: exportedSymbols.length > 0 ? exportedSymbols : ['module', kind],
        codeSnippet,
        importedModules,
        exportedSymbols,
      },
      significantEntities,
    };
  } catch (err) {
    console.warn(`[AST Scanner] Error scanning ${filePath}:`, err);
    return null;
  }
}

/**
 * Supported file extensions for full codebase architecture indexing
 */
const SUPPORTED_EXTENSIONS = new Set([
  // JavaScript & TypeScript
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  // Backend & Systems
  '.py', '.go', '.rs', '.java', '.kt', '.c', '.cpp', '.h', '.hpp', '.cs', '.php', '.rb',
  // Web & UI
  '.html', '.css', '.scss', '.vue', '.svelte',
  // Configuration, Schemas & Scripts
  '.json', '.yaml', '.yml', '.toml', '.sql', '.sh', '.env.example', '.md'
]);

export function findCodeFiles(dir: string, baseDir = dir): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    const lowerName = entry.name.toLowerCase();

    // Never index credentials, private keys, secrets or environment files with secrets
    if (
      lowerName === '.env' ||
      (lowerName.startsWith('.env.') && !lowerName.endsWith('.example')) ||
      lowerName.endsWith('.key') ||
      lowerName.endsWith('.pem') ||
      lowerName.endsWith('.crt') ||
      lowerName.endsWith('.id_rsa') ||
      lowerName.endsWith('.id_ed25519') ||
      lowerName.endsWith('.p12') ||
      lowerName.endsWith('.pfx') ||
      lowerName.includes('credentials') ||
      lowerName.includes('id_rsa') ||
      lowerName.includes('id_ecdsa')
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      // Ignore dependencies, build artifacts, framework runtime storage/cache and VCS
      if (
        [
          'node_modules',
          '.git',
          '.ssh',
          'dist',
          'build',
          '.drizzle',
          '.turbo',
          '__pycache__',
          '.pytest_cache',
          'venv',
          '.venv',
          'target',
          '.next',
          '.cache',
          'vendor',
        ].includes(entry.name)
      ) {
        continue;
      }

      // Check full path for specific ignored subdirectories (like storage/framework, bootstrap/cache)
      const normPath = fullPath.replace(/\\/g, '/');
      if (
        normPath.includes('/storage/framework') ||
        normPath.includes('/storage/logs') ||
        normPath.includes('/storage/debugbar') ||
        normPath.includes('/bootstrap/cache')
      ) {
        continue;
      }
      results = results.concat(findCodeFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name).toLowerCase();
      const isNamedConfigFile =
        entry.name.startsWith('Dockerfile') ||
        entry.name.startsWith('Makefile') ||
        entry.name === '.env.example';
      if ((SUPPORTED_EXTENSIONS.has(ext) && !entry.name.endsWith('.d.ts')) || isNamedConfigFile) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Extract logical Domain / Module from a relative file path.
 * Examples:
 * - app/Http/Controllers/Api/Auth/... -> Auth Domain (or Controllers)
 * - app/Models/Order.php -> Order Domain / Models
 * - apps/api/src/routes/sources.ts -> Sources Module
 * - src/services/astScanner.ts -> Services Module
 */
export function inferDomainOrModule(filePath: string): {
  domainKey: string;
  domainLabel: string;
  kind: 'controller' | 'service' | 'database' | 'security' | 'gateway';
  nodeType: GraphNodeType;
} {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);

  // Common root prefixes to skip (src, app, apps/..., packages/...)
  let startIndex = 0;
  if (parts[0] === 'apps' || parts[0] === 'packages') {
    startIndex = 2; // skip apps/api or packages/core
  }
  if (parts[startIndex] === 'src' || parts[startIndex] === 'app') {
    startIndex++;
  }

  const remainingParts = parts.slice(startIndex);
  const primaryFolder = remainingParts.length > 1 ? remainingParts[0] : (remainingParts.length === 1 ? 'core' : 'root');
  const subFolder = remainingParts.length > 2 ? remainingParts[1] : null;

  // Identify meaningful domain
  let domainKey = primaryFolder.toLowerCase();
  let domainLabel = primaryFolder.charAt(0).toUpperCase() + primaryFolder.slice(1);

  if (subFolder && ['controllers', 'routes', 'api', 'modules', 'features', 'services'].includes(primaryFolder.toLowerCase())) {
    domainKey = `${primaryFolder}_${subFolder}`.toLowerCase();
    domainLabel = `${subFolder.charAt(0).toUpperCase() + subFolder.slice(1)} ${primaryFolder.slice(0, -1).toUpperCase()}`;
  }

  // Infer architectural kind
  const lower = normalized.toLowerCase();
  let kind: 'controller' | 'service' | 'database' | 'security' | 'gateway' = 'service';
  let nodeType: GraphNodeType = 'module';

  if (lower.includes('auth') || lower.includes('security') || lower.includes('jwt') || lower.includes('middleware') || lower.includes('guard')) {
    kind = 'security';
    nodeType = 'service';
  } else if (lower.includes('controller') || lower.includes('route') || lower.includes('endpoint') || lower.includes('api')) {
    kind = 'controller';
    nodeType = 'endpoint';
  } else if (lower.includes('model') || lower.includes('schema') || lower.includes('db') || lower.includes('repository') || lower.includes('migration') || lower.includes('database')) {
    kind = 'database';
    nodeType = 'schema';
  } else if (lower.includes('gateway') || lower.includes('client') || lower.includes('http') || lower.includes('proxy')) {
    kind = 'gateway';
    nodeType = 'service';
  } else if (lower.includes('config') || lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    nodeType = 'config';
  }

  return { domainKey, domainLabel, kind, nodeType };
}

/**
 * Scan directory and build the full AST Knowledge Graph (Nodes and Edges).
 * Following the Domain / Module Architecture paradigm:
 * - ALL files are scanned and indexed for deep knowledge search and symbol indexing.
 * - However, on the graph canvas, files and internal functions are grouped into clean
 *   Domain / Architectural Module nodes (e.g. Auth, Order, Database, API Routing),
 *   producing ~15-35 high-level architectural nodes with cross-domain dependency edges.
 */
export async function scanCodebaseDirectory(
  targetDir: string,
  onProgress?: (current: number, total: number, filePath: string) => void | Promise<void>
): Promise<ScannedASTResult> {
  const files = findCodeFiles(targetDir);
  const totalFiles = files.length;

  const scannedDetails: ScannedFileDetail[] = [];
  const fileDetailMap = new Map<string, ScannedFileDetail>();

  // 1. Scan and index all files for symbols and dependencies
  for (let i = 0; i < totalFiles; i++) {
    const file = files[i];
    const scanned = scanSourceFile(file, targetDir);
    if (scanned) {
      scannedDetails.push(scanned);
      fileDetailMap.set(scanned.node.filePath, scanned);
    }
    if (onProgress) {
      const relPath = path.relative(targetDir, file).replace(/\\/g, '/');
      await onProgress(i + 1, totalFiles, relPath);
    }
  }

  // 2. Aggregate files by Architectural Domain / Module
  interface DomainBucket {
    domainKey: string;
    domainLabel: string;
    kind: 'controller' | 'service' | 'database' | 'security' | 'gateway';
    nodeType: GraphNodeType;
    files: ScannedFileDetail[];
    exportedSymbols: Set<string>;
    importedModules: Set<string>;
    totalLines: number;
    totalMethods: number;
  }

  const domainMap = new Map<string, DomainBucket>();
  const fileToDomainMap = new Map<string, string>(); // filePath -> domainKey

  for (const detail of scannedDetails) {
    const filePath = detail.node.filePath;
    const lowerPath = filePath.toLowerCase();

    // Ignore cache & temporary runtime files
    if (
      lowerPath.includes('storage/framework') ||
      lowerPath.includes('storage/logs') ||
      lowerPath.includes('storage/debugbar') ||
      lowerPath.includes('bootstrap/cache')
    ) {
      continue;
    }

    const { domainKey, domainLabel, kind, nodeType } = inferDomainOrModule(filePath);
    fileToDomainMap.set(filePath, domainKey);

    if (!domainMap.has(domainKey)) {
      domainMap.set(domainKey, {
        domainKey,
        domainLabel,
        kind,
        nodeType,
        files: [],
        exportedSymbols: new Set<string>(),
        importedModules: new Set<string>(),
        totalLines: 0,
        totalMethods: 0,
      });
    }

    const bucket = domainMap.get(domainKey)!;
    bucket.files.push(detail);
    detail.node.exportedSymbols.forEach((s) => bucket.exportedSymbols.add(s));
    detail.node.importedModules.forEach((m) => bucket.importedModules.add(m));
    bucket.totalMethods += detail.node.methodCount;
  }

  // 3. Build Curated Graph Nodes (1 Node per Domain / Module)
  const nodes: ScannedASTNode[] = [];
  const edges: ScannedASTResult['edges'] = [];
  const domainKeySet = new Set<string>();

  for (const bucket of domainMap.values()) {
    if (bucket.files.length === 0) continue;

    const fileCount = bucket.files.length;
    const sampleExports = Array.from(bucket.exportedSymbols).slice(0, 6);
    const sampleFiles = bucket.files.slice(0, 4).map((f) => path.basename(f.node.filePath));

    const domainNode: ScannedASTNode = {
      label: bucket.domainLabel,
      kind: bucket.kind,
      nodeType: bucket.nodeType,
      nodeKey: `module:${bucket.domainKey}`,
      filePath: bucket.files[0]?.node.filePath || bucket.domainKey,
      summary: `Domain module with ${fileCount} files (${sampleFiles.join(', ')}). Exports: ${sampleExports.length > 0 ? sampleExports.join(', ') : 'Internal module logic'}.`,
      lines: `${fileCount} source files`,
      methodCount: Math.max(bucket.totalMethods, fileCount),
      dependencyCount: bucket.importedModules.size,
      tags: [bucket.domainKey, `${fileCount} files`, bucket.kind, ...sampleExports.slice(0, 3)],
      codeSnippet: bucket.files[0]?.node.codeSnippet || `// Domain Module: ${bucket.domainLabel}\n// Contains ${fileCount} files`,
      importedModules: Array.from(bucket.importedModules),
      exportedSymbols: sampleExports,
    };

    nodes.push(domainNode);
    domainKeySet.add(bucket.domainKey);
  }

  // 4. Build Cross-Domain Dependency Edges
  const edgeCountMap = new Map<string, number>();

  for (const detail of scannedDetails) {
    const sourceDomain = fileToDomainMap.get(detail.node.filePath);
    if (!sourceDomain) continue;

    const nodeDir = path.dirname(detail.node.filePath);

    for (const imp of detail.node.importedModules) {
      if (imp.startsWith('.')) {
        const resolvedPath = path.normalize(path.join(nodeDir, imp)).replace(/\\/g, '/');
        const possibleMatches = [
          resolvedPath,
          `${resolvedPath}.ts`,
          `${resolvedPath}.tsx`,
          `${resolvedPath}.js`,
          `${resolvedPath}.jsx`,
          `${resolvedPath}.py`,
          `${resolvedPath}.go`,
          `${resolvedPath}.rs`,
          `${resolvedPath}.php`,
          `${resolvedPath}/index.ts`,
          `${resolvedPath}/index.js`,
          `${resolvedPath}/__init__.py`,
        ];

        for (const match of possibleMatches) {
          const targetDetail = fileDetailMap.get(match);
          if (targetDetail) {
            const targetDomain = fileToDomainMap.get(targetDetail.node.filePath);
            if (targetDomain && targetDomain !== sourceDomain) {
              const edgeKey = `${sourceDomain}->${targetDomain}`;
              edgeCountMap.set(edgeKey, (edgeCountMap.get(edgeKey) || 0) + 1);
            }
            break;
          }
        }
      }
    }
  }

  // Create clean aggregated edges between domain nodes
  for (const [edgeKey, count] of edgeCountMap.entries()) {
    const [sourceDomain, targetDomain] = edgeKey.split('->');
    if (domainKeySet.has(sourceDomain) && domainKeySet.has(targetDomain)) {
      edges.push({
        sourceNodeKey: `module:${sourceDomain}`,
        targetNodeKey: `module:${targetDomain}`,
        relationType: 'depends_on',
        label: `${count} dependencies`,
      });
    }
  }

  return {
    nodes,
    edges,
    totalIndexedFiles: totalFiles,
  };
}
