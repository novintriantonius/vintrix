import { Client, type ConnectConfig, type SFTPWrapper } from 'ssh2';

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
