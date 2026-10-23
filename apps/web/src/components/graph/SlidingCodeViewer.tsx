import { useState } from 'react';
import {
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Code,
  FileText,
  ShieldCheck,
  ChevronDown,
  Terminal,
} from 'lucide-react';
import type { CodeNodeData } from './CustomCodeNode';

interface SlidingCodeViewerProps {
  node: CodeNodeData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SlidingCodeViewer({ node, isOpen, onClose }: SlidingCodeViewerProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  if (!isOpen || !node) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(node.codeSnippet);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const lines = node.codeSnippet.split('\n');

  return (
    <div
      className={`absolute left-0 right-0 bottom-0 z-30 transition-all duration-300 ease-out flex flex-col bg-[#050912]/95 backdrop-blur-xl border-t border-white/[0.1] shadow-2xl ${
        isFullScreen ? 'top-0' : 'h-[260px] sm:h-[320px]'
      }`}
    >
      {/* Drawer Header */}
      <div className="h-11 px-2.5 sm:px-4 border-b border-white/[0.08] flex items-center justify-between shrink-0 bg-[#070c16]/80 select-none">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <Code size={15} className="text-sky-400" />
            <span className="text-xs font-mono font-semibold text-slate-100 truncate max-w-[90px] sm:max-w-none">{node.label}</span>
          </div>
          <div className="w-px h-3 bg-white/[0.1] shrink-0 hidden sm:block" />
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 min-w-0">
            <FileText size={12} className="text-slate-500 shrink-0" />
            <span className="truncate max-w-[100px] sm:max-w-none">{node.filePath}</span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20 uppercase shrink-0 hidden xs:inline">
            {node.kind}
          </span>
          {node.sourceName && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-300 border border-white/[0.06] shrink-0 hidden md:inline">
              {node.sourceName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* ISO 27001 Zero-leak badge */}
          <div className="hidden md:flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/20 px-2 py-0.5 rounded border border-emerald-900/40">
            <ShieldCheck size={12} />
            <span>AST Sandboxed</span>
          </div>

          {/* Copy Snippet */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-slate-300 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] px-2 sm:px-2.5 py-1 rounded-md border border-white/[0.08] transition-colors"
            title="Copy code snippet to clipboard"
          >
            {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span className="hidden sm:inline">{isCopied ? 'Copied' : 'Copy'}</span>
          </button>

          {/* Toggle Full Screen / Half Screen */}
          <button
            onClick={() => setIsFullScreen((prev) => !prev)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title={isFullScreen ? 'Restore height' : 'Expand full screen'}
          >
            {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>

          {/* Close / Slide Down */}
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Close viewer"
          >
            <ChevronDown size={16} />
          </button>
        </div>
      </div>

      {/* Code Body with Line Numbers */}
      <div className="flex-1 overflow-auto p-4 font-mono text-[11px] leading-relaxed select-text bg-[#03060c]">
        <div className="table w-full">
          {lines.map((line, idx) => (
            <div key={idx} className="table-row hover:bg-white/[0.03] transition-colors">
              <span className="table-cell pr-4 text-right text-slate-600 select-none w-10 text-[10px]">
                {idx + 1}
              </span>
              <span className="table-cell text-emerald-400/90 whitespace-pre">{line || ' '}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Drawer Status Bar */}
      <div className="h-6 px-4 border-t border-white/[0.06] bg-[#050912] flex items-center justify-between text-[10px] font-mono text-slate-500 shrink-0">
        <div className="flex items-center gap-3">
          <span>Lines: {lines.length}</span>
          <span>•</span>
          <span>Complexity: {node.methodCount} methods</span>
          <span>•</span>
          <span>Deps: {node.dependencyCount} cross-repo references</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Terminal size={11} className="text-sky-400" />
          <span>Parsed with XERJ Tree-sitter engine</span>
        </div>
      </div>
    </div>
  );
}
