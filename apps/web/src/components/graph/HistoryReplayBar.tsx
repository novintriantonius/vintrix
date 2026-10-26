import { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  ClockCounterClockwise,
  SkipForward,
  SkipBack,
  X,
  GitCommit,
} from '@phosphor-icons/react';

export interface TimelineSnapshot {
  id: string;
  commitHash: string;
  commitMessage: string;
  author: string;
  timestamp: string;
  activeNodeIds: string[];
  activeEdgeIds: string[];
  changedNodeId?: string;
}

interface HistoryReplayBarProps {
  isOpen: boolean;
  onClose: () => void;
  snapshots: TimelineSnapshot[];
  currentIndex: number;
  onSelectIndex: (index: number | ((prev: number) => number)) => void;
}

export function HistoryReplayBar({
  isOpen,
  onClose,
  snapshots,
  currentIndex,
  onSelectIndex,
}: HistoryReplayBarProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 2 | 4>(1);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const total = snapshots.length;
  const currentSnapshot = snapshots[currentIndex] || snapshots[0];

  useEffect(() => {
    if (isPlaying) {
      const intervalMs = Math.round(1600 / playbackSpeed);
      timerRef.current = setInterval(() => {
        onSelectIndex((prevIndex: number) => {
          if (prevIndex >= total - 1) {
            setIsPlaying(false);
            return prevIndex;
          }
          return prevIndex + 1;
        });
      }, intervalMs);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPlaying, playbackSpeed, total, onSelectIndex]);

  if (!isOpen || total === 0) return null;

  return (
    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-30 w-[94vw] max-w-2xl bg-[#080d16]/95 backdrop-blur-md border border-sky-500/30 rounded-2xl p-3 sm:p-4 shadow-[0_0_40px_rgba(14,165,233,0.15)] font-mono text-xs">
      {/* Top Header info */}
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <ClockCounterClockwise size={16} weight="bold" className="text-sky-400 animate-spin-slow" />
          <span className="font-semibold text-sky-300 text-[11px] sm:text-xs">
            Architecture History Replay
          </span>
          <span className="text-[10px] bg-sky-950/60 text-sky-400 border border-sky-500/30 px-1.5 py-0.2 rounded-full">
            Step {currentIndex + 1} of {total}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            Speed:
          </span>
          <div className="flex items-center rounded border border-white/10 bg-[#0c1424] overflow-hidden text-[10px]">
            {([1, 2, 4] as const).map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-1.5 py-0.5 transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-sky-500/30 text-sky-200 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/[0.06] transition-colors"
            title="Exit History Replay"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Snapshot Commit Details */}
      <div className="py-2.5 flex items-start gap-2 text-slate-300">
        <GitCommit size={16} className="text-emerald-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-100 truncate text-[11px] sm:text-xs">
              {currentSnapshot?.commitMessage}
            </span>
            <span className="text-[10px] font-mono text-emerald-400/80 bg-emerald-950/40 px-1 py-0.2 rounded border border-emerald-500/20">
              {currentSnapshot?.commitHash}
            </span>
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {currentSnapshot?.author} • {currentSnapshot?.timestamp} • {currentSnapshot?.activeNodeIds.length} nodes active
          </div>
        </div>
      </div>

      {/* Timeline Scrubber Slider */}
      <div className="relative pt-1 pb-2">
        <input
          type="range"
          min={0}
          max={total - 1}
          value={currentIndex}
          onChange={(e) => onSelectIndex(Number(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-400 hover:accent-sky-300 transition-all"
        />
        <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono">
          <span>Initial Architecture</span>
          <span>Latest Release</span>
        </div>
      </div>

      {/* Playback Controls Footer */}
      <div className="flex items-center justify-center gap-3 pt-1">
        <button
          type="button"
          onClick={() => onSelectIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex <= 0}
          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
          title="Previous Step"
        >
          <SkipBack size={14} weight="fill" />
        </button>

        <button
          type="button"
          onClick={() => setIsPlaying((prev) => !prev)}
          className="px-4 py-1.5 rounded-full bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center gap-1.5 shadow-md shadow-sky-500/20 transition-all text-xs"
        >
          {isPlaying ? (
            <>
              <Pause size={13} weight="fill" />
              <span>Pause</span>
            </>
          ) : (
            <>
              <Play size={13} weight="fill" />
              <span>{currentIndex >= total - 1 ? 'Replay' : 'Play'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => onSelectIndex(Math.min(total - 1, currentIndex + 1))}
          disabled={currentIndex >= total - 1}
          className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] disabled:opacity-30 disabled:cursor-not-allowed text-slate-300"
          title="Next Step"
        >
          <SkipForward size={14} weight="fill" />
        </button>
      </div>
    </div>
  );
}
