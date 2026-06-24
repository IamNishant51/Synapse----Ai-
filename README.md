# Synapse: The Autonomous Memory Dashboard

**[▶️ Watch the 100-Second Demo Video Here](#)**

*Because an LLM that forgets your decisions is just a search engine.*

Built for: *The Hangover Part AI: Where's My Context?* — WeMakeDevs × Cognee Hackathon (Jun 29 – Jul 5, 2026)

---

## 1. The Problem
Developers, researchers, and creators use scattered tools (ChatGPT, Claude, Notion, GitHub, PDFs, articles, YouTube videos). Over time, their beliefs, codebase frameworks, and decisions evolve. Plain vector RAG systems suffer from **acting on outdated information** (e.g., citing a decision that got reversed, writing code with a framework they switched away from, or repeating context). 

## 2. What Synapse Does
Synapse solves this by layered memory health management on top of Cognee. It captures raw sources, stores them in a hybrid graph-vector store, detects claims that contradict or supersede existing nodes, and asks the user to resolve the conflict. Additionally, unused memories gradually lose confidence and are pruned.

## 3. Cognee API Mapping
Synapse integrates Cognee's memory lifecycle APIs directly to solve the hackathon challenge:

| Cognee Operation | Code Location | Synapse Application Feature |
|---|---|---|
| `remember()` | [services/__init__.py:L363](https://github.com/IamNishant51/Synapse----Ai-/blob/main/backend/services/__init__.py#L363) | Ingests PDF files, GitHub repositories, conversations, articles, and YouTube transcripts. |
| `recall()` | [services/__init__.py:L782](https://github.com/IamNishant51/Synapse----Ai-/blob/main/backend/services/__init__.py#L782) | Powers graph-grounded, time-aware chat queries ("what did I believe before vs now"). |
| `improve()` / memify | [services/__init__.py:L367](https://github.com/IamNishant51/Synapse----Ai-/blob/main/backend/services/__init__.py#L367) | Runs the **Reconciliation Pass** after ingestion to detect semantic conflicts and updates confidence weights. |
| `forget()` | [services/__init__.py:L1062](https://github.com/IamNishant51/Synapse----Ai-/blob/main/backend/services/__init__.py#L1062) | Enables user-triggered manual pruning, source-level forgetting, and automatic decay of stale nodes. |

---

## 4. Key Architectural Features

### 4.1 The Reconciliation Engine
When new data is ingested, Synapse fetches existing context and runs a structured-output judge to check if it contradicts or supersedes past beliefs. Found conflicts are queued in the **"What Changed" Inbox** UI where users decide to **Keep New**, **Keep Old**, or **Keep Both**.

### 4.2 The Decay Engine (Memory Health)
Unreinforced nodes gradually degrade in confidence (by 0.15 per check invocation). If a node's confidence drops below `0.20`, it triggers `cognee.forget()` and is marked forgotten in the metadata database. 

### 4.3 Structured Diff ("What Changed?")
Queries matching a temporal belief/delta pattern (e.g. "what changed about my database choice since March") generate a structured card detailing:
*   **✚ Added** (newly added technologies/decisions)
*   **✖ Removed** (rejected/deleted decisions)
*   **⇄ Changed** (superseded flows, e.g. Postgres → Supabase)
*   **★ New Decisions**

---

## 5. Technical Stack
*   **Frontend**: Next.js 15 (App Router), Tailwind CSS, TypeScript, `react-force-graph-3d` for the memory node visualization.
*   **Backend**: FastAPI (Python), SQLite metadata store ([database.py](https://github.com/IamNishant51/Synapse----Ai-/blob/main/backend/database.py)), Cognee SDK, and Gemini / Groq API wrappers.

---

## 6. Known Limitations
- **Single-User Scope**: This is a single-instance demonstration. While guarded on both the frontend and backend by a shared-secret access key (`SYNAPSE_ACCESS_KEY`), it is not currently configured for multi-tenant auth.
- **Browser-Local Chat History**: Conversation history in the `/ask` view is stored locally in your browser's `localStorage` and will not persist across different devices.

---

## 7. Judging Criteria Alignment

| Criterion | Synapse Implementation |
|---|---|
| **Potential Impact** | Solves the "context amnesia" problem for high-turnover projects by ensuring organizational knowledge scales without degrading. |
| **Creativity & Innovation** | The **Reconciliation Engine**: instead of blindly appending facts, it detects contradictions and forces human judgment to build a coherent graph. |
| **Technical Excellence** | Clean Next.js + FastAPI split, responsive UI, 3D interactive force graph, strict typing, and structured LLM JSON-parsing with exponential backoff. |
| **Best Use of Cognee** | Maps directly to Cognee's `remember()`, `recall()`, and `forget()` primitives, turning the SDK into a visual, user-manageable memory dashboard. |
| **User Experience** | Sleek dark-mode interface with skeleton loaders, `ResizeObserver` responsive layouts, GSAP animations, and zero layout shift. |
| **Presentation Quality** | See the 100-second demo video at the top of this README. |

---

*Note: This project was built with the assistance of an AI coding agent as part of the hackathon build process, in compliance with the hackathon's AI usage rules.*

## 8. How to Run Locally

### Backend Setup
1. Navigate to `/backend`:
   ```bash
   cd backend
   ```
2. Create and activate venv:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set environment variables in `.env`:
   ```env
   LLM_PROVIDER=gemini
   LLM_MODEL=gemini/gemini-2.5-flash
   GEMINI_API_KEY=your_gemini_key
   GROQ_API_KEY=your_groq_fallback_key
   ```
5. Start Uvicorn:
   ```bash
   python -m uvicorn main:app --reload --port 8000
   ```

### Frontend Setup
1. Navigate to `/frontend`:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run Development Server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000).
