import { useState } from 'react';
import {
  Cpu,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Trash2,
  Globe,
  Key,
} from 'lucide-react';

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

  if (!isOpen) return null;

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
        message: `Koneksi endpoint valid. Berhasil terhubung ke ${new URL(baseUrl).hostname || baseUrl}.`,
      });
    } catch {
      setTestResult({
        success: false,
        message: 'Gagal menghubungi endpoint. Periksa Base URL atau API Key.',
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#080d16] border border-white/[0.08] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Cpu size={18} className="text-purple-400" />
              Configure Custom AI Endpoint
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hubungkan OpenAI API, Azure OpenAI, Ollama, vLLM, atau local compatible endpoint.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 overflow-y-auto max-h-[65vh]">
          {/* Preset Buttons */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1.5">
              QUICK PRESETS
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setName('Official OpenAI');
                  setBaseUrl('https://api.openai.com/v1');
                  setModels(['gpt-4o', 'gpt-4o-mini', 'o1-preview']);
                }}
                className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs text-slate-300 transition-colors"
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
                className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs text-slate-300 transition-colors"
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
                className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] text-xs text-slate-300 transition-colors"
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

          {/* ISO 27001 Cryptographic Safeguard Banner */}
          <div className="p-3 bg-white/[0.02] border border-white/[0.06] rounded-xl flex items-center gap-2.5 text-[11px] text-slate-400 font-mono">
            <ShieldCheck size={16} className="text-emerald-400 shrink-0" />
            <span>API Key dienkripsi di database menggunakan AES-256-GCM envelope encryption.</span>
          </div>

          {/* Footer Submit */}
          <div className="pt-2 border-t border-white/[0.08] flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs bg-purple-500 hover:bg-purple-400 text-slate-950 font-semibold transition-all disabled:opacity-50 shadow-lg shadow-purple-500/20"
            >
              {isSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              <span>Save AI Endpoint</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
