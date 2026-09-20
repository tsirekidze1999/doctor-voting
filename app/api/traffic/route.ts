import { NextResponse } from "next/server";
import { trafficStatus } from "@/src/traffic";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get("clientId");
  if (!clientId || !/^[a-f0-9-]{16,80}$/.test(clientId)) return NextResponse.json({ error: "არასწორი მომხმარებელი" }, { status: 400 });
  return NextResponse.json(trafficStatus(clientId), { headers: { "Cache-Control": "no-store" } });
}
