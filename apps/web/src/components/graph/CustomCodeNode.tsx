import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import {
  Code,
  Database,
  ShieldCheck,
  Cpu,
  GitCommit,
  CheckCircle,
} from '@phosphor-icons/react';

export type NodeKind = 'controller' | 'service' | 'database' | 'security' | 'gateway';

export interface CodeNodeData {
  label: string;
  kind: NodeKind;
  filePath: string;
  lines: string;
  methodCount: number;
  dependencyCount: number;
  status: 'synced' | 'indexing' | 'warning';
  summary: string;
  codeSnippet: string;
  tags?: string[];
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

  return (
    <div
      className={`relative w-[260px] rounded-xl transition-all duration-200 text-left select-none group cursor-pointer ${
        selected
          ? 'ring-1 ring-sky-400/80 shadow-[0_0_24px_rgba(56,189,248,0.22)] bg-[#0c1424]'
          : 'border border-white/[0.08] hover:border-white/20 bg-[#080d16]/95 hover:bg-[#0b121f] shadow-lg shadow-black/40'
      }`}
    >
      {/* Top connection handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-slate-400 !border-2 !border-[#050a10] !rounded-full transition-transform hover:!scale-150 hover:!bg-sky-400"
      />

      <div className="p-3 space-y-2.5">
        {/* Header: Kind tag + Title + Sync indicator */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className={`text-[9px] font-mono tracking-wider px-1.5 py-0.5 rounded border font-semibold flex items-center gap-1 ${config.badgeBg}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${config.dotBg}`} />
              {config.label}
            </span>
            <span className="text-[10px] font-mono text-slate-500 truncate" title={nodeData.filePath}>
              {nodeData.filePath.split('/').pop()}
            </span>
          </div>

          <div className="flex items-center gap-1 text-[10px] text-emerald-400/90 font-mono shrink-0">
            <CheckCircle size={11} weight="fill" />
            <span className="text-[9px]">SYNC</span>
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

        {/* Footer info: Metrics & Tags */}
        <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-[10px] font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span>{nodeData.methodCount} methods</span>
            <span>•</span>
            <span>{nodeData.dependencyCount} deps</span>
          </div>
          {nodeData.tags && nodeData.tags[0] && (
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-white/[0.04] text-slate-400 border border-white/[0.06]">
              #{nodeData.tags[0]}
            </span>
          )}
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
