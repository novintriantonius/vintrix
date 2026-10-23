import React, { useState, useRef, useEffect } from 'react';
import { Folder, X, Plus, Loader2 } from 'lucide-react';

interface PathTagInputProps {
  paths: string[];
  onAddPath: (path: string) => void;
  onRemovePath: (index: number) => void;
  placeholder?: string;
  suggestions?: string[];
  isSearchingSuggestions?: boolean;
  onInputChange?: (val: string) => void;
  disabled?: boolean;
}

export function PathTagInput({
  paths,
  onAddPath,
  onRemovePath,
  placeholder = 'e.g. apps/web/src/ or /var/www/',
  suggestions = [],
  isSearchingSuggestions = false,
  onInputChange,
  disabled = false,
}: PathTagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAdd = (valueToAdd?: string) => {
    const val = (valueToAdd ?? inputValue).trim();
    if (val && !paths.includes(val)) {
      onAddPath(val);
      setInputValue('');
      setShowDropdown(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onInputChange?.(val);
    if (suggestions.length > 0 || isSearchingSuggestions) {
      setShowDropdown(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className={`space-y-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Existing Path Badges */}
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {paths.length === 0 ? (
          <span className="text-xs text-slate-500 italic">No paths added yet.</span>
        ) : (
          paths.map((path, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-sky-500/10 text-sky-300 border border-sky-500/20 text-xs font-mono"
            >
              <Folder size={11} className="shrink-0" />
              <span className="truncate max-w-[240px]">{path}</span>
              <button
                type="button"
                onClick={() => onRemovePath(idx)}
                className="text-slate-400 hover:text-rose-400 transition-colors"
                aria-label={`Remove ${path}`}
              >
                <X size={12} />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Input & Autocomplete Dropdown */}
      <div className="relative" ref={dropdownRef}>
        <div className="flex gap-2">
          <input
            type="text"
            disabled={disabled}
            placeholder={placeholder}
            value={inputValue}
            onChange={handleChange}
            onFocus={() => {
              if (suggestions.length > 0) setShowDropdown(true);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-[#050912] border border-white/[0.08] focus:border-sky-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none font-mono"
          />
          <button
            type="button"
            disabled={disabled || !inputValue.trim()}
            onClick={() => handleAdd()}
            className="px-3 py-1.5 bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-40 text-slate-200 border border-white/[0.08] rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <Plus size={13} />
            <span>Add</span>
          </button>
        </div>

        {/* Dropdown Suggestions */}
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#080d16] border border-white/[0.12] rounded-xl shadow-2xl z-30 overflow-hidden max-h-48 overflow-y-auto">
            <div className="p-2 border-b border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
              <span>AVAILABLE DIRECTORIES</span>
              {isSearchingSuggestions && <Loader2 size={11} className="animate-spin text-sky-400" />}
            </div>
            <div className="p-1 space-y-0.5">
              {suggestions.map((dir, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    const base = inputValue.endsWith('/') || !inputValue ? inputValue : `${inputValue}/`;
                    const selected = inputValue.startsWith('/')
                      ? `${base.replace(/\/+$/, '')}/${dir}`
                      : dir;
                    handleAdd(selected);
                  }}
                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs font-mono text-slate-300 hover:bg-sky-500/20 hover:text-sky-200 transition-colors"
                >
                  <Folder size={12} className="text-sky-400 shrink-0" />
                  <span className="truncate">{dir}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
