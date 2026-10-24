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
 * Executes a Git command as a Promise.
 */
function runGit(args: string[], cwd?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
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
