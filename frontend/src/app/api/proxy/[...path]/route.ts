import { NextRequest, NextResponse } from "next/server";

async function handleProxy(request: NextRequest, pathArray: string[]) {
  const backendUrl = process.env.NEXT_PUBLIC_COGNEE_API_URL || "http://localhost:8000";
  const path = pathArray.join("/");
  const url = new URL(`${backendUrl}/${path}`);
  url.search = request.nextUrl.search;

  const accessKey = process.env.SYNAPSE_ACCESS_KEY || "";
  
  const headers = new Headers(request.headers);
  headers.set("X-Synapse-Key", accessKey);
  headers.delete("host");

  try {
    const requestBody = request.method !== "GET" && request.method !== "HEAD" 
      ? await request.arrayBuffer() 
      : undefined;

    const res = await fetch(url.toString(), {
      method: request.method,
      headers,
      body: requestBody,
    });

    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: res.status,
      headers: {
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    });
  } catch {
    return NextResponse.json({ error: "Proxy error" }, { status: 500 });
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return handleProxy(request, params.path);
}

export async function POST(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return handleProxy(request, params.path);
}

export async function PUT(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return handleProxy(request, params.path);
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params;
  return handleProxy(request, params.path);
}
