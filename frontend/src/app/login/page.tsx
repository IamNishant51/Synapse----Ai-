"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
        window.location.href = "/graph";
      } else {
        setError(data.error || "Incorrect access key");
      }
    } catch (err) {
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
          <div className="w-12 h-12 rounded-full border border-hairline flex items-center justify-center bg-canvas mb-4">
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="13" stroke="#292524" strokeWidth="1.5"/>
              <circle cx="14" cy="14" r="4" fill="#292524"/>
              <line x1="14" y1="5" x2="14" y2="10" stroke="#292524" strokeWidth="1.2"/>
              <line x1="14" y1="18" x2="14" y2="23" stroke="#292524" strokeWidth="1.2"/>
              <line x1="5" y1="14" x2="10" y2="14" stroke="#292524" strokeWidth="1.2"/>
              <line x1="18" y1="14" x2="23" y2="14" stroke="#292524" strokeWidth="1.2"/>
            </svg>
          </div>
          <h1 className="display-sm text-ink">Synapse</h1>
          <p className="mt-1 text-sm text-muted" style={{ letterSpacing: "0.15px" }}>Enter your access key to continue</p>
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
      </div>
    </div>
  );
}
