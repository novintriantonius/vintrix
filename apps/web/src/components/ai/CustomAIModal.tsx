import { useState } from 'react';
import {
  Cpu,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Globe,
  Key,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../common';

export interface AIEndpoint {
  id: string;
  name: string;
  baseUrl: string;
  models: { id: string; modelId: string; displayName: string }[];
  isDefault?: boolean;
}

interface CustomAIModalProps {
  isOpen: boolean;
  workspaceId?: string;
  onClose: () => void;
  onEndpointSaved: (endpoint: AIEndpoint) => void;
}

export function CustomAIModal({ isOpen, workspaceId, onClose, onEndpointSaved }: CustomAIModalProps) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>(['gpt-4o', 'gpt-4o-mini']);
  const [newModelInput, setNewModelInput] = useState('');
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [selectedDiscoveredModel, setSelectedDiscoveredModel] = useState('');

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleFetchModels = async () => {
    if (!baseUrl.trim()) return;
    setIsFetchingModels(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/v1/ai/probe-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success && Array.isArray(data.models) && data.models.length > 0) {
        setDiscoveredModels(data.models);
        setSelectedDiscoveredModel(data.models[0]);
        // Also auto-add top models if empty
        if (models.length === 0) {
          setModels(data.models.slice(0, 3));
        }
        setTestResult({
          success: true,
          message: data.message || `Discovered ${data.models.length} models.`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || 'Could not fetch models. You can enter model name manually.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Network error while querying models endpoint.',
      });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleAddSelectedModel = () => {
    if (selectedDiscoveredModel && !models.includes(selectedDiscoveredModel)) {
      setModels([...models, selectedDiscoveredModel]);
    }
  };

  const handleAddModel = () => {
    if (newModelInput.trim() && !models.includes(newModelInput.trim())) {
      setModels([...models, newModelInput.trim()]);
      setNewModelInput('');
    }
  };

  const handleRemoveModel = (modelToRemove: string) => {
    setModels(models.filter((m) => m !== modelToRemove));
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/v1/ai/probe-models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (Array.isArray(data.models) && data.models.length > 0) {
          setDiscoveredModels(data.models);
          if (!selectedDiscoveredModel) {
            setSelectedDiscoveredModel(data.models[0]);
          }
        }
        setTestResult({
          success: true,
          message: `Endpoint verified! Reachable at ${new URL(baseUrl).hostname || baseUrl} (${data.models?.length ?? 0} models available).`,
        });
      } else {
        setTestResult({
          success: false,
          message: data.message || 'Failed to connect to endpoint.',
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Failed to connect to endpoint. Please verify Base URL and API Key.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      // 1. Save endpoint to backend database if workspaceId is present
      let endpointId = `ep-${Date.now()}`;
      const modelsWithIds = [];
      if (workspaceId && !workspaceId.startsWith('ws-vintrix')) {
        const epRes = await fetch('/api/v1/ai/endpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            name: name || 'Custom AI Endpoint',
            baseUrl: baseUrl.trim(),
            apiKey: apiKey.trim() || undefined,
            isDefault: false,
          }),
        });

        if (epRes.ok) {
          const epData = await epRes.json();
          endpointId = epData.id;

          // Also persist selected models to database
          for (const m of models) {
            try {
              const modelRes = await fetch('/api/v1/ai/models', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  endpointId,
                  modelId: m,
                  displayName: m,
                }),
              });
              if (modelRes.ok) {
                const modelData = await modelRes.json();
                modelsWithIds.push({
                  id: modelData.id,
                  modelId: m,
                  displayName: m,
                });
              } else {
                modelsWithIds.push({
                  id: m,
                  modelId: m,
                  displayName: m,
                });
              }
            } catch {
              modelsWithIds.push({
                id: m,
                modelId: m,
                displayName: m,
              });
            }
          }
        }
      }

      if (modelsWithIds.length === 0) {
        for (const m of models) {
          modelsWithIds.push({
            id: m,
            modelId: m,
            displayName: m,
          });
        }
      }

      const newEndpoint: AIEndpoint = {
        id: endpointId,
        name: name || 'Custom OpenAI Endpoint',
        baseUrl: baseUrl.trim(),
        models: modelsWithIds,
      };
      onEndpointSaved(newEndpoint);
      onClose();
    } catch (err: any) {
      console.error('Failed to save AI endpoint:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title="Configure Custom AI Endpoint"
      subtitle="Connect OpenAI API, Azure OpenAI, Ollama, vLLM, or any custom compatible endpoint."
      icon={<Cpu size={18} className="text-purple-400 shrink-0" />}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">AES-256-GCM Envelope Encryption</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="custom-ai-form"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-purple-500 hover:bg-purple-400 text-slate-950 font-semibold transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin text-slate-950" /> : <Plus size={14} />}
              <span>Save AI Endpoint</span>
            </button>
          </div>
        </div>
      }
    >
      <form id="custom-ai-form" onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-3.5">
        {/* Preset Buttons */}
        <div>
          <label className="block text-[10px] font-mono text-slate-400 mb-1">
            QUICK PRESETS
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => {
                setName('Official OpenAI');
                setBaseUrl('https://api.openai.com/v1');
                setModels(['gpt-4o', 'gpt-4o-mini', 'o1-preview']);
              }}
              className="px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] text-slate-300 transition-colors"
            >
              OpenAI Official
            </button>
            <button
              type="button"
              onClick={() => {
                setName('Local Ollama');
                setBaseUrl('http://localhost:11434/v1');
                setApiKey('ollama');
                setModels(['llama3.2', 'qwen2.5-coder', 'deepseek-r1']);
              }}
              className="px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] text-slate-300 transition-colors"
            >
              Ollama (Local)
            </button>
            <button
              type="button"
              onClick={() => {
                setName('OpenRouter');
                setBaseUrl('https://openrouter.ai/api/v1');
                setModels(['anthropic/claude-3.5-sonnet', 'deepseek/deepseek-chat']);
              }}
              className="px-2 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] text-slate-300 transition-colors"
            >
              OpenRouter
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1">
              ENDPOINT NAME
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Omniroute / OpenAI"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-[#050912] border border-white/[0.08] focus:border-purple-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono text-slate-400 mb-1 flex items-center gap-1.5">
              <Globe size={12} className="text-slate-400" />
              BASE URL
            </label>
            <input
              type="url"
              required
              placeholder="https://api.openai.com/v1"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              className="w-full bg-[#050912] border border-white/[0.08] focus:border-purple-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-slate-400 mb-1 flex items-center gap-1.5">
            <Key size={12} className="text-slate-400" />
            API KEY (OPTIONAL FOR LOCAL OLLAMA)
          </label>
          <input
            type="password"
            placeholder="sk-••••••••••••"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full bg-[#050912] border border-white/[0.08] focus:border-purple-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none font-mono"
          />
        </div>

        {/* Model Management */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[11px] font-mono text-slate-400">
              AVAILABLE MODELS
            </label>
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={isFetchingModels || !baseUrl}
              className="text-[10px] text-purple-400 hover:text-purple-300 flex items-center gap-1 font-mono transition-colors disabled:opacity-50"
            >
              {isFetchingModels ? (
                <Loader2 size={11} className="animate-spin" />
              ) : (
                <RefreshCw size={11} />
              )}
              <span>Auto-fetch from Endpoint</span>
            </button>
          </div>

          {/* Quick Select from Auto-Discovered Models */}
          {discoveredModels.length > 0 && (
            <div className="flex gap-2 mb-2 p-2 rounded-lg bg-purple-950/20 border border-purple-500/20">
              <select
                value={selectedDiscoveredModel}
                onChange={(e) => setSelectedDiscoveredModel(e.target.value)}
                className="flex-1 bg-[#050912] border border-white/[0.08] focus:border-purple-500/50 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none font-mono"
              >
                {discoveredModels.map((m) => (
                  <option key={m} value={m} className="bg-[#080d16] text-slate-200">
                    {m}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddSelectedModel}
                disabled={!selectedDiscoveredModel || models.includes(selectedDiscoveredModel)}
                className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 text-xs rounded-lg border border-purple-500/40 font-medium transition-colors disabled:opacity-40 flex items-center gap-1 shrink-0"
              >
                <Plus size={13} />
                <span>Add</span>
              </button>
            </div>
          )}

          {/* Manual Input Fallback */}
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Or enter model name manually (e.g. gpt-4o, claude-3-5-sonnet)"
              value={newModelInput}
              onChange={(e) => setNewModelInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddModel();
                }
              }}
              className="flex-1 bg-[#050912] border border-white/[0.08] focus:border-purple-500/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 outline-none font-mono"
            />
            <button
              type="button"
              onClick={handleAddModel}
              className="px-3 py-1.5 bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 text-xs rounded-lg border border-white/[0.08] font-medium transition-colors"
            >
              <Plus size={14} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto p-1 bg-[#050912] rounded-lg border border-white/[0.06]">
            {models.length === 0 ? (
              <span className="text-[11px] font-mono text-slate-500 px-2 py-1">No models added yet</span>
            ) : (
              models.map((model) => (
                <span
                  key={model}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/30 text-purple-300 font-mono text-[11px]"
                >
                  <span>{model}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveModel(model)}
                    className="hover:text-rose-400 transition-colors ml-0.5"
                  >
                    <Trash2 size={11} />
                  </button>
                </span>
              ))
            )}
          </div>
        </div>

        {/* Probe Connection */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting || !baseUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08] transition-all disabled:opacity-50"
          >
            {isTesting ? <Loader2 size={13} className="animate-spin text-purple-400" /> : <Globe size={13} />}
            <span>Test Endpoint Reachability</span>
          </button>
        </div>

        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              testResult.success
                ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-950/20 border-rose-500/30 text-rose-300'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 size={15} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={15} className="text-rose-400 shrink-0 mt-0.5" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}
      </form>
    </Modal>
  );
}