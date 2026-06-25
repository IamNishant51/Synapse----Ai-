import os
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
import httpx
from pydantic import BaseModel
from database import (
    db_save_user_ai_config,
    db_get_user_ai_config,
    db_delete_user_ai_config,
)
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
    generate_node_summary,
    forget_node,
    forget_source,
    reset_demo_data,
    get_cognee_activities,
    apply_cognee_llm_config,
)

limiter = Limiter(key_func=get_remote_address)

# async def verify_llm_authorization(x_synapse_key: str = Header(None)):
#     user_config = db_get_user_ai_config()
#     if user_config and user_config.get("provider") and user_config.get("model"):
#         return  # BYOK is configured, bypass access key checks
#     secret = os.environ.get("SYNAPSE_ACCESS_KEY")
#     is_dev = os.environ.get("ENVIRONMENT", "production") == "development"
#     if not secret and not is_dev:
#         raise HTTPException(status_code=500, detail="Server misconfigured: Access keys not configured")
#     allowed_keys = {k for k in (secret,) if k}
#     if x_synapse_key not in allowed_keys:
#         raise HTTPException(status_code=403, detail="Access key required.")
# Uncomment above and add Depends(verify_llm_authorization) to /ingest, /recall, /reconciliation/resolve to re-lock the app

app = FastAPI(
    title="Synapse — Cognee Backend", 
    version="0.1.0"
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.environ.get("FRONTEND_URL", "http://localhost:3000")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    import cognee
    from services import COGNEE_READY
    if COGNEE_READY:
        try:
            print("[Cognee] Running startup migrations...", flush=True)
            await cognee.run_migrations()
            print("[Cognee] Startup migrations completed successfully.", flush=True)
        except Exception as e:
            print(f"[Cognee] Startup migrations failed: {e}", flush=True)



@app.get("/health")
async def health():
    return {"status": "ok", "service": "synapse-cognee"}


@app.post("/ingest")
@limiter.limit("10/minute")
async def ingest(request: Request, req: IngestRequest):
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


class NodeSummarizeRequest(BaseModel):
    nodeId: str
    label: str
    sourceProvenance: str


@app.post("/nodes/summarize")
async def node_summarize(req: NodeSummarizeRequest):
    summary = await generate_node_summary(req.nodeId, req.label, req.sourceProvenance)
    return {"summary": summary}


@app.post("/recall")
@limiter.limit("20/minute")
async def recall(request: Request, req: RecallRequest):
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


@app.get("/cognee/activity")
async def cognee_activity_endpoint():
    return get_cognee_activities()


class AIConfigRequest(BaseModel):
    provider: str
    apiKey: str
    model: str


@app.get("/ai/models")
@limiter.limit("10/minute")
async def get_ai_models(request: Request, provider: str, key: str):
    if not key or not provider:
        raise HTTPException(status_code=400, detail="Provider and key are required")
        
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            if provider == "groq":
                headers = {"Authorization": f"Bearer {key}"}
                r = await client.get("https://api.groq.com/openai/v1/models", headers=headers)
                if r.status_code != 200:
                    raise HTTPException(status_code=r.status_code, detail=f"Groq API error: {r.text}")
                data = r.json()
                models = [m["id"] for m in data.get("data", [])]
                
            elif provider == "openai":
                headers = {"Authorization": f"Bearer {key}"}
                r = await client.get("https://api.openai.com/v1/models", headers=headers)
                if r.status_code != 200:
                    raise HTTPException(status_code=r.status_code, detail=f"OpenAI API error: {r.text}")
                data = r.json()
                models = [m["id"] for m in data.get("data", [])]
                
            elif provider == "gemini":
                r = await client.get(f"https://generativelanguage.googleapis.com/v1beta/models?key={key}")
                if r.status_code != 200:
                    raise HTTPException(status_code=r.status_code, detail=f"Gemini API error: {r.text}")
                data = r.json()
                models_raw = data.get("models", [])
                models = []
                for m in models_raw:
                    if "generateContent" in m.get("supportedGenerationMethods", []):
                        name = m.get("name", "")
                        clean_name = name.split("/")[-1] if "/" in name else name
                        models.append(clean_name)
            else:
                raise HTTPException(status_code=400, detail="Invalid provider")
                
            models = sorted(list(set(models)))
            return {"models": models}
            
    except httpx.RequestError as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to provider: {str(e)}")


@app.get("/ai/config")
async def get_ai_config_endpoint():
    config = db_get_user_ai_config()
    if config:
        return {
            "configured": True,
            "provider": config["provider"],
            "model": config["model"]
        }
    return {"configured": False}


@app.post("/ai/config")
@limiter.limit("5/minute")
async def save_ai_config_endpoint(request: Request, config_req: AIConfigRequest):
    if not config_req.provider or not config_req.apiKey or not config_req.model:
        raise HTTPException(status_code=400, detail="Missing required configuration fields")
    
    db_save_user_ai_config(config_req.provider, config_req.apiKey, config_req.model)
    apply_cognee_llm_config()
    return {"status": "ok"}


@app.delete("/ai/config")
async def delete_ai_config_endpoint():
    db_delete_user_ai_config()
    apply_cognee_llm_config()
    return {"status": "ok"}

