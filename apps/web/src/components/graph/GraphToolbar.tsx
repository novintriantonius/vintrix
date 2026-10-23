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
  selectedSource: string;
  onSourceSelect: (source: string) => void;
  availableSources: { id: string; label: string }[];
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
  selectedSource,
  onSourceSelect,
  availableSources,
  nodeCount,
  totalNodes,
  onResetView,
}: GraphToolbarProps) {
  return (
    <div className="absolute top-3 left-3 right-3 sm:right-auto sm:top-4 sm:left-4 z-10 flex items-center gap-1.5 sm:gap-2 bg-[#080d16]/95 backdrop-blur-md border border-white/[0.08] p-1 rounded-xl shadow-xl max-w-[calc(100vw-24px)] overflow-x-auto no-scrollbar">
      {/* Workspace Source Filter (Frontend, Backend, SSH, All) */}
      <div className="flex items-center gap-1 bg-[#050912]/80 border border-white/[0.06] rounded-lg px-2 py-1 shrink-0">
        <span className="text-[10px] font-mono text-slate-500 uppercase hidden sm:inline">Scope:</span>
        <select
          value={selectedSource}
          onChange={(e) => onSourceSelect(e.target.value)}
          className="bg-transparent text-[11px] font-medium text-sky-400 outline-none cursor-pointer max-w-[110px] sm:max-w-none truncate"
        >
          <option value="all" className="bg-[#080d16] text-slate-200">
            All Sources
          </option>
          {availableSources.map((s) => (
            <option key={s.id} value={s.id} className="bg-[#080d16] text-slate-200">
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="h-3.5 w-px bg-white/[0.08] shrink-0" />

      {/* Search Input Bar */}
      <div className="flex items-center gap-1.5 bg-[#050912]/80 border border-white/[0.06] rounded-lg px-2 py-1 w-24 sm:w-40 transition-all focus-within:w-36 sm:focus-within:w-52 shrink-0">
        <MagnifyingGlass size={13} className="text-slate-500 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter..."
          className="bg-transparent border-none text-[11px] text-slate-200 outline-none w-full placeholder:text-slate-500 font-mono"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="text-[9px] font-mono text-slate-400 hover:text-slate-200"
          >
            ×
          </button>
        )}
      </div>

      <div className="h-3.5 w-px bg-white/[0.08] shrink-0" />

      {/* Segmented Filter Buttons */}
      <div className="flex items-center gap-0.5 shrink-0">
        {FILTER_BUTTONS.map((btn) => {
          const Icon = btn.icon;
          const isActive = selectedKind === btn.kind;
          return (
            <button
              key={btn.kind}
              onClick={() => onKindSelect(btn.kind)}
              title={btn.label}
              className={`flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
                isActive
                  ? 'bg-white/10 text-white shadow-sm font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
              }`}
            >
              <Icon size={12} weight={isActive ? 'fill' : 'regular'} style={{ color: btn.color }} />
              <span className="hidden sm:inline">{btn.label}</span>
            </button>
          );
        })}
      </div>

      <div className="h-3.5 w-px bg-white/[0.08] shrink-0" />

      {/* Counter & Fit View */}
      <div className="flex items-center gap-1.5 px-1 shrink-0">
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
