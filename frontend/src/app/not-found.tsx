"use client";

import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6 selection:bg-gradient-lavender/40 relative overflow-hidden">
      {/* Soft atmospheric gradient orbs */}
      <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] orb-lavender opacity-20 blur-[110px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-15%] w-[400px] h-[400px] orb-mint opacity-20 blur-[100px] pointer-events-none" />

      <div className="max-w-md w-full text-center relative z-10 flex flex-col items-center gap-6">
        {/* Decorative 404 Badge */}
        <div className="text-[120px] font-display font-light leading-none tracking-tight text-muted animate-pulse">
          404
        </div>
        
        <div className="space-y-2">
          <h1 className="text-2xl font-display font-semibold tracking-tight text-ink">
            Page Not Found
          </h1>
          <p className="text-sm text-muted-soft leading-relaxed max-w-sm">
            The page you are looking for does not exist or has been moved. Note that Synapse is a demo-locked application.
          </p>
        </div>

        <div className="flex flex-wrap gap-4 justify-center mt-2 w-full max-w-[280px]">
          <Link
            href="/"
            className="flex-1 text-center py-2.5 rounded-full bg-primary text-on-primary text-[14px] font-medium hover:bg-primary-active active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-sm"
          >
            Go Back Home
          </Link>
          <Link
            href="/login"
            className="flex-1 text-center py-2.5 rounded-full bg-surface-strong border border-hairline-strong text-ink text-[14px] font-medium hover:bg-surface-card-active active:scale-[0.98] transition-all duration-150 cursor-pointer shadow-sm"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
