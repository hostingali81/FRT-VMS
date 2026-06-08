import { NextResponse } from "next/server";
import { syncMonthlyGpsDistance } from "@/lib/gps-distance";

// Node runtime (needs the Millitrack HTTP fetch + admin client); never cache.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily Vercel Cron → monthly GPS distance sync.
 *
 * Secured with CRON_SECRET: Vercel automatically sends
 * `Authorization: Bearer <CRON_SECRET>` to cron paths when the env var is set.
 * Set CRON_SECRET in Vercel project env (any long random string).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncMonthlyGpsDistance();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
