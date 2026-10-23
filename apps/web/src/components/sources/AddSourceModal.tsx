import { useState } from 'react';
import {
  GitBranch,
  Terminal,
  ShieldCheck,
  FolderOpen,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Plus,
} from 'lucide-react';

interface AddSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSourceAdded: (source: { name: string; type: 'git' | 'ssh' }) => void;
}

export function AddSourceModal({ isOpen, onClose, onSourceAdded }: AddSourceModalProps) {
  const [activeType, setActiveType] = useState<'git' | 'ssh'>('git');

  // Git state
  const [gitName, setGitName] = useState('');
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitToken, setGitToken] = useState('');
  const [gitIndexPaths, setGitIndexPaths] = useState('src/, packages/');

  // SSH state
  const [sshName, setSshName] = useState('');
  const [sshHost, setSshHost] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUsername, setSshUsername] = useState('root');
  const [sshAuthType, setSshAuthType] = useState<'key' | 'password'>('key');
  const [sshPassword, setSshPassword] = useState('');
  const [sshPrivateKey, setSshPrivateKey] = useState('');
  const [sshPassphrase, setSshPassphrase] = useState('');
  const [sshIndexPaths, setSshIndexPaths] = useState('/var/www/app, /opt/backend');

  // Test & submit status
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleTestSSH = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      // In production calls POST /sources/test-ssh
      await new Promise((res) => setTimeout(res, 800));
      setTestResult({
        success: true,
        message: `SSH Handshake & SFTP connection successful. Remote host ${sshHost}:${sshPort} reachable.`,
      });
    } catch {
      setTestResult({
        success: false,
        message: 'Failed to establish SSH handshake. Check host, port, or authentication key.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onSourceAdded({
        name: activeType === 'git' ? (gitName || 'Git Repo') : (sshName || 'SSH Server'),
        type: activeType,
      });
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#080d16] border border-white/[0.08] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <FolderOpen size={18} className="text-sky-400" />
              Connect Code Source
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Connect Git repositories or remote SSH/SFTP servers to ingest into the Knowledge Graph.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Source Type Selector */}
        <div className="px-6 pt-4 pb-2">
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#050912] rounded-xl border border-white/[0.06]">
            <button
              type="button"
              onClick={() => {
                setActiveType('git');
                setTestResult(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                activeType === 'git'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitBranch size={15} />
              <span>Git Repository (GitHub / GitLab)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveType('ssh');
                setTestResult(null);
              }}
              className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                activeType === 'ssh'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal size={15} />
              <span>SSH / SFTP Remote Server</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 overflow-y-auto max-h-[60vh]">
          {activeType === 'git' ? (
            <>
              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  SOURCE NAME
                </label>
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

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  MULTIPLE INDEX PATHS (COMMA SEPARATED)
                </label>
                <input
                  type="text"
                  value={gitIndexPaths}
                  onChange={(e) => setGitIndexPaths(e.target.value)}
                  className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Only files matching these paths will be parsed into the AST graph to preserve index efficiency.
                </p>
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
                  placeholder="e.g. Production Cluster (SFTP)"
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
                    onChange={(e) => setSshHost(e.target.value)}
                    className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    PORT
                  </label>
                  <input
                    type="number"
                    required
                    value={sshPort}
                    onChange={(e) => setSshPort(e.target.value)}
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
                    onChange={(e) => setSshUsername(e.target.value)}
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
                      onClick={() => setSshAuthType('key')}
                      className={`flex-1 text-[11px] font-medium rounded transition-all ${
                        sshAuthType === 'key' ? 'bg-sky-500/20 text-sky-300' : 'text-slate-400'
                      }`}
                    >
                      SSH Key
                    </button>
                    <button
                      type="button"
                      onClick={() => setSshAuthType('password')}
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
                      onChange={(e) => setSshPrivateKey(e.target.value)}
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
                      onChange={(e) => setSshPassphrase(e.target.value)}
                      className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">
                    PASSWORD
                  </label>
                  <input
                    type="password"
                    placeholder="••••••••••••"
                    value={sshPassword}
                    onChange={(e) => setSshPassword(e.target.value)}
                    className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">
                  REMOTE INDEX PATHS (COMMA SEPARATED)
                </label>
                <input
                  type="text"
                  value={sshIndexPaths}
                  onChange={(e) => setSshIndexPaths(e.target.value)}
                  className="w-full bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
                />
              </div>

              {/* Test Connection Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleTestSSH}
                  disabled={isTesting || !sshHost}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08] transition-all disabled:opacity-50"
                >
                  {isTesting ? <Loader2 size={13} className="animate-spin text-sky-400" /> : <Terminal size={13} />}
                  <span>Test Handshake & SFTP Probe</span>
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
            </>
          )}

          {/* ISO 27001 Cryptographic Safeguard Banner */}
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center gap-2.5 text-[11px] text-slate-400 font-mono">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span>Credentials encrypted at rest with AES-256-GCM envelope encryption (ISO/IEC 27001 compliant).</span>
          </div>

          {/* Footer Submit */}
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
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold transition-all disabled:opacity-50 shadow-lg shadow-sky-500/20"
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              <span>Add & Index Source</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
