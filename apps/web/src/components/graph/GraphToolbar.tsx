import { useState, useRef, useEffect } from 'react';
import {
  MagnifyingGlass,
  Stack,
  Sparkle,
  Cpu,
  Code,
  Database,
  ShieldCheck,
  DownloadSimple,
  FileText,
  CaretDown,
  Check,
  TreeStructure,
} from '@phosphor-icons/react';
import type { NodeKind } from './CustomCodeNode';
import type { LayoutDirection } from './layout';

interface GraphToolbarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedKind: NodeKind | 'all';
  onKindSelect: (kind: NodeKind | 'all') => void;
  selectedSource: string;
  onSourceSelect: (source: string) => void;
  availableSources: { id: string; label: string }[];
  layoutDirection?: LayoutDirection;
  onSelectLayout?: (direction: LayoutDirection) => void;
  nodeCount: number;
  totalNodes: number;
  onResetView: () => void;
  onExportPng?: () => void;
  onExportMermaid?: () => void;
  onExportReport?: () => void;
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
  layoutDirection = 'TB',
  onSelectLayout,
  nodeCount,
  totalNodes,
  onResetView,
  onExportPng,
  onExportMermaid,
  onExportReport,
}: GraphToolbarProps) {
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);
  const [isLayoutDropdownOpen, setIsLayoutDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const layoutDropdownRef = useRef<HTMLDivElement>(null);

  // Close custom dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsScopeDropdownOpen(false);
      }
      if (layoutDropdownRef.current && !layoutDropdownRef.current.contains(event.target as Node)) {
        setIsLayoutDropdownOpen(false);
      }
    }
    if (isScopeDropdownOpen || isLayoutDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isScopeDropdownOpen, isLayoutDropdownOpen]);

  const currentSourceLabel =
    selectedSource === 'all'
      ? 'All Sources'
      : availableSources.find((s) => s.id === selectedSource)?.label || selectedSource;

  return (
    <div className="absolute top-3 left-3 right-3 sm:right-auto sm:top-4 sm:left-4 z-10 flex items-center gap-1.5 sm:gap-2 bg-[#080d16]/95 backdrop-blur-md border border-white/[0.08] p-1 rounded-xl shadow-xl max-w-[calc(100vw-24px)] overflow-x-auto no-scrollbar">
      {/* Custom Scope Dropdown (replaces native <select>) */}
      <div className="relative shrink-0" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsScopeDropdownOpen((prev) => !prev)}
          className="flex items-center gap-1.5 bg-[#050912]/80 hover:bg-[#070e1b] border border-white/[0.06] hover:border-white/[0.12] rounded-lg px-2 py-1 text-[11px] font-medium text-sky-400 transition-colors"
          title="Filter graph by code source"
        >
          <span className="text-[10px] font-mono text-slate-500 uppercase hidden sm:inline">Scope:</span>
          <span className="max-w-[100px] sm:max-w-[130px] truncate text-left">{currentSourceLabel}</span>
          <CaretDown size={11} className={`text-slate-400 transition-transform ${isScopeDropdownOpen ? 'rotate-180 text-sky-400' : ''}`} />
        </button>

        {isScopeDropdownOpen && (
          <div className="absolute left-0 top-full mt-1.5 w-48 bg-[#080d16] border border-white/[0.1] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-150">
            <button
              type="button"
              onClick={() => {
                onSourceSelect('all');
                setIsScopeDropdownOpen(false);
              }}
              className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                selectedSource === 'all'
                  ? 'bg-sky-500/15 text-sky-300 font-semibold'
                  : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
              }`}
            >
              <span>All Sources</span>
              {selectedSource === 'all' && <Check size={12} className="text-sky-400" />}
            </button>

            {availableSources.map((s) => {
              const isSelected = selectedSource === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onSourceSelect(s.id);
                    setIsScopeDropdownOpen(false);
                  }}
                  className={`flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    isSelected
                      ? 'bg-sky-500/15 text-sky-300 font-semibold'
                      : 'text-slate-300 hover:bg-white/[0.05] hover:text-white'
                  }`}
                >
                  <span className="truncate pr-2">{s.label}</span>
                  {isSelected && <Check size={12} className="text-sky-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
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

        {/* Layout Presets Dropdown */}
        {onSelectLayout && (
          <div className="relative shrink-0" ref={layoutDropdownRef}>
            <button
              type="button"
              onClick={() => setIsLayoutDropdownOpen((prev) => !prev)}
              className="flex items-center gap-1 px-1.5 py-1 rounded-md text-[11px] font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors border border-white/[0.06]"
              title="Change Graph Auto-Layout"
            >
              <TreeStructure size={12} className="text-indigo-400" />
              <span className="hidden sm:inline">
                {layoutDirection === 'TB' ? 'Tree ↓' : layoutDirection === 'LR' ? 'Flow →' : layoutDirection === 'GRID' ? 'Grid ⊞' : 'Radial ⊙'}
              </span>
              <CaretDown size={10} className={`text-slate-400 transition-transform ${isLayoutDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isLayoutDropdownOpen && (
              <div className="absolute top-full right-0 mt-1.5 w-36 bg-[#080d16] border border-white/10 rounded-lg shadow-2xl p-1 z-50 space-y-0.5">
                {[
                  { dir: 'TB' as const, label: 'Hierarchical (Top-Down)', icon: '↓' },
                  { dir: 'LR' as const, label: 'Flow (Left-to-Right)', icon: '→' },
                  { dir: 'GRID' as const, label: 'Orthogonal Grid', icon: '⊞' },
                  { dir: 'RADIAL' as const, label: 'Radial Cluster', icon: '⊙' },
                ].map((item) => (
                  <button
                    key={item.dir}
                    type="button"
                    onClick={() => {
                      onSelectLayout(item.dir);
                      setIsLayoutDropdownOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] text-left transition-colors ${
                      layoutDirection === item.dir
                        ? 'bg-indigo-600/25 text-indigo-200 font-semibold border border-indigo-500/30'
                        : 'text-slate-300 hover:bg-white/[0.05]'
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="font-mono text-indigo-400 text-xs">{item.icon}</span>
                      <span>{item.label}</span>
                    </span>
                    {layoutDirection === item.dir && <Check size={11} className="text-indigo-400 shrink-0" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {(onExportPng || onExportMermaid || onExportReport) && (
        <>
          <div className="h-3.5 w-px bg-white/[0.08] shrink-0" />
          <div className="flex items-center gap-1 shrink-0">
            {onExportPng && (
              <button
                onClick={onExportPng}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Export Knowledge Graph as Vector SVG"
              >
                <DownloadSimple size={12} className="text-sky-400" />
                <span className="hidden sm:inline">SVG</span>
              </button>
            )}
            {onExportMermaid && (
              <button
                onClick={onExportMermaid}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Copy or Export Mermaid.js Architecture Diagram"
              >
                <Code size={12} className="text-amber-400" />
                <span className="hidden sm:inline">Mermaid</span>
              </button>
            )}
            {onExportReport && (
              <button
                onClick={onExportReport}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium text-slate-300 hover:text-white hover:bg-white/[0.06] transition-colors"
                title="Generate Architecture Markdown Report"
              >
                <FileText size={12} className="text-emerald-400" />
                <span className="hidden sm:inline">Report</span>
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
