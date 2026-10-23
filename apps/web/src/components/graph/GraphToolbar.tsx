import {
  MagnifyingGlass,
  Stack,
  Sparkle,
  Cpu,
  Code,
  Database,
  ShieldCheck,
} from '@phosphor-icons/react';
import type { NodeKind } from './CustomCodeNode';

interface GraphToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedKind: NodeKind | 'all';
  onKindSelect: (kind: NodeKind | 'all') => void;
  nodeCount: number;
  totalNodes: number;
  onResetView: () => void;
}

const FILTER_BUTTONS: { kind: NodeKind | 'all'; label: string; icon: typeof Stack; color: string }[] = [
  { kind: 'all', label: 'All', icon: Stack, color: '#94a3b8' },
  { kind: 'controller', label: 'API', icon: Cpu, color: '#38bdf8' },
  { kind: 'service', label: 'Services', icon: Code, color: '#34d399' },
  { kind: 'database', label: 'Database', icon: Database, color: '#fbbf24' },
  { kind: 'security', label: 'Security', icon: ShieldCheck, color: '#f43f5e' },
];

export function GraphToolbar({
  searchQuery,
  onSearchChange,
  selectedKind,
  onKindSelect,
  nodeCount,
  totalNodes,
  onResetView,
}: GraphToolbarProps) {
  return (
    <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-[#080d16]/90 backdrop-blur-md border border-white/[0.08] p-1 rounded-xl shadow-xl">
      {/* Search Input Bar */}
      <div className="flex items-center gap-2 bg-[#050912]/80 border border-white/[0.06] rounded-lg px-2.5 py-1.5 w-44 transition-all focus-within:w-56 focus-within:border-sky-500/40">
        <MagnifyingGlass size={13} className="text-slate-500 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter nodes..."
          className="bg-transparent border-none text-[11px] text-slate-200 outline-none w-full placeholder:text-slate-500 font-mono"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="text-[9px] font-mono text-slate-400 hover:text-slate-200"
          >
            clear
          </button>
        )}
      </div>

      <div className="h-3.5 w-px bg-white/[0.08]" />

      {/* Segmented Filter Buttons */}
      <div className="flex items-center gap-0.5">
        {FILTER_BUTTONS.map((btn) => {
          const Icon = btn.icon;
          const isActive = selectedKind === btn.kind;
          return (
            <button
              key={btn.kind}
              onClick={() => onKindSelect(btn.kind)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                isActive
                  ? 'bg-white/10 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Icon size={12} weight={isActive ? 'fill' : 'regular'} style={{ color: btn.color }} />
              <span>{btn.label}</span>
            </button>
          );
        })}
      </div>

      <div className="h-3.5 w-px bg-white/[0.08]" />

      {/* Counter & Fit View */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-[10px] font-mono text-slate-400">
          <span className="text-sky-400 font-medium">{nodeCount}</span>/{totalNodes}
        </span>
        <button
          onClick={onResetView}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-slate-400 hover:text-slate-200 hover:bg-white/[0.04] transition-colors"
          title="Reset canvas camera"
        >
          <Sparkle size={12} className="text-sky-400" />
          <span>Fit</span>
        </button>
      </div>
    </div>
  );
}
