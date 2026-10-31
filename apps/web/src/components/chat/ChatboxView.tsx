import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  PaperPlaneTilt,
  Cpu,
  Plus,
  ShieldCheck,
  ArrowClockwise,
  Sliders,
  ChatCircleText,
  ClockCounterClockwise,
  Spinner,
  Sparkle,
  Check,
  Copy,
  Trash,
} from '@phosphor-icons/react';
import { workspacesApi, aiApi } from '../../services/api';
import { CustomAIModal, type AIEndpoint } from '../ai/CustomAIModal';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string | null;
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

const AVAILABLE_MODELS: AIModelOption[] = [];

const WELCOME_MESSAGE = (workspaceName?: string): ChatMessage => ({
  id: `msg-init-${Date.now()}`,
  role: 'assistant',
  content: `Hello! I'm your architecture assistant. I can explain how features and modules work in simple terms for product planning, or provide deep-dive technical implementations if requested. How can I help you with **${workspaceName || 'this workspace'}**?`,
  createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* =========================================================
   Code Block with Copy Button
   ========================================================= */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="my-3 rounded-xl border border-white/[0.08] bg-[#03070d]/90 overflow-hidden shadow-lg shadow-black/40">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-slate-900/70 border-b border-white/[0.06] text-[10px] font-mono">
        <span className="text-sky-400 font-semibold uppercase tracking-wider">{lang || 'text'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-slate-400 hover:text-slate-100 transition-colors py-0.5 px-2 rounded hover:bg-white/[0.08]"
          title="Copy code"
        >
          {copied ? (
            <>
              <Check size={12} className="text-emerald-400" />
              <span className="text-emerald-400">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3.5 text-[11px] font-mono text-sky-200/90 overflow-x-auto whitespace-pre leading-relaxed scrollbar-thin">
        <code>{code.replace(/\n$/, '')}</code>
      </pre>
    </div>
  );
}

/* =========================================================
   Inline text formatter (bold, inline code, italics)
   ========================================================= */
function InlineText({ text }: { text: string }) {
  // Regex tokenizing **bold**, `code`, *italic*
  const tokens = text.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

  return (
    <>
      {tokens.map((token, i) => {
        if (token.startsWith('**') && token.endsWith('**') && token.length >= 4) {
          return (
            <strong key={i} className="font-semibold text-slate-100">
              {token.slice(2, -2)}
            </strong>
          );
        }
        if (token.startsWith('`') && token.endsWith('`') && token.length >= 2) {
          return (
            <code
              key={i}
              className="px-1.5 py-0.5 rounded bg-slate-800/80 border border-white/[0.08] text-sky-300 font-mono text-[11px] mx-0.5"
            >
              {token.slice(1, -1)}
            </code>
          );
        }
        if (token.startsWith('*') && token.endsWith('*') && token.length >= 2) {
          return (
            <em key={i} className="italic text-slate-300">
              {token.slice(1, -1)}
            </em>
          );
        }
        return <span key={i}>{token}</span>;
      })}
    </>
  );
}

/* =========================================================
   Markdown Table Formatter
   ========================================================= */
function MarkdownTable({ tableText }: { tableText: string }) {
  const rows = tableText
    .trim()
    .split('\n')
    .map((r) =>
      r
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((cell) => cell.trim())
    )
    .filter((r) => r.length > 0 && !r.every((c) => /^[-:]+$/.test(c)));

  if (rows.length === 0) return null;
  const header = rows[0];
  const body = rows.slice(1);

  return (
    <div className="my-3 overflow-x-auto rounded-xl border border-white/[0.08] bg-[#040810]">
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-white/[0.08] bg-white/[0.03]">
            {header.map((col, idx) => (
              <th key={idx} className="px-3.5 py-2 font-mono font-semibold text-slate-300 text-[11px]">
                <InlineText text={col} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/[0.04]">
          {body.map((row, rIdx) => (
            <tr key={rIdx} className="hover:bg-white/[0.02] transition-colors">
              {row.map((cell, cIdx) => (
                <td key={cIdx} className="px-3.5 py-2 text-slate-300 text-xs">
                  <InlineText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* =========================================================
   Rich Markdown Content Renderer
   ========================================================= */
function FormattedContent({ content }: { content: string }) {
  const renderedBlocks = useMemo(() => {
    // Split code blocks
    const chunks = content.split(/(```[\s\S]*?```)/g);

    return chunks.map((chunk, idx) => {
      // Code Block
      if (chunk.startsWith('```') && chunk.endsWith('```')) {
        const lines = chunk.slice(3, -3);
        const firstLineBreak = lines.indexOf('\n');
        const lang = firstLineBreak !== -1 ? lines.slice(0, firstLineBreak).trim() : '';
        const code = firstLineBreak !== -1 ? lines.slice(firstLineBreak + 1) : lines;
        return <CodeBlock key={idx} code={code} lang={lang} />;
      }

      // Check for table blocks inside chunk
      const tableMatch = chunk.match(/((?:^\|.+?\|\r?\n)+)/m);
      if (tableMatch && tableMatch[0]) {
        const preTable = chunk.slice(0, tableMatch.index);
        const postTable = chunk.slice((tableMatch.index ?? 0) + tableMatch[0].length);
        return (
          <div key={idx} className="space-y-2">
            {preTable && <FormattedContent content={preTable} />}
            <MarkdownTable tableText={tableMatch[0]} />
            {postTable && <FormattedContent content={postTable} />}
          </div>
        );
      }

      // Process regular paragraphs, headings, bullet lists
      const lines = chunk.split('\n');
      return (
        <div key={idx} className="space-y-2">
          {lines.map((line, lIdx) => {
            const trimmed = line.trim();
            if (!trimmed) {
              return <div key={lIdx} className="h-1.5" />;
            }

            // Headings
            if (trimmed.startsWith('### ')) {
              return (
                <h4 key={lIdx} className="text-xs font-bold text-sky-300 uppercase tracking-wide mt-3 mb-1">
                  <InlineText text={trimmed.slice(4)} />
                </h4>
              );
            }
            if (trimmed.startsWith('## ')) {
              return (
                <h3 key={lIdx} className="text-sm font-semibold text-slate-100 mt-4 mb-1.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 inline-block" />
                  <InlineText text={trimmed.slice(3)} />
                </h3>
              );
            }
            if (trimmed.startsWith('# ')) {
              return (
                <h2 key={lIdx} className="text-base font-bold text-white mt-4 mb-2 pb-1 border-b border-white/[0.08]">
                  <InlineText text={trimmed.slice(2)} />
                </h2>
              );
            }

            // Horizontal rule
            if (trimmed === '---' || trimmed === '***') {
              return <hr key={lIdx} className="border-t border-white/[0.08] my-3" />;
            }

            // Blockquote
            if (trimmed.startsWith('> ')) {
              return (
                <div
                  key={lIdx}
                  className="pl-3 py-1 my-1 border-l-2 border-sky-500/60 bg-sky-950/20 text-slate-300 text-xs italic rounded-r"
                >
                  <InlineText text={trimmed.slice(2)} />
                </div>
              );
            }

            // Unordered list item
            if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
              return (
                <div key={lIdx} className="flex items-start gap-2 pl-2 text-xs text-slate-300 leading-relaxed">
                  <span className="text-sky-400 mt-1 text-[8px]">•</span>
                  <div className="flex-1">
                    <InlineText text={trimmed.slice(2)} />
                  </div>
                </div>
              );
            }

            // Numbered list item
            const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
            if (numMatch) {
              return (
                <div key={lIdx} className="flex items-start gap-2 pl-2 text-xs text-slate-300 leading-relaxed">
                  <span className="font-mono text-sky-400/80 text-[10px] min-w-[14px]">
                    {numMatch[1]}.
                  </span>
                  <div className="flex-1">
                    <InlineText text={numMatch[2]} />
                  </div>
                </div>
              );
            }

            // Regular line
            return (
              <p key={lIdx} className="text-xs sm:text-[13px] text-slate-200 leading-relaxed">
                <InlineText text={line} />
              </p>
            );
          })}
        </div>
      );
    });
  }, [content]);

  return <div className="font-sans space-y-2 break-words [overflow-wrap:anywhere]">{renderedBlocks}</div>;
}

export function ChatboxView({ initialWorkspaceId }: { initialWorkspaceId?: string } = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE()]);
  const [inputMessage, setInputMessage] = useState('');
  const [workspacesList, setWorkspacesList] = useState<WorkspaceContextOption[]>(() => {
    try {
      const stored = localStorage.getItem('vintrix_workspaces');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((w: any) => ({
            id: w.id,
            name: w.name,
            sourcesDescription: w.description || 'Connected repository workspace',
            nodesCount: 7,
          }));
        }
      }
    } catch {}
    return AVAILABLE_WORKSPACES;
  });

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>(() => {
    if (initialWorkspaceId && UUID_REGEX.test(initialWorkspaceId)) {
      return initialWorkspaceId;
    }
    const saved = localStorage.getItem('vintrix_active_workspace') || '';
    if (UUID_REGEX.test(saved)) {
      return saved;
    }
    const stored = localStorage.getItem('vintrix_workspaces');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed[0]?.id && UUID_REGEX.test(parsed[0].id)) {
          return parsed[0].id;
        }
      } catch {}
    }
    return AVAILABLE_WORKSPACES[0].id;
  });

  // Sync selectedWorkspaceId if prop initialWorkspaceId updates from parent (e.g. workspace switcher in header)
  useEffect(() => {
    if (initialWorkspaceId && UUID_REGEX.test(initialWorkspaceId) && initialWorkspaceId !== selectedWorkspaceId) {
      setSelectedWorkspaceId(initialWorkspaceId);
    }
  }, [initialWorkspaceId]);
  const [modelsList, setModelsList] = useState<AIModelOption[]>(AVAILABLE_MODELS);
  const [selectedModelId, setSelectedModelId] = useState(AVAILABLE_MODELS[0]?.id ?? '');
  const [isSending, setIsSending] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'settings'>('chat');
  const [isCustomAIOpen, setIsCustomAIOpen] = useState(false);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  // Chat history
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedWorkspace = workspacesList.find((w) => w.id === selectedWorkspaceId) ?? workspacesList[0];
  const selectedModel = modelsList.find((m) => m.id === selectedModelId) ?? modelsList[0];

  // Load sessions for the selected workspace
  const loadSessions = useCallback(async (workspaceId: string) => {
    if (!UUID_REGEX.test(workspaceId)) return;
    try {
      const data = await aiApi.listSessions(workspaceId);
      setSessions(data);
    } catch {
      // DB unavailable — ignore
    }
  }, []);

  // Load messages for a session
  const loadSessionMessages = useCallback(async (sessionId: string) => {
    setIsLoadingHistory(true);
    try {
      const msgs = await aiApi.getSessionMessages(sessionId);
      if (msgs && msgs.length > 0) {
        setMessages(
          msgs.map((m) => ({
            id: m.id,
            role: m.role as ChatMessage['role'],
            content: m.content,
            createdAt: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          })),
        );
      } else {
        setMessages([WELCOME_MESSAGE(selectedWorkspace?.name)]);
      }
    } catch {
      setMessages([WELCOME_MESSAGE(selectedWorkspace?.name)]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [selectedWorkspace?.name]);

  // Create a new session and make it active
  const createNewSession = useCallback(async (workspaceId: string, title?: string): Promise<string | null> => {
    if (!UUID_REGEX.test(workspaceId)) return null;
    try {
      const session = await aiApi.createSession({ workspaceId, title: title ?? 'New Chat' });
      setSessions((prev) => [session, ...prev]);
      setActiveSessionId(session.id);
      return session.id;
    } catch {
      return null;
    }
  }, []);

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
              const existingKeys = new Set(apiModels.map((m) => m.modelId));
              const defaults = prev.filter((p) => !existingKeys.has(p.modelId));
              return [...apiModels, ...defaults];
            });
            setSelectedModelId(apiModels[0].id);
          }
        }
      })
      .catch(() => {});
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
          if (!initialWorkspaceId) {
            setSelectedWorkspaceId(mapped[0].id);
          }
        }
      })
      .catch(() => {});
  }, [initialWorkspaceId]);

  // When workspace changes: reset to new session directly with workspace context welcome message and load history
  useEffect(() => {
    setActiveSessionId(null);
    setSessions([]);
    setMessages([WELCOME_MESSAGE(selectedWorkspace?.name)]);
    loadSessions(selectedWorkspaceId);
  }, [selectedWorkspaceId, loadSessions, selectedWorkspace?.name]);

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

    if (!UUID_REGEX.test(selectedWorkspaceId)) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? {
                ...m,
                content:
                  '**[AI Assistant]**\n\nNo workspace selected. Please select a valid workspace from the sidebar before chatting.',
              }
            : m
        )
      );
      setIsSending(false);
      return;
    }

    let sessionId = activeSessionId;
    if (!sessionId) {
      const title = userText.slice(0, 50) + (userText.length > 50 ? '…' : '');
      sessionId = await createNewSession(selectedWorkspaceId, title);
      if (sessionId) {
        setSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
        );
      }
    }

    const resolvedSessionId = sessionId ?? '00000000-0000-0000-0000-000000000001';

    try {
      const response = await fetch('/api/v1/ai/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: resolvedSessionId,
          workspaceId: selectedWorkspaceId,
          modelId: selectedModel?.modelId || selectedModelId,
          message: userText,
        }),
      });

      if (!response.ok || !response.body) {
        let errDetail = '';
        try {
          const errJson = await response.json();
          errDetail = errJson.error || errJson.message || '';
        } catch {
          try { errDetail = await response.text(); } catch {}
        }
        throw new Error(errDetail || `Streaming failed with status: ${response.status}`);
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

      if (!streamedContent) {
        throw new Error('Empty stream response received from model endpoint');
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const fallbackContent = `**[AI Assistant Notice]**\n\nFailed to stream from AI model: ${errMsg}\n\nPlease verify that your Custom AI Endpoint URL and API Key are valid in the Model Settings.`;
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

  const handleNewChat = () => {
    setMessages([WELCOME_MESSAGE(selectedWorkspace?.name)]);
    setActiveSessionId(null);
  };

  const handleSelectSession = async (session: ChatSession) => {
    setActiveSessionId(session.id);
    await loadSessionMessages(session.id);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      await aiApi.deleteSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      if (activeSessionId === sessionId) {
        handleNewChat();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleCopyMessage = (msgId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(msgId);
    setTimeout(() => setCopiedMessageId(null), 2000);
  };

  const formatSessionDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex h-full w-full bg-[#040810] text-[#e0e0e0] font-sans overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`w-full md:w-80 border-r border-[#14233a] bg-[#070e1b] flex-col justify-between p-4 shrink-0 overflow-y-auto ${
          mobileTab === 'settings' ? 'flex h-full' : 'hidden md:flex'
        }`}
      >
        <div className="space-y-5">
          {/* Mobile back header */}
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

          {/* New Chat button */}
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 text-white text-xs font-medium shadow-md shadow-sky-950/30 transition-all cursor-pointer"
          >
            <Plus size={14} weight="bold" />
            <span>New Chat</span>
          </button>

          {/* Chat History */}
          <div>
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2">
              <ClockCounterClockwise size={14} className="text-sky-400" />
              Chat History
            </label>
            {sessions.length === 0 ? (
              <p className="text-[11px] text-slate-500 font-mono px-1">
                {UUID_REGEX.test(selectedWorkspaceId) ? 'No sessions yet.' : 'Select a workspace to load history.'}
              </p>
            ) : (
              <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session)}
                    className={`group relative w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      activeSessionId === session.id
                        ? 'bg-sky-950/50 border-sky-500/40 text-sky-200'
                        : 'bg-[#0b1424] border-[#14233a] text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-slate-200 truncate">
                        {session.title ?? 'Untitled Chat'}
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {formatSessionDate(session.createdAt)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSession(e, session.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-all shrink-0"
                      title="Delete chat session"
                    >
                      <Trash size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
                className="text-[10px] text-purple-400 hover:text-purple-300 font-medium flex items-center gap-1 hover:underline cursor-pointer"
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
                  className={`w-full text-left p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                    selectedModelId === model.id
                      ? 'bg-purple-950/40 border-purple-500/50 text-purple-200'
                      : 'bg-[#0b1424] border-[#14233a] text-slate-400 hover:text-slate-200 hover:border-slate-700'
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

        {/* Security badge */}
        <div className="pt-4 border-t border-[#14233a]">
          <div className="flex items-center gap-2 text-[11px] text-emerald-400/90 bg-emerald-950/20 border border-emerald-900/30 p-2.5 rounded-xl">
            <ShieldCheck size={16} className="shrink-0 text-emerald-400" />
            <span className="leading-tight">Zero-leak cryptographic sandbox active.</span>
          </div>
        </div>
      </aside>

      {/* Main Chat Interface */}
      <main
        className={`flex-1 min-w-0 flex-col h-full bg-[#040810] overflow-hidden ${
          mobileTab === 'chat' ? 'flex' : 'hidden md:flex'
        }`}
      >
        {/* Chat Header */}
        <div className="h-14 border-b border-[#14233a] bg-[#070e1b] px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-b from-sky-500/20 to-blue-600/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shrink-0 shadow-sm">
              <Sparkle size={16} weight="fill" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-semibold text-slate-100 flex items-center gap-2 truncate">
                <span className="truncate">Architecture Assistant</span>
                <span className="text-[9px] sm:text-[10px] font-mono bg-sky-950/80 text-sky-300 border border-sky-500/30 px-1.5 py-0.5 rounded-md shrink-0">
                  {selectedModel?.modelId}
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-slate-400 font-mono truncate">
                Context: {selectedWorkspace?.name}
                {activeSessionId && (
                  <span className="ml-2 text-sky-400/70">
                    · Session #{sessions.findIndex((s) => s.id === activeSessionId) + 1}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setMobileTab('settings')}
              className="flex md:hidden items-center gap-1 p-1.5 text-xs text-sky-400 bg-sky-500/10 border border-sky-500/20 rounded-lg"
              title="Change context or model"
            >
              <Sliders size={16} />
            </button>
            <button
              onClick={handleNewChat}
              title="Start New Session"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-100 bg-[#0c1527] hover:bg-[#121f38] border border-[#172742] rounded-lg transition-colors cursor-pointer"
            >
              <ArrowClockwise size={14} />
              <span className="hidden sm:inline text-[11px]">New Session</span>
            </button>
          </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-4 min-w-0">
          {isLoadingHistory ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3 text-slate-500">
                <Spinner size={24} className="animate-spin text-sky-400" />
                <span className="text-xs font-mono">Loading session messages...</span>
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';

              if (isUser) {
                return (
                  <div key={msg.id} className="flex justify-end w-full my-2">
                    <div className="max-w-[85%] sm:max-w-[70%] group">
                      <div className="bg-gradient-to-br from-sky-600 to-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-xs shadow-md shadow-sky-950/20 text-xs sm:text-[13px] leading-relaxed break-words [overflow-wrap:anywhere]">
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 text-right mt-1 px-1">
                        {msg.createdAt}
                      </div>
                    </div>
                  </div>
                );
              }

              // Assistant message
              return (
                <div key={msg.id} className="flex gap-3 max-w-3xl w-full my-3 group">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-b from-sky-500/20 to-purple-500/10 border border-sky-500/30 flex items-center justify-center shrink-0 text-sky-400 mt-0.5 shadow-sm">
                    <Sparkle size={15} weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1 bg-[#09111e] border border-[#14233a] rounded-2xl p-4 sm:p-5 shadow-sm hover:border-[#1b3152] transition-colors">
                    {/* Header bar */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/[0.04]">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-slate-300">Architecture Assistant</span>
                        <span className="text-[9px] font-mono text-sky-400 bg-sky-950/60 px-1.5 py-0.2 rounded border border-sky-500/20">
                          AI
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px] text-slate-400 hover:text-slate-200 transition-opacity px-1.5 py-0.5 rounded hover:bg-white/[0.05]"
                          title="Copy response"
                        >
                          {copiedMessageId === msg.id ? (
                            <>
                              <Check size={11} className="text-emerald-400" />
                              <span className="text-emerald-400">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy size={11} />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                        <span className="text-[10px] font-mono text-slate-500">{msg.createdAt}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <FormattedContent content={msg.content} />
                  </div>
                </div>
              );
            })
          )}

          {isSending && (
            <div className="flex gap-3 max-w-xl my-3">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#0e1828] border border-sky-500/30 text-sky-400 flex items-center justify-center shrink-0">
                <Spinner size={16} className="animate-spin text-sky-400" />
              </div>
              <div className="p-3.5 bg-[#09111e] border border-[#14233a] rounded-2xl text-xs text-slate-300 font-mono flex items-center gap-2.5">
                <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-ping" />
                Querying LLM with AST Knowledge Graph...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompt Chips */}
        <div className="px-4 sm:px-6 py-2 border-t border-[#14233a] bg-[#060c17] flex items-center gap-2 overflow-x-auto text-[11px] font-mono no-scrollbar shrink-0">
          <span className="text-slate-500 text-[10px] shrink-0 font-sans">Prompts:</span>
          {[
            'Explain project structure',
            'Core data & API flow',
            'Database & model relations',
            'Key modules & dependencies',
          ].map((promptText) => (
            <button
              key={promptText}
              type="button"
              onClick={() => {
                setInputMessage(promptText);
                textareaRef.current?.focus();
              }}
              className="shrink-0 px-3 py-1 rounded-full bg-white/[0.03] hover:bg-sky-500/10 hover:border-sky-500/40 border border-white/[0.08] text-slate-300 hover:text-sky-300 text-xs transition-colors cursor-pointer"
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Message Input Box */}
        <div className="p-4 sm:p-5 border-t border-[#14233a] bg-[#070e1b]">
          <div className="relative max-w-4xl mx-auto rounded-2xl border border-[#182842] bg-[#040810] focus-within:border-sky-500/60 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all shadow-inner">
            <textarea
              ref={textareaRef}
              rows={2}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about architecture, data flow, or modules... (Enter to send, Shift+Enter for newline)"
              className="w-full bg-transparent px-4 py-3 text-xs sm:text-[13px] text-slate-100 placeholder-slate-500 outline-none resize-none pr-14 font-sans leading-relaxed"
            />
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isSending}
              className="absolute right-3 bottom-3 p-2 rounded-xl bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-500 hover:to-blue-500 disabled:opacity-30 disabled:pointer-events-none text-white shadow-md shadow-sky-950/30 transition-all cursor-pointer"
              title="Send Message"
            >
              <PaperPlaneTilt size={16} weight="fill" />
            </button>
          </div>
          <div className="text-center mt-2 text-[10px] font-mono text-slate-500">
            Context powered by XERJ AST indexer • Zero-leak cryptographic sandbox
          </div>
        </div>
      </main>

      {/* Custom AI Endpoint Modal */}
      <CustomAIModal
        isOpen={isCustomAIOpen}
        workspaceId={selectedWorkspaceId}
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
