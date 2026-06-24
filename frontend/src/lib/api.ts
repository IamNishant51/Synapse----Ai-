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
    throw new Error(`API ${res.status}: ${body}`);
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
