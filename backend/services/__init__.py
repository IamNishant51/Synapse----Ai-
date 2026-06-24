from typing import Optional
from models import (
    IngestRequest,
    IngestResponse,
    RecallRequest,
    ChatMessage,
    SourcePill,
    DiffCard,
    TimelinePoint,
    ConflictEvent,
    ResolveRequest,
    ForgetNodeRequest,
    ForgetSourceRequest,
    GraphSnapshot,
    GraphNode,
    GraphEdge,
    DecaySettings,
    DecayResult,
    Source,
    NodeSearchResult,
    ReconciliationLogEntry,
    ConfidenceHistoryEntry,
)
import os
import uuid
import hashlib
import asyncio
import time
import base64
import fnmatch
import re
import httpx
import trafilatura
from youtube_transcript_api import YouTubeTranscriptApi
from datetime import datetime, timezone
from collections import OrderedDict
import sys
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

# Load only non-secret config from .env
from dotenv import load_dotenv
load_dotenv()

from database import (
    db_init,
    db_save_source,
    db_get_sources,
    db_delete_source,
    db_save_conflict,
    db_get_conflicts,
    db_save_reconciliation_log_entry,
    db_get_reconciliation_log,
    db_save_confidence_history_entry,
    db_get_confidence_history,
    db_get_decay_settings,
    db_update_decay_settings,
    db_update_source_content,
    db_get_source_content,
)
db_init()

# Provider: "gemini" (primary) or "groq" (fallback)
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini")

# Gemini config
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY") or ""
GEMINI_MODEL = (os.environ.get("LLM_MODEL", "gemini/gemini-2.5-flash")).split("/")[-1]

# Groq fallback config
GROQ_API_KEY = os.environ.get("GROQ_API_KEY") or os.environ.get("LLM_API_KEY") or ""
GROQ_MODEL = (os.environ.get("LLM_MODEL_FALLBACK", "groq/llama-3.3-70b-versatile")).split("/")[-1]

HAS_LLM = bool(GEMINI_API_KEY) or bool(GROQ_API_KEY)

# ---- Cognee initialization ----
COGNEE_READY = False
COGNEE_DATASET = "synapse_default"
try:
    import cognee

    if LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
        cognee.config.set_llm_provider("gemini")
        cognee.config.set_llm_model(f"gemini/{GEMINI_MODEL}")
        cognee.config.set_llm_api_key(GEMINI_API_KEY)
        cognee.config.set_llm_endpoint("")
        print(f"[Cognee] Initialized with provider=gemini, model={GEMINI_MODEL}", flush=True)
    else:
        # Route to Groq via the openai provider adapter
        cognee.config.set_llm_provider("openai")
        cognee.config.set_llm_model(f"groq/{GROQ_MODEL}")
        cognee.config.set_llm_api_key(GROQ_API_KEY)
        cognee.config.set_llm_endpoint("https://api.groq.com/openai/v1")
        print(f"[Cognee] Initialized with provider=groq (via openai client), model={GROQ_MODEL}", flush=True)
    COGNEE_READY = True
except Exception as e:
    print(f"[Cognee] Init failed: {e}", flush=True)

# ---- Rate limiting + caching for Groq LLM calls ----
# Cache: LRU, max 64 entries, TTL 5 minutes
_cache: OrderedDict[str, tuple[float, str]] = OrderedDict()
CACHE_MAX = 64
CACHE_TTL = 300  # 5 minutes

# Rate limiter: max 10 LLM calls per 60 seconds (Groq free tier: 30 req/min for 70b)
_last_calls: list[float] = []
RATE_MAX = 10
RATE_WINDOW = 60


async def call_llm(prompt: str, system_prompt: str = "You are a precise, analytical assistant.", use_cache: bool = True) -> str:
    if not HAS_LLM:
        return ""

    cache_key = hashlib.md5(f"{system_prompt}|{prompt}".encode()).hexdigest()

    # Check cache
    if use_cache and cache_key in _cache:
        ts, resp = _cache[cache_key]
        if time.time() - ts < CACHE_TTL:
            _cache.move_to_end(cache_key)
            return resp

    # Rate limit: wait if needed
    now = time.time()
    _last_calls[:] = [t for t in _last_calls if now - t < RATE_WINDOW]
    if len(_last_calls) >= RATE_MAX:
        sleep_time = _last_calls[0] + RATE_WINDOW - now
        if sleep_time > 0:
            await asyncio.sleep(sleep_time)
        _last_calls[:] = [t for t in _last_calls if now + sleep_time - t < RATE_WINDOW] if sleep_time > 0 else []

    _last_calls.append(time.time())

    text = ""
    # Try Gemini (primary), fall back to Groq
    if LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=GEMINI_API_KEY, base_url="https://generativelanguage.googleapis.com/v1beta/openai/")
            resp = await client.chat.completions.create(
                model=GEMINI_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=1024,
            )
            text = resp.choices[0].message.content or ""
        except Exception as e:
            print(f"[LLM] Gemini failed: {e}", flush=True)
            text = ""

    # Fallback to Groq if Gemini failed or not configured
    if not text and GROQ_API_KEY:
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=GROQ_API_KEY, base_url="https://api.groq.com/openai/v1")
            resp = await client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=1024,
            )
            text = resp.choices[0].message.content or ""
        except Exception as e:
            print(f"[LLM] Groq fallback failed: {e}", flush=True)

    if text:
        _cache[cache_key] = (time.time(), text)
        if len(_cache) > CACHE_MAX:
            _cache.popitem(last=False)

    return text


# In-memory jobs status store (short-lived, fine for in-memory)
jobs: dict[str, dict] = {}
_ch_counter = 5


async def fetch_github_repo_content(repo_url: str, path_filter: Optional[str] = None) -> tuple[str, list[str]]:
    import zipfile
    import io

    url = repo_url.strip().rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]
        
    parts = url.split("/")
    if len(parts) < 5 or "github.com" not in parts[2]:
        raise ValueError("Invalid GitHub repository URL")
        
    owner = parts[3]
    repo = parts[4]
    
    headers = {
        "User-Agent": "Synapse-Cognee-Scraper",
        "Accept": "application/vnd.github+json"
    }
    
    zip_content = None
    for branch in ["main", "master"]:
        zip_url = f"https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.zip"
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=30.0) as client:
                resp = await client.get(zip_url, headers=headers)
                if resp.status_code == 200:
                    zip_content = resp.content
                    break
        except Exception as e:
            print(f"[Scraper] Failed to download zip for branch {branch}: {e}", flush=True)

    if not zip_content:
        raise ValueError("Could not download repository zip archive from main or master branch")
        
    valid_exts = {".md", ".txt", ".py", ".js", ".jsx", ".ts", ".tsx", ".json", ".html", ".css", ".go", ".rs", ".yml", ".yaml"}
    concatenated = []
    file_paths = []
    
    try:
        with zipfile.ZipFile(io.BytesIO(zip_content)) as z:
            for file_info in z.infolist():
                if file_info.is_dir():
                    continue
                
                filename = file_info.filename
                parts_path = filename.split("/", 1)
                if len(parts_path) < 2:
                    continue
                path = parts_path[1]
                
                _, ext = os.path.splitext(path.lower())
                if ext not in valid_exts:
                    continue
                    
                if path_filter:
                    clean_filter = path_filter.strip()
                    if not clean_filter.startswith("*") and not clean_filter.startswith("/"):
                        if clean_filter not in path:
                            continue
                    else:
                        match_pattern = clean_filter if not clean_filter.startswith("/") else clean_filter[1:]
                        if not fnmatch.fnmatch(path, match_pattern):
                            continue
                
                try:
                    file_lower = path.lower()
                    if any(ignored in file_lower for ignored in ["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "cargo.lock", "node_modules", ".git", ".next"]):
                        continue
                        
                    with z.open(file_info) as f:
                        file_content = f.read().decode("utf-8", errors="ignore")
                        if not file_content.strip() or len(file_content) > 100000:
                            continue
                        concatenated.append(f"--- FILE: {path} ---\n{file_content}\n")
                        file_paths.append(path)
                except Exception as e:
                    print(f"[Scraper] Failed to decode/read file {path}: {e}", flush=True)
    except Exception as zip_err:
        raise ValueError(f"Failed to parse repository zip archive: {zip_err}")
                    
    # Fetch recent commits via API
    commits_text = ""
    try:
        commits_url = f"https://api.github.com/repos/{owner}/{repo}/commits?per_page=50"
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(commits_url, headers=headers)
            if resp.status_code == 200:
                commits_data = resp.json()
                commits_lines = ["\n\n--- REPOSITORY COMMITS HISTORY ---"]
                for c in commits_data:
                    sha = c.get("sha", "")[:8]
                    commit_info = c.get("commit", {})
                    author = commit_info.get("author", {})
                    date = author.get("date", "")
                    author_name = author.get("name", "")
                    message = commit_info.get("message", "")
                    first_line = message.strip().split("\n")[0] if message else ""
                    commits_lines.append(f"Commit {sha} by {author_name} on {date}: {first_line}")
                commits_text = "\n".join(commits_lines)
    except Exception as e:
        print(f"[Scraper] Failed to fetch commits history for {owner}/{repo}: {e}", flush=True)

    result_content = "\n".join(concatenated)
    if commits_text:
        result_content += commits_text

    return result_content, file_paths


async def save_base64_pdf(content_str: str, label: str) -> str:
    tmp_dir = os.path.join(os.path.dirname(__file__), "tmp_uploads")
    os.makedirs(tmp_dir, exist_ok=True)
    
    if "," in content_str:
        header, base64_data = content_str.split(",", 1)
    else:
        base64_data = content_str
        
    pdf_bytes = base64.b64decode(base64_data)
    
    safe_label = "".join(c for c in label if c.isalnum() or c in (".", "_", "-")).rstrip()
    if not safe_label.endswith(".pdf"):
        safe_label += ".pdf"
        
    file_path = os.path.join(tmp_dir, safe_label)
    
    with open(file_path, "wb") as f:
        f.write(pdf_bytes)
        
    return file_path


def fetch_youtube_transcript(url: str) -> str:
    video_id = None
    if "v=" in url:
        video_id = url.split("v=")[1].split("&")[0]
    elif "youtu.be/" in url:
        video_id = url.split("youtu.be/")[1].split("?")[0]
        
    if not video_id:
        raise ValueError("Could not extract YouTube video ID")
        
    try:
        api = YouTubeTranscriptApi()
        transcript_list = api.list(video_id)
        transcript = transcript_list.find_transcript(["en"])
        transcript_data = transcript.fetch()
        transcript_text = " ".join([t.text for t in transcript_data])
        return transcript_text
    except Exception as e:
        raise ValueError(f"Could not retrieve YouTube transcript: {e}")


def fetch_article_content(url: str) -> str:
    downloaded = trafilatura.fetch_url(url)
    if not downloaded:
        raise ValueError("Could not download article content")
    text = trafilatura.extract(downloaded)
    if not text:
        raise ValueError("Could not extract text from article content")
    return text


async def run_ingest_background(job_id: str, source: Source, req: IngestRequest):
    try:
        content = ""
        file_path_to_remember = None
        
        if req.type == "github":
            if not req.url:
                raise ValueError("GitHub Repository URL is required")
            content, file_paths = await fetch_github_repo_content(req.url, req.pathFilter)
            import json as _json
            source.filePath = _json.dumps(file_paths[:15])
        elif req.type == "pdf":
            file_path_to_remember = await save_base64_pdf(req.content, req.label)
            content = f"[Ingested PDF: {req.label}]"
            source.filePath = file_path_to_remember
        elif req.type == "youtube":
            if not req.url:
                raise ValueError("YouTube Video URL is required")
            content = fetch_youtube_transcript(req.url)
        elif req.type == "article":
            if not req.url:
                raise ValueError("Article URL is required")
            content = fetch_article_content(req.url)
        else:
            content = req.content
            
        jobs[job_id].update({"currentStep": "extracting", "progress": 30})
        db_update_source_content(source.id, content)

        # Run Cognee ingestion and reconciliation in parallel
        async def do_cognee():
            if not COGNEE_READY:
                return
            try:
                truncated = content[:50000] if len(content) > 50000 else content
                full = f"[Source: {req.label} | Type: {req.type} | Ingested: {datetime.now(timezone.utc).isoformat()}]\n\n{truncated}"
                if file_path_to_remember:
                    await cognee.remember(file_path_to_remember, dataset_name=COGNEE_DATASET)
                else:
                    await cognee.remember(full, dataset_name=COGNEE_DATASET)
                try:
                    await asyncio.wait_for(cognee.cognify(datasets=[COGNEE_DATASET]), timeout=5.0)
                except asyncio.TimeoutError:
                    print("[Cognee] cognify timed out, proceeding", flush=True)
            except Exception as e:
                print(f"[Cognee] ingestion failed: {e}", flush=True)

        async def do_reconciliation():
            return await run_reconciliation(
                content=content, label=req.label, date=datetime.now(timezone.utc).isoformat()
            )

        jobs[job_id].update({"currentStep": "improve", "progress": 60})
        cognee_task = asyncio.create_task(do_cognee())
        recon_task = asyncio.create_task(do_reconciliation())

        # Mark source ready as soon as Cognee finishes, even if reconciliation is still running
        await cognee_task
        source.status = "ready"
        source.lastSyncedAt = datetime.now(timezone.utc).isoformat()
        db_save_source(source)
        jobs[job_id].update({"currentStep": "reconcile", "progress": 80})

        # Reconciliation is best-effort — don't fail the source if it errors
        try:
            new_nodes = await recon_task
            jobs[job_id].update({"progress": 100, "status": "completed"})
        except Exception as recon_err:
            print(f"[Reconciliation] failed for {req.label}: {recon_err}", flush=True)
            jobs[job_id].update({"currentStep": "reconcile_failed", "progress": 100, "status": "completed"})

    except Exception as e:
        source.status = "failed"
        db_save_source(source)
        jobs[job_id].update({"status": "failed", "error": str(e)})


async def ingest_source(req: IngestRequest) -> IngestResponse:
    job_id = str(uuid.uuid4())
    source_id = str(uuid.uuid4())

    source = Source(
        id=source_id,
        type=req.type,
        label=req.label,
        url=req.url,
        ingestedAt=datetime.now(timezone.utc).isoformat(),
        lastSyncedAt=None,
        status="processing",
    )
    db_save_source(source)

    jobs[job_id] = {
        "id": job_id,
        "sourceId": source_id,
        "currentStep": "fetching",
        "progress": 0,
        "status": "running",
        "error": None,
    }

    # Run the actual heavy lifting in the background
    asyncio.create_task(run_ingest_background(job_id, source, req))

    return IngestResponse(jobId=job_id, status="started")


async def get_ingestion_job(job_id: str) -> dict:
    return jobs.get(job_id, {"status": "not_found"})


async def run_reconciliation(content: str, label: str, date: str) -> list[dict]:
    new_nodes = []
    now = datetime.now(timezone.utc).isoformat()

    # Use LLM to detect contradictions vs existing knowledge
    existing_sources = db_get_sources()
    existing_conflicts = db_get_conflicts(include_resolved=True)

    existing_summaries = "\n".join(
        f'- Source "{s.label}" ({s.type}): {s.status}'
        for s in existing_sources
    )
    conflict_summaries = "\n".join(
        f'- Conflict "{c.topic}": old="{c.oldNodeSummary}" ({c.oldNodeSource}), new="{c.newNodeSummary}" ({c.newNodeSource}) → {c.relationship}'
        for c in existing_conflicts
    )
    sys_prompt = (
        "You analyze new content against an existing knowledge graph. "
        "Detect if the new content introduces a different claim (contradiction or superseding) "
        "on the same topic as any existing knowledge. Respond with ONLY a JSON array of objects, "
        "each with these fields: topic (str), summary (str, one line), "
        "relationship (\"contradicts\" or \"supersedes\"), confidenceScore (float 0-1). "
        "Return [] if no contradictions found. "
        "Be conservative — only flag genuine factual conflicts on the same topic."
    )
    user_prompt = (
        f"Existing sources:\n{existing_summaries}\n\n"
        f"Existing conflicts:\n{conflict_summaries}\n\n"
        f"New content from \"{label}\" on {date}:\n{content[:2000]}\n\n"
        f"Analyze for contradictions or supersessions. Return JSON array."
    )
    contradictions = None
    if HAS_LLM:
        for attempt in range(3):
            llm_result = await call_llm(user_prompt, system_prompt=sys_prompt)
            if llm_result:
                import json as _json
                try:
                    cleaned = llm_result.strip()
                    if cleaned.startswith("```"):
                        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
                        if "```" in cleaned:
                            cleaned = cleaned.rsplit("```", 1)[0]
                    cleaned = cleaned.strip()
                    if cleaned.startswith("["):
                        contradictions = _json.loads(cleaned)
                        break
                except Exception as parse_err:
                    print(f"[Reconciliation] LLM parse error on attempt {attempt+1}: {parse_err}", flush=True)
            
            if attempt < 2:
                await asyncio.sleep(2 ** attempt)

    if contradictions is None:
        print("[Reconciliation] Failed to detect conflicts using LLM after 3 attempts.", flush=True)
        raise RuntimeError("Reconciliation failed due to LLM error")

    for c in contradictions:
        topic = c.get("topic", "Unknown")
        summary = c.get("summary", "")
        relationship = c.get("relationship", "contradicts")
        confidence = c.get("confidenceScore", 0.85)

        # Find old node info from existing conflicts (use newest old side as anchor)
        old_node_summary = summary
        old_node_date = date
        old_node_source = label
        for ec in existing_conflicts:
            if ec.topic == topic:
                old_node_summary = ec.newNodeSummary
                old_node_date = ec.newNodeDate
                old_node_source = ec.newNodeSource
                break

        conflict_id = str(uuid.uuid4())[:8]
        new_conflict = ConflictEvent(
            id=conflict_id,
            oldNodeSummary=old_node_summary,
            oldNodeDate=old_node_date,
            oldNodeSource=old_node_source,
            newNodeSummary=summary,
            newNodeDate=date,
            newNodeSource=label,
            topic=topic,
            relationship=relationship,
            llmConfidence=confidence,
            status="pending",
            resolutionNote=None,
            createdAt=now,
        )
        db_save_conflict(new_conflict)

        log_id = "log_" + str(uuid.uuid4())[:8]
        db_save_reconciliation_log_entry(ReconciliationLogEntry(
            id=log_id, eventType="changed", topic=topic,
            oldSummary=old_node_summary, newSummary=summary, source=label, createdAt=now,
        ))
        
        ch_id = "ch_" + str(uuid.uuid4())[:8]
        db_save_confidence_history_entry(ConfidenceHistoryEntry(
            id=ch_id, topic=topic,
            valueSummary=summary, confidenceScore=confidence, reason="superseded", date=date,
        ))
        new_nodes.append({
            "topic": topic, "summary": summary,
            "date": date, "source": label,
            "old_summary": old_node_summary,
            "old_date": old_node_date, "old_source": old_node_source,
        })

    return new_nodes


async def get_graph_snapshot() -> GraphSnapshot:
    # Try to fetch real graph data from Cognee first
    if COGNEE_READY:
        try:
            nodes, edges = await cognee.get_memory_provenance_graph(include_memory=True)
            mapped_nodes = []
            seen_nodes = set()
            for n in nodes:
                node_id = str(n.id)
                if node_id in seen_nodes:
                    continue
                seen_nodes.add(node_id)
                node_type = n.properties.get("type", "Entity")
                if node_type in ("User", "Dataset", "Session", "TextDocument", "Document"):
                    continue
                node_name = n.properties.get("name") or n.properties.get("text") or "Entity"
                label = f"{node_name} ({node_type})" if node_type != "Entity" else node_name
                summary = f"{node_type}: {node_name}"
                connection_count = sum(1 for e in edges if e.source == node_id or e.target == node_id)
                mapped_nodes.append(GraphNode(
                    id=node_id,
                    label=label[:40],
                    summary=summary,
                    confidenceScore=0.9,
                    sourceProvenance="Cognee Graph",
                    lastReinforcedAt=datetime.now(timezone.utc).isoformat(),
                    connectionCount=connection_count,
                    status="active",
                    isDecisionType=True if node_type == "Entity" else False
                ))
            mapped_edges = []
            for e in edges:
                mapped_edges.append(GraphEdge(
                    source=str(e.source),
                    target=str(e.target),
                    relationship=str(e.relation),
                    confidence=0.8
                ))
            if mapped_nodes:
                MAX_NODES = 300
                if len(mapped_nodes) > MAX_NODES:
                    mapped_nodes = mapped_nodes[:MAX_NODES]
                    node_ids = {n.id for n in mapped_nodes}
                    mapped_edges = [e for e in mapped_edges if e.source in node_ids and e.target in node_ids]
                return GraphSnapshot(nodes=mapped_nodes, edges=mapped_edges)
        except Exception as cognee_err:
            print(f"[Cognee] get_memory_provenance_graph failed: {cognee_err}", flush=True)

    # Fallback: derive nodes from database conflicts and sources with files
    node_id_counter = 0
    seen_labels: set[str] = set()
    nodes: list[GraphNode] = []
    edges: list[GraphEdge] = []
    db_conflicts = db_get_conflicts(include_resolved=True)
    db_sources = db_get_sources()

    # 1. Build nodes and edges from conflicts
    conflict_node_map = {}
    for c in db_conflicts:
        for variant, is_decision in [(c.newNodeSummary, True), (c.oldNodeSummary, False)]:
            label = variant[:40]
            if label in seen_labels:
                continue
            seen_labels.add(label)
            node_id_counter += 1
            node_id_str = f"conflict_{node_id_counter}"
            status = "active" if is_decision else "superseded"
            nodes.append(GraphNode(
                id=node_id_str, label=label, summary=variant,
                confidenceScore=c.llmConfidence if is_decision else 0.1,
                sourceProvenance=c.newNodeSource if is_decision else c.oldNodeSource,
                lastReinforcedAt=c.newNodeDate if is_decision else c.oldNodeDate,
                connectionCount=1, status=status, isDecisionType=is_decision,
            ))
            conflict_node_map[variant] = node_id_str

    # Connect conflict nodes
    for c in db_conflicts:
        source_id = conflict_node_map.get(c.newNodeSummary)
        target_id = conflict_node_map.get(c.oldNodeSummary)
        if source_id and target_id:
            edges.append(GraphEdge(
                source=source_id, target=target_id,
                relationship=c.relationship, confidence=c.llmConfidence
            ))

    # 2. Build source-level nodes and their file structures
    for s in db_sources:
        source_node_id = f"src_{s.id}"
        nodes.append(GraphNode(
            id=source_node_id,
            label=s.label[:40],
            summary=f"Source: {s.label}",
            confidenceScore=0.90,
            sourceProvenance=s.label,
            lastReinforcedAt=s.ingestedAt,
            connectionCount=0,
            status="active",
            isDecisionType=False
        ))

        # Connect source to its files if it is a GitHub repository
        if s.type == "github" and s.filePath:
            import json as _json
            try:
                files = _json.loads(s.filePath)
                for f in files:
                    node_id_counter += 1
                    file_node_id = f"file_{node_id_counter}"
                    file_name = f.split("/")[-1]
                    nodes.append(GraphNode(
                        id=file_node_id,
                        label=file_name[:40],
                        summary=f"File path: {f}",
                        confidenceScore=0.85,
                        sourceProvenance=s.label,
                        lastReinforcedAt=s.ingestedAt,
                        connectionCount=1,
                        status="active",
                        isDecisionType=False
                    ))
                    edges.append(GraphEdge(
                        source=source_node_id,
                        target=file_node_id,
                        relationship="contains",
                        confidence=0.90
                    ))
            except Exception as json_err:
                print(f"[Graph] Failed to parse files JSON: {json_err}", flush=True)

        # Connect sources to conflict nodes they are associated with
        for c in db_conflicts:
            if s.label in (c.newNodeSource, c.oldNodeSource):
                target_node_id = conflict_node_map.get(c.newNodeSummary) or conflict_node_map.get(c.oldNodeSummary)
                if target_node_id:
                    edges.append(GraphEdge(
                        source=source_node_id,
                        target=target_node_id,
                        relationship="mentions",
                        confidence=0.7
                    ))

    MAX_NODES = 300
    if len(nodes) > MAX_NODES:
        nodes = nodes[:MAX_NODES]
        node_ids = {n.id for n in nodes}
        edges = [e for e in edges if e.source in node_ids and e.target in node_ids]

    return GraphSnapshot(nodes=nodes, edges=edges)


def get_relevant_db_context(query: str, db_sources: list, db_conflicts: list) -> list[str]:
    query_lower = query.lower()
    stopwords = {
        "what", "is", "a", "the", "about", "did", "change", "changed", "how", "why", "who", "where", 
        "to", "from", "for", "in", "on", "of", "and", "or", "project", "repo", "github", "source",
        "i", "my", "me", "we", "us", "our", "you", "your", "he", "she", "it", "they", "them", 
        "before", "now", "vs", "versus", "after", "then", "believe", "believed", "think", "thought"
    }
    query_terms = [word.strip("?,.!-()\"'") for word in query_lower.split()]
    query_terms = [word for word in query_terms if word and len(word) > 2 and word not in stopwords]
    
    relevant_lines = []
    
    if not query_terms:
        for s in db_sources[:5]:
            relevant_lines.append(f"- Source \"{s.label}\" ({s.type}, ingested {s.ingestedAt})")
        for c in db_conflicts[:5]:
            relevant_lines.append(f"- Conflict in \"{c.topic}\" — old: \"{c.oldNodeSummary}\" (from source \"{c.oldNodeSource}\", dated {c.oldNodeDate}) vs new: \"{c.newNodeSummary}\" (from source \"{c.newNodeSource}\", dated {c.newNodeDate}) → {c.relationship} (confidence {c.llmConfidence})")
        return relevant_lines

    referenced_sources = set()
    for c in db_conflicts:
        is_relevant = False
        for term in query_terms:
            if (term in c.topic.lower() or 
                term in c.oldNodeSummary.lower() or 
                term in c.newNodeSummary.lower() or 
                term in c.oldNodeSource.lower() or 
                term in c.newNodeSource.lower()):
                is_relevant = True
                break
        if is_relevant:
            relevant_lines.append(f"- Conflict in \"{c.topic}\" — old: \"{c.oldNodeSummary}\" (from source \"{c.oldNodeSource}\", dated {c.oldNodeDate}) vs new: \"{c.newNodeSummary}\" (from source \"{c.newNodeSource}\", dated {c.newNodeDate}) → {c.relationship} (confidence {c.llmConfidence})")
            referenced_sources.add(c.oldNodeSource)
            referenced_sources.add(c.newNodeSource)

    for s in db_sources:
        is_relevant = s.label in referenced_sources
        if not is_relevant:
            for term in query_terms:
                if term in s.label.lower() or (s.url and term in s.url.lower()):
                    is_relevant = True
                    break
        if is_relevant:
            relevant_lines.append(f"- Source \"{s.label}\" ({s.type}, ingested {s.ingestedAt})")
            raw = db_get_source_content(s.label)
            if raw and len(raw.strip()) > 20:
                snippet = raw.strip()[:600]
                relevant_lines.append(f"  Content: {snippet}")
            
    if not relevant_lines:
        for s in db_sources[:3]:
            relevant_lines.append(f"- Source \"{s.label}\" ({s.type}, ingested {s.ingestedAt})")
            raw = db_get_source_content(s.label)
            if raw and len(raw.strip()) > 20:
                snippet = raw.strip()[:600]
                relevant_lines.append(f"  Content: {snippet}")
            
    return relevant_lines


_commits_cache: dict[str, tuple[float, str]] = {}
COMMITS_CACHE_TTL = 300  # 5 minutes

async def fetch_github_commits(repo_url: str) -> str:
    import time
    url = repo_url.strip().rstrip("/")
    if url.endswith(".git"):
        url = url[:-4]
        
    if url in _commits_cache:
        ts, cached_val = _commits_cache[url]
        if time.time() - ts < COMMITS_CACHE_TTL:
            return cached_val

    parts = url.split("/")
    if len(parts) < 5 or "github.com" not in parts[2]:
        return ""
        
    owner = parts[3]
    repo = parts[4]
    
    headers = {
        "User-Agent": "Synapse-Cognee-Scraper",
        "Accept": "application/vnd.github+json"
    }
    
    commits_url = f"https://api.github.com/repos/{owner}/{repo}/commits?per_page=30"
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=10.0) as client:
            resp = await client.get(commits_url, headers=headers)
            if resp.status_code == 200:
                commits_data = resp.json()
                commits_lines = [f"\n--- Recent Git Commits for {owner}/{repo} ---"]
                for c in commits_data:
                    sha = c.get("sha", "")[:8]
                    commit_info = c.get("commit", {})
                    author = commit_info.get("author", {})
                    date = author.get("date", "")
                    author_name = author.get("name", "")
                    message = commit_info.get("message", "")
                    first_line = message.strip().split("\n")[0] if message else ""
                    commits_lines.append(f"- Commit {sha} by {author_name} on {date}: {first_line}")
                commits_text = "\n".join(commits_lines)
                _commits_cache[url] = (time.time(), commits_text)
                return commits_text
    except Exception as e:
        print(f"[LLM-Commits] Failed to fetch commits history for {owner}/{repo}: {e}", flush=True)
    return ""


async def answer_query(req: RecallRequest) -> ChatMessage:
    query = req.query.lower()
    msg_id = str(uuid.uuid4())

    intent: str = "standard"
    if "changed" in query:
        intent = "what_changed"
    elif "believe" in query or "timeline" in query or "before" in query or "before vs" in query:
        intent = "temporal_belief"

    db_sources = db_get_sources()
    db_conflicts = db_get_conflicts(include_resolved=True)

    # Build filtered knowledge graph context for the LLM
    graph_ctx_lines = ["Knowledge Graph Contents:"]
    graph_ctx_lines.extend(get_relevant_db_context(req.query, db_sources, db_conflicts))

    # Dynamically inject git commit history for history-related queries if github sources are present
    history_keywords = {"changed", "change", "changes", "commit", "commits", "history", "git", "since", "repository", "author", "march"}
    if any(k in query for k in history_keywords):
        for s in db_sources:
            if s.type == "github" and s.url:
                commits_ctx = await fetch_github_commits(s.url)
                if commits_ctx:
                    graph_ctx_lines.append(commits_ctx)

    # Enrich with Cognee recall results from the actual graph
    if COGNEE_READY:
        try:
            cognee_results = await cognee.recall(
                query_text=req.query,
                datasets=[COGNEE_DATASET],
                only_context=True,
                top_k=5,
            )
            graph_ctx_lines.append("\n[Cognee Graph Search Results:]")
            for r in cognee_results:
                graph_ctx_lines.append(f"- {str(r)[:200]}")
        except Exception as cognee_err:
            print(f"[Cognee] recall failed: {cognee_err}", flush=True)

    # Try LLM answer; fall back to keyword answer if LLM unavailable
    if HAS_LLM:
        sys_prompt = (
            "You are Synapse, an AI knowledge-graph assistant. "
            "Answer the user's question based ONLY on the provided knowledge graph context. "
            "Be concise, specific, and refer to actual facts from the context. "
            "If the context doesn't contain enough information, say so honestly."
        )
        user_prompt = (
            f"{chr(10).join(graph_ctx_lines)}\n\n"
            f"User question: {req.query}\n\n"
            f"Provide a natural, conversational answer. Reference specific sources and dates from the context."
        )
        llm_answer = await call_llm(user_prompt, system_prompt=sys_prompt)
    else:
        llm_answer = ""

    if not llm_answer:
        if not db_sources:
            answer = "I don't have any sources ingested yet. Please add a source under 'Add Memory' to ask questions about your project."
        else:
            source_labels = ", ".join(f"'{s.label}'" for s in db_sources)
            answer = f"I've searched your active sources ({source_labels}) but couldn't find specific information to answer your question. Could you rephrase it or check the source content?"
    else:
        answer = llm_answer

    # If the LLM returned "don't know" but we have relevant data in context, build answer directly
    # We only override the LLM response if it is a short refusal (e.g., under 180 characters).
    # If the LLM actually wrote a detailed explanation but included a caveat, we keep its conversational answer.
    ignorance_phrases = ["don't have", "no information", "no context", "couldn't find", "not mentioned", "not enough", "don't know", "cannot determine", "doesn't contain"]
    is_refusal = len(answer.strip()) < 180 and any(p in answer.lower() for p in ignorance_phrases)
    if is_refusal:
        conflict_lines = [l for l in graph_ctx_lines if l.startswith("- Conflict in")]
        content_lines = []
        source_labels = []
        for i, l in enumerate(graph_ctx_lines):
            if l.startswith("- Source "):
                m = re.match(r'- Source "([^"]+)"', l)
                if m:
                    source_labels.append(m.group(1))
            if l.startswith("  Content:") and source_labels:
                content_lines.append((source_labels[-1], l.replace("  Content: ", "", 1)))
        if conflict_lines:
            parts = []
            for line in conflict_lines:
                m = re.match(r'- Conflict in "([^"]+)".*old: "([^"]+)".*new: "([^"]+)".*→ (\w+)', line)
                if m:
                    topic = m.group(1)
                    old_val = m.group(2)
                    new_val = m.group(3)
                    rel = m.group(4)
                    if rel == "supersedes":
                        parts.append(f"On the topic of **{topic}**, the old belief was \"{old_val}\". This was superseded by the new decision \"{new_val}\".")
                    else:
                        parts.append(f"On **{topic}**, there is a conflict between \"{old_val}\" and \"{new_val}\".")
            if parts:
                answer = ("Based on your knowledge graph, here's what I found:\n\n" + "\n\n".join(parts) +
                          "\n\nThese changes were detected automatically by Synapse when new information contradicted existing knowledge. "
                          "You can review and resolve them under **What Changed**.")
        elif content_lines:
            parts = []
            for label, snippet in content_lines:
                parts.append(f"**{label}**: {snippet}")
            answer = ("Based on your knowledge graph, here's what I found about this source:\n\n" +
                      "\n\n".join(parts[:3]) +
                      "\n\n*This information was extracted from the source content you ingested.*")

    # Build structured data from real reconciliation_log and confidence_history
    matched_source_labels = set()
    for line in graph_ctx_lines:
        if line.startswith("- Source "):
            m = re.match(r'- Source "([^"]+)"', line)
            if m:
                matched_source_labels.add(m.group(1))

    # Only show source pills if we actually found relevant sources for the answer
    has_no_info = any(phrase in answer.lower() for phrase in ["no information", "no context", "don't have", "couldn't find", "not mentioned", "any sources ingested yet"])
    if not matched_source_labels and db_sources and not has_no_info:
        matched_source_labels = {s.label for s in db_sources[:1]}

    sources_list = [SourcePill(label=s.label, type=s.type) for s in db_sources if s.label in matched_source_labels]

    diff_card: Optional[DiffCard] = None
    timeline_list: Optional[list[TimelinePoint]] = None

    if intent == "what_changed":
        topic = "tech stack"
        if "database" in query or "auth" in query or "postgres" in query or "supabase" in query:
            topic = query
        db_recon_log = db_get_reconciliation_log()
        added = [e.newSummary for e in db_recon_log if e.eventType == "added" and e.newSummary]
        removed = [e.oldSummary for e in db_recon_log if e.eventType == "removed" and e.oldSummary]
        changed = [(e.oldSummary or "", e.newSummary or "") for e in db_recon_log if e.eventType == "changed" and e.oldSummary and e.newSummary]
        decisions = [e.newSummary for e in db_recon_log if e.eventType == "new_decision" and e.newSummary]
        
        # Only attach diff card if there is actual historical data
        if added or removed or changed or decisions:
            diff_card = DiffCard(
                topic=topic, sinceDate="Earliest recorded change",
                added=added, removed=removed, changed=changed, newDecisions=decisions,
            )
    elif intent == "temporal_belief":
        topic = "Database choice"  # default topic for timeline
        if "auth" in query:
            topic = "Auth provider"
        db_history = db_get_confidence_history(topic)
        if db_history:
            timeline_list = [
                TimelinePoint(date=h.date, valueSummary=h.valueSummary, confidenceScore=h.confidenceScore, reason=h.reason)
                for h in sorted(db_history, key=lambda x: x.date)
            ]

    return ChatMessage(
        id=msg_id, query=req.query, intent=intent,
        answer=answer,
        sources=sources_list,
        diffCard=diff_card,
        timeline=timeline_list,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


async def get_conflict_events() -> list[ConflictEvent]:
    return db_get_conflicts(include_resolved=True)


async def resolve_conflict(req: ResolveRequest) -> None:
    db_conflicts = db_get_conflicts(include_resolved=True)
    for c in db_conflicts:
        if c.id == req.eventId:
            c.status = f"resolved_{req.resolution}"  # type: ignore
            c.resolutionNote = req.note
            db_save_conflict(c)

            # Log to reconciliation_log so the diff card reflects it
            now = datetime.now(timezone.utc).isoformat()
            log_id = "log_" + str(uuid.uuid4())[:8]
            
            if req.resolution == "keep_new":
                db_save_reconciliation_log_entry(ReconciliationLogEntry(
                    id=log_id, eventType="changed", topic=c.topic,
                    oldSummary=c.oldNodeSummary, newSummary=c.newNodeSummary,
                    source=c.newNodeSource, createdAt=now,
                ))
                # Update confidence history
                db_save_confidence_history_entry(ConfidenceHistoryEntry(
                    id="ch_" + str(uuid.uuid4())[:8], topic=c.topic,
                    valueSummary=c.newNodeSummary, confidenceScore=0.95,
                    reason="reinforced", date=now
                ))
                db_save_confidence_history_entry(ConfidenceHistoryEntry(
                    id="ch_" + str(uuid.uuid4())[:8], topic=c.topic,
                    valueSummary=c.oldNodeSummary, confidenceScore=0.10,
                    reason="superseded", date=now
                ))
            elif req.resolution == "keep_old":
                db_save_reconciliation_log_entry(ReconciliationLogEntry(
                    id=log_id, eventType="removed", topic=c.topic,
                    oldSummary=c.newNodeSummary, createdAt=now,
                ))
                # Update confidence history
                db_save_confidence_history_entry(ConfidenceHistoryEntry(
                    id="ch_" + str(uuid.uuid4())[:8], topic=c.topic,
                    valueSummary=c.oldNodeSummary, confidenceScore=0.92,
                    reason="reinforced", date=now
                ))
                db_save_confidence_history_entry(ConfidenceHistoryEntry(
                    id="ch_" + str(uuid.uuid4())[:8], topic=c.topic,
                    valueSummary=c.newNodeSummary, confidenceScore=0.10,
                    reason="superseded", date=now
                ))
            elif req.resolution == "keep_both":
                db_save_reconciliation_log_entry(ReconciliationLogEntry(
                    id=log_id, eventType="added", topic=c.topic,
                    newSummary=f"{c.newNodeSummary} (coexists with {c.oldNodeSummary})",
                    source=c.newNodeSource, createdAt=now,
                ))
                # Update confidence history
                db_save_confidence_history_entry(ConfidenceHistoryEntry(
                    id="ch_" + str(uuid.uuid4())[:8], topic=c.topic,
                    valueSummary=c.oldNodeSummary, confidenceScore=0.90,
                    reason="reinforced", date=now
                ))
                db_save_confidence_history_entry(ConfidenceHistoryEntry(
                    id="ch_" + str(uuid.uuid4())[:8], topic=c.topic,
                    valueSummary=c.newNodeSummary, confidenceScore=0.90,
                    reason="reinforced", date=now
                ))
            return


async def run_decay_check() -> DecayResult:
    now_dt = datetime.now(timezone.utc)
    now = now_dt.isoformat()
    decayed = 0
    forgotten = 0
    
    settings = db_get_decay_settings()
    db_conflicts = db_get_conflicts(include_resolved=True)
    
    for c in db_conflicts:
        if c.status == "forgotten":
            continue
        
        # Compute time elapsed since the conflict was created
        try:
            raw = c.createdAt.replace("Z", "+00:00")
            created = datetime.fromisoformat(raw)
        except (ValueError, TypeError):
            created = now_dt
        days_since = max(0, (now_dt - created).days)
        
        # Get original confidence from confidence history (first entry for this topic)
        history = db_get_confidence_history(c.topic)
        original_entry = history[0] if history else None
        original_confidence = original_entry.confidenceScore if original_entry else c.llmConfidence
        
        # Compute time-proportional decay
        if days_since <= settings.decayStartDays:
            new_confidence = original_confidence
        elif days_since >= settings.forgetThresholdDays:
            new_confidence = 0.0
        else:
            decay_ratio = (days_since - settings.decayStartDays) / (settings.forgetThresholdDays - settings.decayStartDays)
            new_confidence = max(0.0, round(original_confidence * (1 - decay_ratio), 2))
        
        c.llmConfidence = new_confidence
        
        if new_confidence < 0.20:
            c.status = "forgotten"
            forgotten += 1
        elif new_confidence < original_confidence:
            decayed += 1
        
        db_save_conflict(c)
        
        ch_id = "ch_" + str(uuid.uuid4())[:8]
        db_save_confidence_history_entry(ConfidenceHistoryEntry(
            id=ch_id, topic=c.topic,
            valueSummary=c.newNodeSummary, confidenceScore=new_confidence,
            reason="decay_tick", date=now,
        ))
        
    return DecayResult(forgotten=forgotten, decayed=decayed)


async def get_decay_settings() -> DecaySettings:
    return db_get_decay_settings()


async def update_decay_settings(settings: DecaySettings) -> None:
    db_update_decay_settings(settings)


async def get_sources() -> list[Source]:
    return db_get_sources()


async def search_nodes(query: str) -> list[NodeSearchResult]:
    q = query.lower()
    results = []
    db_conflicts = db_get_conflicts(include_resolved=True)
    for c in db_conflicts:
        if q in c.topic.lower() or q in c.oldNodeSummary.lower() or q in c.newNodeSummary.lower():
            results.append(NodeSearchResult(id=f"node_{c.id}_new", label=c.newNodeSummary[:40], confidence=c.llmConfidence, status=c.status))
    return results


async def forget_node(node_id: str) -> None:
    if COGNEE_READY:
        try:
            await cognee.forget(data_id=node_id, dataset=COGNEE_DATASET)
        except Exception as cognee_err:
            print(f"[Cognee] forget failed: {cognee_err}", flush=True)


async def forget_source(source_id: str) -> None:
    db_sources = db_get_sources()
    target_source = next((s for s in db_sources if s.id == source_id), None)
    if target_source:
        db_delete_source(source_id)
        if COGNEE_READY:
            try:
                await cognee.forget(dataset=COGNEE_DATASET, data_id=target_source.label)
            except Exception:
                pass
