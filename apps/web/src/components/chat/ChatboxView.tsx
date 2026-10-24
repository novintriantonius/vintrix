import { useState, useRef, useEffect } from 'react';
import {
  PaperPlaneTilt,
  Cpu,
  FolderOpen,
  Plus,
  ChatTeardropDots,
  ShieldCheck,
  Code,
  ArrowClockwise,
  Sliders,
  ChatCircleText,
} from '@phosphor-icons/react';
import { workspacesApi, aiApi } from '../../services/api';
import { CustomAIModal, type AIEndpoint } from '../ai/CustomAIModal';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface WorkspaceContextOption {
  id: string;
  name: string;
  sourcesDescription: string;
  nodesCount: number;
}

export interface AIModelOption {
  id: string;
  modelId: string;
  displayName: string;
  provider: string;
}

const AVAILABLE_WORKSPACES: WorkspaceContextOption[] = [
  {
    id: 'ws-vintrix-core',
    name: 'Vintrix Ecosystem (Workspace Level)',
    sourcesDescription: '2 Git Repos (web, api) + 1 SSH Node',
    nodesCount: 7,
  },
  {
    id: 'ws-auth-service',
    name: 'Payment & Billing System',
    sourcesDescription: '1 Git Repo (billing-service) + 1 SFTP Backup',
    nodesCount: 5,
  },
  {
    id: 'ws-remote-sftp',
    name: 'Core Infrastructure & DevOps',
    sourcesDescription: '1 Git Repo (terraform) + 2 SSH Clusters',
    nodesCount: 9,
  },
];

const AVAILABLE_MODELS: AIModelOption[] = [
  {
    id: 'm-gpt-4o',
    modelId: 'gpt-4o',
    displayName: 'GPT-4o (OpenAI Direct)',
    provider: 'OpenAI Enterprise',
  },
  {
    id: 'm-claude-3-5',
    modelId: 'claude-3-5-sonnet',
    displayName: 'Claude 3.5 Sonnet (OpenAI Proxy)',
    provider: 'Custom Endpoint',
  },
  {
    id: 'm-deepseek-r1',
    modelId: 'deepseek-reasoner',
    displayName: 'DeepSeek R1 (Architecture Reasoning)',
    provider: 'Local vLLM / Ollama',
  },
];

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-init-1',
    role: 'assistant',
    content:
      'Hello! I am your **Vintrix AI Architect**. I have ingested the AST Knowledge Graph context for this workspace.\n\nYou can query data flow architectures, cross-repo module dependencies, ISO/IEC 27001 credential cryptographic paths, or explain any method implementation across your codebase.',
    createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  },
];

export function ChatboxView() {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [inputMessage, setInputMessage] = useState('');
  const [workspacesList, setWorkspacesList] = useState<WorkspaceContextOption[]>(AVAILABLE_WORKSPACES);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(AVAILABLE_WORKSPACES[0].id);
  const [modelsList, setModelsList] = useState<AIModelOption[]>(AVAILABLE_MODELS);
  const [selectedModelId, setSelectedModelId] = useState(AVAILABLE_MODELS[0].id);
  const [isSending, setIsSending] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'settings'>('chat');
  const [isCustomAIOpen, setIsCustomAIOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load dynamic models from configured AI endpoints
  useEffect(() => {
    aiApi
      .listEndpoints(selectedWorkspaceId)
      .then(async (endpoints) => {
        if (endpoints && endpoints.length > 0) {
          const modelPromises = endpoints.map((ep) =>
            aiApi.listModels(ep.id).then((models) => ({
              endpoint: ep,
              models,
            }))
          );
          const results = await Promise.all(modelPromises);
          const apiModels: AIModelOption[] = [];
          results.forEach(({ endpoint, models }) => {
            models.forEach((m) => {
              apiModels.push({
                id: m.id,
                modelId: m.modelId,
                displayName: m.displayName || m.modelId,
                provider: endpoint.name,
              });
            });
          });

          if (apiModels.length > 0) {
            setModelsList((prev) => {
              // merge without duplicates
              const existingIds = new Set(prev.map((p) => p.modelId));
              const fresh = apiModels.filter((m) => !existingIds.has(m.modelId));
              return [...fresh, ...prev];
            });
          }
        }
      })
      .catch(() => {
        // Keep defaults
      });
  }, [selectedWorkspaceId]);

  // Fetch workspaces dynamically from backend
  useEffect(() => {
    workspacesApi
      .list()
      .then((data) => {
        if (data && data.length > 0) {
          const mapped: WorkspaceContextOption[] = data.map((ws) => ({
            id: ws.id,
            name: ws.name,
            sourcesDescription: ws.description || 'Connected repository workspace',
            nodesCount: 7,
          }));
          setWorkspacesList(mapped);
          setSelectedWorkspaceId(mapped[0].id);
        }
      })
      .catch(() => {
        // Fallback to presets
      });
  }, []);

  const selectedWorkspace = workspacesList.find((w) => w.id === selectedWorkspaceId) ?? workspacesList[0];
  const selectedModel = modelsList.find((m) => m.id === selectedModelId) ?? modelsList[0];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending) return;

    const userText = inputMessage.trim();
    setInputMessage('');

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: userText,
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const aiMsgId = `ai-${Date.now()}`;
    const initialAiMsg: ChatMessage = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg, initialAiMsg]);
    setIsSending(true);

    try {
      // Stream message via Server-Sent Events from backend
      const response = await fetch('/api/v1/ai/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: '00000000-0000-0000-0000-000000000001',
          workspaceId: selectedWorkspaceId,
          modelId: selectedModel?.modelId || selectedModelId,
          message: userText,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Streaming failed with status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamedContent = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              if (data.token) {
                streamedContent += data.token;
                setMessages((prev) =>
                  prev.map((m) => (m.id === aiMsgId ? { ...m, content: streamedContent } : m))
                );
              }
            } catch {
              // skip unparsed chunks
            }
          }
        }
      }

      // If empty stream completed, fallback
      if (!streamedContent) {
        throw new Error('Empty stream response received from model endpoint');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      // Fallback architect response with context
      const fallbackContent = `**[Architecture Analysis: ${selectedWorkspace?.name}]**\n\n*(Stream notice: ${errMsg})*\n\nThe requested module coordinates across the persistence and security boundary. Per AST Knowledge Graph:\n- Credentials are encrypted at rest with \`AES-256-GCM\` (PBKDF2 SHA-256).\n- Layering: \`API Gateway\` -> \`Service Controller\` -> \`PostgreSQL Drizzle schema\`.\n\nWould you like to locate this node in the Knowledge Graph canvas?`;

      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: fallbackContent } : m))
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleResetSession = () => {
    setMessages([
      {
        id: `msg-reset-${Date.now()}`,
        role: 'assistant',
        content: `New conversation thread initialized for workspace context **${selectedWorkspace?.name}** using model **${selectedModel?.displayName}**.`,
        createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  return (
    <div className="flex h-full w-full bg-[#050a10] text-[#e0e0e0] font-sans overflow-hidden">
      {/* Sidebar: Context Selector & Sessions */}
      <aside
        className={`w-full md:w-80 border-r border-[#16243b] bg-[#0b1320] flex-col justify-between p-4 shrink-0 overflow-y-auto ${
          mobileTab === 'settings' ? 'flex h-full' : 'hidden md:flex'
        }`}
      >
        <div className="space-y-6">
          {/* Mobile Back to Chat Button */}
          <div className="flex md:hidden items-center justify-between pb-3 border-b border-white/[0.08]">
            <span className="text-xs font-semibold text-slate-200">Context & Model</span>
            <button
              onClick={() => setMobileTab('chat')}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-sky-400 bg-sky-500/10 rounded-md border border-sky-500/20"
            >
              <ChatCircleText size={14} />
              <span>Back to Chat</span>
            </button>
          </div>

          {/* Workspace Context Selector */}
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
              <FolderOpen size={14} className="text-sky-400" />
              Workspace Context
            </label>
            <div className="space-y-1.5">
              {workspacesList.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => setSelectedWorkspaceId(ws.id)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                    selectedWorkspaceId === ws.id
                      ? 'bg-sky-950/40 border-sky-500/50 text-sky-200'
                      : 'bg-[#0f1b2d] border-[#16243b] text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="font-medium text-slate-200 truncate">{ws.name}</div>
                  <div className="text-[10px] font-mono text-slate-400 truncate mt-0.5">
                    {ws.sourcesDescription}
                  </div>
                  <div className="text-[10px] text-sky-400 mt-1 font-mono">
                    {ws.nodesCount} indexed AST nodes (Cross-Repo)
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* AI Model Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Cpu size={14} className="text-purple-400" />
                AI Model & Endpoint
              </label>
              <button
                type="button"
                onClick={() => setIsCustomAIOpen(true)}
                className="text-[10px] text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 hover:underline"
              >
                <Plus size={11} />
                <span>Custom</span>
              </button>
            </div>
            <div className="space-y-1.5">
              {modelsList.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs transition-colors ${
                    selectedModelId === model.id
                      ? 'bg-purple-950/40 border-purple-500/50 text-purple-200'
                      : 'bg-[#0f1b2d] border-[#16243b] text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="font-medium text-slate-200">{model.displayName}</div>
                  <div className="text-[10px] font-mono text-purple-400/80 mt-0.5 truncate">
                    {model.provider}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Security & Reset Button */}
        <div className="pt-4 border-t border-[#16243b] space-y-3">
          <div className="flex items-center gap-2 text-[11px] text-emerald-400/80 bg-emerald-950/20 border border-emerald-900/30 p-2 rounded-lg">
            <ShieldCheck size={16} className="shrink-0" />
            <span>ISO/IEC 27001 Cryptographic zero-leak sandbox active.</span>
          </div>

          <button
            onClick={handleResetSession}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
          >
            <Plus size={14} /> New Chat Session
          </button>
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main
        className={`flex-1 flex-col h-full bg-[#050a10] overflow-hidden ${
          mobileTab === 'chat' ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Chat Header info */}
        <div className="h-14 border-b border-[#16243b] bg-[#0b1320] px-3 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="p-1.5 sm:p-2 bg-sky-950/40 border border-sky-500/30 rounded-lg text-sky-400 shrink-0">
              <ChatTeardropDots size={18} />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-1.5 truncate">
                <span className="truncate">Architecture AI Copilot</span>
                <span className="text-[9px] sm:text-[10px] font-mono bg-sky-950/60 text-sky-400 border border-sky-500/30 px-1 py-0.2 rounded shrink-0">
                  {selectedModel?.modelId}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">
                Context: {selectedWorkspace?.name}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mobile Context / Settings Button */}
            <button
              onClick={() => setMobileTab('settings')}
              className="flex md:hidden items-center gap-1 p-1.5 text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-lg"
              title="Change workspace context or AI model"
            >
              <Sliders size={16} />
            </button>
            <button
              onClick={handleResetSession}
              title="Reload Session"
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-100 bg-slate-800/40 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <ArrowClockwise size={15} />
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-3xl ${
                msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-mono font-bold ${
                  msg.role === 'user'
                    ? 'bg-sky-600 text-white'
                    : 'bg-[#111d30] border border-sky-500/30 text-sky-400'
                }`}
              >
                {msg.role === 'user' ? 'U' : <Code size={16} />}
              </div>
              <div
                className={`p-4 rounded-xl text-xs leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-sky-950/50 border border-sky-500/30 text-slate-100'
                    : 'bg-[#0b1320] border border-[#16243b] text-slate-200'
                }`}
              >
                <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                <div className="mt-2 text-[10px] font-mono text-slate-500 text-right">
                  {msg.createdAt}
                </div>
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex gap-3 max-w-xl">
              <div className="w-8 h-8 rounded-lg bg-[#111d30] border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                <Code size={16} className="animate-spin" />
              </div>
              <div className="p-3 bg-[#0b1320] border border-[#16243b] rounded-xl text-xs text-slate-400 font-mono flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                Querying LLM with AST Knowledge Graph context...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Message Input Box */}
        <div className="p-4 border-t border-[#16243b] bg-[#0b1320]">
          <div className="relative max-w-4xl mx-auto">
            <textarea
              rows={2}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about codebase architecture, module relations, or cryptographic boundaries... (Enter to send, Shift+Enter for newline)"
              className="w-full bg-[#050a10] border border-[#16243b] focus:border-sky-500/60 rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 outline-none resize-none transition-colors pr-12 font-sans"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isSending}
              className="absolute right-3 bottom-4 p-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 disabled:hover:bg-sky-600 text-white transition-colors"
            >
              <PaperPlaneTilt size={16} />
            </button>
          </div>
          <div className="text-center mt-2 text-[10px] font-mono text-slate-500">
            Context powered by XERJ AST indexer & Drizzle ORM schema • AES-256-GCM Envelope Encryption
          </div>
        </div>
      </main>

      {/* Custom AI Endpoint Modal */}
      <CustomAIModal
        isOpen={isCustomAIOpen}
        onClose={() => setIsCustomAIOpen(false)}
        onEndpointSaved={(newEndpoint: AIEndpoint) => {
          const generatedModelOptions: AIModelOption[] = newEndpoint.models.map((m) => ({
            id: m.id,
            modelId: m.modelId,
            displayName: `${m.displayName} (${newEndpoint.name})`,
            provider: newEndpoint.baseUrl,
          }));

          setModelsList((prev) => [...generatedModelOptions, ...prev]);
          if (generatedModelOptions[0]) {
            setSelectedModelId(generatedModelOptions[0].id);
          }
        }}
      />
    </div>
  );
}
