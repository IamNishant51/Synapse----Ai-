"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getDecaySettings, updateDecaySettings, runDecayCheck, getSources, searchNodes, forgetSource, forgetNode } from "@/lib/api";
import type { Source } from "@/lib/types";
import { useIngestion } from "@/context/IngestionContext";
import { useToast } from "@/context/ToastContext";
import { useAIConfig } from "@/context/AIConfigContext";

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    if (!iso.includes("T")) return iso;
    return d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export default function SettingsPage() {
  const { addToast } = useToast();
  const { config, openModal, disconnectAI } = useAIConfig();
  const { jobStatus, progress } = useIngestion();
  const [decayStart, setDecayStart] = useState(60);
  
  const decayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragStartDecayRef = useRef<number | null>(null);

  const forgetTimerRef = useRef<NodeJS.Timeout | null>(null);
  const dragStartForgetRef = useRef<number | null>(null);
  const [forgetThreshold, setForgetThreshold] = useState(180);
  const [searchQuery, setSearchQuery] = useState("");
  const [decayRunning, setDecayRunning] = useState(false);
  const [sources, setSources] = useState<Source[]>([]);
  const [searchResults, setSearchResults] = useState<{ id: string; label: string; confidence: number; status: string }[]>([]);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [decayResult, setDecayResult] = useState<{ forgotten: number; decayed: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [settings, srcs] = await Promise.all([getDecaySettings(), getSources()]);
        setDecayStart(settings.decayStartDays);
        setForgetThreshold(settings.forgetThresholdDays);
        setSources(srcs);
      } catch {
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      Promise.resolve().then(() => {
        setSearchResults([]);
      });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const results = await searchNodes(searchQuery);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const toggleNodeSelection = (id: string) => {
    setSelectedNodeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDecayCheck = async () => {
    setDecayRunning(true);
    setDecayResult(null);
    try {
      const result = await runDecayCheck();
      setDecayResult(result);
      addToast("Memory decay sweep completed", "success");
    } catch {
      setDecayResult({ forgotten: 0, decayed: 0 });
      addToast("Failed to run memory decay sweep", "error");
    } finally {
      setDecayRunning(false);
    }
  };

  const handleDecayStartChange = (val: number) => {
    if (dragStartDecayRef.current === null) {
      dragStartDecayRef.current = decayStart;
    }
    setDecayStart(val);

    if (decayTimerRef.current) clearTimeout(decayTimerRef.current);
    decayTimerRef.current = setTimeout(async () => {
      const originalVal = dragStartDecayRef.current;
      try {
        await updateDecaySettings({ decayStartDays: val, forgetThresholdDays: forgetThreshold });
        addToast("Decay settings updated", "success");
      } catch {
        if (originalVal !== null) {
          setDecayStart(originalVal);
        }
        addToast("Failed to update decay settings", "error");
      } finally {
        dragStartDecayRef.current = null;
      }
    }, 500);
  };

  const handleForgetThresholdChange = (val: number) => {
    if (dragStartForgetRef.current === null) {
      dragStartForgetRef.current = forgetThreshold;
    }
    setForgetThreshold(val);

    if (forgetTimerRef.current) clearTimeout(forgetTimerRef.current);
    forgetTimerRef.current = setTimeout(async () => {
      const originalVal = dragStartForgetRef.current;
      try {
        await updateDecaySettings({ decayStartDays: decayStart, forgetThresholdDays: val });
        addToast("Pruning threshold updated", "success");
      } catch {
        if (originalVal !== null) {
          setForgetThreshold(originalVal);
        }
        addToast("Failed to update pruning threshold", "error");
      } finally {
        dragStartForgetRef.current = null;
      }
    }, 500);
  };

  const handleDeleteSource = useCallback(async (sourceId: string) => {
    try {
      await forgetSource(sourceId);
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      addToast("Source document deleted", "success");
    } catch {
      addToast("Failed to delete source document", "error");
    }
  }, [addToast]);

  const handleForgetSelected = useCallback(async () => {
    const ids = Array.from(selectedNodeIds);
    if (ids.length === 0) return;
    try {
      await Promise.all(ids.map((id) => forgetNode(id)));
      setSelectedNodeIds(new Set());
      setSearchResults((prev) => prev.filter((r) => !ids.includes(r.id)));
      addToast(`Successfully forgot ${ids.length} nodes`, "success");
    } catch {
      addToast("Failed to forget selected nodes", "error");
    }
  }, [selectedNodeIds, addToast]);

  if (loading) {
    return (
      <div className="h-full overflow-y-auto scrollbar-thin bg-canvas">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-12 pt-6 md:pt-16 pb-24">
          <div className="mb-10">
            <div className="h-8 w-40 bg-surface-strong animate-pulse rounded-lg mb-2.5" />
            <div className="h-4 w-80 max-w-full bg-surface-strong/60 animate-pulse rounded-lg" />
          </div>

          {[1, 2, 3].map((i) => (
            <section key={i} className="mb-10 animate-pulse">
              <div className="h-5 w-32 bg-surface-strong rounded-md mb-4" />
              <div className="p-4 sm:p-6 rounded-2xl bg-surface-card border border-hairline space-y-6">
                <div className="h-4 w-full bg-surface-strong rounded" />
                <div className="h-4 w-3/4 bg-surface-strong rounded" />
                <div className="h-10 w-40 bg-surface-strong rounded-full mt-4" />
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto scrollbar-thin relative bg-canvas selection:bg-gradient-rose/40">
      {/* Soft atmospheric gradient orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] orb-rose opacity-20 blur-[110px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[400px] h-[400px] orb-peach opacity-20 blur-[100px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-12 pt-6 md:pt-16 pb-24 relative z-10">
        <div className="mb-10">
          <div className="caption-upper text-muted mb-2.5">Memory health & decay</div>
          <h1 className="display-lg text-ink">Memory Health.</h1>
          <p className="mt-2 text-base text-body leading-relaxed max-w-xl" style={{ letterSpacing: "0.15px" }}>
            Control how Synapse manages confidence, pruning thresholds, and manual node forgetting across your knowledge graph.
          </p>
        </div>

        {/* 0. Custom AI Configuration */}
        <section className="mb-10">
          <div className="caption-upper text-muted mb-3.5">Custom AI Configuration</div>
          <div className="p-4 sm:p-6 md:p-8 rounded-2xl bg-surface-card border border-hairline shadow-[0_4px_16px_rgba(0,0,0,0.02)] space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-body-strong">Synapse AI Integration</h3>
                <p className="text-xs text-muted-soft mt-1 leading-relaxed max-w-lg">
                  Bring your own API key to run queries, ingestions, and memory reconciliation.
                </p>
              </div>
              <button
                onClick={openModal}
                className="px-5 py-2.5 rounded-full bg-primary text-on-primary text-[14px] font-semibold hover:bg-primary-active active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-sm self-start sm:self-auto whitespace-nowrap"
              >
                {config?.configured ? "Change Credentials" : "Configure AI"}
              </button>
            </div>

            {config?.configured && (
              <div className="pt-4 border-t border-hairline-soft flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-surface-strong/20 p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm uppercase">
                    {config.provider?.substring(0, 2)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-ink uppercase tracking-wider">{config.provider} Provider (BYOK)</div>
                    <div className="text-sm text-body-strong font-mono mt-0.5">{config.model}</div>
                  </div>
                </div>
                <button
                  onClick={disconnectAI}
                  className="text-xs font-semibold text-semantic-error hover:underline cursor-pointer"
                >
                  Disconnect AI Key
                </button>
              </div>
            )}
            
            {!config?.configured && (
              <div className="pt-3.5 border-t border-hairline-soft text-xs text-muted leading-relaxed flex items-start gap-2 bg-surface-strong/10 p-3.5 rounded-xl">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5">
                  <circle cx="7" cy="7" r="6" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M7 4.5v3M7 9.5v.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <span>AI features are currently <strong>inactive</strong>. Connect a personal API key to authorize AI operations.</span>
              </div>
            )}
          </div>
        </section>

        {/* 1. Decay Settings */}
        <section className="mb-10">
          <div className="caption-upper text-muted mb-3.5">Decay Settings</div>
          <div className="p-4 sm:p-6 md:p-8 rounded-2xl bg-surface-card border border-hairline shadow-[0_4px_16px_rgba(0,0,0,0.02)] space-y-7">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-body-strong">Days until confidence declines</label>
                <span className="text-sm font-mono text-muted bg-surface-strong px-2 py-0.5 rounded">{decayStart}</span>
              </div>
              <input
                type="range"
                min={7} max={365}
                value={decayStart}
                onChange={(e) => handleDecayStartChange(Number(e.target.value))}
                className="w-full h-1 rounded-full bg-surface-strong appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary transition-all"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-muted-soft">7 days</span>
                <span className="text-xs text-muted-soft">365 days</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold text-body-strong">Days until fully forgotten</label>
                <span className="text-sm font-mono text-muted bg-surface-strong px-2 py-0.5 rounded">{forgetThreshold}</span>
              </div>
              <input
                type="range"
                min={30} max={730}
                value={forgetThreshold}
                onChange={(e) => handleForgetThresholdChange(Number(e.target.value))}
                className="w-full h-1 rounded-full bg-surface-strong appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-semantic-error transition-all"
              />
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-muted-soft">30 days</span>
                <span className="text-xs text-muted-soft">730 days</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-hairline-soft">
              <button
                onClick={handleDecayCheck}
                disabled={decayRunning}
                className="px-5 py-2.5 rounded-full bg-primary text-on-primary text-[14px] font-semibold hover:bg-primary-active active:scale-[0.98] transition-all duration-150 cursor-pointer disabled:opacity-50"
              >
                {decayRunning ? "Running decay check…" : "Run decay check now"}
              </button>
              {decayResult && (
                <span className="text-xs font-semibold text-muted bg-surface-strong px-3 py-1 rounded-full">
                  {decayResult.decayed} nodes decayed &middot; {decayResult.forgotten} forgotten
                </span>
              )}
            </div>
          </div>
        </section>

        {/* 2. Manual Forget */}
        <section className="mb-10">
          <div className="caption-upper text-muted mb-3.5">Manual Forget</div>
          <div className="p-4 sm:p-6 md:p-8 rounded-2xl bg-surface-card border border-hairline shadow-[0_4px_16px_rgba(0,0,0,0.02)] space-y-5">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setSelectedNodeIds(new Set()); }}
              placeholder="Search specific topic to forget…"
              className="w-full px-4 py-3 rounded-lg bg-surface-card border border-hairline-strong text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 transition-all duration-200"
            />

            {searchResults.length > 0 && (
              <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin border border-hairline-soft rounded-lg p-2 bg-canvas/30">
                {searchResults.map((result) => (
                  <div key={result.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-surface-strong/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedNodeIds.has(result.id)}
                        onChange={() => toggleNodeSelection(result.id)}
                        className="rounded border-hairline-strong bg-surface-card accent-primary cursor-pointer w-4 h-4"
                      />
                      <span className="text-sm font-medium text-body">{result.label}</span>
                    </div>
                    <span className="text-xs font-mono text-muted bg-surface-strong px-2 py-0.5 rounded">conf. {Math.round(result.confidence * 100)}%</span>
                  </div>
                ))}
              </div>
            )}
            {searchQuery && searchResults.length === 0 && (
              <p className="text-xs text-muted-soft px-1">No matching memory nodes found</p>
            )}

            <button
              onClick={handleForgetSelected}
              disabled={selectedNodeIds.size === 0}
              className="px-5 py-2.5 rounded-full bg-semantic-error/10 border border-semantic-error/20 text-semantic-error text-[14px] font-semibold hover:bg-semantic-error/20 active:scale-[0.98] disabled:opacity-30 transition-all duration-150 cursor-pointer"
            >
              Forget selected ({selectedNodeIds.size})
            </button>
          </div>
        </section>

        {/* 3. Ingested Sources */}
        <section className="mb-10">
          <div className="caption-upper text-muted mb-3.5">Ingested Sources</div>
          <div className="rounded-2xl bg-surface-card border border-hairline shadow-[0_4px_16px_rgba(0,0,0,0.02)] divide-y divide-hairline overflow-hidden">
            {sources.length === 0 && (
              <div className="px-6 py-8 text-center text-sm text-muted-soft">No sources ingested into graph yet.</div>
            )}
            {sources.map((source) => (
              <div key={source.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 sm:px-6 py-4 hover:bg-canvas/20 transition-colors">
                <div className="flex items-start sm:items-center gap-3">
                  <svg width="16" height="16" viewBox="0 0 14 14" fill="none" className="shrink-0 mt-0.5 sm:mt-0">
                    <circle cx="7" cy="7" r="6" stroke="#777169" strokeWidth="1.2" />
                    <path d="M4 7h6" stroke="#777169" strokeWidth="1.2" strokeLinecap="round" />
                  </svg>
                  <div className="min-w-0 flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2.5">
                    <span className="text-[14px] font-semibold text-ink truncate">{source.label}</span>{" "}
                    <span className="text-[10px] font-semibold text-muted bg-surface-strong px-2 py-0.5 rounded-full uppercase tracking-wider w-fit">{source.type}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto mt-2 sm:mt-0 border-t sm:border-0 border-hairline/40 pt-2.5 sm:pt-0">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    source.status === "ready"
                      ? "bg-semantic-success/10 text-semantic-success"
                      : source.status === "processing"
                        ? "bg-primary/10 text-primary"
                        : "bg-semantic-error/10 text-semantic-error"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      source.status === "ready"
                        ? "bg-semantic-success"
                        : source.status === "processing"
                          ? "bg-primary animate-pulse"
                          : "bg-semantic-error"
                    }`} />
                    {source.status === "processing"
                      ? (jobStatus === "running" ? `Syncing… (${progress}%)` : "processing…")
                      : source.status}
                  </span>{" "}
                  <span className="text-xs text-muted-soft font-mono">{formatDate(source.ingestedAt)}</span>{" "}
                  <button
                    onClick={() => handleDeleteSource(source.id)}
                    className="text-xs font-semibold text-semantic-error hover:text-semantic-error/85 transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

