import os
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from models import (
    IngestRequest,
    RecallRequest,
    ResolveRequest,
    ForgetNodeRequest,
    ForgetSourceRequest,
    DecaySettings,
)
from services import (
    ingest_source,
    get_ingestion_job,
    get_graph_snapshot,
    answer_query,
    get_ask_topics,
    get_conflict_events,
    resolve_conflict,
    run_decay_check,
    get_decay_settings,
    update_decay_settings,
    get_sources,
    search_nodes,
    forget_node,
    forget_source,
    reset_demo_data,
)

async def verify_access_key(x_synapse_key: str = Header(None)):
    secret = os.environ.get("SYNAPSE_ACCESS_KEY")
    if secret and x_synapse_key != secret:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Synapse-Key header")

app = FastAPI(
    title="Synapse — Cognee Backend", 
    version="0.1.0",
    dependencies=[Depends(verify_access_key)]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "synapse-cognee"}


@app.post("/ingest")
async def ingest(req: IngestRequest):
    result = await ingest_source(req)
    return result


@app.get("/ingest/{job_id}")
async def ingestion_job(job_id: str):
    job = await get_ingestion_job(job_id)
    if job.get("status") == "not_found":
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/graph-snapshot")
async def graph_snapshot():
    return await get_graph_snapshot()


@app.post("/recall")
async def recall(req: RecallRequest):
    return await answer_query(req)


@app.get("/topics")
async def ask_topics():
    return get_ask_topics()


@app.get("/reconciliation/events")
async def reconciliation_events():
    return await get_conflict_events()


@app.post("/reconciliation/resolve")
async def reconciliation_resolve(req: ResolveRequest):
    await resolve_conflict(req)
    return {"status": "ok"}


@app.post("/decay/run")
async def decay_run():
    return await run_decay_check()


@app.get("/decay/settings")
async def decay_settings_get():
    return await get_decay_settings()


@app.put("/decay/settings")
async def decay_settings_put(settings: DecaySettings):
    await update_decay_settings(settings)
    return {"status": "ok"}


@app.get("/sources")
async def sources_list():
    return await get_sources()


@app.get("/nodes/search")
async def nodes_search(q: str = ""):
    return await search_nodes(q)


@app.post("/forget/node")
async def forget_node_endpoint(req: ForgetNodeRequest):
    await forget_node(req.nodeId)
    return {"status": "ok"}


@app.post("/forget/source")
async def forget_source_endpoint(req: ForgetSourceRequest):
    await forget_source(req.sourceId)
    return {"status": "ok"}


@app.post("/reset-demo")
async def reset_demo_endpoint():
    await reset_demo_data()
    return {"status": "ok"}
