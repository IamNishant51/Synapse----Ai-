"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function LandingPage() {
  const router = useRouter();
  const [entering, setEntering] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => { ScrollTrigger.refresh(); }, []);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add("(prefers-reduced-motion: no-preference)", () => {
      /* ── Hero entrance ── */
      gsap.set(".fade-up", { y: 28, opacity: 0 });

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro.to(".fade-up", { y: 0, opacity: 1, stagger: 0.14, duration: 0.9, delay: 0.2 });

      // Atmospheric orb drift
      gsap.to(".atm-orb", {
        keyframes: [
          { x: "3%", y: "-2%", scale: 1.02, duration: 6 },
          { x: "-2%", y: "3%", scale: 0.98, duration: 7 },
          { x: "0%", y: "0%", scale: 1, duration: 5 },
        ],
        repeat: -1,
        ease: "sine.inOut",
      });

      // Scroll cue
      gsap.to(".scroll-hint", { y: 5, repeat: -1, yoyo: true, duration: 1.4, ease: "sine.inOut" });

      /* ── Section 2: source pills ── */
      gsap.from(".src-item", {
        opacity: 0,
        y: 24,
        stagger: 0.08,
        scrollTrigger: { trigger: "#section-sources", start: "top 80%", end: "top 50%", scrub: 1 },
      });

      /* ── Section 3: Ingest stepper (pinned) ── */
      const steps = [".step-1", ".step-2", ".step-3", ".step-4"];
      const ingestTl = gsap.timeline({
        scrollTrigger: { trigger: "#section-ingest", start: "center center", end: "+=160%", pin: true, scrub: 1 },
      });
      steps.forEach((sel, i) => {
        const pct = `${(i + 1) * 25}%`;
        ingestTl
          .to(".prog-fill", { width: pct, ease: "none" })
          .to(`${sel} .dot`, { backgroundColor: "#292524", borderColor: "#292524", color: "#fff" }, "<")
          .to(`${sel} .lbl`, { color: "#292524" }, "<");
      });

      /* ── Section 4: Conflict (pinned) ── */
      const conflictTl = gsap.timeline({
        scrollTrigger: { trigger: "#section-conflict", start: "center center", end: "+=220%", pin: true, scrub: 1 },
      });
      conflictTl
        .from(".belief-old", { opacity: 0, x: -30, duration: 1 })
        .from(".belief-new", { opacity: 0, x: 30, duration: 1 }, "-=0.5")
        .from(".conflict-badge", { scale: 0, duration: 0.3 }, "-=0.4")
        .to(".btn-resolve", { boxShadow: "0 0 0 3px rgba(41,37,36,0.15)", scale: 1.04, duration: 0.35 })
        .to(".btn-resolve", { boxShadow: "none", scale: 1, duration: 0.2 })
        .from(".diff-result", { opacity: 0, y: 16, duration: 0.7 });

      /* ── Section 5: Decay ── */
      const decayTl = gsap.timeline({
        scrollTrigger: { trigger: "#section-decay", start: "top 65%", end: "bottom 35%", scrub: 1 },
      });
      decayTl
        .to(".bar-fading", { width: "6%", duration: 2 })
        .to(".bar-active", { width: "94%", duration: 2 }, "<");

      /* ── Feature cards stagger ── */
      gsap.from(".feat-card", {
        opacity: 0,
        y: 30,
        stagger: 0.1,
        scrollTrigger: { trigger: "#section-features", start: "top 75%", end: "top 45%", scrub: 1 },
      });
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      gsap.set(".fade-up, .src-item, .belief-old, .belief-new, .diff-result, .feat-card", { opacity: 1, y: 0 });
    });
  }, { scope: wrapRef });

  const enter = () => {
    setEntering(true);
    setTimeout(() => router.push("/graph"), 500);
  };

  return (
    <div ref={wrapRef} className="bg-canvas text-ink selection:bg-gradient-lavender/40 relative">

      {/* ═══════ ATMOSPHERIC ORBS ═══════ */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="atm-orb absolute top-[-10%] right-[-5%] w-[500px] h-[500px] orb-mint opacity-40 blur-[80px]" />
        <div className="atm-orb absolute top-[40%] left-[-10%] w-[400px] h-[400px] orb-peach opacity-30 blur-[90px]" />
        <div className="atm-orb absolute bottom-[-5%] right-[20%] w-[350px] h-[350px] orb-lavender opacity-35 blur-[70px]" />
      </div>

      {/* ═══════ TOP NAVIGATION ═══════ */}
      <nav className="sticky top-0 z-50 bg-canvas/80 backdrop-blur-md border-b border-hairline">
        <div className="max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5 fade-up">
            {/* Synapse logo — clean editorial circle */}
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="#292524" strokeWidth="1.5"/>
              <circle cx="14" cy="14" r="4" fill="#292524"/>
              <line x1="14" y1="5" x2="14" y2="10" stroke="#292524" strokeWidth="1.2"/>
              <line x1="14" y1="18" x2="14" y2="23" stroke="#292524" strokeWidth="1.2"/>
              <line x1="5" y1="14" x2="10" y2="14" stroke="#292524" strokeWidth="1.2"/>
              <line x1="18" y1="14" x2="23" y2="14" stroke="#292524" strokeWidth="1.2"/>
            </svg>
            <span style={{ fontFamily: "'EB Garamond', serif", fontSize: "20px", fontWeight: 400, letterSpacing: "-0.3px" }}
              className="text-ink">Synapse</span>
          </div>

          <div className="flex items-center gap-5 fade-up">
            <a href="https://github.com/IamNishant51/Synapse----Ai-" target="_blank" rel="noreferrer"
              className="text-[15px] font-medium text-body hover:text-ink transition-colors hidden sm:block">GitHub</a>
            <button onClick={enter}
              className="px-5 py-2 rounded-full bg-primary text-on-primary text-[15px] font-medium hover:bg-primary-active transition-colors cursor-pointer">
              Try free
            </button>
          </div>
        </div>
      </nav>

      {/* ═══════ 1 · HERO ═══════ */}
      <section className="relative z-10 max-w-[1200px] mx-auto px-6 pt-20 md:pt-32 pb-24 min-h-[85vh] flex flex-col items-center justify-center text-center">
        <div className="fade-up caption-upper text-muted mb-6">Memory infrastructure for developers</div>

        <h1 className="fade-up display-mega text-ink max-w-3xl mb-6">
          A knowledge graph that reconciles, decays, and actually keeps up with you.
        </h1>

        <p className="fade-up text-body text-base leading-relaxed max-w-lg mb-10" style={{ letterSpacing: "0.16px" }}>
          Ingest scattered notes from ChatGPT, GitHub, PDFs, and more. Synapse detects when facts contradict each other and lets old beliefs fade away.
        </p>

        <div className="fade-up flex items-center gap-3">
          <button onClick={enter} disabled={entering}
            className="px-6 py-2.5 rounded-full bg-primary text-on-primary text-[15px] font-medium hover:bg-primary-active transition-all cursor-pointer disabled:opacity-50">
            {entering ? "Opening…" : "Initialize graph"}
          </button>
          <a href="https://github.com/IamNishant51/Synapse----Ai-" target="_blank" rel="noreferrer"
            className="px-6 py-2.5 rounded-full border border-hairline-strong text-[15px] font-medium text-ink hover:bg-surface-strong transition-all cursor-pointer">
            View source
          </a>
        </div>

        <div className="scroll-hint absolute bottom-8 left-1/2 -translate-x-1/2 opacity-40 flex flex-col items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted font-medium">Scroll</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#777169" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
        </div>
      </section>

      {/* ═══════ 2 · THE PROBLEM ═══════ */}
      <section id="section-sources" className="relative z-10 py-24 px-6" style={{ paddingTop: "96px", paddingBottom: "96px" }}>
        <div className="max-w-[1200px] mx-auto text-center">
          <div className="caption-upper text-muted mb-4">The problem</div>
          <h2 className="display-lg text-ink mb-4">Your context lives everywhere.</h2>
          <p className="text-body max-w-md mx-auto mb-14" style={{ letterSpacing: "0.16px" }}>
            Decisions in ChatGPT. Code on GitHub. Research in PDFs. None of them stay in sync.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {[
              { name: "ChatGPT", d: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-.55 0-1-.45-1-1h2c0 .55-.45 1-1 1zm3-3H9v-1l1-1v-2.5c0-1.6.97-2.97 2.5-3.32V5.5c0-.28.22-.5.5-.5s.5.22.5.5v.68c1.53.35 2.5 1.72 2.5 3.32V12l1 1v1z" },
              { name: "GitHub", d: "M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z" },
              { name: "PDFs", d: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8 17h8v-2H8v2zm0-4h8v-2H8v2z" },
              { name: "YouTube", d: "M21.8 8.001a2.75 2.75 0 00-1.94-1.93C18.12 5.5 12 5.5 12 5.5s-6.12 0-7.86.57a2.75 2.75 0 00-1.94 1.93A28.7 28.7 0 001.5 12a28.7 28.7 0 00.7 3.999 2.75 2.75 0 001.94 1.93c1.74.57 7.86.57 7.86.57s6.12 0 7.86-.57a2.75 2.75 0 001.94-1.93A28.7 28.7 0 0022.5 12a28.7 28.7 0 00-.7-3.999zM9.75 15.02V8.98L15.5 12l-5.75 3.02z" },
              { name: "Articles", d: "M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" },
            ].map((src) => (
              <div key={src.name} className="src-item flex items-center gap-2.5 px-5 py-3 rounded-2xl bg-surface-card border border-hairline hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-shadow">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#777169"><path d={src.d}/></svg>
                <span className="text-[15px] font-medium text-body-strong">{src.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ 3 · INGEST (pinned) ═══════ */}
      <section id="section-ingest" className="relative z-10 min-h-[70vh] flex items-center border-y border-hairline bg-canvas-soft">
        <div className="max-w-[700px] mx-auto px-6 w-full py-24">
          <div className="caption-upper text-muted mb-4">How it works</div>
          <h2 className="display-lg text-ink mb-3">Feed it anything.</h2>
          <p className="text-body mb-14 max-w-md" style={{ letterSpacing: "0.16px" }}>
            Drop a repo, a PDF, or a conversation export. Synapse fetches, extracts,
            calls <code className="text-body-strong text-sm">cognee.remember()</code>,
            then reconciles via <code className="text-body-strong text-sm">improve()</code>.
          </p>

          {/* Stepper */}
          <div className="relative flex items-start justify-between">
            <div className="absolute top-4 left-[12.5%] right-[12.5%] h-[2px] bg-hairline z-0" />
            <div className="prog-fill absolute top-4 left-[12.5%] h-[2px] w-0 bg-primary z-[1] transition-all" />

            {["Fetch", "Extract", "remember()", "improve()"].map((label, i) => (
              <div key={label} className={`step-${i + 1} flex-1 flex flex-col items-center gap-2.5 relative z-10`}>
                <div className="dot w-9 h-9 rounded-full border-2 border-hairline bg-surface-card grid place-items-center text-xs font-mono text-muted transition-all duration-300">
                  {i + 1}
                </div>
                <span className="lbl text-xs text-muted font-medium transition-colors duration-300">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ 4 · CONFLICT RESOLUTION (pinned) ═══════ */}
      <section id="section-conflict" className="relative z-10 min-h-screen flex items-center py-24">
        <div className="max-w-[700px] mx-auto px-6 w-full">
          <div className="caption-upper text-muted mb-4" style={{ color: "#e0a328" }}>Core differentiator</div>
          <h2 className="display-lg text-ink mb-3">Facts change. Synapse catches it.</h2>
          <p className="text-body mb-12 max-w-md" style={{ letterSpacing: "0.16px" }}>
            When new evidence contradicts an older belief, Synapse surfaces the conflict and asks you to decide.
          </p>

          {/* Conflict card */}
          <div className="rounded-2xl border border-hairline bg-surface-card overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.04)]">
            {/* Accent bar */}
            <div className="h-[3px]" style={{ background: "linear-gradient(90deg, #e0a328 0%, #f4c5a8 100%)" }} />
            <div className="p-6 md:p-8">
              {/* Badge */}
              <div className="flex items-center gap-2 mb-6">
                <div className="conflict-badge w-5 h-5 rounded-full grid place-items-center" style={{ background: "rgba(224,163,40,0.12)" }}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6.5" stroke="#e0a328" strokeWidth="1.5"/>
                    <path d="M8 5v3.5M8 10.5v.01" stroke="#e0a328" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="text-sm font-medium text-ink">Conflict — Database choice</span>
              </div>

              {/* Old vs New */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div className="belief-old p-4 rounded-xl bg-canvas border border-hairline">
                  <span className="caption-upper text-muted-soft block mb-2">Old belief</span>
                  <p className="text-sm text-body leading-snug">&quot;Using Postgres for the main datastore&quot;</p>
                  <span className="mt-2 inline-block text-[11px] text-muted-soft">Mar 2 — ChatGPT session</span>
                </div>
                <div className="belief-new p-4 rounded-xl bg-canvas border border-hairline" style={{ borderColor: "rgba(41,37,36,0.2)" }}>
                  <span className="caption-upper text-body-strong block mb-2">New evidence</span>
                  <p className="text-sm text-body leading-snug">&quot;Switched everything to Supabase&quot;</p>
                  <span className="mt-2 inline-block text-[11px] text-muted-soft">Jun 20 — project-notes.md</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-center gap-2.5">
                <button className="px-4 py-2 rounded-full border border-hairline-strong text-sm text-body hover:bg-surface-strong transition-colors">Keep Old</button>
                <button className="btn-resolve px-4 py-2 rounded-full bg-primary text-on-primary text-sm font-medium">Keep New</button>
                <button className="px-4 py-2 rounded-full border border-hairline-strong text-sm text-body hover:bg-surface-strong transition-colors">Keep Both</button>
              </div>

              {/* Diff result */}
              <div className="diff-result mt-6 pt-6 border-t border-hairline">
                <span className="caption-upper block mb-2" style={{ color: "#16a34a" }}>Decision recorded</span>
                <div className="rounded-xl bg-canvas border border-hairline p-4 font-mono text-sm leading-relaxed">
                  <span style={{ color: "#dc2626" }}>− Postgres</span><br />
                  <span style={{ color: "#16a34a" }}>+ Supabase</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 5 · DECAY ═══════ */}
      <section id="section-decay" className="relative z-10 py-24 px-6 border-t border-hairline" style={{ paddingTop: "96px", paddingBottom: "96px" }}>
        <div className="max-w-[700px] mx-auto">
          <div className="caption-upper text-muted mb-4">Memory health</div>
          <h2 className="display-lg text-ink mb-3">Unreinforced beliefs fade.</h2>
          <p className="text-body mb-14 max-w-md" style={{ letterSpacing: "0.16px" }}>
            Confidence decays over time. When a belief goes unreinforced, <code className="text-body-strong text-sm">cognee.forget()</code> prunes it from the graph.
          </p>

          <div className="space-y-6 max-w-lg">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted">Postgres · 3 months ago</span>
                <span className="font-mono text-sm" style={{ color: "#dc2626" }}>0.12</span>
              </div>
              <div className="h-2 bg-hairline-soft rounded-full overflow-hidden">
                <div className="bar-fading h-full rounded-full w-[88%]" style={{ background: "#d6d3d1" }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-body-strong font-medium">Supabase · reinforced today</span>
                <span className="font-mono text-sm text-ink">0.95</span>
              </div>
              <div className="h-2 bg-hairline-soft rounded-full overflow-hidden">
                <div className="bar-active h-full bg-primary rounded-full w-[8%]" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 6 · FEATURE GRID ═══════ */}
      <section id="section-features" className="relative z-10 py-24 px-6 border-t border-hairline" style={{ paddingTop: "96px", paddingBottom: "96px" }}>
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <div className="caption-upper text-muted mb-4">Capabilities</div>
            <h2 className="display-lg text-ink">Built on Cognee&apos;s memory lifecycle.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              {
                title: "5 source types",
                desc: "PDFs, GitHub repos, ChatGPT exports, YouTube transcripts, and web articles.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#292524" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                  </svg>
                ),
              },
              {
                title: "Reconciliation engine",
                desc: "LLM-judged contradiction detection with structured JSON verdicts and exponential backoff.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#292524" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 3l5 5-5 5"/>
                    <path d="M21 8H9"/>
                    <path d="M8 21l-5-5 5-5"/>
                    <path d="M3 16h12"/>
                  </svg>
                ),
              },
              {
                title: "Time-aware decay",
                desc: "Confidence scores degrade proportionally. Stale beliefs are automatically pruned via forget().",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#292524" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="12" cy="12" r="9"/>
                    <path d="M12 7v5l3 3"/>
                  </svg>
                ),
              },
              {
                title: "3D knowledge graph",
                desc: "Interactive force-directed visualization with glow nodes, particle-flow links, and fly-to navigation.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#292524" strokeWidth="1.5" strokeLinecap="round">
                    <circle cx="12" cy="5" r="3"/>
                    <circle cx="5" cy="19" r="3"/>
                    <circle cx="19" cy="19" r="3"/>
                    <line x1="10" y1="7.5" x2="6.5" y2="16.5"/>
                    <line x1="14" y1="7.5" x2="17.5" y2="16.5"/>
                    <line x1="8" y1="19" x2="16" y2="19"/>
                  </svg>
                ),
              },
              {
                title: "Structured diffs",
                desc: "\"What changed since March?\" — Added, Removed, Changed, and New Decisions, all at a glance.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#292524" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M12 3v18"/>
                    <path d="M5 12h14"/>
                    <path d="M5 6h4"/>
                    <path d="M5 18h4"/>
                    <path d="M15 6h4"/>
                    <path d="M15 18h4"/>
                  </svg>
                ),
              },
              {
                title: "MCP server",
                desc: "Expose your memory graph to any MCP-compatible agent or IDE via the built-in server.",
                icon: (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#292524" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="6" width="20" height="12" rx="2"/>
                    <path d="M6 10h.01M10 10h.01M14 10h.01"/>
                    <path d="M6 14h12"/>
                  </svg>
                ),
              },
            ].map((feat) => (
              <div key={feat.title} className="feat-card p-6 rounded-2xl bg-surface-card border border-hairline hover:shadow-[0_4px_16px_rgba(0,0,0,0.04)] transition-shadow">
                <div className="mb-4">{feat.icon}</div>
                <h3 className="text-lg font-medium text-ink mb-2" style={{ fontFamily: "'Inter', sans-serif", letterSpacing: "0" }}>
                  {feat.title}
                </h3>
                <p className="text-sm text-body leading-relaxed" style={{ letterSpacing: "0.15px" }}>
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ 7 · CTA BAND ═══════ */}
      <section className="relative z-10 py-24 px-6 flex flex-col items-center text-center" style={{ paddingTop: "96px", paddingBottom: "96px" }}>
        {/* Atmospheric orb behind CTA */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] orb-sky opacity-25 blur-[80px] pointer-events-none" />

        <h2 className="relative z-10 display-xl text-ink mb-6 max-w-lg">
          Stop re-explaining context.
        </h2>
        <p className="relative z-10 text-body mb-8 max-w-sm" style={{ letterSpacing: "0.16px" }}>
          Build a memory that reconciles, decays, and keeps up with you.
        </p>
        <button onClick={enter}
          className="relative z-10 px-7 py-3 rounded-full bg-primary text-on-primary text-[15px] font-medium hover:bg-primary-active transition-all cursor-pointer">
          Initialize graph →
        </button>
      </section>

      {/* ═══════ FOOTER ═══════ */}
      <footer className="relative z-10 border-t border-hairline bg-canvas" style={{ padding: "64px 48px" }}>
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <svg width="20" height="20" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="#292524" strokeWidth="1.5"/>
              <circle cx="14" cy="14" r="4" fill="#292524"/>
            </svg>
            <span style={{ fontFamily: "'EB Garamond', serif", fontSize: "16px" }} className="text-body">Synapse</span>
          </div>
          <p className="text-[15px] text-body" style={{ letterSpacing: "0.15px" }}>
            Built for WeMakeDevs × Cognee Hackathon 2026
          </p>
          <div className="flex items-center gap-4">
            <a href="https://github.com/IamNishant51/Synapse----Ai-" target="_blank" rel="noreferrer"
              className="text-[15px] text-body hover:text-ink transition-colors">GitHub</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
