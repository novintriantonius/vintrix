import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Code,
  Database,
  ShieldCheck,
  Cpu,
  GitCommit,
  CheckCircle,
  Flame,
} from '@phosphor-icons/react';

export type NodeKind = 'controller' | 'service' | 'database' | 'security' | 'gateway';

export interface CodeNodeData {
  label: string;
  kind: NodeKind;
  sourceName?: string; // Repository or Server identifier (e.g., 'frontend-repo', 'backend-repo', 'ssh-prod')
  sourceType?: 'git' | 'ssh';
  filePath: string;
  lines: string;
  methodCount: number;
  dependencyCount: number;
  status: 'synced' | 'indexing' | 'warning';
  summary: string;
  codeSnippet: string;
  tags?: string[];
  inDegree?: number;
  outDegree?: number;
  hotspotScore?: number;
  isDimmed?: boolean;
  isBlastRadius?: boolean;
  blastRole?: 'target' | 'upstream' | 'downstream';
  [key: string]: unknown;
}

const KIND_CONFIG: Record<
  NodeKind,
  {
    icon: typeof Code;
    color: string;
    label: string;
    dotBg: string;
    badgeBg: string;
  }
> = {
  controller: {
    icon: Cpu,
    color: '#38bdf8',
    label: 'API',
    dotBg: 'bg-sky-400',
    badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  },
  service: {
    icon: Code,
    color: '#34d399',
    label: 'SERVICE',
    dotBg: 'bg-emerald-400',
    badgeBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  },
  database: {
    icon: Database,
    color: '#fbbf24',
    label: 'DATABASE',
    dotBg: 'bg-amber-400',
    badgeBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  },
  security: {
    icon: ShieldCheck,
    color: '#f43f5e',
    label: 'SECURITY',
    dotBg: 'bg-rose-400',
    badgeBg: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
  },
  gateway: {
    icon: GitCommit,
    color: '#a78bfa',
    label: 'GATEWAY',
    dotBg: 'bg-purple-400',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  },
};

export const CustomCodeNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as unknown as CodeNodeData;
  const config = KIND_CONFIG[nodeData.kind] || KIND_CONFIG.service;
  const isHot = nodeData.hotspotScore !== undefined && nodeData.hotspotScore >= 4;
  const isDimmed = nodeData.isDimmed && !selected;
  const blastRole = nodeData.blastRole;

  return (
    <div
      className={`relative w-[260px] rounded-xl transition-all duration-300 text-left select-none group cursor-pointer ${
        isDimmed
          ? 'opacity-25 grayscale hover:grayscale-0 hover:opacity-100 border border-white/[0.04] bg-[#080d16]/60'
          : selected
          ? 'ring-2 ring-sky-400 shadow-[0_0_30px_rgba(56,189,248,0.35)] bg-[#0c1424] border-transparent'
          : blastRole === 'upstream'
          ? 'ring-1 ring-emerald-400/80 shadow-[0_0_20px_rgba(52,211,153,0.25)] border-emerald-500/50 bg-[#08151a]'
          : blastRole === 'downstream'
          ? 'ring-1 ring-indigo-400/80 shadow-[0_0_20px_rgba(129,140,248,0.25)] border-indigo-500/50 bg-[#0f1124]'
          : isHot
          ? 'border border-amber-500/40 hover:border-amber-500/70 bg-[#0a0f1d]/95 hover:bg-[#0d1426] shadow-[0_0_15px_rgba(245,158,11,0.12)]'
          : 'border border-white/[0.08] hover:border-white/20 bg-[#080d16]/95 hover:bg-[#0b121f] shadow-lg shadow-black/40'
      }`}
    >
      {/* Blast role badge banner */}
      {blastRole && blastRole !== 'target' && (
        <div className="absolute -top-2.5 right-3 z-10">
          <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded-full font-bold shadow-md border ${
            blastRole === 'upstream'
              ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40'
              : 'bg-indigo-950 text-indigo-300 border-indigo-500/40'
          }`}>
            {blastRole === 'upstream' ? '↑ CALLER' : '↓ CALLEE'}
          </span>
        </div>
      )}

      {/* Animated Subtle Pulse Ring for HOT nodes when not manually selected and not dimmed */}
      {isHot && !selected && !isDimmed && (
        <div className="absolute -inset-[1px] rounded-xl border border-amber-500/30 animate-pulse pointer-events-none" />
      )}
      {/* Top connection handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-slate-400 !border-2 !border-[#050a10] !rounded-full transition-transform hover:!scale-150 hover:!bg-sky-400"
      />

      <div className="p-3 space-y-2.5">
        {/* Header: Kind tag + Source/Repo badge + Sync indicator */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded border font-semibold flex items-center gap-1 ${config.badgeBg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${config.dotBg}`} />
              {config.label}
            </span>
            {nodeData.sourceName && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/[0.04] text-slate-400 border border-white/[0.06] truncate max-w-[90px]" title={nodeData.sourceName}>
                {nodeData.sourceName}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {nodeData.hotspotScore !== undefined && nodeData.hotspotScore >= 4 && (
              <span
                className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-0.5 font-bold"
                title={`Hotspot Centrality Score: ${nodeData.hotspotScore} (High coupling)`}
              >
                <Flame size={10} weight="fill" className="text-amber-400" />
                <span>HOT</span>
              </span>
            )}
            <div className="flex items-center gap-1 text-[10px] text-emerald-400/90 font-mono">
              <CheckCircle size={11} weight="fill" />
              <span className="text-[9px]">SYNC</span>
            </div>
          </div>
        </div>

        {/* Node Name */}
        <div>
          <h4 className="text-[13px] font-semibold text-slate-100 tracking-tight leading-snug truncate">
            {nodeData.label}
          </h4>
          <p className="text-[11px] text-slate-400/90 mt-1 line-clamp-2 leading-relaxed">
            {nodeData.summary}
          </p>
        </div>

        {/* Footer info: Metrics & Path */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-1.5 truncate max-w-[150px]" title={nodeData.filePath}>
            <span className="truncate">{nodeData.filePath}</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {nodeData.inDegree !== undefined && nodeData.outDegree !== undefined ? (
              <span title={`In-degree: ${nodeData.inDegree} dependents | Out-degree: ${nodeData.outDegree} dependencies`}>
                ↓{nodeData.inDegree} ↑{nodeData.outDegree}
              </span>
            ) : (
              <span>{nodeData.dependencyCount}d</span>
            )}
            <span>•</span>
            <span>{nodeData.methodCount}m</span>
          </div>
        </div>
      </div>

      {/* Bottom connection handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-slate-400 !border-2 !border-[#050a10] !rounded-full transition-transform hover:!scale-150 hover:!bg-sky-400"
      />
    </div>
  );
});

CustomCodeNode.displayName = 'CustomCodeNode';
