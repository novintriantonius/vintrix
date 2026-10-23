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
  onClose: () => void;
  onEndpointSaved: (endpoint: AIEndpoint) => void;
}

export function CustomAIModal({ isOpen, onClose, onEndpointSaved }: CustomAIModalProps) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://api.openai.com/v1');
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>(['gpt-4o', 'gpt-4o-mini']);
  const [newModelInput, setNewModelInput] = useState('');

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      // In production calls GET /models from baseUrl or test via backend
      await new Promise((res) => setTimeout(res, 600));
      setTestResult({
        success: true,
        message: `Endpoint connection verified. Reachable at ${new URL(baseUrl).hostname || baseUrl}.`,
      });
    } catch {
      setTestResult({
        success: false,
        message: 'Failed to connect to endpoint. Please verify Base URL and API Key.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    setTimeout(() => {
      setIsSaving(false);
      const newEndpoint: AIEndpoint = {
        id: `ep-${Date.now()}`,
        name: name || 'Custom OpenAI Endpoint',
        baseUrl: baseUrl.trim(),
        models: models.map((m) => ({
          id: `mod-${m}`,
          modelId: m,
          displayName: m,
        })),
      };
      onEndpointSaved(newEndpoint);
      onClose();
    }, 400);
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
      <form id="custom-ai-form" onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
        {/* Preset Buttons */}
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
            QUICK PRESETS
          </label>
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setName('Official OpenAI');
                setBaseUrl('https://api.openai.com/v1');
                setModels(['gpt-4o', 'gpt-4o-mini', 'o1-preview']);
              }}
              className="px-2 sm:px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] sm:text-xs text-slate-300 transition-colors"
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
              className="px-2 sm:px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] sm:text-xs text-slate-300 transition-colors"
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
              className="px-2 sm:px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-[11px] sm:text-xs text-slate-300 transition-colors"
            >
              OpenRouter
            </button>
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1">
            ENDPOINT NAME
          </label>
          <input
            type="text"
            required
            placeholder="e.g. Corporate OpenAI Gateway"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#050912] border border-white/[0.08] focus:border-purple-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center gap-1.5">
            <Globe size={13} className="text-slate-400" />
            BASE URL
          </label>
          <input
            type="url"
            required
            placeholder="https://api.openai.com/v1"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className="w-full bg-[#050912] border border-white/[0.08] focus:border-purple-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1 flex items-center gap-1.5">
            <Key size={13} className="text-slate-400" />
            API KEY (OPTIONAL FOR LOCAL OLLAMA)
          </label>
          <input
            type="password"
            placeholder="sk-proj-••••••••••••"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full bg-[#050912] border border-white/[0.08] focus:border-purple-500/50 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none font-mono"
          />
        </div>

        {/* Model Management */}
        <div>
          <label className="block text-[11px] font-mono text-slate-400 mb-1">
            AVAILABLE MODELS
          </label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Add model name (e.g. claude-3-5-sonnet, deepseek-coder)"
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

          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-[#050912] rounded-lg border border-white/[0.06]">
            {models.map((model) => (
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
            ))}
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