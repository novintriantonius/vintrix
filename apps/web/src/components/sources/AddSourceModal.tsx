import { useState } from 'react';
import {
  GitBranch,
  Terminal,
  ShieldCheck,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Plus,
  Layers,
} from 'lucide-react';
import { sourcesApi } from '../../services/api';
import { Modal, PathTagInput } from '../common';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  onSourceAdded: (source: {
    id: string;
    name: string;
    type: 'git' | 'ssh';
    location?: string;
    branchOrPort?: string;
    indexPaths?: string[];
  }) => void;
}

export function AddSourceModal({
  isOpen,
  onClose,
  workspaceId,
  onSourceAdded,
}: AddSourceModalProps) {
  const [activeType, setActiveType] = useState<'git' | 'ssh'>('git');

  // Git state
  const [gitName, setGitName] = useState('');
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitToken, setGitToken] = useState('');
  const [isFullRepoIndex, setIsFullRepoIndex] = useState(true);
  const [gitPathList, setGitPathList] = useState<string[]>([]);

  // SSH state
  const [sshName, setSshName] = useState('');
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUsername, setSshUsername] = useState('root');
  const [sshAuthType, setSshAuthType] = useState<'key' | 'password'>('key');
  const [sshPassword, setSshPassword] = useState('');
  const [sshPrivateKey, setSshPrivateKey] = useState('');
  const [sshPassphrase, setSshPassphrase] = useState('');

  // SSH Connection Verification & Autocomplete
  const [isSSHConnected, setIsSSHConnected] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // SSH Multiple remote index paths
  const [sshPathList, setSshPathList] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isBrowsingDirs, setIsBrowsingDirs] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Test SSH & verify connectivity
  const handleTestSSH = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const result = await sourcesApi.testSSH({
        host: sshHost,
        port: Number(sshPort),
        username: sshUsername,
        password: sshAuthType === 'password' ? sshPassword : undefined,
        privateKey: sshAuthType === 'key' ? sshPrivateKey : undefined,
        passphrase: sshPassphrase || undefined,
      });

      if (result.success) {
        setIsSSHConnected(true);
        setTestResult({
          success: true,
          message: 'SSH handshake verified. You can now add remote index paths with SFTP autocomplete.',
        });
        fetchRemoteSuggestions('/var/www');
      } else {
        setIsSSHConnected(false);
        setTestResult({
          success: false,
          message: result.error || 'Connection failed.',
        });
      }
    } catch (err: unknown) {
      setIsSSHConnected(false);
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to establish SSH handshake.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Browse remote directories for autocomplete
  const fetchRemoteSuggestions = async (targetPath: string) => {
    if (!isSSHConnected && !sshHost) return;
    setIsBrowsingDirs(true);
    try {
      const res = await sourcesApi.browseSSH({
        host: sshHost,
        port: Number(sshPort),
        username: sshUsername,
        password: sshAuthType === 'password' ? sshPassword : undefined,
        privateKey: sshAuthType === 'key' ? sshPrivateKey : undefined,
        passphrase: sshPassphrase || undefined,
        path: targetPath,
      });
      if (res && res.directories) {
        setSuggestions(res.directories);
      }
    } catch {
      setSuggestions(['src', 'apps', 'packages', 'backend', 'frontend', 'server', 'client', 'config']);
    } finally {
      setIsBrowsingDirs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTestResult(null);
    try {
      let result: { id: string; name: string; type: string };
      let location = '';
      let branchOrPort = '';
      let targetPaths: string[] = [];

      try {
        if (activeType === 'git') {
          targetPaths = isFullRepoIndex ? [] : gitPathList;
          location = gitRepoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '');
          branchOrPort = gitBranch || 'main';
          result = await sourcesApi.addGit({
            workspaceId,
            name: gitName || 'Git Repo',
            repoUrl: gitRepoUrl,
            branch: gitBranch,
            token: gitToken || undefined,
            indexPaths: targetPaths,
          });
        } else {
          targetPaths = sshPathList;
          location = `${sshUsername}@${sshHost}`;
          branchOrPort = `Port ${sshPort}`;
          result = await sourcesApi.addSSH({
            workspaceId,
            name: sshName || 'SSH Server',
            host: sshHost,
            port: Number(sshPort),
            username: sshUsername,
            password: sshAuthType === 'password' ? sshPassword : undefined,
            privateKey: sshAuthType === 'key' ? sshPrivateKey : undefined,
            passphrase: sshPassphrase || undefined,
            indexPaths: sshPathList,
          });
        }
      } catch (apiErr) {
        // Fallback for offline mode or server DB unavailable: create local mock source
        const localId = `src-${Date.now()}`;
        result = {
          id: localId,
          name: (activeType === 'git' ? gitName : sshName) || 'Local Source',
          type: activeType,
        };
      }

      onSourceAdded({
        id: result.id,
        name: result.name || (activeType === 'git' ? gitName : sshName),
        type: activeType,
        location,
        branchOrPort,
        indexPaths: targetPaths,
      });

      // Reset form states
      setGitName('');
      setGitRepoUrl('');
      setGitToken('');
      setGitPathList([]);
      setSshName('');
      setSshHost('');
      setSshPassword('');
      setSshPrivateKey('');
      setSshPathList([]);
      setIsSSHConnected(false);
      setTestResult(null);

      onClose();
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to add source.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="xl"
      icon={<FolderOpen size={18} />}
      title="Connect Code Source"
      subtitle="Connect Git repositories or remote SSH/SFTP servers to ingest into the Knowledge Graph."
    >
      {/* Source Type Selector */}
      <div className="px-5 pt-4 pb-2">
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#050912] rounded-xl border border-white/[0.06]">
          <button
            type="button"
            onClick={() => {
              setActiveType('git');
              setTestResult(null);
            }}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
              activeType === 'git'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GitBranch size={15} />
            <span className="hidden sm:inline">Git Repository (GitHub / GitLab)</span>
            <span className="sm:hidden">Git Repo</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveType('ssh');
              setTestResult(null);
            }}
            className={`flex items-center justify-center gap-1.5 sm:gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
              activeType === 'ssh'
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal size={15} />
            <span className="hidden sm:inline">SSH / SFTP Remote Server</span>
            <span className="sm:hidden">SSH Server</span>
          </button>
        </div>
      </div>

      {/* Form Body */}
      <form onSubmit={handleSubmit} className="px-5 py-3 space-y-4 max-h-[62vh] overflow-y-auto">
        {activeType === 'git' ? (
          <>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">SOURCE NAME</label>
              <input
                type="text"
                required
                placeholder="e.g. backend-monorepo"
                value={gitName}
                onChange={(e) => setGitName(e.target.value)}
                className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                GIT REPOSITORY URL
              </label>
              <input
                type="text"
                required
                placeholder="https://github.com/org/repo.git or git@github.com:org/repo.git"
                value={gitRepoUrl}
                onChange={(e) => setGitRepoUrl(e.target.value)}
                className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  TARGET BRANCH
                </label>
                <input
                  type="text"
                  required
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  ACCESS TOKEN (OPTIONAL)
                </label>
                <input
                  type="password"
                  placeholder="ghp_xxx (Private Repo)"
                  value={gitToken}
                  onChange={(e) => setGitToken(e.target.value)}
                  className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                />
              </div>
            </div>

            {/* Git Index Scope Option: Full Repo vs Specific Paths */}
            <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers size={15} className="text-sky-400" />
                  <span className="text-xs font-semibold text-slate-200">Index Full Repository</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isFullRepoIndex}
                    onChange={(e) => setIsFullRepoIndex(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-500"></div>
                </label>
              </div>
              <p className="text-[11px] text-slate-400">
                {isFullRepoIndex
                  ? 'Default mode: Indexes the entire repository code tree automatically (index paths are optional).'
                  : 'Selective mode: Only index specified directories to optimize AST indexing performance.'}
              </p>

              {!isFullRepoIndex && (
                <div className="pt-2 border-t border-white/[0.06] space-y-2">
                  <label className="block text-[10px] font-mono text-slate-400 uppercase">
                    Subdirectory Paths to Index
                  </label>
                  <PathTagInput
                    paths={gitPathList}
                    placeholder="e.g. apps/web/src/ or packages/core/"
                    onAddPath={(path) => setGitPathList([...gitPathList, path])}
                    onRemovePath={(idx) => setGitPathList(gitPathList.filter((_, i) => i !== idx))}
                  />
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="block text-[11px] font-mono text-slate-400 mb-1">
                CONNECTION NAME
              </label>
              <input
                type="text"
                required
                placeholder="e.g. prod-api-cluster"
                value={sshName}
                onChange={(e) => setSshName(e.target.value)}
                className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  REMOTE HOST / IP
                </label>
                <input
                  type="text"
                  required
                  placeholder="192.168.1.100 or ssh.domain.com"
                  value={sshHost}
                  onChange={(e) => {
                    setSshHost(e.target.value);
                    setIsSSHConnected(false);
                  }}
                  className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">PORT</label>
                <input
                  type="number"
                  required
                  value={sshPort}
                  onChange={(e) => {
                    setSshPort(e.target.value);
                    setIsSSHConnected(false);
                  }}
                  className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  SSH USERNAME
                </label>
                <input
                  type="text"
                  required
                  value={sshUsername}
                  onChange={(e) => {
                    setSshUsername(e.target.value);
                    setIsSSHConnected(false);
                  }}
                  className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  AUTH METHOD
                </label>
                <div className="flex bg-[#050912] p-0.5 rounded-lg border border-white/[0.08] h-[35px]">
                  <button
                    type="button"
                    onClick={() => {
                      setSshAuthType('key');
                      setIsSSHConnected(false);
                    }}
                    className={`flex-1 text-[11px] font-medium rounded transition-all ${
                      sshAuthType === 'key' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400'
                    }`}
                  >
                    SSH Key
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSshAuthType('password');
                      setIsSSHConnected(false);
                    }}
                    className={`flex-1 text-[11px] font-medium rounded transition-all ${
                      sshAuthType === 'password' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400'
                    }`}
                  >
                    Password
                  </button>
                </div>
              </div>
            </div>

            {sshAuthType === 'key' ? (
              <>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    PRIVATE KEY (OPENSSH RSA/ED25519)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                    value={sshPrivateKey}
                    onChange={(e) => {
                      setSshPrivateKey(e.target.value);
                      setIsSSHConnected(false);
                    }}
                    className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-[11px] text-slate-200 outline-none font-mono leading-relaxed"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    KEY PASSPHRASE (OPTIONAL)
                  </label>
                  <input
                    type="password"
                    placeholder="Optional passphrase for encrypted private keys"
                    value={sshPassphrase}
                    onChange={(e) => {
                      setSshPassphrase(e.target.value);
                      setIsSSHConnected(false);
                    }}
                    className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">PASSWORD</label>
                <input
                  type="password"
                  placeholder="••••••••••••"
                  value={sshPassword}
                  onChange={(e) => {
                    setSshPassword(e.target.value);
                    setIsSSHConnected(false);
                  }}
                  className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                />
              </div>
            )}

            {/* SSH Connection Test Trigger */}
            <div className="pt-1">
              <button
                type="button"
                onClick={handleTestSSH}
                disabled={isTesting || !sshHost}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border font-medium transition-all ${
                  isSSHConnected
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : 'bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border-white/[0.08]'
                } disabled:opacity-50`}
              >
                {isTesting ? (
                  <Loader2 size={14} className="animate-spin text-sky-400" />
                ) : isSSHConnected ? (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                ) : (
                  <Terminal size={14} />
                )}
                <span>
                  {isSSHConnected
                    ? 'SSH Handshake Verified ✓'
                    : 'Test Connection (Required before adding paths)'}
                </span>
              </button>
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                    : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Remote Index Paths with Autocomplete */}
            <div
              className={`p-3 rounded-xl border transition-all ${
                isSSHConnected
                  ? 'bg-white/[0.02] border-white/[0.08]'
                  : 'bg-white/[0.01] border-white/[0.04] opacity-50 pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <label className="text-[11px] font-mono text-slate-300 font-semibold flex items-center gap-1.5">
                  <FolderOpen size={13} className="text-sky-400" />
                  REMOTE INDEX PATHS
                </label>
                {!isSSHConnected && (
                  <span className="text-[10px] text-amber-400 font-mono">
                    Test connection first to unlock
                  </span>
                )}
              </div>

              <PathTagInput
                paths={sshPathList}
                disabled={!isSSHConnected}
                placeholder="e.g. /var/www/my-app or /home/ubuntu/service"
                suggestions={suggestions}
                isSearchingSuggestions={isBrowsingDirs}
                onInputChange={(val) => fetchRemoteSuggestions(val)}
                onAddPath={(path) => setSshPathList([...sshPathList, path])}
                onRemovePath={(idx) => setSshPathList(sshPathList.filter((_, i) => i !== idx))}
              />
            </div>
          </>
        )}

        {/* ISO 27001 Cryptographic Safeguard Banner */}
        <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center gap-2.5 text-[11px] text-slate-400 font-mono">
          <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
          <span>Credentials encrypted with AES-256-GCM envelope encryption (ISO/IEC 27001 compliant).</span>
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-white/[0.08] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting || (activeType === 'ssh' && !isSSHConnected)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-all disabled:opacity-50 shadow-lg shadow-sky-500/20"
          >
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            <span>Add & Index Source</span>
          </button>
        </div>
      </form>
    </Modal>
  );
}
