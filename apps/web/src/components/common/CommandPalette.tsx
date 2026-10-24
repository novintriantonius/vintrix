import React, { useState, useEffect, useRef } from 'react';
import {
  MagnifyingGlass,
  Code,
  FileCode,
  ChatCircleText,
  GitBranch,
  SlidersHorizontal,
  X,
  ArrowRight,
} from '@phosphor-icons/react';
import type { Node } from '@xyflow/react';
import type { CodeNodeData } from '../graph/CustomCodeNode';

export interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: Node<CodeNodeData>[];
  onSelectNode: (node: Node<CodeNodeData>) => void;
  onNavigateTab: (tab: 'graph' | 'chat') => void;
  onOpenManageSources: () => void;
  onOpenAddSource: () => void;
  onOpenAIConfig: () => void;
}

interface CommandItem {
  id: string;
  category: 'ast' | 'navigation' | 'action';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  badge?: string;
  action: () => void;
}

export function CommandPalette({
  isOpen,
  onClose,
  nodes,
  onSelectNode,
  onNavigateTab,
  onOpenManageSources,
  onOpenAddSource,
  onOpenAIConfig,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Global keydown listener for palette navigation & ESC
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Build items list
  const navigationItems: CommandItem[] = [
    {
      id: 'nav-graph',
      category: 'navigation',
      title: 'Go to Knowledge Graph View',
      subtitle: 'Explore codebase architecture and AST nodes',
      icon: <GitBranch className="w-4 h-4 text-sky-400" />,
      badge: 'View',
      action: () => {
        onNavigateTab('graph');
        onClose();
      },
    },
    {
      id: 'nav-chat',
      category: 'navigation',
      title: 'Open AI Codebase Copilot',
      subtitle: 'Ask contextual architecture questions with LLM',
      icon: <ChatCircleText className="w-4 h-4 text-purple-400" />,
      badge: 'View',
      action: () => {
        onNavigateTab('chat');
        onClose();
      },
    },
    {
      id: 'act-add-source',
      category: 'action',
      title: 'Connect New Code Source',
      subtitle: 'Add Git repository or remote SSH/SFTP workspace',
      icon: <Code className="w-4 h-4 text-emerald-400" />,
      badge: 'Action',
      action: () => {
        onOpenAddSource();
        onClose();
      },
    },
    {
      id: 'act-manage-sources',
      category: 'action',
      title: 'Manage Code Sources',
      subtitle: 'Review connected repositories and index status',
      icon: <SlidersHorizontal className="w-4 h-4 text-amber-400" />,
      badge: 'Action',
      action: () => {
        onOpenManageSources();
        onClose();
      },
    },
    {
      id: 'act-ai-config',
      category: 'action',
      title: 'Configure Custom AI Endpoints',
      subtitle: 'Set up OpenAI API keys, Ollama, or custom models',
      icon: <SlidersHorizontal className="w-4 h-4 text-indigo-400" />,
      badge: 'Action',
      action: () => {
        onOpenAIConfig();
        onClose();
      },
    },
  ];

  // Convert nodes to AST items
  const astItems: CommandItem[] = nodes.map((n) => ({
    id: `node-${n.id}`,
    category: 'ast',
    title: n.data.label,
    subtitle: `${n.data.filePath} • ${n.data.sourceName || 'Workspace'}`,
    icon: <FileCode className="w-4 h-4 text-cyan-400" />,
    badge: n.data.kind,
    action: () => {
      onSelectNode(n);
      onClose();
    },
  }));

  const allItems = [...astItems, ...navigationItems];

  const filteredItems = query.trim()
    ? allItems.filter((item) => {
        const q = query.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          (item.subtitle && item.subtitle.toLowerCase().includes(q)) ||
          (item.badge && item.badge.toLowerCase().includes(q))
        );
      })
    : allItems;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl bg-[#090e18] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.08] bg-[#070b13]">
          <MagnifyingGlass className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search AST nodes, files, actions, or views..."
            className="flex-1 bg-transparent text-sm text-slate-100 placeholder-slate-500 outline-none font-mono"
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white/[0.06] border border-white/10 rounded">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 divide-y divide-white/[0.04] scrollbar-thin scrollbar-thumb-white/10"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              No matching AST nodes or actions found for "{query}".
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-sky-500/15 border border-sky-500/30 text-white'
                      : 'hover:bg-white/[0.04] text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected ? 'bg-sky-500/20 text-sky-300' : 'bg-white/[0.06] text-slate-400'
                      }`}
                    >
                      {item.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium font-mono truncate flex items-center gap-2">
                        <span>{item.title}</span>
                        {item.badge && (
                          <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-400 font-sans border border-white/[0.06]">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      {item.subtitle && (
                        <div className="text-[11px] text-slate-400 truncate mt-0.5 font-sans">
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>

                  <ArrowRight
                    className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                      isSelected ? 'text-sky-400 translate-x-0.5' : 'text-slate-600'
                    }`}
                  />
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-4 py-2 border-t border-white/[0.08] bg-[#070b13] flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 text-[9px] font-mono bg-white/[0.06] border border-white/10 rounded">↑</kbd>
              <kbd className="px-1 py-0.5 text-[9px] font-mono bg-white/[0.06] border border-white/10 rounded">↓</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-white/[0.06] border border-white/10 rounded">↵</kbd>
              Select
            </span>
          </div>
          <span>{filteredItems.length} items</span>
        </div>
      </div>
    </div>
  );
}
