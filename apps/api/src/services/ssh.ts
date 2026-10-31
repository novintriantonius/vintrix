import { Client, type ConnectConfig, type SFTPWrapper } from 'ssh2';
import fs from 'node:fs';
import path from 'node:path';

export interface SSHConnectOptions {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface RemoteDirEntry {
  name: string;
  type: 'file' | 'directory' | 'symlink';
  size: number;
  modifiedAt: string;
  permissions: string;
}

function buildConfig(opts: SSHConnectOptions): ConnectConfig {
  const cfg: ConnectConfig = {
    host: opts.host,
    port: opts.port,
    username: opts.username,
    readyTimeout: 10_000,
  };
  if (opts.privateKey) {
    cfg.privateKey = opts.privateKey;
    if (opts.passphrase) cfg.passphrase = opts.passphrase;
  } else if (opts.password) {
    cfg.password = opts.password;
  }
  return cfg;
}

/** Opens an SSH connection and resolves with the Client when ready. */
function openConnection(opts: SSHConnectOptions): Promise<Client> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => resolve(conn))
      .on('error', reject)
      .connect(buildConfig(opts));
  });
}

/** Test connectivity — resolves true or rejects with error message. */
export async function testSSHConnection(opts: SSHConnectOptions): Promise<true> {
  const conn = await openConnection(opts);
  conn.end();
  return true;
}

/** Resolve remote path: if path is root '/' and not accessible, fallback to home dir via pwd. */
async function resolveRemotePath(_sftp: SFTPWrapper, conn: Client, requestedPath: string): Promise<string> {
  // If not root, use as-is
  if (requestedPath && requestedPath !== '/') return requestedPath;

  // Try to get the home directory via exec pwd
  return new Promise<string>((resolve) => {
    (conn as any).exec('pwd', (err: any, stream: any) => {
      if (err) return resolve(requestedPath);
      let output = '';
      stream.on('data', (d: any) => (output += d.toString()));
      stream.stderr.on('data', () => {});
      stream.on('close', () => {
        const home = output.trim();
        resolve(home && home !== '' ? home : requestedPath);
      });
    });
  });
}

/** List directory contents via SFTP. Falls back to home dir if root is not accessible. */
export async function listRemoteDirectory(
  opts: SSHConnectOptions,
  remotePath: string,
): Promise<{ entries: RemoteDirEntry[]; resolvedPath: string }> {
  const conn = await openConnection(opts);

  try {
    const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      conn.sftp((err, sftpWrapper) => {
        if (err) return reject(err);
        resolve(sftpWrapper);
      });
    });

    // Resolve actual path (handles root-inaccessible servers)
    const targetPath = await resolveRemotePath(sftp, conn, remotePath || '/');

    const entries = await new Promise<RemoteDirEntry[]>((resolve, reject) => {
      sftp.readdir(targetPath, (err: Error | undefined, list: any[]) => {
        if (err) {
          return reject(new Error(`No such file or directory: ${targetPath}`));
        }
        resolve(
          list.map((item) => ({
            name: item.filename,
            type: item.attrs.isDirectory()
              ? 'directory'
              : item.attrs.isSymbolicLink()
                ? 'symlink'
                : 'file',
            size: item.attrs.size,
            modifiedAt: new Date(item.attrs.mtime * 1000).toISOString(),
            permissions: item.longname.substring(0, 10),
          })),
        );
      });
    });

    return { entries, resolvedPath: targetPath };
  } finally {
    conn.end();
  }
}

/**
 * Downloads a remote directory tree to a local destination directory via SFTP.
 * Selectively ignores common non-code folders like node_modules, .git, dist.
 */
export async function syncRemoteSSHDirectory(
  opts: SSHConnectOptions,
  remoteDir: string,
  localTargetDir: string,
  maxFiles = 5000,
): Promise<{ filesDownloaded: number; targetDir: string }> {
  const conn = await openConnection(opts);
  let filesDownloaded = 0;

  try {
    const sftp = await new Promise<SFTPWrapper>((resolve, reject) => {
      conn.sftp((err, sftpWrapper) => {
        if (err) return reject(err);
        resolve(sftpWrapper);
      });
    });

    // Resolve home dir if root path given
    const resolvedRemoteDir = await resolveRemotePath(sftp, conn, remoteDir || '/');

    // Non-code & sensitive folders to strictly ignore
    const ignoredDirs = new Set([
      'node_modules',
      '.git',
      '.ssh',
      'dist',
      'build',
      '.next',
      '.cache',
      'target',
      'vendor',
      '.turbo',
      '__pycache__',
      '.pytest_cache',
      'venv',
      '.venv',
    ]);

    // Ignored binary/media file extensions to avoid unnecessary heavy network transfers
    const ignoredExtensions = new Set([
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.svg', '.mp4', '.mp3',
      '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
      '.exe', '.bin', '.dll', '.so', '.dylib', '.iso', '.pdf', '.woff', '.woff2', '.ttf', '.eot',
      // Strictly ignore credential/secret file extensions
      '.key', '.pem', '.crt', '.p12', '.pfx', '.pkcs12', '.jks', '.keystore'
    ]);

    async function walkAndDownload(rem: string, loc: string): Promise<void> {
      if (filesDownloaded >= maxFiles) return;
      try {
        fs.mkdirSync(loc, { recursive: true });
      } catch {
        // ignore
      }

      let items: any[] = [];
      try {
        items = await new Promise((resolve, reject) => {
          sftp.readdir(rem, (err, list) => {
            if (err) return reject(err);
            resolve(list);
          });
        });
      } catch (err: any) {
        console.warn(`[SFTP] Cannot read remote directory ${rem}:`, err.message);
        return;
      }

      for (const item of items) {
        if (filesDownloaded >= maxFiles) break;
        const itemName = item.filename;
        if (itemName === '.' || itemName === '..' || ignoredDirs.has(itemName)) {
          continue;
        }

        const remoteItemPath = path.posix.join(rem, itemName);
        const localItemPath = path.join(loc, itemName);

        // Check if path is in ignored list (e.g. storage/framework, bootstrap/cache)
        const relFromRoot = path.posix.relative(resolvedRemoteDir, remoteItemPath);
        if (
          relFromRoot.startsWith('storage/framework') ||
          relFromRoot.startsWith('storage/logs') ||
          relFromRoot.startsWith('storage/debugbar') ||
          relFromRoot.startsWith('bootstrap/cache')
        ) {
          continue;
        }

        if (item.attrs.isDirectory()) {
          await walkAndDownload(remoteItemPath, localItemPath);
        } else if (item.attrs.isFile()) {
          const ext = path.extname(itemName).toLowerCase();
          // Skip large binary / media files; download all code, config, script, text files
          if (!ignoredExtensions.has(ext)) {
            try {
              await new Promise<void>((res, rej) => {
                sftp.fastGet(remoteItemPath, localItemPath, (err) => {
                  if (err) return rej(err);
                  res();
                });
              });
              filesDownloaded++;
            } catch (dlErr: any) {
              console.warn(`[SFTP] Skipped downloading ${remoteItemPath}:`, dlErr.message);
            }
          }
        }
      }
    }

    await walkAndDownload(resolvedRemoteDir, localTargetDir);
    return { filesDownloaded, targetDir: localTargetDir };
  } finally {
    conn.end();
  }
}
