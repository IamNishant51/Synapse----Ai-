import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const sessionCookie = request.cookies.get("synapse_session");
  const secret = process.env.SYNAPSE_ACCESS_KEY;

  if (!secret) {
    return NextResponse.json({ authenticated: true });
  }

  const authenticated = sessionCookie?.value === secret;
  return NextResponse.json({ authenticated });
}
