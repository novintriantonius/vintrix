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

/** List directory contents via SFTP. */
export async function listRemoteDirectory(
  opts: SSHConnectOptions,
  remotePath: string,
): Promise<RemoteDirEntry[]> {
  const conn = await openConnection(opts);

  try {
    const entries = await new Promise<RemoteDirEntry[]>((resolve, reject) => {
      conn.sftp((err: Error | undefined, sftp: SFTPWrapper) => {
        if (err) return reject(err);

        sftp.readdir(remotePath, (err: Error | undefined, list: any[]) => {
          if (err) return reject(err);

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
    });

    return entries;
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
  maxFiles = 500,
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

    const ignoredDirs = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.cache', 'target', 'vendor']);

    async function walkAndDownload(rem: string, loc: string): Promise<void> {
      if (filesDownloaded >= maxFiles) return;
      fs.mkdirSync(loc, { recursive: true });

      const items: any[] = await new Promise((resolve, reject) => {
        sftp.readdir(rem, (err, list) => {
          if (err) return reject(err);
          resolve(list);
        });
      });

      for (const item of items) {
        if (filesDownloaded >= maxFiles) break;
        const itemName = item.filename;
        if (itemName === '.' || itemName === '..' || ignoredDirs.has(itemName)) {
          continue;
        }

        const remoteItemPath = path.posix.join(rem, itemName);
        const localItemPath = path.join(loc, itemName);

        if (item.attrs.isDirectory()) {
          await walkAndDownload(remoteItemPath, localItemPath);
        } else if (item.attrs.isFile()) {
          // Download source file
          await new Promise<void>((res, rej) => {
            sftp.fastGet(remoteItemPath, localItemPath, (err) => {
              if (err) return rej(err);
              res();
            });
          });
          filesDownloaded++;
        }
      }
    }

    await walkAndDownload(remoteDir, localTargetDir);
    return { filesDownloaded, targetDir: localTargetDir };
  } finally {
    conn.end();
  }
}
