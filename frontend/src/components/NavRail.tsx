"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useIngestion } from "@/context/IngestionContext";

const navItems = [
  { href: "/graph", label: "Graph", icon: GraphIcon },
  { href: "/ingest", label: "Ingest", icon: IngestIcon },
  { href: "/resolve", label: "Resolve", icon: ResolveIcon },
  { href: "/ask", label: "Ask", icon: AskIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function NavRail() {
  const pathname = usePathname();
  const { jobStatus, progress } = useIngestion();

  return (
    <aside className="fixed bottom-0 md:top-0 left-0 z-40 flex w-full h-14 md:h-full md:w-56 flex-row md:flex-col bg-canvas border-t md:border-t-0 md:border-r border-hairline">
      {/* Brand */}
      <div className="hidden md:flex items-center gap-2.5 px-5 pt-5 pb-6">
        <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="2"/>
            <circle cx="12" cy="12" r="3" fill="white"/>
          </svg>
        </div>
        <span className="text-[15px] font-medium tracking-tight text-ink" style={{ fontFamily: "'EB Garamond', serif", fontWeight: 400, fontSize: "18px" }}>
          Synapse
        </span>
      </div>

      {/* Nav links */}
      <nav className="flex flex-row md:flex-col w-full md:w-auto h-full md:h-auto gap-0.5 px-1.5 md:px-3 justify-around md:justify-start items-center md:items-stretch py-1 md:py-0">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const isIngest = item.label === "Ingest";
          const isSyncing = isIngest && jobStatus === "running";

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col md:flex-row items-center md:justify-between px-2 py-1.5 md:px-3 md:py-2 rounded-lg text-[10px] md:text-[15px] transition-all duration-150 group flex-1 md:flex-none ${
                isActive
                  ? "text-ink md:bg-surface-strong md:text-ink font-medium"
                  : "text-muted hover:text-ink md:hover:bg-surface-strong/50"
              }`}
            >
              <div className="flex flex-col md:flex-row items-center gap-1 md:gap-2.5 relative">
                <item.icon active={isActive} />
                <span className="mt-0.5 md:mt-0 font-medium tracking-wide" style={{ letterSpacing: "0.15px" }}>{item.label}</span>
                {isSyncing && (
                  <span className="absolute -top-1 -right-2 md:relative md:top-auto md:right-auto flex h-2 w-2 md:mr-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-semantic-success opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-semantic-success"></span>
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* Status bar */}
      <div className="hidden md:block mt-auto px-4 pb-4">
        {jobStatus === "running" ? (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-strong border border-hairline">
            <div className="w-2 h-2 rounded-full bg-semantic-success animate-pulse" />
            <span className="text-xs text-body">
              Syncing… <span className="text-[10px] text-muted">({progress}%)</span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-strong">
            <div className="w-2 h-2 rounded-full bg-semantic-success" />
            <span className="text-xs text-muted">Memory active</span>
          </div>
        )}
      </div>
    </aside>
  );
}

/* ── SVG Icons — clean, editorial line style ── */

function GraphIcon({ active }: { active: boolean }) {
  const c = active ? "#0c0a09" : "#a8a29e";
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="4" r="2" stroke={c} strokeWidth="1.5" />
      <circle cx="4" cy="14" r="2" stroke={c} strokeWidth="1.5" />
      <circle cx="14" cy="14" r="2" stroke={c} strokeWidth="1.5" />
      <line x1="7.5" y1="5.5" x2="5.5" y2="12.5" stroke={c} strokeWidth="1.2" />
      <line x1="10.5" y1="5.5" x2="12.5" y2="12.5" stroke={c} strokeWidth="1.2" />
      <line x1="6" y1="14" x2="12" y2="14" stroke={c} strokeWidth="1.2" />
    </svg>
  );
}

function IngestIcon({ active }: { active: boolean }) {
  const c = active ? "#0c0a09" : "#a8a29e";
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 2v14" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M2 9h14" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ResolveIcon({ active }: { active: boolean }) {
  const c = active ? "#0c0a09" : "#a8a29e";
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="3" width="6" height="12" rx="1.5" stroke={c} strokeWidth="1.5" />
      <rect x="10" y="5" width="6" height="10" rx="1.5" stroke={c} strokeWidth="1.5" />
      <path d="M11 9h4" stroke={c} strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function AskIcon({ active }: { active: boolean }) {
  const c = active ? "#0c0a09" : "#a8a29e";
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 1.5C4.86 1.5 1.5 4.86 1.5 9c0 4.14 3.36 7.5 7.5 7.5h7.5V9c0-4.14-3.36-7.5-7.5-7.5z" stroke={c} strokeWidth="1.5" />
      <path d="M9 12v.01" stroke={c} strokeWidth="2" strokeLinecap="round" />
      <path d="M6.5 7.5a2.5 2.5 0 015 0c0 1-.7 1.7-1.5 2" stroke={c} strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ active }: { active: boolean }) {
  const c = active ? "#0c0a09" : "#a8a29e";
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
