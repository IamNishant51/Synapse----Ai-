"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(useGSAP, ScrollTrigger);

const SparkleIcon = ({ className = "w-4 h-4 text-[#777169]/40" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5Z" />
  </svg>
);

const SectionLabel = ({ text, color = "bg-[#f4c5a8]" }: { text: string; color?: string }) => (
  <div className="flex items-center gap-2 mb-6 justify-start">
    <span className={`w-1.5 h-1.5 rounded-full ${color}`} />
    <span className="caption-uppercase tracking-[0.08em] text-xs font-semibold text-[#777169]">{text}</span>
  </div>
);

const BrowserChrome = ({ children, className = "", url = "localhost:3000" }: { children: React.ReactNode; className?: string; url?: string }) => (
  <div className={`w-full bg-[#f5f5f5] rounded-2xl border border-[#e7e5e4] shadow-[0_8px_30px_rgba(0,0,0,0.04)] overflow-hidden ${className}`}>
    <div className="bg-[#f0efed] px-4 py-2.5 border-b border-[#e7e5e4] flex items-center gap-1.5 select-none pointer-events-none">
      <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]/40" />
      <div className="w-2.5 h-2.5 rounded-full bg-[#eab308]/40" />
      <div className="w-2.5 h-2.5 rounded-full bg-[#22c55e]/40" />
      <div className="h-4.5 bg-white/60 border border-[#e7e5e4] rounded-md text-[9px] text-[#777169] px-4 ml-4 flex items-center flex-1 max-w-[240px] font-mono tracking-tight overflow-hidden text-ellipsis whitespace-nowrap">
        {url}
      </div>
    </div>
    <div className="relative bg-white w-full">
      {children}
    </div>
  </div>
);

const FAQItem = ({ question, answer, isOpen, onClick }: { question: string; answer: string; isOpen: boolean; onClick: () => void }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      if (isOpen) {
        gsap.to(contentRef.current, { height: "auto", opacity: 1, duration: 0.35, ease: "power2.out" });
      } else {
        gsap.to(contentRef.current, { height: 0, opacity: 0, duration: 0.3, ease: "power2.in" });
      }
    }
  }, [isOpen]);

  return (
    <div className="border border-[#e7e5e4] rounded-2xl bg-white overflow-hidden transition-all duration-300">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between p-6 text-left font-medium text-[#0c0a09] hover:text-[#0c0a09] transition-colors focus:outline-none"
      >
        <span className="text-base font-medium">{question}</span>
        <svg
          className={`w-5 h-5 text-[#777169] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>
      <div
        ref={contentRef}
        style={{ height: 0, opacity: 0 }}
        className="overflow-hidden"
      >
        <div className="px-6 pb-6 text-sm text-[#4e4e4e] leading-relaxed border-t border-[#e7e5e4]/50 pt-4">
          {answer}
        </div>
      </div>
    </div>
  );
};

const faqs = [
  {
    q: "Is this just RAG with extra steps?",
    a: "No. Traditional RAG relies on pure semantic similarity search over passive text embeddings, which doesn't handle evolving contexts or direct contradictions. Synapse uses Cognee to construct a structured metadata knowledge graph that acts as a deterministic memory layer. It proactively detects factual conflicts at ingestion, giving you structured, reconcilable state updates rather than just appending text."
  },
  {
    q: "What happens to old beliefs when they're superseded?",
    a: "When a conflict is resolved in favor of 'Keep New', the older belief node is deactivated and deprecated in the graph, with its confidence score set to 0. The transaction history is saved in the reconciliation log database, allowing you to run query diffs like 'what changed since March' to trace the precise evolution of your tech stack or design decisions."
  },
  {
    q: "Does this work with my specific tools?",
    a: "Yes. Synapse supports raw context ingestion from multiple common developer and researcher sources, including PDF files, GitHub commit histories, pasted ChatGPT/Claude conversation exports, web articles, and YouTube transcripts."
  },
  {
    q: "Is my data sent to third-party services?",
    a: "No, unless you configure an external LLM provider. Synapse runs its metadata reconciliation pipelines using either Google Gemini or Groq API wrappers based on your local .env configuration. All other metadata, reconciliation history logs, and access control lists are stored entirely locally in a lightweight SQLite database file."
  },
  {
    q: "Open source or hosted?",
    a: "Synapse is fully open-source and built for local deployment, designed specifically to showcase the capabilities of the Cognee memory lifecycle APIs as a developer utility."
  }
];

export default function LandingPage() {
  const router = useRouter();
  const [entering, setEntering] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    if (lenisRef.current) {
      lenisRef.current.scrollTo(targetId, {
        duration: 1.5,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
      });
    } else {
      const target = document.querySelector(targetId);
      if (target) {
        target.scrollIntoView({ behavior: "smooth" });
      }
    }
    setIsMobileMenuOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);

    // Save original classes to restore them when unmounting
    const htmlHasHFull = document.documentElement.classList.contains("h-full");
    const bodyHasHFull = document.body.classList.contains("h-full");

    // Adjust classes for landing page scrolling
    document.documentElement.classList.remove("h-full");
    document.documentElement.classList.add("min-h-screen");
    document.body.classList.remove("h-full");
    document.body.classList.add("min-h-screen");

    // Initialize Lenis Smooth Scrolling
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // easeOutExpo
      smoothWheel: true,
    });
    lenisRef.current = lenis;

    // Synchronize Lenis with GSAP ScrollTrigger
    lenis.on("scroll", ScrollTrigger.update);
    
    const tickerUpdate = (time: number) => {
      lenis.raf(time * 1000);
    };
    
    gsap.ticker.add(tickerUpdate);
    gsap.ticker.lagSmoothing(0);

    // Refresh ScrollTrigger after DOM load/hydration layout shifts
    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 100);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      // Restore original classes for other pages (like dashboard/graph)
      if (htmlHasHFull) {
        document.documentElement.classList.add("h-full");
        document.documentElement.classList.remove("min-h-screen");
      }
      if (bodyHasHFull) {
        document.body.classList.add("h-full");
        document.body.classList.remove("min-h-screen");
      }
      
      clearTimeout(timer);
      gsap.ticker.remove(tickerUpdate);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  useGSAP(() => {
    const mm = gsap.matchMedia();

    mm.add({
      isDesktop: "(min-width: 768px) and (prefers-reduced-motion: no-preference)",
      isMobile: "(max-width: 767px) and (prefers-reduced-motion: no-preference)"
    }, (context) => {
      const { isDesktop } = context.conditions as Record<string, boolean>;

      /* ── Hero entrance ── */
      gsap.set(".fade-up", { y: 24, opacity: 0 });
      gsap.set(".scroll-cue", { y: 0, opacity: 0 });

      const intro = gsap.timeline({ defaults: { ease: "power3.out" } });
      intro
        .to(".fade-up", { y: 0, opacity: 1, stagger: 0.1, duration: 0.9, delay: 0.1 })
        .to(".scroll-cue", { opacity: 0.6, duration: 0.5 }, "-=0.3");

      // Hide scroll cue on scroll
      gsap.to(".scroll-cue", {
        opacity: 0,
        y: -10,
        scrollTrigger: {
          trigger: "#hero",
          start: "top top",
          end: "60px top",
          scrub: true
        }
      });

      /* ── Section 3: Scattered Source Cards ── */
      gsap.from(".source-card", {
        opacity: 0,
        scale: 0.8,
        x: (i) => [60, -60, 40, -40, 50, -50, 20][i % 7],
        y: (i) => [40, 60, -30, 50, -40, 30, -20][i % 7],
        stagger: 0.05,
        scrollTrigger: {
          trigger: "#section-problem",
          start: "top 80%",
          end: "bottom 70%",
          scrub: 1
        }
      });

      const ingestTl = gsap.timeline({
        scrollTrigger: {
          trigger: "#section-ingest",
          pin: isDesktop,
          start: isDesktop ? "top top" : "top 95%",
          end: isDesktop ? "+=1800" : "bottom 20%",
          scrub: isDesktop ? 0.5 : false,
          toggleActions: isDesktop ? "none" : "play none none reverse",
          anticipatePin: isDesktop ? 1 : 0
        }
      });

      // Scrub the spiral path drawing
      ingestTl.fromTo("#spiral-path", 
        { strokeDashoffset: 2000 }, 
        { strokeDashoffset: 0, duration: 2, ease: "none" }
      );

      // Scrub stepper dots lighting up along path progress
      const stepTimes = [0.2, 0.7, 1.3, 1.8];
      const steps = [1, 2, 3, 4];
      steps.forEach((step, idx) => {
        const time = stepTimes[idx];
        ingestTl.to(`.pipeline-step-${step}`, {
          borderColor: "#292524",
          backgroundColor: "#292524",
          color: "#ffffff",
          duration: 0.2
        }, time)
        .to(`.pipeline-label-${step}`, {
          color: "#0c0a09",
          fontWeight: 600,
          opacity: 1,
          duration: 0.2
        }, time)
        .to(`.pipeline-desc-${step}`, {
          opacity: 1,
          duration: 0.2
        }, time);
      });

      const resolveTl = gsap.timeline({
        scrollTrigger: {
          trigger: "#section-resolve",
          pin: isDesktop,
          start: isDesktop ? "top top" : "top 95%",
          end: isDesktop ? "+=2200" : "bottom 20%",
          scrub: isDesktop ? 0.5 : false,
          toggleActions: isDesktop ? "none" : "play none none reverse",
          anticipatePin: isDesktop ? 1 : 0
        }
      });

      // 1. Gold droplet fades in
      resolveTl.fromTo("#droplet-gold", { opacity: 0, scale: 0.6 }, { opacity: 0.8, scale: 1, duration: isDesktop ? 0.5 : 0.2 });
      resolveTl.fromTo("#droplet-gold-label", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: isDesktop ? 0.3 : 0.15 }, "-=0.2");

      // 2. Smoke droplet slides in and fuses
      resolveTl.fromTo("#droplet-smoke", 
        { opacity: 0, scale: 0.6, x: 100 }, 
        { opacity: 0.8, scale: 1, x: 0, duration: isDesktop ? 0.7 : 0.3, ease: "power2.out" }
      );
      resolveTl.fromTo("#droplet-smoke-label", { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: isDesktop ? 0.3 : 0.15 }, "-=0.3");

      // 3. Meniscus flash pulse at overlap
      resolveTl.fromTo("#droplet-flash", { opacity: 0 }, { opacity: 1, duration: isDesktop ? 0.15 : 0.1 })
               .to("#droplet-flash", { opacity: 0, duration: isDesktop ? 0.25 : 0.15 });
      resolveTl.fromTo("#conflict-badge", { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: isDesktop ? 0.2 : 0.1 }, "-=0.3");

      // 4. Compare UI card fades in on left
      resolveTl.fromTo("#compare-ui-card", { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: isDesktop ? 0.5 : 0.25 }, isDesktop ? undefined : 0.1);
      
      // Pulse Keep New button
      resolveTl.to("#btn-keep-new", { scale: 1.05, boxShadow: "0 0 12px rgba(41,37,36,0.15)", duration: isDesktop ? 0.2 : 0.1 })
               .to("#btn-keep-new", { scale: 1, boxShadow: "none", duration: isDesktop ? 0.2 : 0.1 });

      // 5. Diff details reveal
      resolveTl.fromTo("#diff-card", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: isDesktop ? 0.5 : 0.25 }, isDesktop ? undefined : 0.2);

      // 6. Screenshot slide-in
      resolveTl.fromTo("#resolve-screenshot-wrapper", 
        { opacity: 0, y: 40, scale: 0.95 }, 
        { opacity: 1, y: 0, scale: 1, duration: isDesktop ? 0.6 : 0.3, ease: "power2.out" }, isDesktop ? undefined : 0.3
      );

      const decayTl = gsap.timeline({
        scrollTrigger: {
          trigger: "#section-decay",
          start: isDesktop ? "top 75%" : "top 95%",
          end: "bottom 75%",
          scrub: isDesktop ? 1 : false,
          toggleActions: isDesktop ? "none" : "play none none reverse"
        }
      });

      // Animate confidence scores and bars
      decayTl.to("#decay-bar-postgres", { width: "12%", duration: 1.2 })
             .to("#decay-score-postgres", { 
               innerText: "0.12", 
               snap: { innerText: 1 }, 
               duration: 1.2 
             }, 0)
             .to("#decay-bar-supabase", { width: "95%", duration: 1.2 }, 0)
             .to("#decay-score-supabase", { 
               innerText: "0.95", 
               snap: { innerText: 1 }, 
               duration: 1.2 
             }, 0);

      /* ── Section 7: Graph Preview Parallax ── */
      gsap.from(".graph-node-group-1", {
        y: -40,
        scrollTrigger: {
          trigger: "#section-graph-preview",
          start: "top bottom",
          end: "bottom top",
          scrub: 1.5
        }
      });
      gsap.from(".graph-node-group-2", {
        y: 30,
        scrollTrigger: {
          trigger: "#section-graph-preview",
          start: "top bottom",
          end: "bottom top",
          scrub: 1
        }
      });
      gsap.from(".graph-node-group-3", {
        y: -15,
        scrollTrigger: {
          trigger: "#section-graph-preview",
          start: "top bottom",
          end: "bottom top",
          scrub: 2
        }
      });
    });

    mm.add("(prefers-reduced-motion: reduce)", () => {
      // Accessibility fallback: simple fades, no scroll locking/scrubbing
      gsap.set(".fade-up", { opacity: 1, y: 0 });
      gsap.set(".source-card", { opacity: 1, scale: 1, x: 0, y: 0 });
      gsap.set("#spiral-path", { strokeDashoffset: 0 });
      gsap.set(".pipeline-step-1, .pipeline-step-2, .pipeline-step-3, .pipeline-step-4", {
        borderColor: "#292524",
        backgroundColor: "#292524",
        color: "#ffffff"
      });
      gsap.set(".pipeline-label-1, .pipeline-label-2, .pipeline-label-3, .pipeline-label-4", { opacity: 1 });
      gsap.set(".pipeline-desc-1, .pipeline-desc-2, .pipeline-desc-3, .pipeline-desc-4", { opacity: 1 });
      gsap.set("#droplet-gold, #droplet-smoke, #compare-ui-card, #diff-card, #resolve-screenshot-wrapper", { opacity: 0.9, scale: 1, x: 0 });
      gsap.set("#decay-bar-postgres", { width: "12%" });
      gsap.set("#decay-bar-supabase", { width: "95%" });
    });
  }, { scope: wrapRef });

  const enter = () => {
    setEntering(true);
    setTimeout(() => router.push("/login"), 500);
  };



  return (
    <div ref={wrapRef} className="bg-[#f5f5f5] text-[#0c0a09] relative min-h-screen selection:bg-[#a8c8e8]/40 overflow-x-clip font-sans">
      
      {/* ═══════ TOP FLOATING NAVIGATION ═══════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 h-16 transition-all duration-300 ${
        scrolled ? "bg-[#f5f5f5]/90 backdrop-blur-md border-b border-[#e7e5e4] shadow-[0_4px_16px_rgba(0,0,0,0.02)]" : "bg-transparent border-b border-transparent"
      }`}>
        <div className="max-w-[1200px] mx-auto px-6 h-full flex items-center justify-between">
          <a href="#hero" onClick={(e) => handleNavClick(e, "#hero")} className="flex items-center gap-2 cursor-pointer" aria-label="Scroll to top">
            <Image
              src="/images/synapse-logo.png"
              alt="Synapse Logo"
              width={100}
              height={28}
              priority
              className="object-contain"
            />
          </a>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#section-ingest" onClick={(e) => handleNavClick(e, "#section-ingest")} className="text-[15px] font-medium text-[#4e4e4e] hover:text-[#0c0a09] transition-colors">How it works</a>
            <a href="#section-resolve" onClick={(e) => handleNavClick(e, "#section-resolve")} className="text-[15px] font-medium text-[#4e4e4e] hover:text-[#0c0a09] transition-colors">Reconciliation</a>
            <a href="#section-decay" onClick={(e) => handleNavClick(e, "#section-decay")} className="text-[15px] font-medium text-[#4e4e4e] hover:text-[#0c0a09] transition-colors">Memory Health</a>
            <a href="https://github.com/IamNishant51/Synapse----Ai-" target="_blank" rel="noreferrer" className="text-[15px] font-medium text-[#4e4e4e] hover:text-[#0c0a09] transition-colors">GitHub</a>
            <a href="/login" className="text-[15px] font-medium text-[#4e4e4e] hover:text-[#0c0a09] transition-colors">Sign In</a>
            <button onClick={enter}
              className="px-5 py-2.5 rounded-full bg-[#292524] text-white text-[15px] font-medium hover:bg-[#0c0a09] transition-all duration-300 cursor-pointer">
              Open App
            </button>
          </div>

          {/* Mobile Menu Hamburger */}
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="md:hidden flex items-center text-[#292524] focus:outline-none">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              {isMobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu Panel */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-[#f5f5f5] border-b border-[#e7e5e4] px-6 py-6 space-y-4 flex flex-col items-start animate-fade-in">
            <a href="#section-ingest" onClick={(e) => handleNavClick(e, "#section-ingest")} className="text-[15px] font-medium text-[#4e4e4e] w-full py-1">How it works</a>
            <a href="#section-resolve" onClick={(e) => handleNavClick(e, "#section-resolve")} className="text-[15px] font-medium text-[#4e4e4e] w-full py-1">Reconciliation</a>
            <a href="#section-decay" onClick={(e) => handleNavClick(e, "#section-decay")} className="text-[15px] font-medium text-[#4e4e4e] w-full py-1">Memory Health</a>
            <a href="https://github.com/IamNishant51/Synapse----Ai-" target="_blank" rel="noreferrer" onClick={() => setIsMobileMenuOpen(false)} className="text-[15px] font-medium text-[#4e4e4e] hover:text-[#0c0a09] transition-colors w-full py-1">GitHub</a>
            <a href="/login" className="text-[15px] font-medium text-[#4e4e4e] hover:text-[#0c0a09] transition-colors w-full py-1">Sign In</a>
            <button onClick={enter}
              className="w-full text-center px-5 py-2.5 rounded-full bg-[#292524] text-white text-[15px] font-medium hover:bg-[#0c0a09] transition-all duration-300">
              Open App
            </button>
          </div>
        )}
      </nav>

      {/* ═══════ 2 · HERO (Soft overlap blurred background) ═══════ */}
      <section id="hero" className="relative z-10 w-full min-h-screen flex items-center justify-center pt-28 pb-20">
        <div className="max-w-[1200px] mx-auto px-6 w-full grid grid-cols-1 md:grid-cols-12 gap-16 items-center">
          
          <div className="flex flex-col items-center text-center md:items-start md:text-left md:col-span-7 relative z-10 w-full">
            <h1 className="fade-up display-mega text-[#0c0a09] mb-8 leading-[1.05] tracking-[-1.92px]" style={{ fontWeight: 300 }}>
              Memory that knows when it&apos;s wrong.
            </h1>

            <p className="fade-up text-[#4e4e4e] text-sm md:text-base leading-relaxed max-w-xl mb-10 tracking-[0.16px]">
              Ingest scattered notes from ChatGPT, GitHub, PDFs, and more. Synapse actively reconciles conflicting facts, prunes unreinforced paths, and structures your personal knowledge graph.
            </p>

            <div className="fade-up flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4 w-full sm:w-auto">
              <button onClick={enter} disabled={entering}
                className="px-6 py-3 rounded-full bg-[#292524] text-white text-[15px] font-medium hover:bg-[#0c0a09] transition-all duration-300 cursor-pointer disabled:opacity-50 w-full sm:w-auto text-center justify-center flex">
                {entering ? "Opening…" : "Open the App"}
              </button>
              <a href="https://github.com/IamNishant51/Synapse----Ai-" target="_blank" rel="noreferrer"
                className="px-6 py-3 rounded-full border border-[#d6d3d1] text-[15px] font-medium text-[#0c0a09] hover:bg-[#f0efed] transition-all duration-300 cursor-pointer w-full sm:w-auto text-center justify-center flex">
                View on GitHub
              </a>
            </div>
          </div>

          {/* Editorial Layout Asymmetric Right Column */}
          <div className="fade-up md:col-span-5 hidden md:flex flex-col items-end text-right border-l border-[#e7e5e4] pl-10 py-8 gap-8 relative z-10 self-center">
            <SparkleIcon className="w-8 h-8 text-[#292524]/20 mr-2" />
            <div className="space-y-2">
              <div className="text-[11px] font-mono tracking-widest text-[#777169] uppercase">STRUCTURED METADATA</div>
              <div className="font-serif text-2xl text-[#292524] italic leading-tight">reconcile()<br />forget()<br />remember()</div>
            </div>
            <div className="text-xs text-[#777169] leading-relaxed max-w-[200px]">
              Built as a real-time memory dashboard on top of Cognee&apos;s semantic engine.
            </div>
          </div>

        </div>

        {/* Animated Scroll Cue */}
        <div className="scroll-cue absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-default select-none pointer-events-none opacity-60 z-20">
          <span className="caption-uppercase tracking-[0.15em] text-[10px] text-[#777169]">SCROLL STORY</span>
          <svg className="w-4 h-4 animate-bounce text-[#777169]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </section>

      {/* ═══════ 2.5 · HOW IT WORKS WALKTHROUGH ═══════ */}
      <section id="how-it-works" className="relative z-10 py-20 px-6 bg-[#f5f5f5] border-t border-[#e7e5e4]">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                num: "01",
                label: "INGEST",
                title: "Ingest Context",
                desc: "Connect scattered repositories, chat sessions, articles, and PDFs natively.",
                color: "bg-[#a7e5d3]/10 text-[#0f766e] border-[#a7e5d3]/30",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                )
              },
              {
                num: "02",
                label: "RECONCILE",
                title: "Reconcile Beliefs",
                desc: "Synapse detects conflicts at ingestion and surfaces them for quick resolution.",
                color: "bg-[#f4c5a8]/10 text-[#c2410c] border-[#f4c5a8]/30",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                )
              },
              {
                num: "03",
                label: "RECALL",
                title: "Recall Grounded",
                desc: "Run time-aware query diffs grounded dynamically on your metadata graph.",
                color: "bg-[#c8b8e0]/10 text-[#6d28d9] border-[#c8b8e0]/30",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )
              },
              {
                num: "04",
                label: "DECAY",
                title: "Decay Stale Nodes",
                desc: "Unreinforced memories fade over time and get pruned dynamically.",
                color: "bg-[#a8c8e8]/10 text-[#1d4ed8] border-[#a8c8e8]/30",
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                )
              }
            ].map((step) => (
              <div 
                key={step.num} 
                className="relative group p-8 rounded-2xl bg-[#fafafa]/80 border border-[#e7e5e4] hover:border-[#0c0a09]/50 hover:bg-white hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] hover:-translate-y-0.5 transition-all duration-500 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-8">
                    <span className="text-[10px] font-mono font-semibold text-[#777169] tracking-widest bg-[#f0efed] px-2.5 py-1 rounded">
                      {step.num} / {step.label}
                    </span>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${step.color}`}>
                      {step.icon}
                    </div>
                  </div>
                  <h3 className="text-base font-serif font-medium text-[#0c0a09] mb-2 leading-tight">
                    {step.title}
                  </h3>
                  <p className="text-xs text-[#777169] leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ 3 · THE PROBLEM (Scattered Cards, white BG) ═══════ */}
      <section id="section-problem" className="relative z-10 py-24 md:py-32 px-6 bg-[#f5f5f5] border-t border-[#e7e5e4]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-16 items-center">
          <div className="text-left md:col-span-5">
            <SectionLabel text="THE PROBLEM" color="bg-[#a7e5d3]" />
            <h2 className="display-lg text-[#0c0a09] mb-8 leading-[1.1]" style={{ fontWeight: 300 }}>
              Your knowledge lives in twelve different places.
            </h2>
            <p className="text-[#4e4e4e] text-base leading-relaxed max-w-lg mb-8 tracking-[0.16px]">
              Decisions are made in ChatGPT. Framework specs are on GitHub. Research is stored in PDFs. Plain vector stores treat them as isolated strings. Synapse brings them together, structuring relationships dynamically.
            </p>
            <div className="mt-8 pt-8 border-t border-[#e7e5e4] flex gap-12 select-none">
              <div>
                <div className="text-3xl font-mono font-light text-[#292524]">12+</div>
                <div className="text-[10px] uppercase tracking-wider text-[#777169] font-semibold mt-1">Disjointed Tools</div>
              </div>
              <div>
                <div className="text-3xl font-mono font-light text-[#ca8a04]">0</div>
                <div className="text-[10px] uppercase tracking-wider text-[#777169] font-semibold mt-1">Shared Context</div>
              </div>
            </div>
          </div>

          {/* Scattered Source-Cards Mockup Frame */}
          <div className="md:col-span-7 relative h-[300px] sm:h-[360px] md:h-[420px] w-full flex items-center justify-center bg-white/30 rounded-3xl border border-[#e7e5e4]/50 overflow-hidden select-none shadow-[inset_0_2px_8px_rgba(0,0,0,0.01)]">
            <div className="absolute inset-0 bg-[radial-gradient(#8080800a_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
            
            {/* Card 1: ChatGPT */}
            <div className="source-card bg-white border border-[#e7e5e4] rounded-full px-3 py-2 md:px-5 md:py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex items-center gap-1.5 md:gap-3 absolute top-[5%] left-[4%] md:top-[10%] md:left-[8%] rotate-[-4deg] hover:border-[#d6d3d1] transition-colors duration-150">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#292524] w-3.5 h-3.5 md:w-[18px] md:h-[18px]">
                <path d="M12 2v20M17 5H7M19 12H5M17 19H7M21 9l-18 6M3 9l18 6" />
                <circle cx="12" cy="12" r="3" className="fill-[#f5f5f5]" />
              </svg>
              <span className="text-[10px] md:text-xs font-semibold text-[#292524] tracking-[0.16px]">ChatGPT Export</span>
            </div>

            {/* Card 2: GitHub */}
            <div className="source-card bg-white border border-[#e7e5e4] rounded-full px-3 py-2 md:px-5 md:py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex items-center gap-1.5 md:gap-3 absolute top-[38%] left-[2%] md:top-[48%] md:left-[4%] rotate-[3deg] hover:border-[#d6d3d1] transition-colors duration-150">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#292524] w-3.5 h-3.5 md:w-[18px] md:h-[18px]">
                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
              </svg>
              <span className="text-[10px] md:text-xs font-semibold text-[#292524] tracking-[0.16px]">GitHub Commit</span>
            </div>

            {/* Card 3: Notion */}
            <div className="source-card bg-white border border-[#e7e5e4] rounded-full px-3 py-2 md:px-5 md:py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex items-center gap-1.5 md:gap-3 absolute top-[70%] left-[6%] md:top-[78%] md:left-[12%] rotate-[-5deg] hover:border-[#d6d3d1] transition-colors duration-150">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#292524] w-3.5 h-3.5 md:w-[18px] md:h-[18px]">
                <path d="M12 2L2 7l10 5 10-5-10-5Z" />
                <path d="M2 17l10 5 10-5" />
              </svg>
              <span className="text-[10px] md:text-xs font-semibold text-[#292524] tracking-[0.16px]">Notion Notes</span>
            </div>

            {/* Card 4: Claude */}
            <div className="source-card bg-white border border-[#e7e5e4] rounded-full px-3 py-2 md:px-5 md:py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex items-center gap-1.5 md:gap-3 absolute top-[18%] right-[4%] md:top-[22%] md:right-[10%] rotate-[6deg] hover:border-[#d6d3d1] transition-colors duration-150">
              <SparkleIcon className="w-3.5 h-3.5 md:w-[18px] md:h-[18px] text-[#292524]" />
              <span className="text-[10px] md:text-xs font-semibold text-[#292524] tracking-[0.16px]">Claude Session</span>
            </div>

            {/* Card 5: PDFs */}
            <div className="source-card bg-white border border-[#e7e5e4] rounded-full px-3 py-2 md:px-5 md:py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex items-center gap-1.5 md:gap-3 absolute top-[48%] right-[18%] md:top-[52%] md:right-[22%] rotate-[-2deg] hover:border-[#d6d3d1] transition-colors duration-150">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#292524] w-3.5 h-3.5 md:w-[18px] md:h-[18px]">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              <span className="text-[10px] md:text-xs font-semibold text-[#292524] tracking-[0.16px]">specs.pdf</span>
            </div>

            {/* Card 6: Articles */}
            <div className="source-card bg-white border border-[#e7e5e4] rounded-full px-3 py-2 md:px-5 md:py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex items-center gap-1.5 md:gap-3 absolute top-[72%] right-[4%] md:top-[76%] md:right-[8%] rotate-[3deg] hover:border-[#d6d3d1] transition-colors duration-150">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#292524] w-3.5 h-3.5 md:w-[18px] md:h-[18px]">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <path d="M16 8h2M16 12h2" />
              </svg>
              <span className="text-[10px] md:text-xs font-semibold text-[#292524] tracking-[0.16px]">Web Article</span>
            </div>

            {/* Card 7: YouTube */}
            <div className="source-card bg-white border border-[#e7e5e4] rounded-full px-3 py-2 md:px-5 md:py-3 shadow-[0_4px_16px_rgba(0,0,0,0.03)] flex items-center gap-1.5 md:gap-3 absolute top-[30%] left-[32%] md:top-[36%] md:left-[40%] rotate-[-1deg] hover:border-[#d6d3d1] transition-colors duration-150">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#292524] w-3.5 h-3.5 md:w-[18px] md:h-[18px]">
                <rect x="2" y="3" width="20" height="18" rx="5" ry="5" />
                <polygon points="10 8 16 12 10 16 10 8" />
              </svg>
              <span className="text-[10px] md:text-xs font-semibold text-[#292524] tracking-[0.16px]">YouTube Audio</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 4 · INGESTION AND STAGES PIPELINE (Pinned, Ingestion Spiral) ═══════ */}
      <section id="section-ingest" className="relative z-10 w-full min-h-fit md:min-h-screen bg-[#f5f5f5] flex items-center border-t border-[#e7e5e4]">
        <div className="max-w-[1200px] mx-auto px-6 w-full py-24 grid grid-cols-1 md:grid-cols-12 gap-16 items-center">
          
          {/* Stepper info list */}
          <div className="text-left md:col-span-6 flex flex-col gap-6">
            <div>
              <SectionLabel text="THE PIPELINE" color="bg-[#c8b8e0]" />
              <h2 className="display-lg text-[#0c0a09] mb-8 leading-[1.08]" style={{ fontWeight: 300 }}>
                Feed it anything. Structure is automatic.
              </h2>
            </div>

            {/* Vertical pipeline progress UI */}
            <div className="relative flex flex-col gap-8 pl-8 border-l border-[#e7e5e4]">
              {[
                { step: 1, title: "Fetch", desc: "Ingests Raw context: PDFs, repository code, exports, or YouTube transcripts." },
                { step: 2, title: "Extract", desc: "AI parsing identifies central semantic nodes, parameters, and entities." },
                { step: 3, title: "remember()", desc: "Cognee maps relations, writing vectors and links directly into the database." },
                { step: 4, title: "improve()", desc: "Synapse contradiction sweeps detect factual conflicts for human judgment." }
              ].map((s) => (
                <div key={s.title} className="relative flex flex-col items-start">
                  <div className={`pipeline-step-${s.step} absolute left-[-45px] top-0 w-8 h-8 rounded-full border border-[#d6d3d1] bg-white grid place-items-center text-xs font-semibold font-mono text-[#777169] transition-all duration-300`}>
                    {s.step}
                  </div>
                  <div>
                    <h4 className={`pipeline-label-${s.step} text-base font-semibold text-[#777169] opacity-70 transition-all duration-300`}>{s.title}</h4>
                    <p className={`pipeline-desc-${s.step} text-sm text-[#777169] mt-1.5 leading-relaxed opacity-60 transition-all duration-300`}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right column with coiling spiral SVG */}
          <div className="md:col-span-6 flex justify-center items-center relative h-[380px] md:h-[480px]">
            <svg viewBox="0 0 600 600" className="w-[90%] h-[90%] select-none">
              <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <linearGradient id="spiral-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#a7e5d3" />
                  <stop offset="50%" stopColor="#c8b8e0" />
                  <stop offset="100%" stopColor="#f4c5a8" />
                </linearGradient>
              </defs>
              
              {/* Coiling spiral path */}
              <path 
                id="spiral-path"
                d="M 50,550 Q 100,550 120,300 C 140,50 510,70 480,300 C 460,520 160,500 180,300 C 190,120 440,140 420,300 C 400,450 200,430 220,300 C 230,190 370,200 360,300 C 350,380 250,370 260,300 C 270,250 330,260 320,300 C 310,330 280,320 280,300 C 280,290 290,270 300,280 C 305,285 305,295 300,300"
                fill="none" 
                stroke="url(#spiral-grad)" 
                strokeWidth="4" 
                strokeLinecap="round" 
                filter="url(#glow)"
                strokeDasharray="2000"
                strokeDashoffset="2000"
              />

              {/* Glowing core indicators */}
              <circle cx="300" cy="300" r="10" fill="#292524" className="animate-pulse" />
              <circle cx="300" cy="300" r="5" fill="#a7e5d3" />
            </svg>
          </div>
        </div>
      </section>

      {/* ═══════ 5 · WHAT CHANGED RECONCILIATION (Pinned droplets, conflict cards) ═══════ */}
      <section id="section-resolve" className="relative z-10 w-full min-h-fit md:min-h-screen bg-[#f5f5f5] flex items-center border-t border-[#e7e5e4]">
        <div className="max-w-[1200px] mx-auto px-6 w-full py-24 grid grid-cols-1 md:grid-cols-12 gap-16 items-center">
          
          {/* Left Column: text details and interactive Compare + Diff card mockups */}
          <div className="text-left md:col-span-6 flex flex-col gap-8">
            <div>
              <SectionLabel text="RECONCILIATION" color="bg-[#f4c5a8]" />
              <h2 className="display-lg text-[#0c0a09] mb-8 leading-[1.08]" style={{ fontWeight: 300 }}>
                Conflicts resolved by design.
              </h2>
              <p className="text-[#4e4e4e] text-base leading-relaxed tracking-[0.16px]">
                When new evidence contradicts an older belief, Synapse detects the contradiction at the schema layer and surfaces it immediately. You retain ultimate control over what enters your long-term memory graph.
              </p>
            </div>

            <div className="space-y-6">
              {/* Compare UI Card Mockup */}
              <div id="compare-ui-card" className="bg-white border border-[#e7e5e4] p-5 sm:p-6 rounded-2xl shadow-[0_4px_16px_rgba(0,0,0,0.02)] flex flex-col opacity-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#e7e5e4] pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#e0a328]" />
                    <span className="text-xs font-semibold text-[#0c0a09] tracking-wider uppercase">Resolve Contradiction</span>
                  </div>
                  <span className="text-[10px] text-[#777169] font-mono">Topic: Backend Security</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  <div className="bg-canvas-soft border border-[#e7e5e4] p-4 rounded-xl text-left">
                    <span className="text-[9px] uppercase tracking-wider text-[#777169] font-semibold block mb-1">Old belief</span>
                    <p className="text-xs text-[#292524] font-medium leading-relaxed">&quot;Authentication: basic client-side session checker.&quot;</p>
                    <span className="text-[9px] text-[#a8a29e] block mt-3">auth_config.md</span>
                  </div>
                  <div className="bg-canvas-soft border border-[#e7e5e4] p-4 rounded-xl text-left">
                    <span className="text-[9px] uppercase tracking-wider text-[#292524] font-semibold block mb-1">New evidence</span>
                    <p className="text-xs text-[#292524] font-medium leading-relaxed">&quot;Authentication: Tier 1 shared-secret server proxy gate.&quot;</p>
                    <span className="text-[9px] text-[#a8a29e] block mt-3">AGENTS.md</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 justify-end">
                  <button className="px-4 py-2 border border-[#d6d3d1] text-xs font-medium rounded-full text-[#4e4e4e] bg-white hover:text-black transition-colors select-none">
                    Keep Old
                  </button>
                  <button id="btn-keep-new" className="px-5 py-2 bg-[#292524] text-white text-xs font-medium rounded-full hover:bg-black transition-colors select-none">
                    Keep New
                  </button>
                </div>
              </div>

              {/* Diff Card Mockup */}
              <div id="diff-card" className="bg-white border border-[#e7e5e4] p-5 rounded-xl text-left font-mono text-[10px] space-y-1.5 shadow-[0_2px_8px_rgba(0,0,0,0.01)] opacity-0">
                <div className="flex justify-between border-b border-[#e7e5e4] pb-2 mb-2 font-sans">
                  <span className="uppercase text-[8px] text-[#777169] font-bold">Diff Result — Backend Security</span>
                  <span className="text-[8px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full font-semibold">Committed</span>
                </div>
                <div className="text-[#dc2626] font-medium">− Client-side route blocking</div>
                <div className="text-emerald-600 font-medium">+ Server-side proxy middleware.ts</div>
                <div className="text-emerald-600 font-medium">+ SYNAPSE_ACCESS_KEY validation</div>
                <div className="text-[#777169] font-sans text-[9px] pt-1">
                  Reconciliation pass updated active nodes successfully.
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Fusing Golden and Smoke droplet visual + Actual UI Screenshot */}
          <div className="md:col-span-6 flex flex-col justify-center items-center relative h-auto py-8">
            {/* "⚠ Conflict detected" Badge */}
            <div id="conflict-badge" className="absolute top-[5%] bg-[#fef08a] border border-[#eab308]/40 px-4 py-1.5 rounded-full shadow-[0_4px_12px_rgba(234,179,8,0.1)] flex items-center gap-2 z-20 opacity-0 select-none">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6.5" stroke="#ca8a04" strokeWidth="1.5"/>
                <path d="M8 5v3.5M8 10.5v.01" stroke="#ca8a04" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="text-[10px] font-bold text-[#ca8a04] uppercase tracking-wider">Conflict Detected</span>
            </div>

            {/* Droplet SVG Canvas */}
            <svg viewBox="0 0 500 350" className="w-full h-full max-w-[420px] select-none relative z-10">
              <defs>
                <radialGradient id="gold-droplet" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#fef08a" stopOpacity="0.8" />
                  <stop offset="40%" stopColor="#eab308" stopOpacity="0.5" />
                  <stop offset="95%" stopColor="#ca8a04" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#ca8a04" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="smoke-droplet" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#78716c" stopOpacity="0.8" />
                  <stop offset="40%" stopColor="#292524" stopOpacity="0.6" />
                  <stop offset="95%" stopColor="#0c0a09" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#0c0a09" stopOpacity="0" />
                </radialGradient>
                <radialGradient id="intersection-flash" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fef08a" stopOpacity="1" />
                  <stop offset="50%" stopColor="#eab308" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#eab308" stopOpacity="0" />
                </radialGradient>
              </defs>

              {/* Gold Droplet */}
              <circle id="droplet-gold" cx="180" cy="180" r="80" fill="url(#gold-droplet)" className="opacity-0" />

              {/* Smoke Droplet */}
              <circle id="droplet-smoke" cx="320" cy="180" r="80" fill="url(#smoke-droplet)" className="opacity-0" />

              {/* Overlap Flash */}
              <circle id="droplet-flash" cx="250" cy="180" r="50" fill="url(#intersection-flash)" className="opacity-0" />
            </svg>

            {/* Droplet Captions */}
            <div className="absolute top-[52%] flex justify-between w-[80%] font-mono text-[10px] text-[#777169] select-none pointer-events-none">
              <span id="droplet-gold-label" className="opacity-0">Old Belief (Gold)</span>
              <span id="droplet-smoke-label" className="opacity-0">New Evidence (Smoke)</span>
            </div>

            {/* Real Screenshot with Browser Frame */}
            <div id="resolve-screenshot-wrapper" className="mt-8 w-full max-w-[460px] opacity-0 relative z-20">
              <BrowserChrome url="localhost:3000/resolve">
                <Image
                  src="/images/resolve_screenshot.jpg"
                  alt="Synapse Resolve Screen"
                  width={800}
                  height={450}
                  className="w-full h-auto object-cover"
                />
              </BrowserChrome>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 6 · MEMORY HEALTH / DECAY (Eclipse and dissolving bubbles) ═══════ */}
      <section id="section-decay" className="relative z-10 py-24 md:py-32 px-6 bg-[#f5f5f5] border-t border-[#e7e5e4]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-16 items-center">
          
          {/* Left Column: Copy + Confidence decay timeline progress */}
          <div className="text-left md:col-span-6 flex flex-col gap-10">
            <div>
              <SectionLabel text="MEMORY HEALTH" color="bg-[#a8c8e8]" />
              <h2 className="display-lg text-[#0c0a09] mb-8 leading-[1.08]" style={{ fontWeight: 300 }}>
                Unreinforced beliefs fade.
              </h2>
              <p className="text-[#4e4e4e] text-base leading-relaxed tracking-[0.16px] max-w-lg">
                Confidence degrades proportionally over time. When a belief goes unreinforced, Synapse prunes it from the graph via <code className="text-xs bg-[#f0efed] px-1 py-0.5 rounded font-mono font-bold">cognee.forget()</code>.
              </p>
            </div>

            {/* Stacked Confidence Bars Mockup */}
            <div className="space-y-8 max-w-md">
              <div>
                <div className="flex justify-between text-xs font-medium mb-3">
                  <span className="text-[#777169]">Backend Security · 3 months ago</span>
                  <span className="font-mono font-semibold text-[#dc2626]" id="decay-score-postgres">0.92</span>
                </div>
                <div className="h-2 bg-[#e7e5e4] rounded-full overflow-hidden">
                  <div id="decay-bar-postgres" className="h-full bg-[#d6d3d1] rounded-full w-[92%]" />
                </div>
              </div>
              
              <div>
                <div className="flex justify-between text-xs font-medium mb-3">
                  <span className="text-[#0c0a09] font-semibold">Canvas Theme · reinforced today</span>
                  <span className="font-mono font-semibold text-[#0c0a09]" id="decay-score-supabase">0.00</span>
                </div>
                <div className="h-2 bg-[#e7e5e4] rounded-full overflow-hidden">
                  <div id="decay-bar-supabase" className="h-full bg-[#292524] rounded-full w-[0%]" />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Memory Decay Illustration */}
          <div className="md:col-span-6 flex justify-center items-center relative h-[260px] sm:h-[320px] md:h-[380px] bg-white border border-[#e7e5e4] rounded-3xl overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.02)] select-none">
            <Image
              src="/images/memory-decay.png"
              alt="Memory Decay Illustration"
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-contain p-6"
              priority
            />
          </div>
        </div>
      </section>

      {/* ═══════ 7 · METADATA GRAPH PREVIEW (Parallax SVG Graph) ═══════ */}
      <section id="section-graph-preview" className="relative z-10 py-24 md:py-32 px-6 bg-[#f5f5f5] border-t border-[#e7e5e4]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-16 items-center">
          
          <div className="text-left md:col-span-5 flex flex-col gap-6">
            <SectionLabel text="METADATA GRAPH" color="bg-[#e8b8c4]" />
            <h2 className="display-lg text-[#0c0a09] leading-[1.08]" style={{ fontWeight: 300 }}>
              Every memory, mapped.
            </h2>
            <p className="text-[#4e4e4e] text-base leading-relaxed tracking-[0.16px]">
              Synapse builds a weighted semantic relationship connection network. Node sizing dynamically adjusts (larger nodes have more connections). Open the app to explore the full interactive 3D graph.
            </p>
            <div className="pt-2 text-xs font-mono text-[#777169] select-none">
              [ Glance Preview — Static Layer Mockup ]
            </div>
          </div>

          {/* Real Screenshot with Browser Frame */}
          <div className="md:col-span-7 flex flex-col items-center gap-6 relative">
            <BrowserChrome url="localhost:3000/graph" className="relative z-10">
              <Image
                src="/images/graph_screenshot.jpg"
                alt="Synapse Metadata Graph Screen"
                width={800}
                height={450}
                className="w-full h-auto object-cover"
                priority
              />
            </BrowserChrome>
            
            <div className="absolute -top-4 -right-4 bg-white border border-[#e7e5e4] px-3 py-1 rounded-full text-[10px] font-mono shadow-sm z-20 select-none">
              Interactive 3D Layer
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 7.5 · CAPABILITIES (Bento Grid) ═══════ */}
      <section id="section-capabilities" className="relative z-10 py-24 md:py-32 px-6 bg-[#f5f5f5] border-t border-[#e7e5e4]">
        <div className="max-w-[1200px] mx-auto">
          <div className="text-center mb-16">
            <SectionLabel text="CAPABILITIES" color="bg-[#c8b8e0]" />
            <h2 className="display-lg text-[#0c0a09] leading-[1.08] mb-4" style={{ fontWeight: 300 }}>
              Built on Cognee&apos;s memory lifecycle.
            </h2>
            <p className="text-[#4e4e4e] text-base leading-relaxed max-w-xl mx-auto tracking-[0.16px]">
              Engineered with advanced database structures and LLM layers to automate personal context curation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: 5 source types (bg-image: capabilities-sphere.png) */}
            <div 
              className="p-8 rounded-3xl border border-[#e7e5e4]/50 flex flex-col justify-end min-h-[300px] md:col-span-2 relative overflow-hidden group shadow-[0_4px_16px_rgba(0,0,0,0.02)]"
              style={{ 
                backgroundImage: "url('/images/capabilities-sphere.png')",
                backgroundSize: "cover",
                backgroundPosition: "center"
              }}
            >
              {/* Dark overlay for contrast */}
              <div className="absolute inset-0 bg-[#0c0a09]/45 group-hover:bg-[#0c0a09]/50 transition-colors duration-300 z-0" />
              
              <div className="relative z-10 text-white">
                <div className="mb-4 text-white/90">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="3" y="3" width="7" height="7" rx="1.5"/>
                    <rect x="14" y="3" width="7" height="7" rx="1.5"/>
                    <rect x="3" y="14" width="7" height="7" rx="1.5"/>
                    <rect x="14" y="14" width="7" height="7" rx="1.5"/>
                  </svg>
                </div>
                <h3 className="text-xl font-medium mb-2 font-serif">5 Source Types</h3>
                <p className="text-sm text-white/80 leading-relaxed max-w-md">
                  Ingests PDFs, GitHub repositories, ChatGPT conversational exports, YouTube transcripts, and web articles natively.
                </p>
                <div className="flex gap-4 mt-4 bg-white/10 p-3 rounded-xl max-w-sm border border-white/5 backdrop-blur-sm w-fit select-none">
                  {/* ChatGPT Icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <path d="M12 2v20M17 5H7M19 12H5M17 19H7M21 9l-18 6M3 9l18 6" />
                  </svg>
                  {/* GitHub Icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                  </svg>
                  {/* PDF Icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  {/* Article Icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  </svg>
                  {/* YouTube Icon */}
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                    <rect x="2" y="3" width="20" height="18" rx="5" ry="5" />
                    <polygon points="10 8 16 12 10 16 10 8" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Card 2: Reconciliation engine */}
            <div className="p-8 rounded-3xl bg-[#f5f3f1] border border-[#e7e5e4]/50 flex flex-col justify-between min-h-[300px] shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              <div className="text-[#292524]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 3l5 5-5 5"/>
                  <path d="M21 8H9"/>
                  <path d="M8 21l-5-5 5-5"/>
                  <path d="M3 16h12"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-[#0c0a09] mb-2 font-serif">Reconciliation Engine</h3>
                <p className="text-sm text-[#4e4e4e] leading-relaxed">
                  Automatic schema-level contradiction detection with interactive conflict-resolution interface.
                </p>
              </div>
            </div>

            {/* Card 3: Time-aware decay */}
            <div className="p-8 rounded-3xl bg-[#f5f3f1] border border-[#e7e5e4]/50 flex flex-col justify-between min-h-[300px] shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              <div className="text-[#292524]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9"/>
                  <path d="M12 7v5l3 3"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-[#0c0a09] mb-2 font-serif">Time-Aware Decay</h3>
                <p className="text-sm text-[#4e4e4e] leading-relaxed">
                  Confidence scores degrade proportionally as time passes. Stale beliefs are automatically pruned via Cognee&apos;s forget API.
                </p>
              </div>
            </div>

            {/* Card 4: 3D knowledge graph */}
            <div className="p-8 rounded-3xl bg-[#f5f3f1] border border-[#e7e5e4]/50 flex flex-col justify-between min-h-[300px] md:col-span-2 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              <div className="text-[#292524]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="12" cy="5" r="3"/>
                  <circle cx="5" cy="19" r="3"/>
                  <circle cx="19" cy="19" r="3"/>
                  <line x1="10" y1="7.5" x2="6.5" y2="16.5"/>
                  <line x1="14" y1="7.5" x2="17.5" y2="16.5"/>
                  <line x1="8" y1="19" x2="16" y2="19"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-[#0c0a09] mb-2 font-serif">3D Knowledge Graph</h3>
                <p className="text-sm text-[#4e4e4e] leading-relaxed max-w-lg">
                  Explore connections through an interactive force-directed WebGL visualizer. Click nodes to trace exact source lineages and update properties. Directly click, zoom, and query individual nodes via temporal asks.
                </p>
              </div>
            </div>

            {/* Card 5: Structured diffs */}
            <div className="p-8 rounded-3xl bg-[#f5f3f1] border border-[#e7e5e4]/50 flex flex-col justify-between min-h-[300px] md:col-span-2 shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              <div className="text-[#292524]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M12 3v18"/>
                  <path d="M5 12h14"/>
                  <path d="M5 6h4"/>
                  <path d="M5 18h4"/>
                  <path d="M15 6h4"/>
                  <path d="M15 18h4"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-[#0c0a09] mb-2 font-serif">Structured Diffs</h3>
                <p className="text-sm text-[#4e4e4e] leading-relaxed max-w-lg">
                  Audit changes seamlessly with comprehensive lists of additions, removals, modifications, and new historical decisions. Provides additions (+), deletions (-), and conflict status mappings per reconciliation cycle.
                </p>
              </div>
            </div>

            {/* Card 6: MCP server */}
            <div className="p-8 rounded-3xl bg-[#f5f3f1] border border-[#e7e5e4]/50 flex flex-col justify-between min-h-[300px] shadow-[0_4px_16px_rgba(0,0,0,0.02)]">
              <div className="text-[#292524]">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="6" width="20" height="12" rx="2"/>
                  <path d="M6 10h.01M10 10h.01M14 10h.01"/>
                  <path d="M6 14h12"/>
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-[#0c0a09] mb-2 font-serif">Built-in MCP Server</h3>
                <p className="text-sm text-[#4e4e4e] leading-relaxed">
                  Expose and sync your curated personal knowledge graph to custom agents or editor IDEs via standard MCP.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ 7.6 · CREDIBILITY BAND ═══════ */}
      <div className="relative z-10 py-8 bg-[#f0efed]/50 border-t border-b border-[#e7e5e4] text-center select-none animate-fade-in">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 text-xs text-[#777169] font-medium tracking-wide">
          <span>BUILT FOR: WeMakeDevs × Cognee Hackathon</span>
          <span className="hidden sm:inline text-[#d6d3d1]">•</span>
          <span>POWERED BY: <a href="https://cognee.ai" target="_blank" rel="noreferrer" className="hover:text-[#0c0a09] transition-colors underline decoration-dotted underline-offset-4">Cognee Memory SDK</a></span>
          <span className="hidden sm:inline text-[#d6d3d1]">•</span>
          <span>DEVELOPED BY: <a href="https://nishantunavane.qzz.io" target="_blank" rel="noreferrer" className="hover:text-[#0c0a09] transition-colors underline decoration-dotted underline-offset-4">Nishant Unavane</a></span>
        </div>
      </div>

      {/* ═══════ 7.7 · FAQ SECTION (Accordion) ═══════ */}
      <section id="faq" className="relative z-10 py-24 md:py-32 px-6 bg-[#f5f5f5] border-t border-[#e7e5e4]">
        <div className="max-w-[800px] mx-auto">
          <div className="text-center mb-16">
            <SectionLabel text="FAQ" color="bg-[#a8c8e8]" />
            <h2 className="display-lg text-[#0c0a09] leading-[1.08] mb-4" style={{ fontWeight: 300 }}>
              Frequently Asked Questions
            </h2>
            <p className="text-[#4e4e4e] text-base leading-relaxed tracking-[0.16px]">
              Substantive answers to technical questions about Synapse&apos;s memory architecture.
            </p>
          </div>
          
          <div className="space-y-4">
            {faqs.map((faq, idx) => (
              <FAQItem
                key={idx}
                question={faq.q}
                answer={faq.a}
                isOpen={openFaqIndex === idx}
                onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ 8 · CTA BAND ═══════ */}
      <section id="cta" className="relative z-10 py-24 md:py-32 px-6 bg-[#f5f5f5] text-center border-t border-[#e7e5e4] overflow-hidden">
        


        <div className="max-w-[800px] mx-auto flex flex-col items-center gap-8 relative z-10">
          <SparkleIcon className="w-8 h-8 text-[#292524]/20" />
          <h2 className="display-lg text-[#0c0a09] leading-[1.08] text-3xl sm:text-4xl md:text-5xl lg:text-6xl" style={{ fontWeight: 300 }}>
            Stop re-explaining context.
          </h2>
          <p className="text-[#4e4e4e] text-lg max-w-md tracking-[0.16px]">
            Build a memory graph that reconciles, decays, and actively maintains itself.
          </p>
          <button onClick={enter}
            className="px-8 py-4 rounded-full bg-[#292524] text-white text-[15px] font-medium hover:bg-black transition-all duration-300 cursor-pointer w-full sm:w-auto text-center justify-center flex">
            Initialize graph →
          </button>
        </div>
      </section>

      {/* ═══════ 9 · FOOTER ═══════ */}
      <footer id="footer" className="relative z-10 bg-[#f5f5f5] border-t border-[#e7e5e4] py-16 px-6 select-none text-[13px]">
        <div className="max-w-[1200px] mx-auto grid grid-cols-2 md:grid-cols-5 gap-12 text-[#4e4e4e]">
          
          {/* Column 1: Brand details */}
          <div className="col-span-2 flex flex-col items-start gap-4">
            <Image
              src="/images/synapse-logo.png"
              alt="Synapse Logo"
              width={80}
              height={22}
              className="object-contain"
            />
            <p className="max-w-[200px] text-[#777169] leading-relaxed">
              Autonomous memory visualization layers running on top of Cognee&apos;s semantic engine.
            </p>
          </div>

          {/* Column 2: Product */}
          <div className="flex flex-col gap-3">
            <span className="font-semibold text-[#0c0a09] uppercase tracking-wider text-[10px]">Product</span>
            <a href="#section-ingest" onClick={(e) => handleNavClick(e, "#section-ingest")} className="hover:text-[#0c0a09] transition-colors">Pipeline Ingest</a>
            <a href="#section-resolve" onClick={(e) => handleNavClick(e, "#section-resolve")} className="hover:text-[#0c0a09] transition-colors">Reconciliation</a>
            <a href="#section-decay" onClick={(e) => handleNavClick(e, "#section-decay")} className="hover:text-[#0c0a09] transition-colors">Memory Health</a>
          </div>

          {/* Column 3: Resources */}
          <div className="flex flex-col gap-3">
            <span className="font-semibold text-[#0c0a09] uppercase tracking-wider text-[10px]">Resources</span>
            <a href="https://github.com/IamNishant51/Synapse----Ai-" target="_blank" rel="noreferrer" className="hover:text-[#0c0a09] transition-colors">GitHub</a>
            <a href="https://github.com/IamNishant51/Synapse----Ai-/blob/main/README.md" target="_blank" rel="noreferrer" className="hover:text-[#0c0a09] transition-colors">Documentation</a>
            <a href="https://github.com/IamNishant51/Synapse----Ai-" target="_blank" rel="noreferrer" className="hover:text-[#0c0a09] transition-colors">Video Demo</a>
          </div>

          {/* Column 4: Tech Stack */}
          <div className="flex flex-col gap-3">
            <span className="font-semibold text-[#0c0a09] uppercase tracking-wider text-[10px]">Frameworks</span>
            <a href="https://cognee.ai" target="_blank" rel="noreferrer" className="hover:text-[#0c0a09] transition-colors">Cognee SDK</a>
            <a href="https://nextjs.org" target="_blank" rel="noreferrer" className="hover:text-[#0c0a09] transition-colors">Next.js 15</a>
            <a href="https://fastapi.tiangolo.com" target="_blank" rel="noreferrer" className="hover:text-[#0c0a09] transition-colors">FastAPI</a>
          </div>

        </div>

        <div className="max-w-[1200px] mx-auto mt-16 pt-8 border-t border-[#e7e5e4] flex flex-col md:flex-row items-center justify-between gap-4 text-[#777169]">
          <p>© 2026 Synapse AI. Built for WeMakeDevs x Cognee Hackathon.</p>
          <a href="https://github.com/IamNishant51/Synapse----Ai-" target="_blank" rel="noreferrer" className="hover:text-[#0c0a09] transition-colors">Repository Home</a>
        </div>
      </footer>
    </div>
  );
}
