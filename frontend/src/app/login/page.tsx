"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/status");
        const data = await res.json();
        if (data.authenticated) {
          router.push("/graph");
        }
      } catch {}
    };
    checkAuth();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();
      if (data.success) {
        router.push("/graph");
      } else {
        setError(data.error || "Incorrect access key");
      }
    } catch {
      setError("Failed to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-4 selection:bg-gradient-lavender/40 relative overflow-hidden">
      {/* Atmospheric orb */}
      <div className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] orb-lavender opacity-30 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] orb-mint opacity-25 blur-[90px] pointer-events-none" />

      <div className="w-full max-w-sm rounded-2xl border border-hairline bg-surface-card p-8 shadow-[0_4px_16px_rgba(0,0,0,0.04)] relative z-10">
        <div className="flex flex-col items-center mb-8">
          {/* Logo */}
          <Image
            src="/images/synapse-logo.png"
            alt="Synapse"
            width={160}
            height={46}
            priority
            className="object-contain mb-1"
          />
          <p className="mt-1 text-sm text-muted text-center" style={{ letterSpacing: "0.15px" }}>
            This demo is access-gated during judging. Enter the key shared with you.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Access Key"
              className="w-full px-4 py-3 rounded-lg bg-surface-card border border-hairline-strong text-sm text-ink placeholder:text-muted-soft focus:outline-none focus:border-ink focus:ring-1 focus:ring-ink/20 transition-all duration-200"
              style={{ letterSpacing: "0.16px" }}
              autoFocus
            />
          </div>

          {error && <p className="text-xs text-semantic-error font-medium">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full py-3 rounded-full bg-primary text-on-primary text-[15px] font-medium hover:bg-primary-active active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
          >
            {loading ? "Authenticating…" : "Unlock"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a
            href="mailto:anonymouslucifer400@gmail.com?subject=Synapse%20Access%20Key%20Request"
            className="text-xs text-muted hover:text-ink hover:underline transition-colors"
          >
            Don&apos;t have a key? Request access
          </a>
        </div>
      </div>
    </div>
  );
}
