import { NextRequest, NextResponse } from "next/server";

import { getCurrentProfile } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/// 🏠 Gwave Home platform proxy — the ONLY public door to the gwave-home
/// container (127.0.0.1:4000 on the box). Verifies the Cognito session here,
/// then forwards with x-user-id (+ the GH_PROXY_KEY shared secret), so the
/// engine can trust its caller identity without knowing about Cognito.
///   /api/home/devices  →  {HOME_API}/api/devices   (etc.)

const BASE = (process.env.HOME_API_URL ?? "http://172.17.0.1:4000").replace(
  /\/+$/,
  "",
);

async function forward(request: NextRequest, path: string[]) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return NextResponse.json({ error: "Gwave အကောင့်နဲ့ ဝင်ပါ" }, { status: 401 });
  }
  // Only the engine's /api/* surface is reachable — never /health or future
  // admin endpoints by accident.
  const target = `${BASE}/api/${path.map(encodeURIComponent).join("/")}${request.nextUrl.search}`;
  const headers: Record<string, string> = {
    "x-user-id": profile.id,
    "content-type": "application/json",
  };
  const proxyKey = process.env.GH_PROXY_KEY;
  if (proxyKey) headers["x-proxy-key"] = proxyKey;

  try {
    const res = await fetch(target, {
      method: request.method,
      headers,
      body:
        request.method === "GET" || request.method === "HEAD"
          ? undefined
          : await request.text(),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const body = await res.text();
    return new NextResponse(body, {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: "Home platform ကို ချိတ်လို့မရပါ (container မတက်သေးတာ ဖြစ်နိုင်)" },
      { status: 502 },
    );
  }
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  return forward(request, (await ctx.params).path);
}
