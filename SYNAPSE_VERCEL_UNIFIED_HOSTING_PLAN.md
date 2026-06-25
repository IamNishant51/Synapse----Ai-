# SYNAPSE_VERCEL_UNIFIED_HOSTING_PLAN.md — Moving Frontend + Backend Onto One Vercel Project

## Read this section first — the honest answer before the plan

You asked for "nothing should change" and "everything perfect and production ready" at the same time as "move to Vercel." Those two goals are mostly compatible, but there's one place they genuinely pull against each other, and a senior engineer's job here is to say so plainly rather than quietly hope it works out: **this backend currently writes to local disk files — a SQLite database (`backend/synapse_meta.db`) and Cognee's own default local stores (LanceDB for vectors, a local graph engine) — and Vercel's serverless functions have a read-only filesystem at runtime, with only a small, *ephemeral* `/tmp` scratch space that gets wiped between invocations and isn't even guaranteed to be the same across two requests in a row.** Confirmed directly from Vercel's own current docs, not assumption.

This means the literal current backend, unmodified, **cannot** run correctly on Vercel — every write to `synapse_meta.db` or to Cognee's local data files would either fail outright or silently vanish the moment that serverless instance gets recycled, which on Vercel can happen between almost any two requests. This isn't a Vercel limitation to work around with a clever trick; it's the fundamental nature of serverless compute, and any plan that pretends otherwise will produce a demo that appears to work in a quick local test and then loses data unpredictably in actual use — which would be a disaster for a "memory that's reliable" product, of all products.

**The good news, and it's real good news, not a consolation prize:** Vercel now ships an official feature called **Services** that does exactly what you're asking for at the *hosting* level — a Python/FastAPI backend and a Next.js frontend can genuinely live in one Vercel project, deploy together, and share one domain. And Cognee itself, by design, supports swapping its storage layer to managed, persistent databases (Postgres/PGVector for relational+vectors, Neo4j or Kuzu-remote for the graph) purely through environment variables — this isn't a workaround, it's Cognee's own documented, intended production configuration, the same one any serious Cognee deployment would use regardless of which cloud platform hosts the compute.

**So the real plan is this: yes, both pieces end up on Vercel, on one domain, deployed together — but the backend's storage has to move off local disk and onto a managed database first, because that's the one piece of "nothing should change" that genuinely cannot be preserved as-is.** Everything about how the app *behaves* — every feature, every API contract, every screen — stays identical. What changes is purely *where data physically lives*, and that change is invisible to a user; it's an infrastructure detail, not a feature.

---

## Part 1 — The Three Real Blockers, Confirmed, and Their Fixes

### 1.1 [BLOCKER] The SQLite file (`backend/synapse_meta.db`)
**The problem:** `database.py` opens a literal file path on local disk (`os.path.join(os.path.dirname(__file__), "synapse_meta.db")`). On Vercel, this directory is read-only at runtime. Even redirecting it to `/tmp` wouldn't fix anything meaningful — `/tmp` is wiped between invocations, so every source you ingest, every conflict you resolve, every confidence-history entry would vanish the moment the serverless instance recycles, which can happen at any time, with no warning.

**The fix:** migrate from SQLite to a managed Postgres database. This is a small, well-defined, and very standard step — not a redesign:
- Use **Vercel Postgres** (powered by Neon, available directly inside the Vercel dashboard — this is the most natural choice specifically *because* you're consolidating onto Vercel, since it's provisioned from the same project, same dashboard, same billing) or any external managed Postgres (Neon, Supabase, Railway Postgres) if you'd rather keep infra separate from the hosting platform.
- Every single table in `database.py` (`sources`, `conflicts`, `reconciliation_log`, `confidence_history`, `decay_settings`, `db_metadata`, `user_ai_config`) is plain, portable SQL — no SQLite-specific syntax was found anywhere in a direct read of the file beyond the connection itself. The actual migration work is: swap `sqlite3.connect(DB_PATH)` for a Postgres connection (via `psycopg` or, cleaner given the codebase already uses `async`/`await` throughout, `asyncpg` or SQLAlchemy's async Postgres driver), and adjust the small number of SQLite-specific syntax differences (`INTEGER PRIMARY KEY CHECK (id = 1)` works identically in Postgres; placeholder style changes from `?` to `%s` or `$1`-style depending on the driver — a mechanical, not architectural, change).
- **This is not a step you can skip "for now" and add later** — it's the one piece of work that makes everything else in this plan possible. Do this first.

### 1.2 [BLOCKER] Cognee's own local data stores (LanceDB + local graph engine)
**The problem:** confirmed directly from Cognee's own documentation — with no explicit `VECTOR_DB_PROVIDER`/`GRAPH_DATABASE_PROVIDER` set (which is the current state of this codebase, confirmed by reading `services/__init__.py`'s Cognee config calls — only LLM provider/key/model are set, never the storage backend), Cognee defaults to **LanceDB** (a local, file-based vector store) and a local graph engine (Kuzu or NetworkX, file-based). These defaults write to disk under Cognee's own `SYSTEM_ROOT_DIRECTORY`, exactly the same fundamental incompatibility as 1.1.

**The fix:** configure Cognee to use managed backends via environment variables — this is Cognee's own first-class, documented, intended configuration path, not a hack:
```env
# Relational metadata store (Cognee's own internal bookkeeping, separate from your synapse_meta.db)
RELATIONAL_DB_PROVIDER=postgres
RELATIONAL_DB_HOST=...
RELATIONAL_DB_PORT=5432
RELATIONAL_DB_NAME=...
RELATIONAL_DB_USERNAME=...
RELATIONAL_DB_PASSWORD=...

# Vector store
VECTOR_DB_PROVIDER=pgvector   # reuse the same Postgres instance — simplest, one fewer service to manage
VECTOR_DB_URL=...             # or point at Qdrant Cloud if you'd rather keep vectors separate

# Graph store
GRAPH_DATABASE_PROVIDER=kuzu-remote   # Cognee's hosted/remote Kuzu option, avoids running your own Neo4j
GRAPH_DATABASE_URL=...
```
**Recommended combination for this project specifically:** Postgres + PGVector for both the relational and vector layers (one managed database service, not two, keeping operational complexity low — appropriate for a hackathon-scale project), and Cognee's `kuzu-remote` option for the graph layer if it's available on your Cognee plan/version, since standing up and managing a separate Neo4j instance is real, additional infrastructure complexity that isn't justified at this project's current scale. Confirm exact current option names/availability against Cognee's live docs at implementation time, since this surface has been evolving (the Configuration docs page is the authoritative source).

### 1.3 [BLOCKER] Long-running ingestion / LLM calls and Vercel's execution time model
**The problem:** ingesting a GitHub repo (`fetch_github_repo_content`), running the reconciliation LLM judge with retries, and Cognee's own `cognify()`/`memify()` calls are not always fast — a large repo or a slow LLM response could plausibly take well past Vercel's traditional function timeout.

**The fix, and this is genuinely good news found directly in current Vercel docs:** Vercel's **Fluid Compute** (the current default execution model, not an opt-in extra) supports up to **800 seconds** on Pro/Enterprise plans (and an extended 1800-second beta tier), a dramatic increase from the old 10-second default most outdated guides still describe. For this project's actual workloads — a GitHub repo zip download, text extraction, a handful of LLM calls — 800 seconds is very likely sufficient headroom, but **measure your actual slowest real ingestion case (largest realistic repo, slowest LLM response you've observed) before assuming this is fine**, rather than assuming based on this document alone. Set `maxDuration` explicitly on the `/ingest` route specifically (it doesn't need to be raised globally — `/recall` and most other endpoints should remain fast and don't need an extended duration, and setting a uniformly long duration everywhere is explicitly called out by Vercel's own guidance as wasteful and a debugging hazard).

---

## Part 2 — The Hosting Architecture Itself, Using Vercel Services

### 2.1 Project structure
Per Vercel's own current Services documentation: one Vercel project, two services, one shared domain, routed by path prefix.
```
synapse/                          (one git repo, one Vercel project)
├── frontend/                     → Service 1: Next.js, served at /
│   └── (entirely unchanged — confirmed no frontend code needs to change
│      for this migration; only the API base URL/proxy target changes,
│      and even that may become unnecessary — see 2.2)
├── backend/                      → Service 2: FastAPI/Python, served at /backend (or /api)
│   ├── main.py
│   ├── services/
│   ├── database.py                ← rewritten for Postgres per §1.1
│   └── requirements.txt           ← trimmed per §3 below
└── vercel.json                    ← declares both services and their routing
```

### 2.2 What this means for the existing `/api/proxy/[...path]/route.ts` pattern
Currently the frontend calls its own Next.js API route, which forwards to a separate backend host (Railway/Fly), attaching the `X-Synapse-Key` header server-side. **Under Services, both pieces share one domain** — meaning the frontend could, in principle, call the backend's path prefix (`/backend/...`) directly, same-origin, no separate CORS configuration needed at all, no proxy hop required.

**Recommendation: keep the existing proxy route anyway, don't remove it.** Reasons:
- It's already correctly built, tested across several review rounds, and handles the access-key/BYOK-header-forwarding logic that needs to live *somewhere* regardless of same-origin status.
- It gives you one clean seam if you ever need to move the backend off Vercel again in the future (e.g. if Cognee's resource needs outgrow what's comfortable on serverless) — same-origin direct calls would need to be unwound; a thin proxy layer doesn't.
- The cost of keeping it (one extra network hop, same-origin so no real CORS cost) is negligible compared to the flexibility it preserves.

Update only the *target URL* the proxy forwards to — from an external Railway/Fly URL to the new same-project backend service path (`/backend/...`), which on Vercel under Services resolves automatically without needing a separate `COGNEE_API_URL` env var pointing at an external host anymore. This is a genuine simplification: one less environment variable to manage, one less external host to keep in sync.

### 2.3 `vercel.json` — the actual routing declaration
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "functions": {
    "backend/main.py": {
      "maxDuration": 60
    },
    "backend/main.py:ingest": {
      "maxDuration": 300
    }
  }
}
```
(Exact syntax for per-route duration overrides within a single Python entrypoint may require routing ingestion through its own dedicated handler/file if Vercel's current Python runtime ties `maxDuration` to the whole function bundle rather than individual routes within it — verify this specific mechanic against Vercel's current Python runtime docs at implementation time, since per-route duration granularity for Python (vs. Next.js route handlers, which support this cleanly per-file) is the one area worth double-checking before assuming the syntax above is exactly right.)

---

## Part 3 — Trimming the Backend's Dependency Footprint to Fit Vercel's Bundle Limits

### 3.1 The real constraint
Vercel's official FastAPI deployment docs state a **500MB unzipped limit** per function bundle. The current `requirements.txt` has 147 packages, including genuinely heavy ones: `lancedb`, `pylance`, `pyarrow` (native Rust/C++ bindings, can be substantial), `numpy`, `tokenizers`, `lxml`. **Once Cognee is reconfigured to use PGVector instead of LanceDB (per §1.2), the `lancedb`/`pylance`/`pyarrow` dependency chain may become entirely unnecessary** — these are pulled in specifically to support Cognee's local-vector-store default; switching providers should let Cognee's own dependency resolution drop them, but this needs to be verified directly (reinstall with the new provider config and confirm via `pip show`/an actual build whether these packages are still required transitively).

### 3.2 The concrete steps
1. After reconfiguring Cognee's providers (§1.2), regenerate `requirements.txt` from a clean virtual environment (`pip install cognee[postgres]` — note the extras syntax confirmed directly from Cognee's own docs — rather than the unscoped `pip install cognee` currently used, which pulls in every optional backend's dependencies indiscriminately).
2. Run an actual test build/deploy to Vercel and check the real resulting bundle size in the Vercel dashboard (this project's earlier rounds already established the habit of checking real build output rather than assuming — continue that here).
3. If still over budget, use `vercel.json`'s `excludeFiles` (confirmed as a real, current Vercel feature for Python functions) to explicitly strip test fixtures, docs, and anything non-runtime-essential that might be getting bundled.
4. `black`, `isort`, `datamodel-code-generator`, `jupyter_core`, `nbformat` — these are dev/tooling packages, not runtime dependencies, and appear to have been pulled in incidentally (likely as transitive dependencies of something else, or leftover from local dev tooling never separated into a `requirements-dev.txt`). Audit whether the production `requirements.txt` genuinely needs these at runtime; if not, split them into a separate dev-only requirements file and exclude them from the deployed bundle.

---

## Part 4 — What Genuinely Does NOT Change (confirming your "nothing should change" requirement, honestly)

To be precise about what this migration touches and what it doesn't, since you asked for confidence here, not just reassurance:

- **Every frontend file** — confirmed, this migration requires zero changes to any `.tsx`/`.ts` file under `frontend/src/`. The frontend talks to "the backend" through one proxy route; as long as that route's target resolves correctly, nothing about the UI, the features, the BYOK flow, the judge-token flow, the graph rendering, the GSAP animations, or anything else changes at all.
- **Every API contract** — every request/response shape, every endpoint path, every Pydantic model stays identical. This migration is purely about *where data is stored and how the process is hosted*, not what the API does.
- **Every feature's behavior** — ingestion, reconciliation, the Confidence Timeline, "What Changed?", decay, BYOK, the judge token, the Cognee Live Console — all identical in behavior, because none of this logic touches the storage layer's specific implementation; it all goes through `database.py`'s functions and Cognee's own SDK calls, both of which are being swapped at the connection/configuration level only, not rewritten in their calling logic.
- **The design system, animations, SEO setup, security headers** — all already correctly built in earlier rounds, none of it is hosting-platform-specific, none of it needs to change.

What *does* change, stated precisely: `database.py`'s connection logic (SQLite → Postgres), Cognee's environment-variable configuration (local defaults → managed Postgres/PGVector + remote graph), `requirements.txt`'s contents (trimmed once the storage swap removes unneeded transitive dependencies), the deployment configuration (`vercel.json`, replacing whatever Railway/Fly-specific config currently exists), and the proxy route's target URL (external host → same-project Service path).

---

## Part 5 — Build & Migration Order

1. **Provision Postgres** (Vercel Postgres/Neon, recommended for keeping everything in one dashboard) — get connection credentials.
2. **Rewrite `database.py`** to use Postgres instead of SQLite — swap the connection logic, adjust placeholder syntax, keep every function's signature and behavior identical (this is the one place where "nothing should change" is literally true at the function-interface level, even though the implementation underneath changes).
3. **Reconfigure Cognee's environment variables** for PGVector + remote/managed graph store, per §1.2. Test ingestion and recall against this new configuration *locally first*, pointed at the real managed Postgres instance (not yet deployed to Vercel) — confirming the storage swap itself works correctly is a separable, independently-verifiable step before introducing Vercel's serverless constraints on top of it.
4. **Re-pin and trim `requirements.txt`** per §3, confirming the LanceDB-chain dependencies are genuinely droppable once the provider switch is live.
5. **Set up the Vercel Services structure** — `vercel.json`, the two-service layout, the `maxDuration` override for `/ingest`.
6. **Update the proxy route's target** to the new same-project backend path; remove the now-unnecessary external `COGNEE_API_URL` variable.
7. **Deploy to a Vercel preview environment first** (not directly to production) — Vercel's preview deployments are exactly the right place to validate bundle size, cold-start behavior, and real ingestion timing before this becomes the live, judge-facing URL.
8. **Run the full verification checklist below** against the preview deployment.
9. **Promote to production** only after every item in the checklist passes.

---

## Part 6 — Verification Checklist (Don't Skip This — This Is Where "Production Ready" Gets Earned)

- [ ] Ingest a real GitHub repo, a real pasted conversation, and a real PDF — confirm all three succeed and the data is queryable immediately after.
- [ ] **Re-run the exact same ingestion a second time after at least 5-10 minutes of inactivity** (long enough that Vercel may have recycled the serverless instance) and confirm previously ingested data is still present, queryable, and unaffected. This specific test is the one that would have failed instantly on the old, unmodified local-disk architecture, and it's the single most important check in this entire plan.
- [ ] Trigger a reconciliation conflict, resolve it via `/resolve`, refresh, and confirm persistence — exactly mirroring the verification discipline already established in earlier review rounds for the resolve feature, now re-run against the new storage backend specifically.
- [ ] Time a real ingestion of your largest realistic test repo and confirm it completes within the configured `maxDuration`, with comfortable margin, not right at the edge.
- [ ] Confirm the actual deployed Python function bundle size in the Vercel dashboard is meaningfully under the 500MB limit, not just "didn't fail to deploy" — leave margin for future dependency growth.
- [ ] Re-run the BYOK and judge-access-token flows end to end against the new deployment — these don't touch storage directly, but verify they survived the migration regardless, since they're the most recently-built features and the most valuable to re-confirm.
- [ ] Confirm the live Cognee operations console still shows real-time activity correctly against the new backend location.
- [ ] Update the README's architecture section and any references to the old two-platform (Vercel + Railway/Fly) hosting model — this is now factually outdated documentation the moment this migration ships, and per this project's own established standard across many previous rounds, stale documentation is worth catching before it's discovered by someone else.

---

## Part 7 — One Honest Tradeoff to Decide On, Not Discover Later

Consolidating onto Vercel Services trades operational simplicity (one platform, one dashboard, one bill) for a small amount of architectural rigidity: if this project's resource needs ever genuinely outgrow serverless (sustained high-concurrency ingestion workloads, very large repos, workloads that would benefit from a real persistent worker process rather than request-scoped functions), moving back to a dedicated long-lived host becomes a real migration again, not a config change. For this project's current, real scale — a hackathon submission and likely modest post-hackathon usage — this tradeoff is the right one to make, and it's exactly the kind of precise, stated tradeoff (rather than a silently discovered limitation) that this project's documentation has correctly modeled in every prior round.
