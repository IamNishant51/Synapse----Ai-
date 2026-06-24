# SYNAPSE_REFINEMENT.md — What to Fix to Maximize Winning Chances

Full repo re-read, this round covering commits `793d2c3` through `6d5c02d` — the full ElevenLabs editorial redesign of every inner page, a complete landing page rebuild with Lenis + GSAP + real image assets, and a long run of `/ask` fixes. This is a genuinely strong state overall. Read Part 0 first — it has the one thing that needs fixing before anything else. Then Part 1 covers real but lower-severity issues. Part 2 is what's now excellent and shouldn't be touched. Part 3 is polish that raises the ceiling further, for if time remains after Parts 0–1.

---

## Part 0 — Fix This First, Before Anything Else

### 0.1 The access-control middleware was renamed in a way that makes Next.js stop running it entirely

**What happened:** `frontend/src/middleware.ts` was renamed to `frontend/src/proxy.ts` (the function inside was renamed from `middleware` to `proxy` too — visible directly in `git log`'s file-rename tracking). The code itself is untouched and still correct — same `SYNAPSE_ACCESS_KEY` cookie check, same login redirect, same `config.matcher`.

**Why this is serious:** Next.js's middleware system is filename-strict. It only executes a file named exactly `middleware.ts` (or `.js`) at the project root or inside `src/`. A file named anything else — `proxy.ts`, `auth.ts`, whatever — is just a normal, inert TypeScript module that nothing imports and nothing runs. Confirmed by checking: nothing in the codebase imports from `@/proxy` or `./proxy`. This means **the entire Tier 1 authentication gate — verified working correctly across the last two full review rounds — currently does nothing.** The app is, right now, completely open: no login redirect, no cookie check, on any route. This is worse than the original "no auth" finding from several rounds ago, because that one was at least visible (no auth code existed at all); this one looks like auth exists (there's a `/login` page, there's a cookie check, the code reads correctly) but silently doesn't run.

**Why it's easy to miss:** there's no error. The build succeeds. The login page still exists and still works if visited directly. The bug only shows up as "huh, I never get redirected to `/login` when I visit `/graph` directly anymore" — something that's easy to not notice if you're mostly testing by clicking through the app from the front door rather than typing protected URLs directly.

**The fix:** rename the file back to `frontend/src/middleware.ts` and the exported function back to `middleware` (Next.js also expects the default/named export to be called `middleware` by convention — confirm against whatever Next.js version this project pins, but `export function middleware(request: NextRequest)` is the standard signature). No other code changes needed — the logic inside is already correct, this is purely a filename/export-name fix.

**Verification:** after the fix, visit `/graph` directly in an incognito window (no cookie set) and confirm it redirects to `/login`. This exact test — hitting a protected route directly, not just clicking through from the login page — is the one that would have caught this regression immediately, and it's worth making a standing habit before every submission: any time middleware, auth, or routing logic changes, re-test by direct URL navigation, not just by clicking through the happy path.

**This is the single highest-priority fix in this document.** Everything else below is real but lower-stakes than an app that's supposed to be gated and currently isn't.

---

## Part 1 — Real Issues, Lower Severity

### 1.1 Stale, hardcoded example data reappeared in two places on the new landing page

This is the same class of bug that took three full review rounds to fully close in `/ask` (hardcoded example content that doesn't match the current, real seed data) — and it's now shown up again, in a new location, on the rebuilt landing page:

- **The "What Changed?" droplet section** (`#section-resolve`) hardcodes a diff card showing `"− Dark canvas (#010102)"` / `"+ Off-white (#f5f5f5) canvas"` — this is literally the *old, now-replaced* dark design system being shown as an example, on a page that itself just adopted the *new* light design system. It's internally contradictory: the page's own visual identity disproves its own example copy.
- **The "Memory Health" decay section** (`#section-decay`) hardcodes `"Postgres Config"` and `"Supabase Integration"` as the two example confidence bars — these are the exact old seed-data topic names that the entire `/ask` topic-detection saga was about purging, and they don't correspond to anything in the current real seed data (Canvas Theme / Backend Security / Typography Choice).

**Why this matters:** none of this breaks functionality — these are static marketing-copy mockups, not live data calls — but it's the same root habit (hardcoding example content against whatever data happened to exist at the time of writing) that's caused every escalation in this review history so far. It's also a slightly awkward look if a judge reads the landing page's example, then opens the live app and finds completely different topics — the marketing promise and the product reality visibly disagree, which is exactly the kind of inconsistency `LANDING_PAGE_PROMPT.md` §5 ("What Not To Do") explicitly warned against: *"do not let the page's example copy/data drift out of sync with whatever the actual app's current seed data is."*

**The fix:** update both hardcoded examples to use the current real seed topics (Canvas Theme, Backend Security, Typography Choice, or whatever is current at time of the next edit), phrased generically enough that they don't need to be re-edited every time the seed data changes again — e.g. describe the *mechanism* concretely ("a design-system value contradicted by a newer source") while keeping specific labels minimal, or pull a real example via the same `getAskTopics`-style approach already built for `/ask`'s prompt chips, so the landing page can never drift out of sync with the app again either.

### 1.2 The 3D graph's 2D fallback escape hatch is gone

Across the last two rounds, `react-force-graph-2d` stayed installed (even though unused) specifically as a documented escape hatch — "if the 3D graph is shaky on demo hardware, switch to 2D" — pending an actual hardware test that's been flagged as open since the very first review round. This round's dependency cleanup (`6d5c02d`, "replace 3D SVG illustrations with high-quality image assets, clean up GSAP animation warnings") removed `react-force-graph-2d` from `package.json` entirely, and no 2D code path exists in `graph/page.tsx`.

**Why this matters:** the hardware-verification task is still open — it's never been confirmed, across four rounds now, that the 3D graph renders reliably on the actual device/browser intended for the live demo. Removing the fallback while the underlying risk is still unverified narrows the available options if something does go wrong on demo day, right when there'd be the least time to recover.

**The fix:** either (a) actually perform the hardware verification now — test on the real demo device, browser, and projector/screen, confirm WebGL initializes reliably and frame rate holds — and if it passes, the missing fallback is a non-issue; or (b) if there's any uncertainty at all about the demo environment, reinstall `react-force-graph-2d` and wire up a simple fallback (a query param, an env flag, or even just a code comment with the swap-in component ready to uncomment) before the actual event, not during it.

### 1.3 No mobile-specific GSAP behavior for the two pinned, scroll-scrubbed sections

The landing page's `gsap.matchMedia()` setup branches correctly on `prefers-reduced-motion`, but has no separate branch for small viewports. Both pinned sections (`#section-ingest`, `#section-resolve`) use `pin: true` with large fixed-pixel scroll distances (e.g. `end: "+=2200"`) and `min-h-screen` containers — this combination is a known trouble spot on mobile browsers, where dynamic viewport-height changes (the address bar showing/hiding as the user scrolls) can cause `ScrollTrigger`'s pin calculations to drift, leading to content that's pinned slightly wrong, releases at the wrong scroll position, or jitters.

**The fix:** add a mobile breakpoint branch to the `matchMedia()` setup (e.g. `"(max-width: 767px)"`) that either shortens the pinned scroll distances significantly, switches `pin: true` to `pin: false` with a simpler `scrub`-only (non-pinned) sequence, or reduces to a straightforward fade-up entrance like the non-pinned sections already use elsewhere on the page. Test on an actual mobile device (not just a resized desktop browser window, which doesn't reproduce the dynamic-viewport-height behavior) before considering this closed.

### 1.4 Several content containers use a single fixed height across all breakpoints

Containers like the scattered-source-cards frame (`h-[420px]`) and a few of the SVG/image panels (`h-[380px]`, no smaller mobile variant) don't shrink for narrow viewports. Combined with absolutely-positioned scattered cards at percentage-based offsets (the source-cards section), this risks visual cramping or overlap on phones narrower than roughly 380px.

**The fix:** add a smaller mobile height variant (e.g. `h-[260px] md:h-[420px]`) to each of these containers, and specifically re-check the scattered source-cards section at a few representative phone widths (360px, 390px, 412px covers most of the real-world range) to confirm the cards don't visually collide.

### 1.5 The footer's "Video Demo" link points at the bare repository, not an actual video

`frontend/src/app/page.tsx`'s footer links "Video Demo" to `https://github.com/IamNishant51/Synapse----Ai-` — the repo root, not a video. This is presumably a placeholder pending the actual demo recording (per `cognee_hackathon.md` §9's submission plan). Low priority, but easy to forget — update it once the demo video exists, and in the meantime consider either removing the link or pointing it at wherever the video will actually live (YouTube unlisted link, a `/demo` page, etc.) so it's not a dead end if a judge clicks it before the recording is in place.

---

## Part 2 — What's Excellent in This Round, Don't Touch It

This round did genuinely strong work, including finally closing the single longest-running issue in this entire review history. Worth being explicit about what's right so it doesn't get second-guessed or accidentally regressed while fixing Part 0/1:

- **The `/ask` topic-detection bug (escalating across three previous rounds) is now correctly, completely fixed.** `get_matched_topic()` does real term-overlap matching against `db_get_distinct_topics()`/`db_get_timeline_topics()` — genuine `SELECT DISTINCT` queries against live data, not hardcoded strings. Both the Confidence Timeline and the "What Changed?" diff card now return nothing (rather than a wrong-but-confident default) when no real topic matches a query. This is exactly the fix specified, exactly the level of rigor asked for, verified by direct code inspection.
- **`promptChips` are now genuinely dynamic**, fetched from the backend's new `/topics` endpoint via `getAskTopics()`, with a topic-agnostic fallback for an empty database. This closes the staleness loop at its root — it cannot go stale against a future reseed the way the static array did before.
- **The stale keyword-trigger word lists were cleaned up correctly** — `history_keywords` dropped its old-story leftovers, and the separate `change_keywords`-gated conflict injection was replaced with an unconditional injection (the better of the two options previously suggested, since the cost of always including this context is low).
- **The Lenis + GSAP ScrollTrigger integration is implemented exactly correctly** — `lenis.on('scroll', ScrollTrigger.update)`, `gsap.ticker.add`/`lagSmoothing(0)`, and careful cleanup that even restores other pages' scroll-height classes on unmount. This is not a naive integration; it shows real understanding of the two systems' sync requirements.
- **The "What Changed?" droplet section is built with real craft** — the gold/smoke SVG radial gradients, the scroll-scrubbed fuse-and-flash sequence, the "Keep New" button pulse, the real comparison-card and diff-card mockups. This is the product's strongest feature and it got the most build attention, exactly as `LANDING_PAGE_PROMPT.md` asked for.
- **The seven hand-built SVG source-icons in the "scattered sources" section** (ChatGPT, GitHub, Notion, Claude, PDF, Article, YouTube) are genuinely custom, recognizable, varied — not generic icon-pack assets — with deliberate scattered rotation and positioning matching the reference image's compositional logic.
- **The decision to use the actual reference photographs as static image assets** (rather than hand-built animatable SVG) for a few sections (Memory Health, Graph Preview, Capabilities) is a reasonable, defensible scope trade-off for a hackathon timeline — these images look better than any SVG approximation realistically would, at the cost of those specific visuals not being animatable the way a from-scratch SVG would be. This is fine as a deliberate choice; it's flagged here only so it's understood as a choice, not re-litigated as a mistake.
- **The full design-system migration to the ElevenLabs light palette is now consistent across every inner page**, not just the landing page — colors, fonts (EB Garamond + Inter, the documented substitute), spacing all match `DESIGN-elevenlabs.md`'s tokens exactly where checked. The earlier-flagged "two documents disagree about the product's visual identity" concern is resolved by consistent execution, not by accident.

---

## Part 3 — Polish for Extra Margin, If Time Remains After Part 0–1

- **Update `cognee_hackathon.md` §6's design tokens** to reflect the ElevenLabs light palette as the actual, final, deliberate choice, replacing the old dark-Linear-derived token table. The spec and the app should describe the same product; right now the original spec document is the one piece of writing still describing the old visual identity.
- **Consider extending the dynamic-topic pattern from `/ask` to the landing page's example data** (per 1.1's fix) as a shared utility, so both surfaces pull from the same "what are the current real topics" source rather than maintaining two separate copies of similar logic.
- **A short, explicit note in the README or `AGENTS.md` codifying the "test protected routes by direct URL, not just by clicking through" habit** — this is the exact testing gap that let the Part 0 middleware regression go unnoticed, and writing the habit down once is cheaper than rediscovering the same blind spot again.
- **Double-check every other file in the repo for a similar Next.js-convention-sensitive rename** — `proxy.ts` was the one found this round, but it's worth a quick scan for any other framework-special filenames (`layout.tsx`, `loading.tsx`, `not-found.tsx`, `route.ts` inside `app/api/.../`) that might have been touched by the same renaming pass, in case it wasn't a one-off.
