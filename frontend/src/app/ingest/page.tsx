"use client";

import { useState, useRef, useEffect } from "react";
import IngestionStepper from "@/components/IngestionStepper";
import { ingestSource } from "@/lib/api";
import type { SourceType } from "@/lib/types";
import { useIngestion } from "@/context/IngestionContext";

type Tab = "github" | "conversation" | "pdf" | "article" | "youtube";

export default function IngestPage() {
  const { jobStatus, currentStep, progress, error, startSync, resetSync } = useIngestion();

  const [activeTab, setActiveTab] = useState<Tab>("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [pathFilter, setPathFilter] = useState("");
  const [conversationText, setConversationText] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [articleUrl, setArticleUrl] = useState("");
  const [articleLabel, setArticleLabel] = useState("");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeLabel, setYoutubeLabel] = useState("");
  const [apiError, setApiError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPathFilter("");
    if (activeTab !== "conversation") setSourceLabel("");
    if (activeTab === "pdf") setPdfFiles([]);
  }, [activeTab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "github", label: "GitHub" },
    { key: "conversation", label: "Paste Conversation" },
    { key: "pdf", label: "Upload PDF" },
    { key: "article", label: "Article URL" },
    { key: "youtube", label: "YouTube URL" },
  ];

  const handleSync = async () => {
    setApiError(null);
    try {
      let sourceType: SourceType;
      let content: string;
      let label: string;
      let url: string | undefined;

      if (activeTab === "github") {
        if (!repoUrl) return;
        sourceType = "github";
        content = `Repository: ${repoUrl}\nPath filter: ${pathFilter || "all"}`;
        label = repoUrl.split("/").slice(-2).join("/");
        url = repoUrl;
      } else if (activeTab === "conversation") {
        if (!conversationText) return;
        sourceType = "conversation";
        content = conversationText;
        label = sourceLabel || `Conversation ${new Date().toLocaleDateString()}`;
        url = undefined;
      } else if (activeTab === "article") {
        if (!articleUrl) return;
        sourceType = "article";
        content = `Article URL: ${articleUrl}`;
        label = articleLabel || articleUrl.replace("https://", "").replace("http://", "").split("/")[0] || "Article URL";
        url = articleUrl;
      } else if (activeTab === "youtube") {
        if (!youtubeUrl) return;
        sourceType = "youtube";
        content = `YouTube URL: ${youtubeUrl}`;
        label = youtubeLabel || "YouTube Transcript";
        url = youtubeUrl;
      } else {
        if (pdfFiles.length === 0) return;
        const file = pdfFiles[0];
        const toBase64 = (f: File): Promise<string> =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(f);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
          });
        sourceType = "pdf";
        content = await toBase64(file);
        label = file.name;
        url = undefined;
      }

      const { jobId } = await ingestSource(sourceType, content, label, url, pathFilter);
      startSync(jobId);
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Failed to start ingestion");
    }
  };

  const handleReset = () => {
    resetSync();
    setApiError(null);
    setRepoUrl("");
    setPathFilter("");
    setConversationText("");
    setSourceLabel("");
    setPdfFiles([]);
    setArticleUrl("");
    setArticleLabel("");
    setYoutubeUrl("");
    setYoutubeLabel("");
  };

  const handlePdfClick = () => {
    fileInputRef.current?.click();
  };

  const handlePdfFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type === "application/pdf");
    if (files.length > 0) setPdfFiles(files);
    e.target.value = "";
  };

  const isDisabled = jobStatus === "running" || jobStatus === "completed";

  return (
    <div className="h-full overflow-y-auto scrollbar-thin relative bg-canvas selection:bg-gradient-peach/40">
      {/* Soft atmospheric gradient orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] orb-mint opacity-20 blur-[110px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[400px] h-[400px] orb-peach opacity-20 blur-[100px] pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 md:px-12 pt-6 md:pt-16 pb-24 relative z-10">
        <div className="mb-10">
          <div className="caption-upper text-muted mb-2.5">Memory ingestion</div>
          <h1 className="display-lg text-ink">Add to your memory.</h1>
          <p className="mt-2 text-base text-body leading-relaxed max-w-xl" style={{ letterSpacing: "0.15px" }}>
            Feed Synapse a source — it will ingest, extract, reconcile, and integrate it into your knowledge graph.
          </p>
        </div>

        <div className="flex flex-row flex-nowrap overflow-x-auto scrollbar-none gap-1.5 p-1 rounded-xl md:rounded-full bg-surface-strong w-full md:w-fit mb-8 border border-hairline">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { if (!isDisabled) setActiveTab(tab.key); }}
              disabled={isDisabled}
              className={`px-5 py-2 rounded-lg md:rounded-full text-sm font-medium transition-all duration-150 cursor-pointer shrink-0 ${
                activeTab === tab.key
                  ? "bg-surface-card text-ink shadow-[0_2px_8px_rgba(0,0,0,0.03)] border border-hairline"
                  : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="bg-surface-card border border-hairline rounded-2xl p-4 sm:p-6 md:p-8 shadow-[0_4px_20px_rgba(0,0,0,0.02)] space-y-6">
          {activeTab === "github" && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-body-strong mb-2">GitHub Repo URL</label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  disabled={isDisabled}
                  className="w-full px-4 py-3 rounded-lg bg-surface-card border border-hairline-strong text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-body-strong mb-2">Path filter (optional)</label>
                <input
                  type="text"
                  value={pathFilter}
                  onChange={(e) => setPathFilter(e.target.value)}
                  placeholder="e.g. /docs or *.md"
                  disabled={isDisabled}
                  className="w-full px-4 py-3 rounded-lg bg-surface-card border border-hairline-strong text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 transition-all duration-200"
                />
              </div>
              {jobStatus === "completed" ? (
                <p className="text-xs font-medium text-semantic-success">Last synced: just now</p>
              ) : (
                <p className="text-xs text-muted-soft">Last synced: never</p>
              )}
            </div>
          )}

          {activeTab === "conversation" && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-body-strong mb-2">Source label</label>
                <input
                  type="text"
                  value={sourceLabel}
                  onChange={(e) => setSourceLabel(e.target.value)}
                  placeholder="e.g. ChatGPT — March refactor discussion"
                  disabled={isDisabled}
                  className="w-full px-4 py-3 rounded-lg bg-surface-card border border-hairline-strong text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-body-strong mb-2">Paste conversation content</label>
                <textarea
                  value={conversationText}
                  onChange={(e) => setConversationText(e.target.value)}
                  placeholder="Paste a ChatGPT or Claude export, or any raw text..."
                  rows={10}
                  disabled={isDisabled}
                  className="w-full px-4 py-3 rounded-lg bg-surface-card border border-hairline-strong text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 transition-all duration-200 resize-none font-mono"
                />
              </div>
            </div>
          )}

          {activeTab === "pdf" && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                multiple
                onChange={handlePdfFileChange}
                className="hidden"
              />
              <div
                onClick={handlePdfClick}
                className={`border-2 border-dashed rounded-xl p-6 sm:p-12 text-center transition-all duration-200 ${
                  isDisabled ? "border-hairline opacity-50" : "border-hairline hover:border-primary cursor-pointer bg-canvas/30"
                }`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!isDisabled) setPdfFiles(Array.from(e.dataTransfer.files).filter((f) => f.type === "application/pdf"));
                }}
              >
                <svg width="36" height="36" viewBox="0 0 32 32" fill="none" className="mx-auto mb-4 opacity-60">
                  <path d="M16 4v16m0 0l4-4m-4 4l-4-4" stroke="#292524" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M4 20v6a2 2 0 002 2h20a2 2 0 002-2v-6" stroke="#292524" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
                <p className="text-sm font-medium text-body">
                  {pdfFiles.length > 0
                    ? `${pdfFiles.length} PDF${pdfFiles.length > 1 ? "s" : ""} selected`
                    : "Drop PDFs here or click to browse"}
                </p>
                {pdfFiles.length > 0 && (
                  <div className="mt-4 space-y-1">
                    {pdfFiles.map((f, i) => (
                      <p key={i} className="text-xs text-muted font-mono bg-surface-strong px-2.5 py-1 rounded inline-block">{f.name}</p>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "article" && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-body-strong mb-2">Article URL</label>
                <input
                  type="url"
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  placeholder="https://example.com/blog-post"
                  disabled={isDisabled}
                  className="w-full px-4 py-3 rounded-lg bg-surface-card border border-hairline-strong text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-body-strong mb-2">Article Label (optional)</label>
                <input
                  type="text"
                  value={articleLabel}
                  onChange={(e) => setArticleLabel(e.target.value)}
                  placeholder="e.g. My Startup Roadmap"
                  disabled={isDisabled}
                  className="w-full px-4 py-3 rounded-lg bg-surface-card border border-hairline-strong text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 transition-all duration-200"
                />
              </div>
            </div>
          )}

          {activeTab === "youtube" && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-body-strong mb-2">YouTube Video URL</label>
                <input
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  disabled={isDisabled}
                  className="w-full px-4 py-3 rounded-lg bg-surface-card border border-hairline-strong text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 transition-all duration-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-body-strong mb-2">Video Label (optional)</label>
                <input
                  type="text"
                  value={youtubeLabel}
                  onChange={(e) => setYoutubeLabel(e.target.value)}
                  placeholder="e.g. Supabase Keynote Transcript"
                  disabled={isDisabled}
                  className="w-full px-4 py-3 rounded-lg bg-surface-card border border-hairline-strong text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 transition-all duration-200"
                />
              </div>
            </div>
          )}

          <div className="pt-2 flex items-center gap-4">
            <button
              onClick={jobStatus === "completed" ? handleReset : handleSync}
              disabled={isDisabled && jobStatus !== "completed"}
              className={`px-6 py-3 rounded-full text-[15px] font-medium transition-all duration-200 cursor-pointer shadow-sm ${
                jobStatus === "completed"
                  ? "bg-surface-strong text-body border border-hairline-strong hover:bg-surface-strong/80"
                  : "bg-primary text-on-primary hover:bg-primary-active active:scale-[0.98]"
              }`}
            >
              {jobStatus === "idle" ? "Sync Now" : jobStatus === "running" ? "Syncing…" : "Done — Sync Another"}
            </button>
            {(apiError || error) && <span className="text-sm text-semantic-error font-medium">{apiError || error}</span>}
          </div>
        </div>

        {jobStatus !== "idle" && (
          <div className="mt-8 p-6 rounded-2xl bg-surface-card border border-hairline shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
            <IngestionStepper currentStep={currentStep} progress={progress} status={jobStatus} />
          </div>
        )}
      </div>
    </div>
  );
}

