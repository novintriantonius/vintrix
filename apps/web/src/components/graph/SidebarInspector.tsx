import { useState } from 'react';
import {
  FileCode,
  FolderSimple,
  Graph,
  Info,
  CheckCircle,
  Copy,
  Terminal,
  ShieldCheck,
  TreeStructure,
} from '@phosphor-icons/react';
import type { CodeNodeData } from './CustomCodeNode';

interface SidebarInspectorProps {
  selectedNode: CodeNodeData | null;
  onSelectNodeByPath: (path: string) => void;
  allNodes: CodeNodeData[];
}

export function SidebarInspector({
  selectedNode,
  onSelectNodeByPath,
  allNodes,
}: SidebarInspectorProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'explorer' | 'security'>('details');
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    if (!selectedNode) return;
    navigator.clipboard.writeText(selectedNode.codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-[380px] h-[calc(100vh-48px)] bg-[#070b12] border-l border-white/[0.08] flex flex-col z-20">
      {/* Tab Navigation Segmented Glass Pill */}
      <div className="px-4 py-3 border-b border-white/[0.08]">
        <div className="flex bg-[#0d1422] p-1 rounded-lg border border-white/[0.06]">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-1.5 text-[11px] font-medium flex items-center justify-center gap-1.5 rounded-md transition-all ${
              activeTab === 'details'
                ? 'text-white bg-white/10 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info size={13} />
            AST Node
          </button>
          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex-1 py-1.5 text-[11px] font-medium flex items-center justify-center gap-1.5 rounded-md transition-all ${
              activeTab === 'explorer'
                ? 'text-white bg-white/10 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderSimple size={13} />
            Files ({allNodes.length})
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-1.5 text-[11px] font-medium flex items-center justify-center gap-1.5 rounded-md transition-all ${
              activeTab === 'security'
                ? 'text-white bg-white/10 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck size={13} />
            Security
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'details' && (
          <>
            {selectedNode ? (
              <div className="space-y-4">
                {/* Node Title & Kind Card */}
                <div className="p-4 bg-[#0a101d] rounded-xl border border-white/[0.07] space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-sky-400 font-semibold px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/20">
                        {selectedNode.kind}
                      </span>
                      {selectedNode.sourceName && (
                        <span className="text-[9px] font-mono text-slate-300 px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">
                          {selectedNode.sourceName}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                      <CheckCircle size={12} weight="fill" />
                      AST Verified
                    </span>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-100 tracking-tight">
                      {selectedNode.label}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 font-mono truncate">
                      {selectedNode.filePath} • {selectedNode.lines}
                    </p>
                  </div>
                </div>

                {/* Plain Purpose */}
                <div className="p-3.5 bg-[#0a101d]/70 rounded-xl border border-white/[0.06] space-y-1.5">
                  <div className="text-[10px] uppercase font-mono tracking-wider text-slate-400 flex items-center gap-1.5">
                    <TreeStructure size={13} className="text-sky-400" />
                    Plain English Purpose
                  </div>
                  <p className="text-[12px] text-slate-300 leading-relaxed font-sans">
                    {selectedNode.summary}
                  </p>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 bg-[#0a101d]/70 rounded-xl border border-white/[0.06]">
                    <div className="text-xl font-bold text-slate-100 font-mono">
                      {selectedNode.methodCount}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                      Declared Methods
                    </div>
                  </div>
                  <div className="p-3 bg-[#0a101d]/70 rounded-xl border border-white/[0.06]">
                    <div className="text-xl font-bold text-slate-100 font-mono">
                      {selectedNode.dependencyCount}
                    </div>
                    <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold mt-0.5">
                      Downstream Deps
                    </div>
                  </div>
                </div>

                {/* Code Snippet Viewer */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-400 px-0.5">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <Terminal size={12} />
                      Code Extract
                    </span>
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200 transition-colors bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06]"
                    >
                      <Copy size={11} />
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="relative rounded-xl border border-white/[0.08] bg-[#03060c] overflow-hidden">
                    <pre className="p-3.5 text-[11px] font-mono text-emerald-400/90 overflow-x-auto leading-relaxed max-h-56">
                      {selectedNode.codeSnippet}
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500 gap-2">
                <Graph size={28} weight="duotone" className="text-slate-600" />
                <p className="text-xs">Pilih salah satu node pada kanvas untuk menginspeksi arsitektur AST.</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'explorer' && (
          <div className="space-y-1">
            <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1 mb-2">
              Workspace Repository Files
            </div>
            {allNodes.map((n) => {
              const isSelected = selectedNode?.filePath === n.filePath;
              return (
                <button
                  key={n.filePath}
                  onClick={() => onSelectNodeByPath(n.filePath)}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-[11px] font-mono transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-sky-500/10 border-sky-500/40 text-sky-300'
                      : 'bg-[#0b1320]/40 border-white/5 text-slate-400 hover:bg-[#0b1320] hover:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <FileCode size={14} className="shrink-0 text-slate-500" />
                    <span className="truncate">{n.filePath}</span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-slate-400 shrink-0">
                    {n.lines}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-3">
            <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
                <ShieldCheck size={15} weight="bold" />
                ISO/IEC 27001 Cryptographic Safeguard
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Semua SSH private keys, remote tokens, dan API keys dienkripsi menggunakan PBKDF2-SHA256 (310,000 iterasi) dengan AES-256-GCM envelope authenticated encryption.
              </p>
            </div>

            <div className="p-3.5 bg-[#0b1320]/60 border border-white/5 rounded-2xl space-y-2 text-xs">
              <div className="text-slate-200 font-medium text-[11px] uppercase tracking-wider font-mono">
                Active Security Policies:
              </div>
              <ul className="space-y-2 text-slate-400 text-[11px]">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  Plaintext credentials tidak pernah disimpan di disk atau log
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  SFTP remote traversal sandboxed per session
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  OAuth Token & API key didekripsi in-memory on-demand
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
