import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface GitCloneOptions {
  repoUrl: string;
  branch?: string;
  targetDir: string;
  token?: string | null;
}

/**
 * Format repository URL with auth token if provided (e.g. GitHub PAT or GitLab token)
 */
export function formatAuthenticatedGitUrl(repoUrl: string, token?: string | null): string {
  if (!token) return repoUrl;
  try {
    const parsed = new URL(repoUrl);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      parsed.username = 'oauth2';
      parsed.password = token;
      return parsed.toString();
    }
  } catch {
    // If it's an SSH URL or plain format, return as-is
  }
  return repoUrl;
}

/**
 * Resolves the working Git binary path on macOS / Linux.
 * Prefers CommandLineTools or Homebrew if system Xcode requires license acceptance.
 */
function getGitBinary(): string {
  if (fs.existsSync('/Library/Developer/CommandLineTools/usr/bin/git')) {
    return '/Library/Developer/CommandLineTools/usr/bin/git';
  }
  if (fs.existsSync('/opt/homebrew/bin/git')) {
    return '/opt/homebrew/bin/git';
  }
  if (fs.existsSync('/usr/local/bin/git')) {
    return '/usr/local/bin/git';
  }
  return 'git';
}

/**
 * Allowed Git subcommands strictly limited to read-only operations.
 * Any push, commit, tag creation, or remote modification is strictly blocked.
 */
const ALLOWED_GIT_READ_SUBCOMMANDS = new Set([
  'clone',
  'fetch',
  'checkout',
  'reset',
  'ls-remote',
  'rev-parse',
  'status',
  'log',
  'show',
  'diff',
  'branch',
]);

/**
 * Validates that git arguments are strictly read-only.
 * Prevents write, push, remote mutation, and hook execution.
 */
export function assertReadOnlyGitArgs(args: string[]): void {
  if (!args || args.length === 0) return;
  const subCmd = args[0].toLowerCase();

  // Explicitly block write commands
  const FORBIDDEN_COMMANDS = [
    'push',
    'commit',
    'tag',
    'merge',
    'rebase',
    'apply',
    'cherry-pick',
    'rm',
    'mv',
    'clean',
    'remote',
    'config',
  ];

  if (FORBIDDEN_COMMANDS.includes(subCmd)) {
    throw new Error(`[Security Enforcement] Git operation '${subCmd}' is strictly forbidden. Vintrix operates in read-only mode.`);
  }

  // Ensure subcommand is in allowlist
  if (!ALLOWED_GIT_READ_SUBCOMMANDS.has(subCmd)) {
    throw new Error(`[Security Enforcement] Unsupported or non-read-only Git operation: '${subCmd}'`);
  }

  // Check flags for any dangerous options
  for (const arg of args) {
    if (arg.startsWith('--upload-pack') || arg.startsWith('--receive-pack') || arg === '-c') {
      throw new Error(`[Security Enforcement] Prohibited Git flag detected: ${arg}`);
    }
  }
}

/**
 * Executes a Git command as a Promise.
 */
function runGit(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
  assertReadOnlyGitArgs(args);

  return new Promise((resolve, reject) => {
    const gitBin = getGitBinary();
    const child = spawn(gitBin, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0', // Don't hang on interactive auth
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString();
    });

    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString();
    });

    const proc = child as any;
    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`Git command failed with code ${code}: ${stderr || stdout}`));
      }
    });

    proc.on('error', (err: Error) => {
      reject(err);
    });
  });
}

/**
 * Clones or pulls a git repository into the specified target directory.
 * Uses shallow clone (depth 1) for speed and disk space efficiency.
 */
export async function syncGitRepository(opts: GitCloneOptions): Promise<string> {
  const { repoUrl, branch = 'main', targetDir, token } = opts;
  const authedUrl = formatAuthenticatedGitUrl(repoUrl, token);

  if (fs.existsSync(path.join(targetDir, '.git'))) {
    // Already cloned; fetch and reset/checkout the branch
    await runGit(['fetch', '--depth=1', 'origin', branch], targetDir);
    await runGit(['checkout', branch], targetDir);
    await runGit(['reset', '--hard', `origin/${branch}`], targetDir);
  } else {
    // Fresh shallow clone
    fs.mkdirSync(path.dirname(targetDir), { recursive: true });
    await runGit(['clone', '--depth=1', '--branch', branch, authedUrl, targetDir]);
  }

  return targetDir;
}

/**
 * Validates Git repository accessibility and credentials using `git ls-remote`.
 * Fast and doesn't download repo contents.
 */
export async function testGitConnection(params: {
  repoUrl: string;
  branch?: string;
  token?: string;
}): Promise<{ success: boolean; error?: string; branches?: string[] }> {
  const { repoUrl, branch, token } = params;
  const authedUrl = formatAuthenticatedGitUrl(repoUrl, token);

  try {
    const { stdout } = await runGit(['ls-remote', '--heads', authedUrl]);
    const lines = stdout.split('\n').filter(Boolean);
    const branches = lines
      .map((line) => {
        const parts = line.split('\trefs/heads/');
        return parts[1];
      })
      .filter((b): b is string => Boolean(b));

    if (branch && branches.length > 0) {
      const branchExists = branches.includes(branch);
      if (!branchExists) {
        return {
          success: false,
          error: `Branch '${branch}' was not found in remote repository. Available branches: ${branches.slice(0, 5).join(', ')}`,
          branches,
        };
      }
    }

    return {
      success: true,
      branches,
    };
  } catch (err: any) {
    const rawMsg = err.message || '';
    if (rawMsg.includes('Authentication failed') || rawMsg.includes('could not read Username')) {
      return { success: false, error: 'Authentication failed. Please verify your Access Token.' };
    }
    if (rawMsg.includes('Repository not found') || rawMsg.includes('not found')) {
      return { success: false, error: 'Repository not found. Check the URL or verify token access permissions.' };
    }
    return { success: false, error: rawMsg.replace(/https:\/\/[^@]+@/, 'https://') };
  }
}

