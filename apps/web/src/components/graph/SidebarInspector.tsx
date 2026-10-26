import { useState, useMemo } from 'react';
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
  X,
  Flame,
  ArrowDown,
  ArrowUp,
  WarningOctagon,
  ArrowRight,
  LightbulbFilament,
  Wrench,
} from '@phosphor-icons/react';
import type { CodeNodeData } from './CustomCodeNode';

interface SidebarInspectorProps {
  selectedNode: CodeNodeData | null;
  onSelectNodeByPath: (path: string) => void;
  onSelectNodeById?: (nodeId: string) => void;
  allNodes: CodeNodeData[];
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function SidebarInspector({
  selectedNode,
  onSelectNodeByPath,
  onSelectNodeById,
  allNodes,
  isOpenMobile,
  onCloseMobile,
}: SidebarInspectorProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'explorer' | 'hotspots' | 'cycles' | 'advisor' | 'security'>('details');
  const [copied, setCopied] = useState(false);

  // Filter circular nodes
  const circularNodes = useMemo(() => {
    return allNodes.filter((n) => n.isCircular && n.circularCycle && n.circularCycle.length > 0);
  }, [allNodes]);

  // Unique detected cycle paths
  const uniqueCycles = useMemo(() => {
    const seen = new Set<string>();
    const result: { cycle: string[]; nodes: CodeNodeData[] }[] = [];

    circularNodes.forEach((node) => {
      if (!node.circularCycle || node.circularCycle.length === 0) return;
      // Normalize cycle representation to avoid duplicate listings of the same cycle
      const cycleKey = [...node.circularCycle].sort().join('-');
      if (!seen.has(cycleKey)) {
        seen.add(cycleKey);
        const resolvedNodes = node.circularCycle
          .map((id) => allNodes.find((n) => (n as any).id === id || n.label === id))
          .filter(Boolean) as CodeNodeData[];
        result.push({ cycle: node.circularCycle, nodes: resolvedNodes });
      }
    });

    return result;
  }, [circularNodes, allNodes]);

  // Sort nodes by hotspot coupling score descending
  const hotspotNodes = useMemo(() => {
    return [...allNodes].sort((a, b) => {
      const scoreA = a.hotspotScore ?? (a.inDegree ?? 0) + (a.outDegree ?? 0);
      const scoreB = b.hotspotScore ?? (b.inDegree ?? 0) + (b.outDegree ?? 0);
      return scoreB - scoreA;
    });
  }, [allNodes]);

  const handleCopyCode = () => {
    if (!selectedNode) return;
    navigator.clipboard.writeText(selectedNode.codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Main Inspector Container */}
      <div
        className={`fixed md:relative top-12 bottom-0 right-0 md:top-auto md:bottom-auto w-full max-w-[380px] sm:w-[380px] h-[calc(100vh-48px)] bg-[#070b12] border-l border-white/[0.08] flex flex-col z-40 transition-transform duration-300 md:translate-x-0 ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : 'translate-x-full md:translate-x-0'
        }`}
      >
        {/* Mobile Header with Close Button */}
        <div className="flex md:hidden items-center justify-between px-4 py-2 border-b border-white/[0.08] bg-[#090e18]">
          <span className="text-xs font-semibold text-slate-200">AST Node Inspector</span>
          <button
            onClick={onCloseMobile}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06]"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation Segmented Glass Pill */}
        <div className="px-4 py-3 border-b border-white/[0.08]">
        <div className="flex bg-[#0d1422] p-1 rounded-lg border border-white/[0.06]">
          <button
            onClick={() => setActiveTab('details')}
            className={`flex-1 py-1.5 text-[11px] font-medium flex items-center justify-center gap-1 rounded-md transition-all ${
              activeTab === 'details'
                ? 'text-white bg-white/10 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Info size={12} />
            AST
          </button>
          <button
            onClick={() => setActiveTab('hotspots')}
            className={`flex-1 py-1.5 text-[11px] font-medium flex items-center justify-center gap-1 rounded-md transition-all ${
              activeTab === 'hotspots'
                ? 'text-amber-300 bg-amber-500/20 shadow-sm font-semibold border border-amber-500/30'
                : 'text-slate-400 hover:text-amber-300'
            }`}
          >
            <Flame size={12} weight={activeTab === 'hotspots' ? 'fill' : 'regular'} className={activeTab === 'hotspots' ? 'text-amber-400' : ''} />
            Hotspots
          </button>
          <button
            onClick={() => setActiveTab('cycles')}
            className={`flex-1 py-1.5 text-[11px] font-medium flex items-center justify-center gap-1 rounded-md transition-all relative ${
              activeTab === 'cycles'
                ? 'text-rose-300 bg-rose-500/20 shadow-sm font-semibold border border-rose-500/30'
                : 'text-slate-400 hover:text-rose-300'
            }`}
          >
            <WarningOctagon size={12} weight={activeTab === 'cycles' ? 'fill' : 'regular'} className={activeTab === 'cycles' ? 'text-rose-400' : ''} />
            Cycles
            {circularNodes.length > 0 && (
              <span className="text-[8px] font-mono px-1 py-0.2 rounded-full bg-rose-500/30 text-rose-300 border border-rose-500/40">
                {circularNodes.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('advisor')}
            className={`flex-1 py-1.5 text-[11px] font-medium flex items-center justify-center gap-1 rounded-md transition-all ${
              activeTab === 'advisor'
                ? 'text-cyan-300 bg-cyan-500/20 shadow-sm font-semibold border border-cyan-500/30'
                : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            <LightbulbFilament size={12} weight={activeTab === 'advisor' ? 'fill' : 'regular'} className={activeTab === 'advisor' ? 'text-cyan-400' : ''} />
            Advisor
          </button>
          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex-1 py-1.5 text-[11px] font-medium flex items-center justify-center gap-1 rounded-md transition-all ${
              activeTab === 'explorer'
                ? 'text-white bg-white/10 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderSimple size={12} />
            Files
          </button>
          <button
            onClick={() => setActiveTab('security')}
            className={`flex-1 py-1.5 text-[11px] font-medium flex items-center justify-center gap-1 rounded-md transition-all ${
              activeTab === 'security'
                ? 'text-white bg-white/10 shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck size={12} />
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
                <p className="text-xs">Select any node on the canvas to inspect its AST architecture.</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'hotspots' && (
          <div className="space-y-2">
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-amber-300 font-semibold text-xs">
                <Flame size={14} weight="fill" className="text-amber-400" />
                <span>Architectural Coupling Ranking</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Ranked by total connections (incoming dependents + outgoing dependencies). Nodes with score ≥ 4 are critical architectural bottlenecks.
              </p>
            </div>

            <div className="space-y-1 mt-3">
              {hotspotNodes.map((n, idx) => {
                const score = n.hotspotScore ?? (n.inDegree ?? 0) + (n.outDegree ?? 0);
                const isHot = score >= 4;
                const isSelected = selectedNode?.filePath === n.filePath;

                return (
                  <button
                    key={n.filePath}
                    onClick={() => onSelectNodeByPath(n.filePath)}
                    className={`w-full text-left p-2.5 rounded-xl border text-[11px] transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                        : isHot
                        ? 'bg-[#0d1422] border-amber-500/25 hover:border-amber-500/50 text-slate-200'
                        : 'bg-[#0b1320]/40 border-white/5 text-slate-400 hover:bg-[#0b1320] hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <span className={`text-[10px] font-mono font-bold w-4 text-center shrink-0 ${
                        idx < 3 ? 'text-amber-400' : 'text-slate-500'
                      }`}>
                        #{idx + 1}
                      </span>
                      <div className="truncate">
                        <div className="font-semibold text-slate-100 truncate flex items-center gap-1.5">
                          <span>{n.label}</span>
                          {isHot && (
                            <span className="text-[8px] font-mono uppercase px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                              HOT
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono truncate">
                          {n.filePath}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="flex items-center gap-1 text-[10px] font-mono bg-white/[0.04] px-1.5 py-0.5 rounded border border-white/[0.06]">
                        <span className="flex items-center text-sky-400" title="Incoming dependents">
                          <ArrowDown size={9} />{n.inDegree ?? 0}
                        </span>
                        <span className="text-slate-600">/</span>
                        <span className="flex items-center text-indigo-400" title="Outgoing dependencies">
                          <ArrowUp size={9} />{n.outDegree ?? 0}
                        </span>
                      </div>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isHot
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-white/5 text-slate-400'
                      }`}>
                        {score}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'cycles' && (
          <div className="space-y-4">
            <div className="p-3 bg-rose-950/20 border border-rose-500/20 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-400">
                <WarningOctagon size={14} weight="fill" />
                <span>Recursive Dependency Loops</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Components entangled in circular dependencies degrade modularity, break tree-shaking, and risk deadlock during initialization.
              </p>
            </div>

            <div className="space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">
                Detected Cycles ({uniqueCycles.length})
              </div>

              {uniqueCycles.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-400 bg-[#0b1320]/40 rounded-xl border border-white/5">
                  No circular dependencies detected. Codebase graph is clean.
                </div>
              ) : (
                uniqueCycles.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-[#0a101d] rounded-xl border border-rose-500/30 space-y-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                        Cycle Loop #{idx + 1} ({item.cycle.length - 1} Hops)
                      </span>
                    </div>

                    {/* Step-by-step chain */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                      {item.cycle.map((nodeName, cIdx) => {
                        const isLast = cIdx === item.cycle.length - 1;
                        return (
                          <div key={cIdx} className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectNodeById) onSelectNodeById(nodeName);
                                const match = allNodes.find((n) => (n as any).id === nodeName || n.label === nodeName);
                                if (match) onSelectNodeByPath(match.filePath);
                              }}
                              className={`px-2 py-1 rounded text-left transition-colors border ${
                                isLast
                                  ? 'bg-rose-500/20 text-rose-200 border-rose-500/40 font-semibold'
                                  : 'bg-white/[0.04] text-slate-200 border-white/[0.08] hover:bg-white/[0.08]'
                              }`}
                              title={`Focus ${nodeName} on canvas`}
                            >
                              {nodeName}
                            </button>
                            {!isLast && <ArrowRight size={10} className="text-rose-400 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-1">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1 mb-2">
                All Affected Components ({circularNodes.length})
              </div>
              {circularNodes.map((n) => {
                const isSelected = selectedNode?.filePath === n.filePath;
                return (
                  <button
                    key={n.filePath}
                    onClick={() => {
                      if (onSelectNodeById && (n as any).id) onSelectNodeById((n as any).id);
                      onSelectNodeByPath(n.filePath);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-[11px] font-mono transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-rose-500/15 border-rose-500/50 text-rose-200'
                        : 'bg-[#0b1320]/40 border-rose-500/20 text-slate-300 hover:bg-[#0b1320] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <WarningOctagon size={13} className="text-rose-400 shrink-0" weight="fill" />
                      <div className="truncate">
                        <span className="font-semibold">{n.label}</span>
                        <div className="text-[10px] text-slate-500 font-mono truncate">
                          {n.filePath}
                        </div>
                      </div>
                    </div>
                    <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0">
                      CYCLE
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'advisor' && (
          <div className="space-y-4">
            <div className="p-3 bg-cyan-950/25 border border-cyan-500/25 rounded-xl space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                <LightbulbFilament size={14} weight="fill" />
                <span>Architectural Decoupling Advisor</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                Automated structural refactoring recommendations to break dependency cycles, reduce fan-in bottlenecks, and elevate cohesion.
              </p>
            </div>

            {/* Context-aware advice for currently selected node */}
            {selectedNode && (
              <div className="p-3.5 bg-[#0a101d] rounded-xl border border-sky-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-semibold uppercase text-sky-400">
                    Target: {selectedNode.label}
                  </span>
                  <span className="text-[9px] font-mono text-slate-400">
                    Coupling: {selectedNode.hotspotScore ?? (selectedNode.inDegree ?? 0) + (selectedNode.outDegree ?? 0)}
                  </span>
                </div>

                {selectedNode.isCircular ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-rose-300 text-[11px]">
                      <Wrench size={13} className="text-rose-400" />
                      <span>Break Recursive Cycle: Dependency Inversion</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Extract an abstract interface or port (e.g. <code className="text-amber-300 font-mono">I{selectedNode.label}</code>) and inject it via constructor/prop into callers instead of directly importing the concrete implementation.
                    </p>
                  </div>
                ) : (selectedNode.inDegree ?? 0) >= 3 && (selectedNode.outDegree ?? 0) >= 2 ? (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-300 text-[11px]">
                      <Wrench size={13} className="text-amber-400" />
                      <span>High Fan-in / Fan-out: Introduce Facade / Mediator</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      This component acts as an architectural nexus. Consider splitting side-effects into a dedicated event emitter or mediator service to isolate domain logic from orchestrations.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-300 text-[11px]">
                      <CheckCircle size={13} className="text-emerald-400" weight="fill" />
                      <span>Healthy Modularity</span>
                    </div>
                    <p className="text-[11px] text-slate-300 leading-relaxed">
                      Low coupling observed. Clean boundary lines between upstream dependents and downstream dependencies.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* General Best-Practice Strategies */}
            <div className="space-y-2.5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500 px-1">
                Refactoring Strategies
              </div>

              <div className="p-3 bg-[#0a101d] rounded-xl border border-white/[0.06] space-y-1.5">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-400" />
                  <span>1. Extract Shared Kernel / Domain Types</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  When two modules import each other only for TypeScript interfaces or constants, move shared types into a standalone <code className="text-slate-200 font-mono">*.types.ts</code> or common kernel package.
                </p>
              </div>

              <div className="p-3 bg-[#0a101d] rounded-xl border border-white/[0.06] space-y-1.5">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />
                  <span>2. Event-Driven Decoupling</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Replace direct downstream method invocation with pub/sub domain events (e.g., RxJS, EventEmitter, or Zustand dispatchers).
                </p>
              </div>

              <div className="p-3 bg-[#0a101d] rounded-xl border border-white/[0.06] space-y-1.5">
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span>3. Inversion of Control (IoC)</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Pass caller dependencies via callback parameters or Context Provider instead of importing singleton instances.
                </p>
              </div>
            </div>
          </div>
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
            <div className="p-3.5 bg-emerald-950/20 border border-emerald-500/20 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs">
                <ShieldCheck size={16} weight="duotone" />
                <span>ISO/IEC 27001 Cryptographic Safeguards</span>
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                All SSH private keys, remote tokens, and API credentials are encrypted with PBKDF2-SHA256 (310,000 iterations) and AES-256-GCM envelope authenticated encryption.
              </p>
            </div>

            <div className="p-3.5 bg-[#0b1320]/60 border border-white/5 rounded-2xl space-y-2 text-xs">
              <div className="text-slate-200 font-medium text-[11px] uppercase tracking-wider font-mono">
                Active Security Policies:
              </div>
              <ul className="space-y-2 text-slate-400 text-[11px]">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  Plaintext credentials never persist on disk or in log streams
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  SFTP remote traversal strictly sandboxed per session
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  OAuth tokens and API keys decrypted in-memory on demand
                </li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
