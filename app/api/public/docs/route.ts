import { NextResponse } from "next/server";

// The API reference now lives at /api-docs — a real page with a table of contents
// rather than a route handler that hand-renders HTML. This endpoint stays behind
// as a permanent redirect because its URL is printed inside the docs themselves
// and has already been shared.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return NextResponse.redirect(new URL("/api-docs", request.url), 308);
}
