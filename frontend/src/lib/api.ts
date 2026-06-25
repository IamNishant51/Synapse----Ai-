import type {
  GraphSnapshot,
  ConflictEvent,
  ChatMessage,
  DecaySettings,
  Source,
  IngestionJob,
  SourceType,
} from "./types";

const API_BASE = "/api/proxy";

function parseAPIError(status: number, body: string): string {
  try {
    const parsed = JSON.parse(body);
    if (parsed.detail) {
      const detail = parsed.detail;
      if (typeof detail === "string" && detail.includes("error") && detail.includes("message")) {
        try {
          const startIdx = detail.indexOf("{");
          if (startIdx !== -1) {
            const nestedJson = detail.substring(startIdx);
            const nestedParsed = JSON.parse(nestedJson);
            if (nestedParsed.error?.message) {
              return nestedParsed.error.message;
            }
          }
        } catch {}
      }
      return detail;
    }
  } catch {}
  
  if (status === 403) {
    return "Access denied.";
  }
  if (status === 401) {
    return "Unauthorized session. Please check your credentials.";
  }
  if (status === 404) {
    return "Requested resource not found.";
  }
  if (status >= 500) {
    return "Server error. Make sure the backend is running correctly.";
  }
  return `Request failed with status ${status}`;
}

async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    const cleanMsg = parseAPIError(res.status, body);
    throw new Error(cleanMsg);
  }
  return res.json();
}

export async function ingestSource(
  type: SourceType,
  content: string,
  label: string,
  url?: string,
  pathFilter?: string,
): Promise<{ jobId: string }> {
  return fetchAPI("/ingest", {
    method: "POST",
    body: JSON.stringify({ type, content, label, url, pathFilter }),
  });
}

export async function getIngestionJob(jobId: string): Promise<IngestionJob> {
  return fetchAPI(`/ingest/${jobId}`);
}

export async function getGraphSnapshot(): Promise<GraphSnapshot> {
  return fetchAPI("/graph-snapshot");
}

export async function forgetNode(nodeId: string): Promise<void> {
  await fetchAPI("/forget/node", {
    method: "POST",
    body: JSON.stringify({ nodeId }),
  });
}

export async function forgetSource(sourceId: string): Promise<void> {
  await fetchAPI("/forget/source", {
    method: "POST",
    body: JSON.stringify({ sourceId }),
  });
}

export async function getConflictEvents(): Promise<ConflictEvent[]> {
  return fetchAPI("/reconciliation/events");
}

export async function resolveConflict(
  eventId: string,
  resolution: "keep_old" | "keep_new" | "keep_both",
  note?: string,
): Promise<void> {
  await fetchAPI("/reconciliation/resolve", {
    method: "POST",
    body: JSON.stringify({ eventId, resolution, note }),
  });
}

export async function answerQuery(query: string, signal?: AbortSignal): Promise<ChatMessage> {
  return fetchAPI("/recall", {
    method: "POST",
    body: JSON.stringify({ query }),
    signal,
  });
}

export async function getAskTopics(): Promise<{ trackedTopics: string[]; timelineTopics: string[] }> {
  return fetchAPI("/topics");
}

export async function runDecayCheck(): Promise<{ forgotten: number; decayed: number }> {
  return fetchAPI("/decay/run", {
    method: "POST",
  });
}

export async function getDecaySettings(): Promise<DecaySettings> {
  return fetchAPI("/decay/settings");
}

export async function updateDecaySettings(settings: DecaySettings): Promise<void> {
  await fetchAPI("/decay/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

export async function getSources(): Promise<Source[]> {
  return fetchAPI("/sources");
}

export async function searchNodes(query: string): Promise<{ id: string; label: string; confidence: number; status: string }[]> {
  return fetchAPI(`/nodes/search?q=${encodeURIComponent(query)}`);
}

export async function summarizeNode(nodeId: string, label: string, sourceProvenance: string): Promise<{ summary: string }> {
  return fetchAPI("/nodes/summarize", {
    method: "POST",
    body: JSON.stringify({ nodeId, label, sourceProvenance }),
  });
}

export async function resetDemoData(): Promise<void> {
  await fetchAPI("/reset-demo", {
    method: "POST",
  });
}

export interface CogneeActivityLog {
  timestamp: string;
  operation: string;
  details: string;
}

export async function getCogneeActivity(): Promise<CogneeActivityLog[]> {
  return fetchAPI("/cognee/activity");
}

export interface AIConfig {
  configured: boolean;
  provider?: string;
  model?: string;
}

export async function getAIConfig(): Promise<AIConfig> {
  return fetchAPI("/ai/config");
}

export async function saveAIConfig(provider: string, apiKey: string, model: string): Promise<{ status: string }> {
  return fetchAPI("/ai/config", {
    method: "POST",
    body: JSON.stringify({ provider, apiKey, model }),
  });
}

export async function deleteAIConfig(): Promise<{ status: string }> {
  return fetchAPI("/ai/config", {
    method: "DELETE",
  });
}

export async function getAIModels(provider: string, key: string): Promise<{ models: string[] }> {
  return fetchAPI(`/ai/models?provider=${encodeURIComponent(provider)}&key=${encodeURIComponent(key)}`);
}


