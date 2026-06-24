"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import EmptyState from "@/components/EmptyState";
import SourcePill from "@/components/SourcePill";
import { answerQuery } from "@/lib/api";
import type { ChatMessage, DiffCard, TimelinePoint } from "@/lib/types";

const promptChips = [
  "What changed about my tech stack since March?",
  "What did I believe about databases before vs now?",
  "Why did I decide to switch from Postgres to Supabase?",
];

interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: string;
  messageCount: number;
}

const CUR_KEY = "ask-messages";
const CONV_INDEX_KEY = "ask-conv-index";

function saveMessagesRaw(msgs: ChatMessage[]) {
  try { localStorage.setItem(CUR_KEY, JSON.stringify(msgs)); } catch {}
}

function loadMessagesRaw(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CUR_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
}

function getConvIndex(): ConversationMeta[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CONV_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function persistConvIndex(list: ConversationMeta[]) {
  try { localStorage.setItem(CONV_INDEX_KEY, JSON.stringify(list)); } catch {}
}

function convMsgKey(id: string) {
  return `ask-conv-${id}`;
}

function saveConvMessages(id: string, msgs: ChatMessage[]) {
  try { localStorage.setItem(convMsgKey(id), JSON.stringify(msgs)); } catch {}
}

function loadConvMessages(id: string): ChatMessage[] | null {
  try {
    const raw = localStorage.getItem(convMsgKey(id));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function deleteConvMessages(id: string) {
  try { localStorage.removeItem(convMsgKey(id)); } catch {}
}

function generateTitle(msgs: ChatMessage[]): string {
  if (msgs.length === 0) return "Empty conversation";
  const first = msgs[0].query;
  return first.length > 45 ? first.slice(0, 42) + "..." : first;
}

function DiffCardView({ diff }: { diff: DiffCard }) {
  return (
    <div className="mt-5 rounded-xl border border-hairline overflow-hidden bg-canvas">
      <div className="px-4 py-3 bg-surface-strong border-b border-hairline">
        <span className="caption-upper text-muted" style={{ fontSize: "11px" }}>Changes since {diff.sinceDate}</span>
      </div>
      <div className="divide-y divide-hairline">
        {diff.added.length > 0 && (
          <div className="px-4 py-3 flex items-center gap-3.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-semantic-success/10 text-semantic-success text-xs font-mono font-bold">+</span>
            <span className="text-xs font-medium text-muted w-14 uppercase">Added</span>
            <span className="text-sm font-medium text-ink">{diff.added.join(", ")}</span>
          </div>
        )}
        {diff.removed.length > 0 && (
          <div className="px-4 py-3 flex items-center gap-3.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-semantic-error/10 text-semantic-error text-xs font-mono font-bold">-</span>
            <span className="text-xs font-medium text-muted w-14 uppercase">Removed</span>
            <span className="text-sm font-medium text-ink">{diff.removed.join(", ")}</span>
          </div>
        )}
        {diff.changed.length > 0 && (
          <div className="px-4 py-3 flex items-center gap-3.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-conflict-warning/10 text-conflict-warning text-xs font-mono font-bold">~</span>
            <span className="text-xs font-medium text-muted w-14 uppercase">Changed</span>
            <span className="text-sm font-medium text-ink">
              {diff.changed.map(([old, nw]) => `${old} → ${nw}`).join(", ")}
            </span>
          </div>
        )}
        {diff.newDecisions.length > 0 && (
          <div className="px-4 py-3 flex items-center gap-3.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-xs font-mono font-bold">*</span>
            <span className="text-xs font-medium text-muted w-28 uppercase">New Decisions</span>
            <span className="text-sm font-medium text-ink">{diff.newDecisions.join(", ")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TimelineView({ points }: { points: TimelinePoint[] }) {
  const maxConfidence = Math.max(...points.map((p) => p.confidenceScore));

  return (
    <div className="mt-5 rounded-xl border border-hairline p-5 bg-canvas">
      <span className="caption-upper text-muted mb-4 block" style={{ fontSize: "11px" }}>Confidence Timeline</span>
      <div className="space-y-3.5">
        {points.map((point, i) => (
          <div key={i} className="flex items-center gap-4">
            <span className="w-16 text-xs text-muted font-medium shrink-0">{point.date}</span>
            <div className="flex-1 h-3 rounded-full bg-surface-strong overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(point.confidenceScore / maxConfidence) * 100}%`,
                  backgroundColor: point.confidenceScore >= 0.8 ? "#292524" : point.confidenceScore >= 0.4 ? "#777169" : "#a8a29e",
                }}
              />
            </div>
            <span className="w-12 text-xs font-mono text-muted text-right shrink-0">
              {Math.round(point.confidenceScore * 100)}%
            </span>
            <span className="text-xs font-medium text-body shrink-0">{point.valueSummary}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function isToday(d: Date) {
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function isYesterday(d: Date) {
  const t = new Date();
  t.setDate(t.getDate() - 1);
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function formatDate(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return `Today ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  if (isYesterday(d)) return `Yesterday ${d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

// Inline formatting: Bold (**text**) and Italic (*text*)
function renderLineContent(line: string) {
  const parts: React.ReactNode[] = [];
  let remaining = line;
  let key = 0;
  
  while (remaining.length > 0) {
    const boldIdx = remaining.indexOf("**");
    const italicIdx = remaining.indexOf("*");
    
    if (boldIdx === -1 && italicIdx === -1) {
      parts.push(remaining);
      break;
    }
    
    // Check if bold is closer
    if (boldIdx !== -1 && (italicIdx === -1 || boldIdx <= italicIdx)) {
      if (boldIdx > 0) {
        parts.push(remaining.substring(0, boldIdx));
      }
      const endBoldIdx = remaining.indexOf("**", boldIdx + 2);
      if (endBoldIdx !== -1) {
        const boldText = remaining.substring(boldIdx + 2, endBoldIdx);
        parts.push(<strong key={key++} className="font-semibold text-ink">{boldText}</strong>);
        remaining = remaining.substring(endBoldIdx + 2);
      } else {
        parts.push(remaining.substring(boldIdx));
        break;
      }
    } else {
      // Italic is closer
      if (italicIdx > 0) {
        parts.push(remaining.substring(0, italicIdx));
      }
      const endItalicIdx = remaining.indexOf("*", italicIdx + 1);
      if (endItalicIdx !== -1) {
        const italicText = remaining.substring(italicIdx + 1, endItalicIdx);
        parts.push(<em key={key++} className="italic text-body-strong">{italicText}</em>);
        remaining = remaining.substring(endItalicIdx + 1);
      } else {
        parts.push(remaining.substring(italicIdx));
        break;
      }
    }
  }
  
  return parts;
}

function parseMarkdown(text: string) {
  if (!text) return null;
  
  const lines = text.split("\n");
  
  return lines.map((line, lineIdx) => {
    // 1. Check for horizontal rule
    if (line.trim() === "---") {
      return <hr key={lineIdx} className="my-4 border-t border-hairline-strong" />;
    }
    
    // 2. Check for headings
    if (line.startsWith("# ")) {
      return (
        <h1 key={lineIdx} className="text-xl font-bold text-ink mt-4 mb-2">
          {renderLineContent(line.slice(2))}
        </h1>
      );
    }
    if (line.startsWith("## ")) {
      return (
        <h2 key={lineIdx} className="text-lg font-bold text-ink mt-3 mb-1.5">
          {renderLineContent(line.slice(3))}
        </h2>
      );
    }
    if (line.startsWith("### ")) {
      return (
        <h3 key={lineIdx} className="text-md font-semibold text-ink mt-2 mb-1">
          {renderLineContent(line.slice(4))}
        </h3>
      );
    }
    
    // 3. Bullet points
    if (line.trim().startsWith("* ") || line.trim().startsWith("- ")) {
      const cleanLine = line.trim().slice(2);
      return (
        <ul key={lineIdx} className="list-disc pl-5 my-1 text-body">
          <li>{renderLineContent(cleanLine)}</li>
        </ul>
      );
    }
    
    // 4. Default paragraph or blank line
    if (line.trim() === "") {
      return <div key={lineIdx} className="h-2" />;
    }
    
    return (
      <p key={lineIdx} className="text-[15px] text-body leading-relaxed mb-2.5 whitespace-pre-wrap">
        {renderLineContent(line)}
      </p>
    );
  });
}

export default function AskPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [convIndex, setConvIndex] = useState<ConversationMeta[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const epochRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = loadMessagesRaw();
    if (saved.length > 0) setMessages(saved);
    setConvIndex(getConvIndex());
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    saveMessagesRaw(messages);
  }, [messages]);

  useEffect(() => {
    persistConvIndex(convIndex);
  }, [convIndex]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(e.target as Node)) {
        setShowHistory(false);
      }
    };
    if (showHistory) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showHistory]);

  const saveCurrentToHistory = useCallback(() => {
    if (messages.length === 0) return null;
    const convId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    saveConvMessages(convId, messages);
    const convs = getConvIndex();
    convs.unshift({
      id: convId,
      title: generateTitle(messages),
      updatedAt: new Date().toISOString(),
      messageCount: messages.length,
    });
    setConvIndex([...convs]);
    return convId;
  }, [messages]);

  const newConversation = useCallback(() => {
    saveCurrentToHistory();
    setMessages([]);
    try { localStorage.removeItem(CUR_KEY); } catch {}
  }, [saveCurrentToHistory]);

  const switchToConversation = useCallback((convId: string) => {
    saveCurrentToHistory();
    const stored = loadConvMessages(convId);
    if (stored) {
      setMessages(stored);
    }
    setConvIndex(prev => prev.filter(c => c.id !== convId));
    setShowHistory(false);
  }, [saveCurrentToHistory]);

  const deleteConversation = useCallback((convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteConvMessages(convId);
    setConvIndex(prev => prev.filter(c => c.id !== convId));
  }, []);

  const handleSubmit = async (query?: string) => {
    const q = (query || input).trim();
    if (!q || isProcessing) return;

    const epoch = ++epochRef.current;
    setIsProcessing(true);
    setInput("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await answerQuery(q, controller.signal);
      if (epoch !== epochRef.current) return;
      setMessages((prev) => {
        const next = [...prev, response];
        saveMessagesRaw(next);
        return next;
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : "Failed to get answer";
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).slice(2),
        query: q,
        intent: null,
        answer: `Error: ${msg}. Make sure the backend is running.`,
        sources: [],
        diffCard: null,
        timeline: null,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => {
        const next = [...prev, errorMsg];
        saveMessagesRaw(next);
        return next;
      });
    } finally {
      if (epoch === epochRef.current) {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-canvas relative overflow-hidden selection:bg-gradient-sky/40">
      {/* Soft atmospheric gradient orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] orb-sky opacity-20 blur-[110px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[400px] h-[400px] orb-peach opacity-20 blur-[100px] pointer-events-none" />

      <div className="shrink-0 px-6 md:px-12 pt-6 pb-4 border-b border-hairline flex items-center justify-between bg-canvas/80 backdrop-blur-md relative z-10">
        <div>
          <div className="caption-upper text-muted" style={{ fontSize: "11px" }}>Recall & queries</div>
          <h1 className="display-sm text-ink mt-0.5">Ask Synapse</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={historyRef}>
            <button
              onClick={() => setShowHistory(v => !v)}
              className="px-4 py-2 rounded-full bg-surface-card border border-hairline-strong text-xs font-semibold text-body hover:text-ink hover:bg-surface-strong transition-all duration-150 cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              History
            </button>
            {showHistory && (
              <div className="absolute right-0 top-full mt-2 w-72 max-h-80 overflow-y-auto rounded-xl border border-hairline bg-surface-card shadow-lg z-50 p-2 space-y-1">
                {convIndex.length === 0 ? (
                  <p className="text-xs text-muted-soft text-center py-5">No past conversations</p>
                ) : (
                  convIndex.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => switchToConversation(conv.id)}
                      className="w-full text-left px-3.5 py-3 rounded-lg hover:bg-surface-strong transition-colors duration-100 cursor-pointer group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink truncate">{conv.title}</p>
                          <p className="text-xs text-muted mt-1">
                            {formatDate(conv.updatedAt)} &middot; {conv.messageCount} msg{conv.messageCount > 1 ? "s" : ""}
                          </p>
                        </div>
                        <button
                          onClick={(e) => deleteConversation(conv.id, e)}
                          className="ml-2 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-surface-strong/80 text-muted hover:text-semantic-error transition-all duration-100"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
          <button
            onClick={newConversation}
            className="px-4 py-2 rounded-full bg-surface-card border border-hairline-strong text-xs font-semibold text-body hover:text-ink hover:bg-surface-strong transition-all duration-150 cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin px-6 md:px-12 py-8 relative z-10">
        {messages.length === 0 && !isProcessing && (
          <div className="h-full flex flex-col items-center justify-center gap-8 py-10">
            <EmptyState
              icon="chat"
              title="What do you want to recall?"
              description="Ask about your knowledge graph. Synapse will reconcile timelines and structure changes."
            />
            <div className="flex flex-wrap gap-2.5 justify-center max-w-xl">
              {promptChips.map((chip) => (
                <button
                  key={chip}
                  onClick={() => handleSubmit(chip)}
                  className="px-5 py-2.5 rounded-full border border-hairline-strong text-[14px] text-body hover:text-ink hover:bg-surface-strong hover:border-hairline bg-surface-card shadow-[0_2px_8px_rgba(0,0,0,0.01)] transition-all duration-150 cursor-pointer"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto space-y-8">
          {messages.map((msg) => (
            <div key={msg.id} className="space-y-3">
              <div className="flex justify-end">
                <div className="px-5 py-3 rounded-2xl bg-surface-strong/60 border border-hairline max-w-xl shadow-[0_2px_8px_rgba(0,0,0,0.01)]">
                  <p className="text-[15px] font-medium text-body-strong leading-relaxed">{msg.query}</p>
                </div>
              </div>

              <div className="p-6 md:p-8 rounded-2xl bg-surface-card border border-hairline shadow-[0_4px_20px_rgba(0,0,0,0.01)] space-y-4">
                <div className="text-[15px] text-body leading-relaxed">
                  {parseMarkdown(msg.answer)}
                </div>
                {msg.diffCard && <DiffCardView diff={msg.diffCard} />}
                {msg.timeline && <TimelineView points={msg.timeline} />}
                {msg.sources.length > 0 && (
                  <div className="mt-5 pt-4 border-t border-hairline flex flex-wrap items-center gap-2">
                    <span className="caption-upper text-muted" style={{ fontSize: "10px" }}>Ingested Sources:</span>
                    {msg.sources.map((s, i) => (
                      <SourcePill key={i} type={s.type} label={s.label} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isProcessing && (
            <div className="flex justify-start">
              <div className="px-6 py-4 rounded-2xl bg-surface-card border border-hairline shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5 items-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.2s" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" style={{ animationDelay: "0.4s" }} />
                  </div>
                  <span className="text-[13px] font-medium text-muted">Synapse is traversing memory graph…</span>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      <div className="shrink-0 px-6 md:px-12 py-5 border-t border-hairline pb-24 md:pb-6 bg-canvas/80 backdrop-blur-md relative z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Ask about your knowledge graph..."
            disabled={isProcessing}
            className="flex-1 px-5 py-3.5 rounded-full bg-surface-card border border-hairline-strong text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 shadow-md transition-all duration-200"
          />
          <button
            onClick={() => handleSubmit()}
            disabled={!input.trim() || isProcessing}
            className="px-6 py-3.5 rounded-full bg-primary text-on-primary text-sm font-semibold hover:bg-primary-active disabled:opacity-40 transition-all duration-200 cursor-pointer shadow-sm active:scale-[0.98]"
          >
            {isProcessing ? "…" : "Ask"}
          </button>
        </div>
      </div>
    </div>
  );
}

